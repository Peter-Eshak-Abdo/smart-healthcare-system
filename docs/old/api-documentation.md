# api-documentation.md

# 🔌 API Endpoints Structure (REST API)

## 1. Auth & Identification
*   `POST /api/auth/login`: تسجيل الدخول وإرجاع JWT Token.
*   `POST /api/auth/face-login`: تسجيل الدخول باستخدام الوجه (يوجه للـ AI Service).
*   `POST /api/identify/emergency`: رفع صورة وإرجاع الـ Emergency Profile.

## 2. Patients
*   `GET /api/patients/:id`: جلب بيانات المريض (يتطلب صلاحيات Doctor أو Patient نفسه).
*   `GET /api/patients/:id/records`: جلب التاريخ المرضي الكامل (Encrypted).
*   `POST /api/patients/:id/records`: إضافة سجل طبي جديد (صلاحيات Doctor فقط).

## 3. Prescriptions
*   `POST /api/prescriptions`: إنشاء روشتة إلكترونية جديدة.
    *   *Body:* `patient_id`, `items: [{drug_name, dosage, ...}]`
*   `GET /api/prescriptions/patient/:patient_id`: جلب الروشتات الخاصة بمريض.
*   `PATCH /api/prescriptions/:id/dispense`: تغيير حالة الروشتة إلى `Dispensed` (صلاحيات Pharmacist فقط).

## 4. AI & Smart Alerts (Internal API between Backend & AI Service)
*   `POST /ai/verify-face`: استقبال صورة، مقارنتها بالـ Embeddings المخزنة، إرجاع `Match_Status`.
*   `POST /ai/check-drug-interaction`:
    *   *Body:* `current_drugs`, `new_drugs`, `allergies`.
    *   *Response:* `alerts: [{severity, message}]`.
