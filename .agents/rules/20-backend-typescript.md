---
trigger: glob
globs: "backend-api/**/*.ts, packages/contracts/**/*.ts"
description: Backend (Express 5 + TS + Zod + Kysely) conventions
---
# Backend conventions
- Layering: routes.ts → controller.ts (HTTP↔DTO only) → service.ts (rules, transactions) → repository.ts (Kysely only, receives tx).
  Controllers never import db/; repositories never import express.
- Middleware order is fixed (docs/role-03-backend.md §4). Per-route: requirePermission → requireStepUp? → rateLimit? → idempotency? → validate → controller.
- Errors: throw `new AppError('<ErrorCode from 00-INDEX §7>', {...})`; the error handler renders RFC 9457 problem+json. Never `res.status(...).json({error})` ad hoc.
- SQL: Kysely builder or `sql` tagged templates with parameters. Never string-concatenate SQL. Never `sql.raw` with user input.
- Map Postgres errors via `db/pg-errors.ts` (docs/role-02 §8). Retry once on 40P01/40001.
- IDs for rows with *_enc columns are generated in the backend (`randomUUID()`) before insert (AAD needs them).
- Idempotent routes (03 §2.7) use the `idempotency({required:true})` middleware AND persist the key in the DB unique column.
- Naming: files kebab-case; types/classes PascalCase; functions/vars camelCase; constants UPPER_SNAKE; DB/JSON fields snake_case.
- JSON API fields are snake_case exactly as in docs/03; convert at the mapper layer only.
- Tests: vitest; integration tests hit a real Postgres (Supabase local) with the DB test stub only for plain-Postgres CI.
- Logging: pino with the redaction config; log ids and codes, never values.
