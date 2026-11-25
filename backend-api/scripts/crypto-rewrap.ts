import { loadEnv } from '../src/config/env.js';
import { createDbPools } from '../src/db/pool.js';
import { withSystemTx } from '../src/db/with-user-tx.js';
import { aad, createFieldCipher } from '../src/security/crypto/field-cipher.js';
import { createKeyring } from '../src/security/crypto/keyring.js';
import { sql } from 'kysely';

async function main() {
  const env = loadEnv();
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for crypto-rewrap');
  }

  const pools = createDbPools(env.DATABASE_URL);
  const keyring = createKeyring(env);
  const cipher = createFieldCipher(keyring);
  const targetPrefix = `v1.${keyring.currentKekId}.`;

  let rewrapped = 0;
  try {
    await withSystemTx(pools, async (tx) => {
      const patients = await tx
        .selectFrom('app.patients')
        .select(['id', 'id_document_enc'])
        .execute();

      for (const row of patients) {
        if (!row.id_document_enc.startsWith(targetPrefix)) {
          const meta = aad('patients', 'id_document_enc', row.id);
          const plain = cipher.decrypt(row.id_document_enc, meta);
          const next = cipher.encrypt(plain, meta);
          await tx
            .updateTable('app.patients')
            .set({ id_document_enc: next })
            .where('id', '=', row.id)
            .execute();
          rewrapped += 1;
        }
      }

      const contacts = await tx
        .selectFrom('app.emergency_contacts')
        .select(['id', 'full_name_enc', 'phone_enc'])
        .execute();

      for (const c of contacts) {
        let nameEnc = c.full_name_enc;
        let phoneEnc = c.phone_enc;
        let dirty = false;
        if (!nameEnc.startsWith(targetPrefix)) {
          const meta = aad('emergency_contacts', 'full_name_enc', c.id);
          nameEnc = cipher.encrypt(cipher.decrypt(nameEnc, meta), meta);
          dirty = true;
        }
        if (!phoneEnc.startsWith(targetPrefix)) {
          const meta = aad('emergency_contacts', 'phone_enc', c.id);
          phoneEnc = cipher.encrypt(cipher.decrypt(phoneEnc, meta), meta);
          dirty = true;
        }
        if (dirty) {
          await tx
            .updateTable('app.emergency_contacts')
            .set({ full_name_enc: nameEnc, phone_enc: phoneEnc })
            .where('id', '=', c.id)
            .execute();
          rewrapped += 1;
        }
      }

      await sql`select 1`.execute(tx);
    });

    process.stdout.write(`Rewrapped ${rewrapped} encrypted record fields to ${keyring.currentKekId}\n`);
  } finally {
    await pools.close();
  }
}

void main();
