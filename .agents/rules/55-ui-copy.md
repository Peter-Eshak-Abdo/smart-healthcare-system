---
trigger: model_decision
description: Use when adding or changing any user-facing text, error message, notification, or i18n key
---
# Copy protocol
1. Find the key in docs/ui/UI-03-EGYPTIAN-ARABIC-UX-COPY.md. Use its Arabic exactly (Egyptian colloquial) and its English.
2. Missing key → add it to design/copy/strings.yaml AND UI-03 in the same PR, in the matching section, with notes (⚕ clinical / ⚖ legal if applicable). Tag UI/UX (M8) for review.
3. Run `pnpm i18n:sync` to regenerate ar.json, en.json, app_ar.arb, app_en.arb. Never edit the generated files by hand.
4. Error UI switches on the ProblemDetails `code` (UI-03 §3.18), never on HTTP status alone, and never reveals whether a resource exists.
5. ⚕ and ⚖ strings cannot change without the reviewer named in UI-03 §0.
