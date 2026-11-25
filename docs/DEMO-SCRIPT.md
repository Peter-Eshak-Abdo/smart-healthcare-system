# SmartHealth — 15-Minute Bilingual Demo Script

1. **Patient Onboarding & 3D ID Card (Mobile - Arabic RTL):**
   - Open SmartHealth Mobile -> Login as patient -> Show 3D holographic Emergency Medical ID Card (`SHEC1.` QR + Blood Type) and offline cache (`/card`).
2. **Generate 15-Minute Doctor Share Code (Mobile):**
   - Tap *اعمل كود مشاركة للدكتور* -> Share 6-digit code + `SH-EG-...` MRN.
3. **Doctor Chart & Live Safety Check + Override (Web - Arabic RTL):**
   - Redeem share code -> Open encounter -> Add interacting drug in `RxBuilder` -> Show critical interaction banner -> Document clinical override (>= 15 chars, >= 3 words) -> Re-auth MFA -> Sign & issue Ed25519 prescription -> Show printable A4 view.
4. **Pharmacist Dispense & Double-Dispense Prevention (Web & Mobile):**
   - Verify `SH1.` token -> Show authentic `RxSeal` -> Acquire lease -> Dispense partial/full items -> Show duplicate submission / expired / cancelled protection.
5. **Paramedic Break-Glass ER & Red-Flag AI Triage:**
   - Trigger AI red-flag phrase (*عندي وجع شديد في صدري*) -> Fullscreen Red-Flag Takeover + 123 call trigger.
   - Switch to Paramedic ER Mode -> Face scan / `SHEC1.` QR -> View strictly closed Emergency Profile + Emergency Contacts -> Close session.
6. **Zero-PHI Admin Governance & SHA-256 Chain Check:**
   - Open Admin `/admin/audit` -> Confirm `auditIntegrityOk` (`SHA-256 Hash Chain Verified`) & `/admin/emergency-review`.
