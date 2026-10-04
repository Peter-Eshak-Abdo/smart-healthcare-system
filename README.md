# 🏥 Smart Healthcare System

> **One Identity. One Medical Record. One Secure Healthcare System.**

An integrated electronic health system designed to seamlessly connect patients, hospitals, doctors, and pharmacies. This project leverages Artificial Intelligence and robust Cybersecurity measures to ensure fast, reliable, and secure medical care.

---

## 💡 Project Overview
The Smart Healthcare System aims to unify the medical experience. Starting from patient identification using biometric data (Face Recognition/Fingerprint), navigating through an encrypted medical history, and ending with a secure E-Prescription system. It is specifically designed to handle emergency situations effectively and eliminate prescription fraud.

## ✨ Key Features

*   **👤 Patient Identification (AI):** Uses Face Recognition to instantly identify patients. Crucial for emergencies when patients are unconscious or lack ID. Displays life-saving data (Blood type, Allergies, Chronic diseases).
*   **💊 E-Prescription Module:** Replaces paper prescriptions. Doctors generate digital prescriptions sent directly to the system. Pharmacists dispense medications only after patient biometric verification, reducing fraud and errors.
*   **🔐 Robust Cybersecurity:** End-to-end protection of medical and biometric data. Implements Authentication, Authorization, Encryption, and Role-Based Access Control (RBAC).
*   **🤖 Smart AI Alerts:** Acts as a medical assistant. The system alerts doctors to potential drug-drug interactions or conflicts with the patient's recorded allergies.

## 🛠️ Technology Stack

### Frontend & Mobile
*   **Web App (Admin & Doctor):** Next.js, React.js, Tailwind CSS, Shadcn UI
*   **Mobile App (Patient, Pharmacist, Paramedic):** Flutter, Provider/Riverpod

### Backend & Database
*   **Core API:** Node.js (Express / NestJS)
*   **Database & Auth:** Supabase (PostgreSQL)

### AI & Machine Learning
*   **Service API:** Python, FastAPI
*   **Models:** Face Recognition Models (e.g., OpenCV, dlib, or DeepFace)

## 📂 Project Structure

```text
smart-health-system/
├── mobile-app/          # Flutter application source code
├── web-admin/           # Next.js web application source code
├── backend-api/         # Node.js backend services and REST API
└── ai-service/          # Python FastAPI service for Face Recognition
```

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   Flutter SDK (v3.10+)
*   Python (v3.9+)
*   Supabase Account (for Database and Auth)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/smart-health-system.git
   cd smart-health-system
   ```

2. **Setup Backend API**
   ```bash
   cd backend-api
   npm install
   # Create .env file based on .env.example
   npm run dev
   ```

3. **Setup AI Service**
   ```bash
   cd ai-service
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

4. **Setup Web Dashboard**
   ```bash
   cd web-admin
   npm install
   npm run dev
   ```

5. **Setup Mobile App**
   ```bash
   cd mobile-app
   flutter pub get
   flutter run
   ```

## 👥 Team & Roles (Graduation Project)

This project is developed by a team of 8 FCS (Faculty of Computer and Information Sciences) students across the following tracks:

*   **Full-Stack / Backend:** System architecture, REST APIs, Database integration.
*   **Mobile Development:** Cross-platform app for diverse user roles.
*   **AI / Machine Learning:** Face recognition pipeline and drug-interaction logic.
*   **Cybersecurity:** Implementation of RBAC, data encryption, and secure APIs.
*   **Database Admin:** PostgreSQL schemas and Supabase configuration.
*   **UI/UX Design:** User flows, wireframes, and accessible design system.

---
*Developed as a Graduation Project - 2026*
