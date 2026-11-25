/* eslint-disable no-console */
import { loadEnv } from '../src/config/env.js';
import { createFirebaseBundle } from '../src/firebase/firebase-admin.js';
import { COLLECTIONS, type PatientDoc } from '../src/firebase/firestore-types.js';
import { aad, createFieldCipher } from '../src/security/crypto/field-cipher.js';
import { createKeyring } from '../src/security/crypto/keyring.js';

async function main() {
  const env = loadEnv();
  const fb = createFirebaseBundle(env);
  if (!fb.db) {
    throw new Error('Firebase credentials required for crypto:rewrap');
  }
  const keyring = createKeyring(env);
  const cipher = createFieldCipher(keyring);
  const snap = await fb.db.collection(COLLECTIONS.patients).get();
  let rewrapped = 0;

  for (const doc of snap.docs) {
    const p = doc.data() as PatientDoc;
    if (p.id_document_number_enc && !p.id_document_number_enc.startsWith(`v1.${keyring.currentKekId}.`)) {
      const a = aad('patients', 'id_document_number_enc', p.id);
      const plain = cipher.decrypt(p.id_document_number_enc, a);
      const updated = cipher.encrypt(plain, a);
      await doc.ref.update({ id_document_number_enc: updated });
      rewrapped += 1;
    }
  }
  console.log(`Rewrapped ${rewrapped} patient documents to active key ${keyring.currentKekId}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
