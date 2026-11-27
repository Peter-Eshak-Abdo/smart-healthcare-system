'use client';

import type {
  CreateAddendumResponseSchema,
  CreateDiagnosisResponseSchema,
  PatchEncounterResponseSchema,
} from '@smarthealth/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, FileText, Mic, Plus, Sparkles, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { apiFetch } from '@/lib/api/client';

type PatchEncounterRes = z.infer<typeof PatchEncounterResponseSchema>;
type AddendumRes = z.infer<typeof CreateAddendumResponseSchema>;
type DiagnosisRes = z.infer<typeof CreateDiagnosisResponseSchema>;

export default function DoctorEncounterWorkspacePage() {
  const params = useParams<{ patientId: string; encounterId: string }>();
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const prefix = isEn ? '/en' : '';

  const [version, setVersion] = useState<number>(1);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [notesInternal, setNotesInternal] = useState('');
  const [patientSummary, setPatientSummary] = useState('');
  const [icdQuery, setIcdQuery] = useState('');
  const [selectedIcd, setSelectedIcd] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [addToProblemList, setAddToProblemList] = useState(false);
  const [addendumText, setAddendumText] = useState('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [scribeTranscript, setScribeTranscript] = useState('');
  const [listening, setListening] = useState(false);

  const soapMutation = useMutation({
    mutationFn: (transcript: string) =>
      apiFetch<{
        subjective: string;
        objective: string;
        assessment: string;
        plan: string;
      }>('/v1/ai/scribe/soap', {
        method: 'POST',
        locale,
        body: { transcript, locale },
      }),
    onSuccess: (soap) => {
      setError(null);
      setNotesInternal(
        `S: ${soap.subjective}\nO: ${soap.objective}\nA: ${soap.assessment}\nP: ${soap.plan}`,
      );
      setPatientSummary(soap.plan);
      setSavedNotice(
        isEn ? 'SOAP notes generated from voice transcript.' : 'تم تنظيم ملاحظات الكشف (SOAP) بنجاح.',
      );
    },
    onError: (err) => setError(err),
  });

  function startBrowserVoiceScribe() {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onend: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onend: () => void;
        start: () => void;
      };
    };
    const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Rec) {
      setSavedNotice(
        isEn
          ? 'Browser speech API unavailable; type dictation below and click Format SOAP.'
          : 'المتصفح لا يدعم التسجيل الصوتي؛ يمكنك كتابة الملاحظة والضغط على تنظيم SOAP.',
      );
      return;
    }
    const rec = new Rec();
    rec.lang = isEn ? 'en-US' : 'ar-EG';
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript ?? '';
      if (text) {
        setScribeTranscript((prev) => `${prev} ${text}`.trim());
      }
    };
    rec.onend = () => setListening(false);
    rec.start();
  }

  const icdSearch = useQuery({
    queryKey: ['icd10-search', icdQuery],
    enabled: icdQuery.trim().length >= 2,
    queryFn: () =>
      apiFetch<{ data: Array<{ code: string; name_ar: string; name_en: string }> }>(
        `/v1/ref/icd10?q=${encodeURIComponent(icdQuery.trim())}`,
        { locale },
      ),
  });

  const patchEncounterMutation = useMutation({
    mutationFn: (endVisit: boolean) =>
      apiFetch<PatchEncounterRes>(`/v1/doctor/encounters/${params.encounterId}`, {
        method: 'PATCH',
        locale,
        ifMatch: `"${version}"`,
        body: {
          ...(chiefComplaint.trim() ? { chief_complaint: chiefComplaint.trim() } : {}),
          ...(notesInternal.trim() ? { notes_internal: notesInternal.trim() } : {}),
          ...(patientSummary.trim() ? { patient_summary: patientSummary.trim() } : {}),
          ...(endVisit ? { end: true } : {}),
        },
      }),
    onSuccess: (res) => {
      setError(null);
      setVersion(res.version);
      setEndedAt(res.ended_at);
      setSavedNotice(isEn ? 'Encounter updated.' : 'تم حفظ بيانات الكشف بنجاح.');
    },
    onError: (err) => setError(err),
  });

  const diagnosisMutation = useMutation({
    mutationFn: () =>
      apiFetch<DiagnosisRes>(`/v1/doctor/encounters/${params.encounterId}/diagnoses`, {
        method: 'POST',
        locale,
        body: {
          icd10_code: selectedIcd.trim(),
          is_primary: isPrimary,
          add_to_problem_list: addToProblemList,
          is_chronic: addToProblemList,
        },
      }),
    onSuccess: () => {
      setError(null);
      setSelectedIcd('');
      setIcdQuery('');
      setSavedNotice(isEn ? 'Diagnosis recorded.' : 'تم تسجيل التشخيص بنجاح.');
    },
    onError: (err) => setError(err),
  });

  const addendumMutation = useMutation({
    mutationFn: () =>
      apiFetch<AddendumRes>(`/v1/doctor/encounters/${params.encounterId}/addenda`, {
        method: 'POST',
        locale,
        body: { text: addendumText.trim() },
      }),
    onSuccess: () => {
      setError(null);
      setAddendumText('');
      setSavedNotice(isEn ? 'Addendum appended.' : 'تمت إضافة الملاحظة التكميلية.');
    },
    onError: (err) => setError(err),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {isEn ? 'Encounter Workspace' : 'توثيق الكشف الطبي'}
          </h2>
          <p className="clinical-num font-mono text-xs text-muted-foreground">
            <bdi>{params.encounterId}</bdi> · v{version} {endedAt ? '· Completed' : ''}
          </p>
        </div>
        <Link
          href={`${prefix}/doctor/patients/${params.patientId}/prescribe?encounterId=${params.encounterId}` as never}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          <FileText className="h-4 w-4" />
          <span>{isEn ? 'Write E-Prescription' : 'كتابة روشتة لهذه الزيارة'}</span>
        </Link>
      </div>

      {error !== null && <ProblemAlert error={error} />}
      {savedNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>{savedNotice}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              <h3>{isEn ? 'Clinical Notes & Summary' : 'ملاحظات الكشف وملخص المريض'}</h3>
            </div>
            <button
              type="button"
              onClick={startBrowserVoiceScribe}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
            >
              <Mic className="h-3.5 w-3.5" />
              <span>
                {listening
                  ? isEn
                    ? 'Listening...'
                    : 'جاري الاستماع...'
                  : isEn
                    ? 'Voice Scribe (0 Audio Tokens)'
                    : 'إملاء صوتي ذكي'}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-2.5">
            <input
              type="text"
              value={scribeTranscript}
              onChange={(e) => setScribeTranscript(e.target.value)}
              placeholder={
                isEn
                  ? 'Dictated or quick clinical text for SOAP formatting...'
                  : 'اكتب أو أملِ ملخص الكشف لتحويله لملاحظات SOAP...'
              }
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
            <button
              type="button"
              disabled={soapMutation.isPending || scribeTranscript.trim().length < 5}
              onClick={() => soapMutation.mutate(scribeTranscript.trim())}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              <span>{isEn ? 'Format SOAP' : 'تنظيم SOAP'}</span>
            </button>
          </div>

          <textarea
            rows={2}
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder={isEn ? 'Chief complaint...' : 'الشكوى الرئيسية...'}
            className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          />
          <textarea
            rows={4}
            value={notesInternal}
            onChange={(e) => setNotesInternal(e.target.value)}
            placeholder={isEn ? 'Internal clinical notes...' : 'الملاحظات الإكلينيكية الداخلية...'}
            className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          />
          <textarea
            rows={3}
            value={patientSummary}
            onChange={(e) => setPatientSummary(e.target.value)}
            placeholder={isEn ? 'Patient-facing summary...' : 'ملخص واضح يظهر للمريض...'}
            className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={patchEncounterMutation.isPending}
              onClick={() => patchEncounterMutation.mutate(false)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
            >
              {isEn ? 'Save Draft' : 'حفظ التغييرات'}
            </button>
            <button
              type="button"
              disabled={patchEncounterMutation.isPending}
              onClick={() => patchEncounterMutation.mutate(true)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              {isEn ? 'Complete Encounter' : 'إنهاء الكشف'}
            </button>
          </div>
        </div>

        <div className="space-y-5 lg:col-span-5">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (selectedIcd.trim()) diagnosisMutation.mutate();
            }}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <h3 className="text-sm font-bold text-foreground">
              {isEn ? 'Add ICD-10 Diagnosis' : 'إضافة تشخيص (ICD-10)'}
            </h3>
            <input
              type="search"
              value={icdQuery}
              onChange={(e) => setIcdQuery(e.target.value)}
              placeholder={isEn ? 'Search ICD-10...' : 'ابحث بالكود أو اسم المرض...'}
              className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            {(icdSearch.data?.data ?? []).length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-border bg-background">
                {(icdSearch.data?.data ?? []).map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setSelectedIcd(item.code)}
                    className="flex w-full items-center justify-between border-b border-border/50 px-3 py-2 text-start text-xs hover:bg-accent"
                  >
                    <span>{isEn ? item.name_en : item.name_ar}</span>
                    <span className="clinical-num font-mono font-bold text-primary">{item.code}</span>
                  </button>
                ))}
              </div>
            )}
            <input
              value={selectedIcd}
              onChange={(e) => setSelectedIcd(e.target.value)}
              placeholder="ICD-10 (e.g. J06.9)"
              className="clinical-num mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
              dir="ltr"
            />
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                />
                <span>{isEn ? 'Primary diagnosis' : 'تشخيص رئيسي'}</span>
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={addToProblemList}
                  onChange={(e) => setAddToProblemList(e.target.checked)}
                />
                <span>{isEn ? 'Add to chronic problem list' : 'أضف للأمراض المزمنة'}</span>
              </label>
            </div>
            <button
              type="submit"
              disabled={!selectedIcd.trim() || diagnosisMutation.isPending}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isEn ? 'Record Diagnosis' : 'تثبيت التشخيص'}</span>
            </button>
          </form>

          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (addendumText.trim()) addendumMutation.mutate();
            }}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <h3 className="text-sm font-bold text-foreground">
              {isEn ? 'Post-Completion Addendum (24h window)' : 'إضافة ملحق توضيحي بعد الإنهاء'}
            </h3>
            <textarea
              rows={2}
              value={addendumText}
              onChange={(e) => setAddendumText(e.target.value)}
              placeholder={isEn ? 'Additional clarification...' : 'اكتب الإضافة الطبية...'}
              className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
            <button
              type="submit"
              disabled={!addendumText.trim() || addendumMutation.isPending}
              className="mt-2 rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-accent disabled:opacity-50"
            >
              {isEn ? 'Append Addendum' : 'إضافة الملحق'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
