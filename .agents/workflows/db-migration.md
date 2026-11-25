---
description: Update Firestore schema types, rules, indexes, and storage rules
---
1. Update `backend-api/src/firebase/firestore-types.ts` and `firebase/firestore.rules` + `firebase/firestore.indexes.json` together.
2. Follow `.agents/rules/60-database.md` (zero-trust deny-by-default rules, custom claims verification, immutable `system_logs` hash chain).
3. Update `backend-api/scripts/seed-firebase.ts` if new reference data collections are added.
// turbo
4. Run `npm run test -w backend-api`
5. Deploy updated rules/indexes: `npx --yes firebase-tools deploy --only firestore:rules,firestore:indexes,storage`
