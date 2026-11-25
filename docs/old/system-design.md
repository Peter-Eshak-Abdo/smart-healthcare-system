# system-design.md

# ⚙️ System Design & Workflows

## 1. Core Modules

### A. Patient Identification Module (AI)
*   **Input:** صورة وجه المريض أو بصمته (من كاميرا الموبايل أو جهاز المستشفى).
*   **Processing:** استخراج الـ Features (Embeddings) ومقارنتها بقاعدة البيانات.
*   **Output:** إرجاع الملف الطبي المبدئي (Emergency Info).

### B. E-Prescription Module
*   **Creation:** الطبيب يختار الأدوية والجرعات من النظام.
*   **AI Validation:** النظام يفحص تعارض الأدوية (Drug-Drug Interactions) مع حساسية المريض.
*   **Generation:** يتم إنشاء سجل مشفر للروشتة وربطه بـ ID المريض.
*   **Dispensing:** المريض يذهب للصيدلية، الصيدلي يطلب مصادقة (بصمة/وجه)، وتظهر الروشتة وتتحول حالتها لـ `Dispensed`.

## 2. System Workflows

### Workflow 1: Emergency Case (حالة طوارئ)
1. المسعف/طبيب الطوارئ يفتح تطبيق الموبايل/الويب.
2. يختار "Identify Patient".
3. يلتقط صورة لوجه المريض الفاقد للوعي.
4. الـ AI Service تحلل الصورة وترجع `Patient_ID`.
5. النظام يعرض **فقط** (Emergency Profile): فصيلة الدم، الأمراض المزمنة، الحساسية، أرقام الطوارئ.

### Workflow 2: Doctor Visit & E-Prescription
1. المريض يزور الطبيب، الطبيب يفتح ملفه برقم الهوية أو الـ Face ID.
2. الطبيب يضيف التشخيص الجديد.
3. الطبيب يكتب الأدوية.
4. النظام ينبه الطبيب إذا كان هناك تعارض أدوية.
5. الروشتة تحفظ في النظام بحالة `Pending`.

### Workflow 3: Pharmacy Dispensing
1. المريض يذهب للصيدلية.
2. الصيدلي يطلب من المريض تأكيد هويته (بصمة/وجه عبر الموبايل أو جهاز الصيدلية).
3. تظهر للصيدلي الروشتات الـ `Pending` الخاصة بهذا المريض فقط.
4. الصيدلي يصرف الدواء ويضغط `Mark as Dispensed`.
