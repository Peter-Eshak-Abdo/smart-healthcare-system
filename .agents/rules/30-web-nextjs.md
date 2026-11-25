---
trigger: glob
globs: "web-admin/**/*.ts, web-admin/**/*.tsx, web-admin/**/*.css"
description: Next.js 16 web portal conventions (doctor, pharmacist, admin)
---
# Web conventions
- Next.js 16 App Router. Use `proxy.ts` (NOT middleware.ts) only for locale + optimistic redirect; real authorization in
  role layouts via `requireRole()` (server) and in the backend.
- Data: Server Components fetch with `cache: 'no-store'` for PHI; client components use TanStack Query with keys from lib/api/query-keys.ts.
  Never copy server data into Zustand. Clear the query cache on logout and patient switch.
- API calls only through the typed openapi-fetch client (`useApi()` / `serverApi()`); never call Firestore collections from the browser.
- Forms: React Hook Form + zod resolvers using schemas from @smarthealth/contracts.
- Styling: Tailwind logical utilities only (ms/me/ps/pe/start/end/text-start/text-end). Banned: ml-, mr-, pl-, pr-, left-, right-, text-left, text-right.
- Colors/spacing from design tokens (CSS variables). No hard-coded hex in components.
- Components in components/<domain>/PascalCase.tsx; shadcn primitives only in components/ui (generated via CLI).
- Severity UI always = icon + text + colour (docs/role-07 §3.2). Blocking alerts use role="alert".
- No dangerouslySetInnerHTML. Render LLM/user text as plain text.
- Every page: loading, empty, error states; ar + en messages (next-intl strict, no missing keys).
