'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signOut as fbSignOut,
  type Auth,
  type MultiFactorResolver,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

let pendingResolver: MultiFactorResolver | null = null;

export function setPendingMfaResolver(resolver: MultiFactorResolver | null): void {
  pendingResolver = resolver;
}

export function getPendingMfaResolver(): MultiFactorResolver | null {
  return pendingResolver;
}

export function getFirebaseBrowserApp(): FirebaseApp | null {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    return null;
  }
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseBrowserAuth(): Auth | null {
  const app = getFirebaseBrowserApp();
  return app ? getAuth(app) : null;
}

export async function getFirebaseIdToken(forceRefresh = false): Promise<string | undefined> {
  const auth = getFirebaseBrowserAuth();
  const user = auth?.currentUser;
  if (!user) return undefined;
  return user.getIdToken(forceRefresh);
}

export async function syncFirebaseSessionCookie(idToken: string): Promise<void> {
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
}

export async function signOutFirebaseBrowser(): Promise<void> {
  const auth = getFirebaseBrowserAuth();
  if (auth) {
    await fbSignOut(auth).catch(() => undefined);
  }
  await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => undefined);
}
