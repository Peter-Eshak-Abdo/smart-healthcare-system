---
trigger: glob
globs: "web-admin/**/*.tsx, web-admin/**/*.ts, web-admin/**/*.css, web-admin/i18n/messages/*.json"
description: SmartHealth UI rules for the Next.js portal (design system, RTL, copy, motion, safety)
---
# Web UI rules (source: docs/ui/UI-01, UI-02, UI-03, UI-05, UI-07)
- Before building a screen, open its spec in docs/ui/UI-05 (screen ID W-…) and its rows in UI-07. Implement EVERY state listed: loading (skeleton after 300 ms), empty, error (ProblemAlert by `code`), offline, forbidden.
- Colours/radii/shadows/fonts ONLY from tokens (app/tokens.css + @theme in globals.css). No hex in components. Themes: data-theme = light | dark | emergency | sunlight on <html> (ER route group forces sunlight).
- RTL first: Tailwind logical utilities only; rtl:rotate-180 on directional icons; drug names, doses, codes, blood type inside <bdi> with class "num" or "code". Doses/quantities are ALWAYS Western digits.
- Copy: every string through next-intl with the exact key from UI-03. Never invent Arabic; if a key is missing, stop and ask (add it to UI-03 first).
- Severity UI = icon + Arabic label + colour (UI-01 §9). contraindicated/major banners use role="alert" and block Sign & Issue until documented; disabled primary buttons always show their reason underneath.
- Glass (.glass utility) only on: TopBar, floating docks. Never behind clinical data, forms, severity banners, QR, emergency/sunlight themes.
- Motion: import durations/easings/springs from lib/motion/tokens.ts (UI-02 §9.1). Wrap the app in <MotionConfig reducedMotion="user">. Clinical numbers never animate. springs.celebrate is forbidden in doctor/pharmacist/admin routes.
- 3D: three/@react-three/* only inside components/three/**, loaded with next/dynamic(ssr:false), never on the Rx builder, dispense or audit routes. Web face scanner = 2D guide unless docs/ui/UI-07 §2.4 is approved.
- Seal/verification visuals are driven ONLY by the verify API result (UI-02 M4). Never show "verified" before the check completes.
- No PHI in URLs, localStorage, IndexedDB, toasts or notification text. Rx-builder draft in sessionStorage = drug IDs + patient ID only.
- Each new screen ships with Playwright screenshots in ar + en, a reducedMotion:'reduce' run, and axe with 0 serious/critical issues.
