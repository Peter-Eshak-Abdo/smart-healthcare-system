import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

function normalizePrivateKey(raw: string): string {
  const trimmed = raw.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;
  return unquoted.replace(/\\n/g, '\n');
}

function getServiceAccount(): ServiceAccount | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const parsed = JSON.parse(json) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: normalizePrivateKey(parsed.private_key),
      };
    }
  }
  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: normalizePrivateKey(privateKey),
    };
  }
  return null;
}

export function getFirebaseServerApp(): App | null {
  if (getApps().length > 0) return getApps()[0] ?? null;
  const sa = getServiceAccount();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!sa && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return null;
  }
  return initializeApp({
    ...(sa ? { credential: cert(sa) } : {}),
    ...(projectId ? { projectId } : {}),
  });
}

export function getFirebaseServerAuth(): Auth | null {
  const app = getFirebaseServerApp();
  return app ? getAuth(app) : null;
}
