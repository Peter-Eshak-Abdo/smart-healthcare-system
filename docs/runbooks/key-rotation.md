# Key Rotation Runbook

1. Generate new keyring entries with `pnpm --filter backend-api tsx scripts/keys-dev.ts` (in production KMS/vault) and add the new `kid` as `DATA_ENC_KEY_ACTIVE_KID` / `RX_SIGN_KEY_ACTIVE_KID` alongside previous public verification keys (`RX_SIGN_PUBLIC_KEYS_JSON`).
2. Re-wrap existing `*_enc` Tier-3 fields using `backend-api/scripts/crypto-rewrap.ts`.
3. If rotating biometric orthogonal transform version `v`, run `ai-service/scripts/rekey_templates.py` inside private maintenance window.
4. Keep old Rx Ed25519 public keys in JWKS until all unexpired prescriptions signed with the prior `kid` have expired or been dispensed.
