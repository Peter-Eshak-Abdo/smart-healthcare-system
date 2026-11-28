'use client';

import { useState, type FormEvent } from 'react';

type AppRole = 'patient' | 'doctor' | 'pharmacist' | 'paramedic' | 'admin';

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<AppRole>('patient');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [bloodType, setBloodType] = useState('O+');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialtyCode, setSpecialtyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isMedicalStaff = role === 'doctor' || role === 'pharmacist' || role === 'paramedic';

  function handleNext(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقتين');
      return;
    }
    setStep(2);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (isMedicalStaff && licenseNumber.trim().length < 3) {
      setError('رقم الترخيص الطبي مطلوب للطاقم الطبي');
      return;
    }
    setSuccess(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg border border-slate-100 transition-all duration-300">
        <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">
          إنشاء حساب جديد — SmartHealth
        </h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          {step === 1 ? 'الخطوة 1: بيانات الدخول ونوع الحساب' : 'الخطوة 2: البيانات الشخصية'}
        </p>

        {/* Animated Stepper */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white text-sm font-bold">
              1
            </span>
            <span className="text-xs font-semibold text-slate-700">بيانات الدخول</span>
          </div>
          <div className="flex-1 h-1 mx-3 rounded bg-slate-200 overflow-hidden">
            <div
              className={`h-full bg-teal-600 transition-all duration-500 ${
                step === 2 ? 'w-full' : 'w-0'
              }`}
            />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300 ${
                step === 2 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              2
            </span>
            <span className="text-xs font-semibold text-slate-700">البيانات الشخصية</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success ? (
          <div className="rounded-xl bg-teal-50 border border-teal-200 p-6 text-center text-teal-800">
            تم إنشاء الحساب بنجاح! {role !== 'patient' && 'حسابك قيد المراجعة للتوثيق.'}
          </div>
        ) : step === 1 ? (
          <form onSubmit={handleNext} className="space-y-4 animate-in fade-in duration-300">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">نوع الحساب</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="patient">مريض (Patient)</option>
                <option value="doctor">طبيب (Doctor)</option>
                <option value="pharmacist">صيدلي (Pharmacist)</option>
                <option value="paramedic">مسعف (Paramedic)</option>
                <option value="admin">إدارة (Admin)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهاتف</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+201001234567"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تأكيد كلمة المرور</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              التالي: البيانات الشخصية
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-300">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الاسم الكامل</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الرقم القومي</label>
              <input
                type="text"
                required
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الميلاد</label>
                <input
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">النوع</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as 'male' | 'female')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
            </div>

            {role === 'patient' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">فصيلة الدم</label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isMedicalStaff && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    رقم الترخيص الطبي
                  </label>
                  <input
                    type="text"
                    required
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">التخصص</label>
                  <input
                    type="text"
                    value={specialtyCode}
                    onChange={(e) => setSpecialtyCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                السابق
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
              >
                إنشاء الحساب
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
