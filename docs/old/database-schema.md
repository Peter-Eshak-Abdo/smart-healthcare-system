# database-schema.md

# 🗄️ Database Schema (PostgreSQL / Supabase)

## Tables & Relationships

### 1. `Users` (الجدول الأساسي لجميع الحسابات)
- `id`: UUID (Primary Key, Supabase Auth ID)
- `email`: String (Unique)
- `password_hash`: String (Managed by Auth)
- `role`: Enum ('patient', 'doctor', 'pharmacist', 'admin', 'paramedic')
- `full_name`: String
- `phone_number`: String
- `created_at`: Timestamp

### 2. `Patients` (يمتد من Users)
- `patient_id`: UUID (Primary Key, FK -> Users.id)
- `national_id`: String (Unique)
- `date_of_birth`: Date
- `gender`: Enum ('male', 'female')
- `blood_type`: Enum ('A+', 'O-', etc.)
- `face_encoding`: Vector/Array (لتخزين بيانات الوجه للـ AI)
- `emergency_contact`: String
- `allergies`: Text (Encrypted)
- `chronic_diseases`: Text (Encrypted)

### 3. `Doctors`
- `doctor_id`: UUID (Primary Key, FK -> Users.id)
- `specialization`: String
- `license_number`: String (Unique)
- `hospital_id`: UUID (FK -> Hospitals.id)

### 4. `Medical_Records` (السجل الطبي العام)
- `record_id`: UUID (Primary Key)
- `patient_id`: UUID (FK -> Patients.patient_id)
- `doctor_id`: UUID (FK -> Doctors.doctor_id)
- `diagnosis`: Text (Encrypted)
- `notes`: Text (Encrypted)
- `created_at`: Timestamp

### 5. `Prescriptions` (الروشتات)
- `prescription_id`: UUID (Primary Key)
- `patient_id`: UUID (FK -> Patients.patient_id)
- `doctor_id`: UUID (FK -> Doctors.doctor_id)
- `status`: Enum ('pending', 'dispensed', 'cancelled')
- `created_at`: Timestamp
- `dispensed_by`: UUID (FK -> Users.id - Pharmacist)
- `dispensed_at`: Timestamp (Nullable)

### 6. `Prescription_Items` (الأدوية داخل الروشتة)
- `item_id`: UUID (Primary Key)
- `prescription_id`: UUID (FK -> Prescriptions.prescription_id)
- `drug_name`: String
- `dosage`: String
- `frequency`: String
- `duration`: String
- `instructions`: Text

### 7. `System_Logs` (لأغراض الـ Cybersecurity و الـ Auditing)
- `log_id`: UUID
- `user_id`: UUID (من قام بالفعل)
- `action`: String (e.g., 'ACCESSED_RECORD', 'CREATED_PRESCRIPTION')
- `target_id`: UUID (e.g., Patient ID)
- `ip_address`: String
- `timestamp`: Timestamp
