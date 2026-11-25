# system-architecture.md

# 🏗️ System Architecture & Tech Stack

## 1. Technology Stack
تم اختيار التقنيات بناءً على أحدث المعايير لبناء أنظمة قابلة للتوسع (Scalable) وآمنة:

*   **Frontend (Web - Web App for Doctors & Admins):** Next.js, React, Tailwind CSS, Shadcn UI.
*   **Mobile App (Patients, Paramedics, Pharmacists):** Flutter (مع استخدام Provider و Hive أو Supabase SDK).
*   **Backend & API:** Node.js (Express/NestJS) أو Supabase Edge Functions.
*   **Database & Authentication:** Supabase (PostgreSQL) لإدارة قواعد البيانات والمصادقة.
*   **AI Service:** Python (FastAPI/Flask) لتشغيل نماذج الـ Face Recognition.
*   **Hosting & CI/CD:** Vercel (للـ Frontend)، Railway/Render (للـ Backend/AI)، و GitHub Actions للأتمتة.

## 2. High-Level Architecture
النظام يعتمد على بنية **Microservices/Modular Monolith** لسهولة توزيع العمل على فريق من 8 أفراد:

1.  **Client Layer:**
    *   Web Dashboard (للمستشفيات والأطباء).
    *   Mobile Application (للمرضى، الصيادلة، ومسعفي الطوارئ).
2.  **API Gateway / Backend Layer:**
    *   يستقبل الطلبات، يتحقق من الصلاحيات (RBAC)، ويوجهها للخدمة المناسبة.
3.  **AI Microservice:**
    *   خدمة منفصلة (Python) تستقبل الصور، وتقوم بمعالجتها ومطابقتها مع قاعدة البيانات وإرجاع الـ `PatientID`.
4.  **Data Layer (Supabase):**
    *   **Auth:** إدارة تسجيل الدخول والصلاحيات (Role-Based Access Control).
    *   **PostgreSQL:** تخزين السجلات الطبية والروشتات.
    *   **Storage:** تخزين صور الوجوه، الأشعة، والتحاليل بشكل آمن.

## 3. Security Architecture (Cybersecurity)
*   **Data in Transit:** جميع الاتصالات مشفرة عبر HTTPS/TLS.
*   **Data at Rest:** تشفير البيانات الحساسة (التاريخ المرضي) داخل الـ Database باستخدام `pgcrypto` أو على مستوى الـ Backend.
*   **Authentication:** استخدام JWT Tokens (عبر Supabase Auth).
*   **Authorization (RBAC):**
    *   `Admin`: إدارة النظام والمستخدمين.
    *   `Doctor`: قراءة السجل الطبي، إنشاء روشتة (E-Prescription).
    *   `Pharmacist`: قراءة الروشتة فقط، تغيير حالتها إلى "مصروفة".
    *   `Patient`: قراءة السجل الخاص به فقط.
    *   `Paramedic (Emergency)`: قراءة بيانات الطوارئ فقط (الاسم، فصيلة الدم، الحساسية) بعد مطابقة الوجه/البصمة.
