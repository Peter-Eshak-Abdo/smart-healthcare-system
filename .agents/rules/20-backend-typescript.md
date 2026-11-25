---
trigger: glob
globs: "backend-api/**/*.ts, packages/contracts/**/*.ts"
description: Backend (Express 5 + TS + Zod + Firebase Admin / Firestore) conventions
---
# Backend conventions
- Layering: routes.ts → controller.ts (HTTP↔DTO only) → service.ts (rules, transactions) → firebase/firestore-helpers.ts.
  Controllers never import firebase-admin directly; keep Firestore access isolated in services/modules/helpers.
- Middleware order is fixed (docs/role-03-backend.md §4). Per-route: requirePermission → requireStepUp? → rateLimit? → idempotency? → validate → controller.
- Errors: throw `new AppError('<ErrorCode from 00-INDEX §7>', {...})`; the error handler renders RFC 9457 problem+json. Never `res.status(...).json({error})` ad hoc.
- Firestore transactions: wrap atomic multi-document writes & lock-protected Rx dispensing in `getFirestore().runTransaction(...)` or `nextIdempotencyKey(...)`.
- IDs for rows with *_enc columns are generated in the backend (`randomUUID()`) before insert (AAD needs them).
- Idempotent routes (03 §2.7) use the `idempotency({required:true})` middleware AND persist keys in Redis/Firestore.
- Naming: files kebab-case; types/classes PascalCase; functions/vars camelCase; constants UPPER_SNAKE; DB/JSON fields snake_case.
- JSON API fields are snake_case exactly as in docs/03; convert at the mapper layer only.
- Tests: vitest; unit & security tests run offline with deterministic Firebase/Firestore stubs (`npx vitest run`).
- Logging: pino with the redaction config; log ids and codes, never PHI values.
