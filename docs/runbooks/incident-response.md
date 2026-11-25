# Incident Response Runbook

1. Triage severity (audit tamper detected, suspected credential leak, spoofing spike, or AI outage).
2. On suspected account compromise: suspend user in Admin (`/admin/users`) and revoke Supabase sessions + active grants.
3. On suspected tamper (`audit-integrity` `status: broken`): isolate write traffic immediately, snapshot DB + Redis, preserve logs starting from `broken_at_event_id`.
4. On AI service outage: verify `AiClient` circuit breakers degrade gracefully (`check` -> `unavailable` manual attestation; `assistant` -> deterministic Egyptian/English red-flag fallback).
