# ui-ux-prototype.md

# 🎨 UI/UX Prototype & Flow

## 1. Design System
*   **Colors:** Primary (Medical Blue #2563EB), Secondary (Teal #0D9488), Alert (Red #DC2626), Background (Light Gray #F3F4F6).
*   **Typography:** Sans-serif (Inter أو Cairo للغة العربية).
*   **Frameworks:** Shadcn UI للويب (نظيف وسريع)، Material 3 للموبايل (Flutter).

## 2. Web Screens (Doctor & Admin - Next.js)

### Screen 1: Doctor Dashboard
*   **Sidebar:** المرضى، الروشتات، السجل الطبي، الإعدادات.
*   **Main Area:** قائمة بالمرضى المحجوزين اليوم.
*   **Top Bar:** بحث سريع عن مريض (بالرقم القومي أو مسح الوجه عبر كاميرا الويب).

### Screen 2: Patient Medical Profile (Doctor View)
*   **Header:** صورة المريض، الاسم، السن، فصيلة الدم، تحذيرات باللون الأحمر (الحساسية).
*   **Tabs:**
    *   `History`: زيارات سابقة.
    *   `New Diagnosis`: كتابة تشخيص جديد.
    *   `E-Prescription`: فورم ديناميكي لإضافة الأدوية (يتصل بالـ AI لإظهار تحذيرات التعارض الفورية).

## 3. Mobile Screens (Patient, Pharmacist, Paramedic - Flutter)

### Screen 1: Paramedic / Emergency Scan
*   زر كبير في منتصف الشاشة "Emergency Scan".
*   يفتح الكاميرا، يحدد الوجه، ويقوم بالبحث.
*   تظهر بطاقة طوارئ (Emergency Card) حمراء اللون تحتوي فقط على: فصيلة الدم، أمراض القلب/السكر، الحساسية لبعض الأدوية، رقم ولي الأمر.

### Screen 2: Patient App
*   **Home:** الروشتات الحالية (QR Code اختياري لتسهيل الوصول في الصيدلية)، التذكير بمواعيد الدواء.
*   **Profile:** السجل الطبي، وإدارة بيانات بصمة الوجه.

### Screen 3: Pharmacist Mode
*   الصيدلي يمسح وجه المريض أو يدخل كود الروشتة.
*   تظهر تفاصيل الأدوية والجرعات بوضوح (لا يوجد خط طبيب غير مقروء).
*   زر `Dispense All` أو `Dispense Partially`. بمجرد الضغط، يتم تحديث الداتابيز ولن يمكن صرف الروشتة من صيدلية أخرى.
