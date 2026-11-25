import { sql } from 'kysely';
import { loadEnv } from '../src/config/env.js';
import { createDbPools } from '../src/db/pool.js';
import { withSystemTx } from '../src/db/with-user-tx.js';
import { createFieldCipher, aad } from '../src/security/crypto/field-cipher.js';
import { createKeyring } from '../src/security/crypto/keyring.js';

interface DevSeedUser {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'doctor' | 'pharmacist' | 'paramedic' | 'patient';
  licenseNumber?: string;
  specialtyCode?: string;
  facilityId?: string;
}

const DEV_USERS: DevSeedUser[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    email: 'admin@sh.test',
    fullName: 'System Admin',
    role: 'admin',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    email: 'karim@sh.test',
    fullName: 'Dr. Karim Nabil',
    role: 'doctor',
    licenseNumber: 'EG-MD-123456',
    specialtyCode: 'internal_medicine',
    facilityId: '00000000-0000-4000-8000-00000000f002',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000001',
    email: 'salma@sh.test',
    fullName: 'Dr. Salma El-Masry',
    role: 'pharmacist',
    licenseNumber: 'EG-PH-111',
    facilityId: '00000000-0000-4000-8000-00000000f003',
  },
  {
    id: 'e0000000-0000-4000-8000-000000000001',
    email: 'ahmed@sh.test',
    fullName: 'Ahmed Paramedic',
    role: 'paramedic',
    licenseNumber: 'EG-PM-333',
    facilityId: '00000000-0000-4000-8000-00000000f005',
  },
  {
    id: 'b0000000-0000-4000-8000-000000000001',
    email: 'mona@sh.test',
    fullName: 'Mona Adel',
    role: 'patient',
  },
];

async function main() {
  const env = loadEnv();
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run seed-dev');
  }
  const pools = createDbPools(env.DATABASE_URL);
  const keyring = createKeyring(env);
  const cipher = createFieldCipher(keyring);

  try {
    await withSystemTx(pools, async (tx) => {
      for (const u of DEV_USERS) {
        const appMeta = u.role === 'patient' ? {} : { invited_role: u.role };
        await sql`
          insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
          values (${u.id}::uuid, ${u.email}, ${JSON.stringify(appMeta)}::jsonb, ${JSON.stringify({ full_name: u.fullName })}::jsonb)
          on conflict (id) do nothing
        `.execute(tx);

        await sql`
          update app.profiles
             set role = ${u.role}::app.app_role,
                 status = 'active'::app.account_status,
                 full_name = ${u.fullName}
           where id = ${u.id}::uuid
        `.execute(tx);

        if (u.licenseNumber && u.facilityId && (u.role === 'doctor' || u.role === 'pharmacist' || u.role === 'paramedic')) {
          await sql`
            insert into app.practitioners (
              id, practitioner_type, license_number, license_status, license_expires_at, specialty_code, verified_at
            ) values (
              ${u.id}::uuid,
              ${u.role}::app.app_role,
              ${u.licenseNumber},
              'verified'::app.license_status,
              date '2029-12-31',
              ${u.specialtyCode ?? null},
              now()
            )
            on conflict (id) do nothing
          `.execute(tx);

          await sql`
            insert into app.practitioner_facilities (practitioner_id, facility_id)
            values (${u.id}::uuid, ${u.facilityId}::uuid)
            on conflict do nothing
          `.execute(tx);
        }
      }

      // Ensure Mona has encrypted national_id & onboarding complete for local tests
      const nid = '29001011200018';
      const monaId = 'b0000000-0000-4000-8000-000000000001';
      await sql`
        insert into app.patients (id, id_document_type, id_document_enc, id_document_bidx, date_of_birth, sex, blood_type, blood_type_source)
        values (
          ${monaId}::uuid,
          'national_id',
          ${cipher.encrypt(nid, aad('patients', 'id_document_enc', monaId))},
          ${cipher.blindIndex(`national_id:${nid}`, 'id_document')},
          date '1990-01-01',
          'female'::app.sex,
          'O+'::app.blood_type,
          'patient_reported'::app.data_source
        )
        on conflict (id) do nothing
      `.execute(tx);
    });

    process.stdout.write(`Seeded ${DEV_USERS.length} dev users successfully\n`);
  } finally {
    await pools.close();
  }
}

void main();
