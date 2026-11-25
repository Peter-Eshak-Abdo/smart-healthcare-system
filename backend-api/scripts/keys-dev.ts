import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

function genEd25519OneLinePem(): string {
  const { privateKey } = generateKeyPairSync('ed25519');
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
  return pem.trim().replace(/\r?\n/g, '\\n');
}

function genEd25519PublicOneLinePem(privatePemOneLine: string): string {
  const pem = privatePemOneLine.replace(/\\n/g, '\n');
  const pub = createPublicKey(createPrivateKey(pem));
  return (pub.export({ format: 'pem', type: 'spki' }) as string).trim().replace(/\r?\n/g, '\\n');
}

function main() {
  const backendEnvPath = path.resolve(rootDir, 'backend-api/.env.local');
  const aiEnvPath = path.resolve(rootDir, 'ai-service/.env.local');

  const internalPriv = genEd25519OneLinePem();
  const internalPub = genEd25519PublicOneLinePem(internalPriv);

  const backendLines = [
    '# Auto-generated local development keys (git-ignored)',
    'APP_ENV=local',
    'KEK_CURRENT_ID=k1',
    `KEK_K1=${randomBytes(32).toString('base64')}`,
    `BLIND_INDEX_KEY=${randomBytes(32).toString('base64')}`,
    'RX_SIGNING_KEY_ID=rx-2026-11',
    `RX_SIGNING_PRIVATE_KEY="${genEd25519OneLinePem()}"`,
    'EMERGENCY_CARD_SIGNING_KEY_ID=ec-2026-11',
    `EMERGENCY_CARD_SIGNING_PRIVATE_KEY="${genEd25519OneLinePem()}"`,
    `INTERNAL_JWT_SIGNING_KEY="${internalPriv}"`,
  ];

  const aiLines = [
    '# Auto-generated local development keys (git-ignored)',
    `INTERNAL_JWT_PUBLIC_KEY="${internalPub}"`,
    'FACE_TRANSFORM_VERSION=1',
    `FACE_TRANSFORM_SEED_1=${randomBytes(32).toString('base64')}`,
  ];

  if (!fs.existsSync(backendEnvPath)) {
    fs.writeFileSync(backendEnvPath, `${backendLines.join('\n')}\n`, 'utf8');
    process.stdout.write(`Wrote ${backendEnvPath}\n`);
  } else {
    process.stdout.write(`Skipped existing ${backendEnvPath}\n`);
  }

  if (!fs.existsSync(aiEnvPath)) {
    fs.writeFileSync(aiEnvPath, `${aiLines.join('\n')}\n`, 'utf8');
    process.stdout.write(`Wrote ${aiEnvPath}\n`);
  } else {
    process.stdout.write(`Skipped existing ${aiEnvPath}\n`);
  }
}

main();
