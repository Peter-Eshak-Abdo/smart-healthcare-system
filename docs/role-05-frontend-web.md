# Role 05 — Frontend Web Engineer (Next.js 16 · TypeScript · Tailwind · shadcn/ui)

**Owner:** M6 · **Users:** Doctors, Pharmacists, Admins (and an optional ER desk view, P2)
**Contracts:** `03` (via `@smarthealth/contracts`) · **Design:** `role-07-ui-ux.md` · **Security:** `role-01 §5, §11`

---

## 1. Responsibilities
1. Build `web-admin/` with three portals: **Doctor**, **Pharmacist**, **Admin**.
2. Implement auth (Supabase SSR cookies), TOTP MFA enrolment/verification, role routing, re-auth for sensitive actions.
3. Implement the components specified in §7 against the API contracts, in Arabic (RTL) and English (LTR).
4. Implement security headers/CSP, session-timeout UX and print views (paper prescription summary).
5. Write Playwright E2E tests for the P0/P1 web stories.

## 2. Stack

| Concern | Choice |
|---------|--------|
| Framework | Next.js 16 (App Router, React 19, Server Components) |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix primitives) + `lucide-react` icons |
| i18n | `next-intl` with `[locale]` segment (`ar` default, `en`) |
| Auth | `@supabase/ssr` (cookie session), `@supabase/supabase-js` (MFA APIs) |
| API client | `openapi-fetch` typed from `packages/contracts/openapi/smarthealth.v1.yaml` (`openapi-typescript`) |
| Server state | TanStack Query v5 (client components); direct `fetch` in Server Components |
| Forms | React Hook Form + `@hookform/resolvers/zod` with schemas from `@smarthealth/contracts` |
| Local UI state | Zustand (only for the prescription builder draft and UI prefs) |
| Tables | TanStack Table + shadcn `DataTable` |
| QR scanning | `BarcodeDetector` API where available, else `@zxing/browser` |
| Testing | Vitest + Testing Library (components), Playwright (E2E), axe-core (a11y) |

## 3. Folder Structure

```text
web-admin/
├── next.config.ts                      # headers() with CSP, typedRoutes, output: 'standalone'
├── proxy.ts                            # Next.js 16 proxy: locale + optimistic auth redirect ONLY
├── i18n/
│   ├── routing.ts  request.ts
│   └── messages/ { ar.json, en.json }
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx                  # <html dir> from locale, fonts, providers
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── mfa/enroll/page.tsx
│   │   │   ├── mfa/verify/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── (doctor)/doctor/
│   │   │   ├── layout.tsx              # requireRole('doctor') server guard + DoctorShell
│   │   │   ├── page.tsx                # Doctor Dashboard (§7.1)
│   │   │   ├── patients/page.tsx       # search among granted patients
│   │   │   ├── access/redeem/page.tsx  # enter MRN + share code
│   │   │   ├── patients/[patientId]/
│   │   │   │   ├── layout.tsx          # PatientHeader (critical banner)
│   │   │   │   ├── page.tsx            # Summary tab
│   │   │   │   ├── history/page.tsx
│   │   │   │   ├── encounters/[encounterId]/page.tsx
│   │   │   │   └── prescribe/page.tsx  # Prescription Builder (§7.3)
│   │   │   └── prescriptions/page.tsx
│   │   ├── (pharmacist)/pharmacy/
│   │   │   ├── layout.tsx              # requireRole('pharmacist') + pharmacy selector
│   │   │   ├── page.tsx                # Verification Portal (§7.4)
│   │   │   ├── prescriptions/[id]/page.tsx   # Dispense screen
│   │   │   └── history/page.tsx
│   │   ├── (admin)/admin/
│   │   │   ├── layout.tsx              # requireRole('admin')
│   │   │   ├── page.tsx                # KPIs
│   │   │   ├── users/page.tsx  users/[id]/page.tsx  users/invite/page.tsx
│   │   │   ├── practitioners/[id]/license/page.tsx
│   │   │   ├── facilities/page.tsx
│   │   │   ├── audit/page.tsx
│   │   │   ├── emergency-review/page.tsx
│   │   │   └── security-flags/page.tsx
│   │   ├── print/prescriptions/[id]/page.tsx  # print-only paper summary
│   │   └── not-authorized/page.tsx
│   └── api/                            # NOT used for business logic (SD-07). Only /api/health for the platform.
├── components/
│   ├── ui/                             # shadcn generated (do not edit by hand except via shadcn CLI)
│   ├── shell/ { AppShell, Sidebar, TopBar, LocaleSwitch, SessionTimeoutDialog }
│   ├── patient/ { PatientHeader, CriticalInfoBanner, AllergyChip, HistoryTimeline, RestrictedPlaceholder }
│   ├── prescription/ { RxBuilder, DrugSearchCombobox, RxItemRow, SafetyAlertBanner, AlertList,
│   │                    OverrideDialog, ManualReviewAttestation, SignAndIssueBar, RxSummaryCard }
│   ├── pharmacy/ { QrScanner, ManualRxEntry, PresenceStep, VerificationResult, DispenseTable, LeaseBanner }
│   ├── admin/ { UsersTable, InviteForm, LicensePanel, AuditTable, AuditFilters, ChainIntegrityBadge,
│   │            EmergencyReviewCard, KpiTiles }
│   └── common/ { ProblemAlert, EmptyState, ConfirmDialog, Countdown, MaskedText }
├── lib/
│   ├── supabase/ { server.ts, client.ts }
│   ├── api/ { client.ts, server.ts, errors.ts, query-keys.ts }
│   ├── auth/ { require-role.ts, reauth.ts, session.ts }
│   ├── hooks/ { useDebouncedSafetyCheck.ts, useIdempotencyKey.ts, useCountdown.ts }
│   └── format/ { date.ts, numbers.ts }
├── stores/ { rx-builder.store.ts }
└── tests/ { e2e/*.spec.ts, components/*.test.tsx }
```

## 4. Authentication, Guards & Sessions

### 4.1 Layers of protection

| Layer | What it does | Trust level |
|-------|--------------|------------|
| `proxy.ts` | Locale negotiation; if no Supabase session cookie → redirect to `/[locale]/login` | **Optimistic only**: never the only check |
| `(role)/layout.tsx` (Server Component) | `requireRole('doctor')`: reads the session server-side, calls `GET /v1/me`, checks `role`, `status`, `mfa.aal === 'aal2'`, licence. Otherwise redirects to `not-authorized`, `mfa/verify`, or `login` | Authoritative for **rendering** |
| backend-api | Enforces everything again | Authoritative for **data** |

```ts
// lib/auth/require-role.ts
export async function requireRole(role: AppRole) {
  const supabase = await createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');
  const me = await serverApi(session.access_token).GET('/v1/me');
  if (me.error?.code === 'AUTH_MFA_REQUIRED' || me.data?.mfa.aal !== 'aal2') redirect('/mfa/verify');
  if (me.error || me.data.role !== role || me.data.status !== 'active') redirect('/not-authorized');
  if (role !== 'admin' && me.data.practitioner?.license_status !== 'verified') redirect('/not-authorized?reason=license');
  return me.data;
}
```

### 4.2 MFA
- First staff login → `mfa/enroll`: `supabase.auth.mfa.enroll({ factorType: 'totp' })` → show QR + secret → verify a code → `aal2`.
- Later logins → `mfa/verify` (`challengeAndVerify`).
- **Re-auth for sensitive actions** (Sign & Issue when `auth_time` > 15 min, admin licence/role/status changes when > 5 min): `ReauthDialog` asks for a TOTP code → `challengeAndVerify` refreshes `auth_time` → retries the action. Triggered automatically when the API returns `AUTH_STEP_UP_REQUIRED` (detail `reauth_totp`).

### 4.3 Session timeout
Inactivity 15 min (doctor/pharmacist), 10 min (admin). `SessionTimeoutDialog` warns 60 s before, then signs out and clears the Query cache and Zustand stores. Never persist PHI in `localStorage`/`IndexedDB`. The only exception is the Rx-builder draft in `sessionStorage` (drug IDs only, see E-NET-06), which is cleared on logout.

## 5. API Client

```ts
// lib/api/client.ts (client components)
import createClient from 'openapi-fetch';
import type { paths } from '@smarthealth/contracts/openapi';
export function useApi() {
  const supabase = useSupabaseBrowser();
  return useMemo(() => {
    const client = createClient<paths>({ baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL });
    client.use({
      async onRequest({ request }) {
        const { data } = await supabase.auth.getSession();     // auto-refreshing session
        request.headers.set('Authorization', `Bearer ${data.session?.access_token ?? ''}`);
        request.headers.set('X-Client', `web/${APP_VERSION}`);
        request.headers.set('Accept-Language', currentLocale());
        request.headers.set('X-Request-Id', crypto.randomUUID());
        return request;
      },
      async onResponse({ response }) {
        if (response.status === 401) await handleUnauthorized(response);   // refresh once, else logout
        return response;
      },
    });
    return client;
  }, [supabase]);
}
```

- Errors are `ProblemDetails`. `lib/api/errors.ts` maps `code` → localised UI message + behaviour (e.g. `ACCESS_GRANT_REQUIRED` → toast + redirect to patient search, per US-20-AC3).
- Query keys: `['patient', id, 'summary']`, `['patient', id, 'history', filters]`, `['rx', id]`, `['pharmacy','verification', verificationId]`, `['admin','audit', filters]`.
- `staleTime: 0` for PHI queries, `gcTime: 5 min`. Call `queryClient.clear()` on logout and on patient switch.
- Server Components fetch with `cache: 'no-store'`. PHI pages export `dynamic = 'force-dynamic'`.

## 6. State Management Rules
- **Server state** → TanStack Query (or Server Components). Never copy it into Zustand.
- **Prescription builder draft** → `rx-builder.store.ts` (Zustand), keyed by `patientId`. Shape:
  `{ items: DraftItem[], overrides: Record<alertKey, OverrideDraft>, manualReviewAttested: boolean, idempotencyKey: string }`.
- **Idempotency keys**: `useIdempotencyKey(scope)` creates a UUID when a mutation is first attempted and reuses it for retries until success, a definitive 4xx, or a form reset.

## 7. Component Specifications

### 7.1 Doctor Dashboard (`/doctor`)
**Purpose:** today's work at a glance and fast access to patients.

| Region | Content | Data |
|--------|---------|------|
| Top bar | Patient search (MRN / national ID; shows only granted patients), "Redeem share code" button, locale switch, profile menu | `GET /v1/doctor/patients?query=` (debounced 300 ms, min 4 chars) |
| KPI row | Active grants count, prescriptions issued today, overrides this week (self) | `GET /v1/doctor/prescriptions?…` aggregates (client-side) |
| Recent patients | Last 10 patients opened (from `GET /v1/doctor/patients` ordered by last grant/encounter) | |
| Expiring grants | Grants expiring in < 3 days with "Ask patient to renew" hint | |

States: loading skeletons, empty state ("No patients yet. Ask the patient for a share code."), error `ProblemAlert`.

### 7.2 Patient Medical Profile (doctor view: `/doctor/patients/[patientId]`)

**`PatientHeader`** (sticky, every tab):
- Name, age, sex, MRN, grant expiry badge.
- **`CriticalInfoBanner`**: blood type chip (with "Self-reported" warning style if not confirmed); allergies as chips coloured by severity (`anaphylaxis` = solid danger + icon; uncoded = outlined warning with text); chronic conditions; "Current meds (n)" popover.
- If `restricted_record_count > 0`: an info chip "1 restricted record (hidden by patient)".

**Tabs:** `Summary` · `History` · `New encounter` · `Prescribe`.
- **Summary:** recent encounters, active prescriptions, problem list with "Add condition", allergies with "Confirm / Refute / Code" actions (patient-reported ones show a "Verify" CTA).
- **History:** `HistoryTimeline`, virtualised, filter chips (visits/diagnoses/meds), `RestrictedPlaceholder` rows.
- **Encounter page:** chief complaint, internal notes (doctor-only, labelled), patient summary (patient-visible, labelled), diagnoses (ICD-10 combobox with AR/EN titles, one primary), addenda list. Edit lock after 24 h → "Add addendum". `If-Match` version handling: a 409 shows a "Record changed — reload and reapply" dialog with a diff.

### 7.3 Dynamic E-Prescription Builder (`/doctor/patients/[patientId]/prescribe`)

**Layout (desktop ≥ 1280 px):** left 2/3 = item list; right 1/3 = sticky `AlertList` panel; bottom sticky `SignAndIssueBar`.

**`RxItemRow` fields:** `DrugSearchCombobox` (searches `/v1/ref/drugs`, shows brand + generic + strength + "Controlled" badge), dose (text, presets per dosage form), route (select, defaulted from drug), frequency (select; `every_x_hours` reveals hours input), duration days, quantity (auto-computed suggestion = dose units × frequency × days, editable, unit = drug `base_unit`), instructions, substitution toggle (disabled + off for controlled).

**Live safety check (`useDebouncedSafetyCheck`)**
```ts
// Re-checks whenever the set of drug_ids changes (not on dose edits): 400 ms debounce, aborts stale requests.
const drugKey = items.map(i => i.drug_id).filter(Boolean).sort().join(',');
const q = useQuery({
  queryKey: ['rx-check', patientId, drugKey],
  queryFn: ({ signal }) => api.POST('/v1/prescriptions/check', { body: { patient_id: patientId, items }, signal }),
  enabled: drugKey.length > 0,
  placeholderData: keepPreviousData,
});
```

**`SafetyAlertBanner` behaviour**

| Severity | Visual | Blocking? | Inline on item row |
|----------|--------|-----------|--------------------|
| `contraindicated` | Red banner, icon `OctagonX`, title + message + management, "Document override" button | Yes, until an override is documented | Red left border + icon |
| `major` | Orange banner, `TriangleAlert`, "Document override" | Yes | Orange border |
| `moderate` | Yellow banner, collapsible | No | Yellow dot |
| `minor` | Grouped single line "3 minor notes" | No | — |
| `checks_status = unavailable` | Grey banner "Automated safety check unavailable — review manually" + `ManualReviewAttestation` checkbox | Yes until attested | — |
| `checks_status = partial` | Info banner listing unmapped drugs | No | — |

Each banner shows `source` attribution and "Previously reviewed by … on …" when applicable. When an alert involves a current medication from a restricted record, the text reads "an active medication from a restricted record".

**`OverrideDialog`:** reason code (radio, required), justification textarea (≥ 15 chars, ≥ 3 words, live counter), an acknowledgement checkbox "I take clinical responsibility", Save. Overrides are stored in the store by `alert_key`. If an alert disappears (drug removed), its override is dropped.

**`SignAndIssueBar`:** summary (n items, blocking alerts remaining), *Preview* (read-only summary modal), *Sign & Issue* (disabled while any blocking alert lacks an override or a check is in flight). On click: `POST /v1/prescriptions` with `Idempotency-Key`. On `AUTH_STEP_UP_REQUIRED` → `ReauthDialog` → auto-retry with the same key. On `RX_ALERT_OVERRIDE_REQUIRED` → highlight the new alerts (the server found something new, E-CLIN-03). On success → `RxSummaryCard` with Rx number, the **paper verification code** (shown once, with "Print for patient"), and a link to the print view.

**Accessibility:** banners use `role="alert"` for blocking severities and `role="status"` otherwise. Focus moves to the first blocking alert when *Sign & Issue* is pressed while blocked.

### 7.4 Pharmacist Verification Portal (`/pharmacy`)

**Step 1, Identify prescription:**
- Tab **Scan QR**: `QrScanner` (webcam; permission prompt; torch toggle when supported). It decodes `SH1.` tokens and verifies the JWS signature **locally first** with the cached `/v1/.well-known/rx-jwks.json`. An invalid signature → red "Do NOT dispense" screen immediately, without a network round trip. Then `POST /v1/pharmacy/prescriptions/verify`.
- Tab **Rx number + code**: `ManualRxEntry` (Rx number mask `RX-____-______`, 6-char code). Then `PresenceStep`: *Send SMS code to patient* (masked phone shown, OTP input) or *Verify face* (webcam capture of 3 frames following the challenge; staff device, not the patient's).

**Step 2, `VerificationResult`:**

| `result` | Visual | Actions |
|----------|--------|---------|
| `valid` | Green header "Authentic prescription", prescriber name, licence no., facility, issued/expiry | Continue to dispense |
| `already_dispensed` | Grey "Already dispensed on <date> at <pharmacy>" | None |
| `expired` / `cancelled` | Grey with reason | None |
| `prescriber_invalid` | Red "Prescriber licence invalid — contact the patient's doctor" | None |
| `RX_SIGNATURE_INVALID` (422) | Full-screen red "FAILED AUTHENTICITY CHECK — Do NOT dispense" | Report button |

Shows the **minimum necessary** patient info: name, age, sex, allergies.

**Step 3, Dispense (`/pharmacy/prescriptions/[id]`):** `LeaseBanner` (takes the soft lease; if `RX_LEASE_HELD` → "Being prepared at another pharmacy" + *Proceed anyway*). `DispenseTable` columns: drug (brand/generic/strength), prescribed, already dispensed (with pharmacy), remaining, **dispense now** (number input, max = remaining, default = remaining), substitute (enabled only if allowed; combobox of equivalent drugs), batch no., expiry. Footer: counselling checkbox, notes, *Dispense* (idempotent). Partial dispensing is natural: set some rows to 0. The context countdown (15 min) is visible; when it expires, require re-verify.

Error handling: `RX_QUANTITY_EXCEEDED` → refresh rows and highlight the changed remaining values ("Another pharmacy just dispensed part of this prescription"). `RX_ALREADY_DISPENSED` → result screen.

**Offline:** `navigator.onLine === false` → banner "Offline: you can check authenticity but cannot dispense" and the Dispense button is disabled (SD-06).

### 7.5 Admin RBAC & Audit Panel (`/admin`)

- **KPIs:** `GET /v1/admin/metrics` tiles (+ override rate per doctor table).
- **Users:** DataTable (filters: role, status, search), row actions: *Suspend/Reactivate* (reason required, re-auth ≤ 5 min), *Change role* (two-person approval for admin; shows "Pending approval" state), *View licence*.
- **Invite staff:** form (email, name, role, licence no./authority/expiry, specialty for doctors, facilities multi-select).
- **Licence panel:** current status timeline, actions *Verify / Suspend / Revoke* with reason. *Revoke* shows a warning: "N open prescriptions will become invalid."
- **Facilities:** CRUD + members.
- **Audit:** `AuditFilters` (actor, action multi-select from the catalogue, patient MRN, outcome, date range) → `AuditTable` (virtualised; columns: time, actor, role, action, resource, patient MRN last 4, outcome, IP), *Export CSV*. `ChainIntegrityBadge` from `/v1/admin/audit-integrity`: green "Verified <time>", or red "Broken at #N".
- **Emergency review queue:** cards with paramedic, facility, method, low-confidence flag, score band, reason, incident ref, map pin (if location). Actions: Appropriate / Inappropriate + note.
- **Security flags:** list of `security_flag` users (spoof attempts, rate-limit abuse) with links to their audit trail.

Admins never see clinical data. No admin route calls patient clinical endpoints.

### 7.6 Print view (`/print/prescriptions/[id]`)
A4, monochrome-friendly. Contents: platform header, Rx number (large), prescriber name/licence/facility, patient name/age/MRN, items table, issue/expiry dates, **verification code** box, QR of the Rx number (not the pickup token), and the footer "Verify at any SmartHealth pharmacy. This paper alone is not sufficient: the pharmacist will confirm your identity." CSS `@media print`; no navigation chrome.

## 8. Internationalisation & RTL
- `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`.
- Tailwind **logical** utilities only: `ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`, `text-start`/`text-end`. Lint rule bans `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`.
- Icons with direction (chevrons, arrows) use `rtl:rotate-180`.
- Numbers: Western digits by default; a user setting allows Eastern-Arabic digits (`Intl.NumberFormat('ar-EG')`). Drug strengths and doses always stay in Western digits to avoid dosing confusion.
- Dates: `Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' })`.
- Mixed-direction strings (drug names inside Arabic text) are wrapped in `<bdi>`.

## 9. Security (web-specific)
- **Headers** (`next.config.ts headers()`): `Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{n}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' {API} {SUPABASE}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`; `Strict-Transport-Security`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.
- No `dangerouslySetInnerHTML`. All user and LLM text renders as text.
- Camera streams are stopped (`track.stop()`) when leaving the scanner or face-capture components.
- PHI pages set `Cache-Control: no-store` (Next headers) and are excluded from any service worker.

## 10. Testing

| Type | Scope | Examples |
|------|-------|----------|
| Component | Vitest + Testing Library | `SafetyAlertBanner` severities; `OverrideDialog` validation; `DispenseTable` max/remaining; RTL snapshot of `PatientHeader` |
| E2E | Playwright against staging/seeded local | `US-08` issue with override flow; `US-10/12` verify + partial dispense; `US-21` invite → verify licence → doctor logs in with TOTP (test TOTP secret from seed); `E-RX-02` two browser contexts dispensing simultaneously (one sees `RX_QUANTITY_EXCEEDED`) |
| Accessibility | `@axe-core/playwright` on every page | 0 serious/critical violations |
| Visual | Playwright screenshots `ar` + `en` for key screens | Reviewed by UI/UX |

## 11. Handoff Contracts

| To | You provide | You need |
|----|-------------|----------|
| UI/UX | Implemented screens for review, Storybook (optional) | Figma frames + tokens (role-07) |
| Backend | Bug reports with `X-Request-Id`, missing-field requests via contract PRs | Staging API, seeded accounts, OpenAPI |
| Security | CSP, auth flows for review | Approval |
| QA | Playwright suite | Edge-case results |

## 12. Definition of Done (Role 05)
- [ ] All routes guarded server-side; manual BFLA test (patient token in web) → `not-authorized`.
- [ ] Prescription builder: live alerts ≤ 1 s p95 after a drug change; override and attestation flows complete; idempotent issue verified (double click = one prescription).
- [ ] Pharmacist portal: QR + manual + SMS/face presence paths; partial dispense; race UX; offline disable.
- [ ] Admin: invite, licence, suspend (re-auth), audit search/export, chain badge, emergency review.
- [ ] `ar` and `en` complete (no missing keys: `next-intl` strict mode), RTL lint passes.
- [ ] Playwright P0/P1 suite green; axe clean; Lighthouse accessibility ≥ 95 on main pages.
