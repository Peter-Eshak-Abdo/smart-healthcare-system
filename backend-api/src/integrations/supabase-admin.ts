import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppEnv } from '../config/env.js';

export interface SupabaseAdminPort {
  inviteStaffUser(input: {
    email: string;
    fullName: string;
    role: string;
  }): Promise<{ id: string }>;
  signOutUserGlobal(userId: string): Promise<void>;
  getUserEmailAndMfa(userId: string): Promise<{
    email: string | null;
    phone: string | null;
    mfaEnrolled: boolean;
  }>;
  requestPhoneChange(userId: string, phone: string): Promise<void>;
}

export function createSupabaseAdmin(env: AppEnv): SupabaseAdminPort {
  let client: SupabaseClient | null = null;
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const requireClient = (): SupabaseClient => {
    if (!client) {
      throw new Error('Supabase admin credentials (SUPABASE_URL / SUPABASE_SECRET_KEY) are not configured');
    }
    return client;
  };

  return {
    async inviteStaffUser({ email, fullName, role }) {
      const sb = requireClient();
      const { data, error } = await sb.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
      });
      if (error || !data.user) {
        throw error ?? new Error('Failed to invite user');
      }
      await sb.auth.admin.updateUserById(data.user.id, {
        app_metadata: { invited_role: role },
      });
      return { id: data.user.id };
    },

    async signOutUserGlobal(userId: string) {
      if (!client) return;
      await client.auth.admin.signOut(userId, 'global');
    },

    async getUserEmailAndMfa(userId: string) {
      if (!client) {
        return { email: null, phone: null, mfaEnrolled: false };
      }
      const { data, error } = await client.auth.admin.getUserById(userId);
      if (error || !data.user) {
        return { email: null, phone: null, mfaEnrolled: false };
      }
      const factors = data.user.factors ?? [];
      const verifiedTotp = factors.some(
        (f) => f.factor_type === 'totp' && f.status === 'verified',
      );
      return {
        email: data.user.email ?? null,
        phone: data.user.phone ?? null,
        mfaEnrolled: verifiedTotp,
      };
    },

    async requestPhoneChange(userId: string, phone: string) {
      const sb = requireClient();
      const { error } = await sb.auth.admin.updateUserById(userId, {
        phone,
        phone_confirm: false,
      });
      if (error) throw error;
    },
  };
}
