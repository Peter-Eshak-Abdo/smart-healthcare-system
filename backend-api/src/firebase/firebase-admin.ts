import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import type { AppEnv } from '../config/env.js';

export interface FirebaseAccountSummary {
  email: string | null;
  phone: string | null;
  mfaEnrolled: boolean;
}

export interface FirebaseCustomClaims {
  role?: string;
  status?: string;
  licenseStatus?: string | null;
  facilityId?: string | null;
  session_epoch?: number;
}

export interface FirebaseAdminPort {
  inviteStaffUser(input: {
    email: string;
    fullName: string;
    role: string;
    licenseStatus?: string;
    facilityId?: string | null;
  }): Promise<{ id: string }>;
  setCustomClaims(userId: string, claims: FirebaseCustomClaims): Promise<void>;
  signOutUserGlobal(userId: string): Promise<void>;
  getUserEmailAndMfa(userId: string): Promise<FirebaseAccountSummary>;
  requestPhoneChange(userId: string, phone: string): Promise<void>;
  verifyIdToken(token: string, checkRevoked?: boolean): Promise<DecodedIdToken>;
}

export interface FirebaseBundle {
  app: App | null;
  auth: Auth | null;
  db: Firestore | null;
  storage: Storage | null;
  adminPort: FirebaseAdminPort;
}

function normalizePemKey(raw: string): string {
  let cleaned = raw.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r/g, '');
}

function parseServiceAccount(env: AppEnv): ServiceAccount | null {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: normalizePemKey(parsed.private_key),
      };
    }
  }
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePemKey(env.FIREBASE_PRIVATE_KEY),
    };
  }
  return null;
}

export function createFirebaseBundle(env: AppEnv): FirebaseBundle {
  const serviceAccount = parseServiceAccount(env);
  const usingEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST,
  );

  let app: App | null = null;
  if (serviceAccount || (usingEmulator && env.FIREBASE_PROJECT_ID)) {
    const existing = getApps()[0];
    app =
      existing ??
      initializeApp({
        ...(serviceAccount ? { credential: cert(serviceAccount) } : {}),
        ...(env.FIREBASE_PROJECT_ID ? { projectId: env.FIREBASE_PROJECT_ID } : {}),
        ...(env.FIREBASE_STORAGE_BUCKET ? { storageBucket: env.FIREBASE_STORAGE_BUCKET } : {}),
      });
  }

  const auth = app ? getAuth(app) : null;
  const db = app ? getFirestore(app) : null;
  if (db) {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // ignore if already initialized
    }
  }
  const storage = app ? getStorage(app) : null;

  const requireAuth = (): Auth => {
    if (!auth) {
      throw new Error(
        'Firebase Admin credentials (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY) are not configured',
      );
    }
    return auth;
  };

  const adminPort: FirebaseAdminPort = {
    async inviteStaffUser({ email, fullName, role, licenseStatus, facilityId }) {
      const fbAuth = requireAuth();
      const user = await fbAuth.createUser({
        email,
        displayName: fullName,
        emailVerified: false,
      });
      await fbAuth.setCustomUserClaims(user.uid, {
        role,
        status: 'active',
        licenseStatus: licenseStatus ?? 'pending',
        facilityId: facilityId ?? null,
        session_epoch: 0,
      });
      return { id: user.uid };
    },

    async setCustomClaims(userId, claims) {
      if (!auth) return;
      const current = await auth.getUser(userId);
      await auth.setCustomUserClaims(userId, {
        ...(current.customClaims ?? {}),
        ...claims,
      });
    },

    async signOutUserGlobal(userId) {
      if (!auth) return;
      await auth.revokeRefreshTokens(userId);
    },

    async getUserEmailAndMfa(userId) {
      if (!auth) {
        return { email: null, phone: null, mfaEnrolled: false };
      }
      try {
        const user = await auth.getUser(userId);
        const factors = user.multiFactor?.enrolledFactors ?? [];
        return {
          email: user.email ?? null,
          phone: user.phoneNumber ?? null,
          mfaEnrolled: factors.length > 0,
        };
      } catch {
        return { email: null, phone: null, mfaEnrolled: false };
      }
    },

    async requestPhoneChange(userId, phone) {
      const fbAuth = requireAuth();
      await fbAuth.updateUser(userId, { phoneNumber: phone });
    },

    async verifyIdToken(token, checkRevoked = true) {
      const fbAuth = requireAuth();
      return fbAuth.verifyIdToken(token, checkRevoked);
    },
  };

  return { app, auth, db, storage, adminPort };
}
