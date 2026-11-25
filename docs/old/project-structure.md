# project-structure.md

# 📂 Project Directory Structure

نظام Monorepo أو Multi-repo يضم الواجهة الأمامية، الخلفية، الموبايل، والذكاء الاصطناعي.

```text
smart-health-system/
│
├── 📱 mobile-app/               # Flutter Project (Patients, Paramedics, Pharmacists)
│   ├── lib/
│   │   ├── main.dart
│   │   ├── core/                # Themes, Constants, Utils, Supabase config
│   │   ├── features/            # Feature-based architecture
│   │   │   ├── auth/            # Login, Face ID setup
│   │   │   ├── emergency/       # Paramedic face scan & emergency profile
│   │   │   ├── prescription/    # E-Prescription view & dispensing
│   │   │   └── profile/         # Medical history
│   │   └── shared/              # Reusable widgets
│   └── pubspec.yaml
│
├── 💻 web-admin/                # Next.js, Tailwind CSS, Shadcn UI (Doctors, Admins)
│   ├── app/                     # App Router
│   │   ├── (auth)/              # Login pages
│   │   ├── dashboard/           # Admin stats
│   │   ├── doctor/              # Doctor workspace (Patients list, create prescription)
│   │   └── api/                 # Next.js API Routes (if not using separate backend)
│   ├── components/
│   │   ├── ui/                  # Shadcn UI components
│   │   └── shared/              # Custom components (e.g., PatientCard, PrescriptionForm)
│   ├── lib/                     # Supabase client, utils
│   └── tailwind.config.js
│
├── ⚙️ backend-api/              # Node.js (Express/NestJS) - Core API & Logic
│   ├── src/
│   │   ├── config/              # DB, Env, AI Service URLs
│   │   ├── controllers/         # Request handlers
│   │   ├── middlewares/         # RBAC, JWT Auth, Error Handling
│   │   ├── models/              # DB Schemas / Supabase queries
│   │   ├── routes/              # API endpoints definitions
│   │   └── services/            # Business logic (Encryption, Validation)
│   └── package.json
│
└── 🤖 ai-service/               # Python (FastAPI) - Face Recognition & Drug Logic
    ├── main.py                  # API entry point
    ├── models/
    │   └── face_model.pt        # Pre-trained/Fine-tuned weights
    ├── routers/
    │   ├── face_auth.py         # Face scanning endpoints
    │   └── smart_alerts.py      # Drug interaction logic
    ├── utils/
    │   └── image_processing.py  # Image normalization
    └── requirements.txt
