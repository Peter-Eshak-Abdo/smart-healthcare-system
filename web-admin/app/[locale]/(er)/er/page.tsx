'use client';

import type {
  EmergencyIdentifyResponseSchema,
  EmergencyProfileResponseSchema,
  EmergencySessionContactsResponseSchema,
  ExtendEmergencySessionResponseSchema,
} from '@smarthealth/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertOctagon, Camera, Clock, Droplets, IdCard, Phone, QrCode, ShieldAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { ProblemAlert } from '@/components/common/ProblemAlert';
import { useThemeMode } from '@/components/providers/AppProviders';
import { FaceMeshScanner } from '@/components/three/FaceMeshScanner';
import { MedicalIdCard3D } from '@/components/three/MedicalIdCard3D';
import type { ProblemDetails } from '@smarthealth/contracts';
import { apiFetch } from '@/lib/api/client';
import { ApiRequestError } from '@/lib/api/errors';
import { getFirebaseIdToken } from '@/lib/firebase/client';
import { formatCairoDateTime } from '@/lib/format/date';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0';

type IdentifyRes = z.infer<typeof EmergencyIdentifyResponseSchema>;
type EmergencyProfile = z.infer<typeof EmergencyProfileResponseSchema>;
type EmergencyContacts = z.infer<typeof EmergencySessionContactsResponseSchema>;
type ExtendRes = z.infer<typeof ExtendEmergencySessionResponseSchema>;

export default function ErConsolePage() {
  const locale = useLocale() as 'ar' | 'en';
  const isEn = locale === 'en';
  const tEr = useTranslations('er');
  const { setTheme } = useThemeMode();

  const [mode, setMode] = useState<'face' | 'card' | 'national_id'>('face');
  const [reason, setReason] = useState<
    'unconscious' | 'unable_to_communicate' | 'altered_mental_status' | 'language_barrier' | 'other'
  >('unconscious');
  const [cardPayload, setCardPayload] = useState('');
  const [idType, setIdType] = useState<'national_id' | 'passport'>('national_id');
  const [idNumber, setIdNumber] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<
    Array<{ candidate_token: string; sex: string; age_band: string }>
  >([]);
  const [showContacts, setShowContacts] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setTheme('emergency');
    return () => setTheme('light');
  }, [setTheme]);

  const profileQuery = useQuery({
    queryKey: ['er-profile', sessionId],
    enabled: Boolean(sessionId),
    queryFn: () =>
      apiFetch<EmergencyProfile>(`/v1/emergency/sessions/${sessionId}/profile`, { locale }),
  });

  const contactsQuery = useQuery({
    queryKey: ['er-contacts', sessionId],
    enabled: Boolean(sessionId) && showContacts,
    queryFn: () =>
      apiFetch<EmergencyContacts>(`/v1/emergency/sessions/${sessionId}/contacts`, { locale }),
  });

  const handleFaceIdentify = async (blob: Blob) => {
    setError(null);
    setCandidates([]);
    try {
      const token = await getFirebaseIdToken();
      const formData = new FormData();
      formData.append('frames', blob, 'face.jpg');
      formData.append('reason_code', reason);

      const response = await fetch(`${API_BASE}/v1/emergency/identify`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Client': `web/${APP_VERSION}`,
          'Accept-Language': locale,
          'X-Request-Id': crypto.randomUUID(),
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: formData,
      });

      const raw = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) {
        throw new ApiRequestError(response.status, raw as Partial<ProblemDetails>);
      }
      const payload = raw as IdentifyRes;

      if (payload.result === 'match') {
        setSessionId(payload.session.id);
      } else if (payload.result === 'possible_match') {
        setCandidates(payload.candidates);
      } else {
        setMode('card');
      }
    } catch (err) {
      setError(err);
    }
  };

  const confirmCandidate = useMutation({
    mutationFn: (candidateToken: string) =>
      apiFetch<Extract<IdentifyRes, { result: 'match' }>>('/v1/emergency/identify/confirm', {
        method: 'POST',
        locale,
        body: { candidate_token: candidateToken, reason_code: reason },
      }),
    onSuccess: (res) => {
      setCandidates([]);
      setSessionId(res.session.id);
    },
    onError: (err) => setError(err),
  });

  const cardIdentify = useMutation({
    mutationFn: () =>
      apiFetch<Extract<IdentifyRes, { result: 'match' }>>('/v1/emergency/identify/card', {
        method: 'POST',
        locale,
        body: { card_qr_payload: cardPayload.trim(), reason_code: reason },
      }),
    onSuccess: (res) => {
      setError(null);
      setSessionId(res.session.id);
    },
    onError: (err) => setError(err),
  });

  const manualIdentify = useMutation({
    mutationFn: () =>
      apiFetch<Extract<IdentifyRes, { result: 'match' }>>('/v1/emergency/identify/manual', {
        method: 'POST',
        locale,
        body: {
          id_document_type: idType,
          id_document_number: idNumber.trim(),
          reason_code: reason,
        },
      }),
    onSuccess: (res) => {
      setError(null);
      setSessionId(res.session.id);
    },
    onError: (err) => setError(err),
  });

  const extendMutation = useMutation({
    mutationFn: () =>
      apiFetch<ExtendRes>(`/v1/emergency/sessions/${sessionId}/extend`, {
        method: 'POST',
        locale,
        body: { reason: 'Continued ER stabilization care' },
      }),
    onSuccess: () => void profileQuery.refetch(),
    onError: (err) => setError(err),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/v1/emergency/sessions/${sessionId}/close`, {
        method: 'POST',
        locale,
        body: {},
      }),
    onSuccess: () => {
      setSessionId(null);
      setShowContacts(false);
    },
    onError: (err) => setError(err),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-destructive bg-card p-5">
        <div className="flex items-center gap-3">
          <AlertOctagon className="h-7 w-7 text-destructive" />
          <div>
            <h1 className="text-xl font-extrabold text-foreground">{tEr('title')}</h1>
            <p className="text-xs text-muted-foreground">{tEr('closedNotice')}</p>
          </div>
        </div>

        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as typeof reason)}
          aria-label={tEr('reasonLabel')}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
        >
          {(['unconscious', 'unable_to_communicate', 'altered_mental_status', 'language_barrier', 'other'] as const).map(
            (r) => (
              <option key={r} value={r}>
                {tEr(`reasons.${r}`)}
              </option>
            ),
          )}
        </select>
      </div>

      {error !== null && <ProblemAlert error={error} />}

      {!sessionId ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('face')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
                mode === 'face' ? 'bg-destructive text-white' : 'border border-border'
              }`}
            >
              <Camera className="h-4 w-4" />
              <span>{tEr('modeFace')}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('card')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
                mode === 'card' ? 'bg-destructive text-white' : 'border border-border'
              }`}
            >
              <QrCode className="h-4 w-4" />
              <span>{tEr('modeCard')}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('national_id')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
                mode === 'national_id' ? 'bg-destructive text-white' : 'border border-border'
              }`}
            >
              <IdCard className="h-4 w-4" />
              <span>{tEr('modeNationalId')}</span>
            </button>
          </div>

          {mode === 'face' && (
            <FaceMeshScanner
              hint={tEr('modeFace')}
              onCaptureFrame={(blob: Blob) => void handleFaceIdentify(blob)}
            />
          )}

          {candidates.length > 0 && (
            <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
              <p className="text-sm font-bold">
                {isEn ? 'Select matching candidate profile:' : 'اختر التطابق المحتمل:'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {candidates.map((c, idx) => (
                  <button
                    key={c.candidate_token}
                    type="button"
                    onClick={() => confirmCandidate.mutate(c.candidate_token)}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold hover:border-destructive"
                  >
                    #{idx + 1} · {c.sex} · {c.age_band}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'card' && (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                cardIdentify.mutate();
              }}
              className="space-y-3"
            >
              <label className="text-sm font-semibold">{tEr('cardPayloadLabel')}</label>
              <textarea
                rows={3}
                required
                value={cardPayload}
                onChange={(e) => setCardPayload(e.target.value)}
                placeholder="SHEC1.eyJ..."
                className="clinical-num w-full rounded-xl border border-border bg-background p-3 font-mono text-xs"
                dir="ltr"
              />
              <button
                type="submit"
                disabled={cardIdentify.isPending}
                className="rounded-xl bg-destructive px-5 py-2.5 text-sm font-bold text-white"
              >
                {tEr('openSession')}
              </button>
            </form>
          )}

          {mode === 'national_id' && (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                manualIdentify.mutate();
              }}
              className="space-y-3"
            >
              <div className="flex flex-wrap gap-3">
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value as 'national_id' | 'passport')}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="national_id">{tEr('modeNationalId')}</option>
                  <option value="passport">{isEn ? 'Passport' : 'جواز سفر'}</option>
                </select>
                <input
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="29901011234567"
                  className="clinical-num flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
                  dir="ltr"
                />
              </div>
              <button
                type="submit"
                disabled={manualIdentify.isPending}
                className="rounded-xl bg-destructive px-5 py-2.5 text-sm font-bold text-white"
              >
                {tEr('openSession')}
              </button>
            </form>
          )}
        </div>
      ) : (
        profileQuery.data && (
          <div className="space-y-5">
            {profileQuery.data.session.low_confidence && (
              <div className="rounded-xl border-2 border-amber-500 bg-amber-500/20 p-3 text-sm font-bold">
                {isEn
                  ? 'LOW CONFIDENCE MATCH — verify physical identity before invasive procedures.'
                  : 'تطابق بدرجة ثقة متوسطة — تأكد من هوية المريض قبل أي إجراء تداخلي.'}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <MedicalIdCard3D
                  fullName={profileQuery.data.patient.full_name}
                  mrn={`SH-••••${profileQuery.data.patient.mrn_last4}`}
                  bloodType={profileQuery.data.blood_type.value}
                  allergies={profileQuery.data.allergies.map((a) => `${a.name} (${a.severity})`)}
                  emergencyMode
                />
              </div>

              <div className="space-y-4 lg:col-span-7">
                <div className="rounded-2xl border-2 border-destructive bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-lg font-extrabold text-destructive">
                      <Droplets className="h-6 w-6" />
                      <span className="clinical-num">{profileQuery.data.blood_type.value}</span>
                      <span className="text-xs font-medium text-muted-foreground">
                        ({profileQuery.data.blood_type.verified ? 'Verified' : 'Self-reported'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatCairoDateTime(profileQuery.data.session.expires_at, locale)}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h2 className="flex items-center gap-1.5 text-sm font-bold text-destructive">
                      <ShieldAlert className="h-4 w-4" />
                      <span>{isEn ? 'Critical Allergies' : 'الحساسية الحرجة'}</span>
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profileQuery.data.allergies.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        profileQuery.data.allergies.map((a, i) => (
                          <span
                            key={`${a.name}-${i}`}
                            className="rounded-full bg-destructive/20 px-3 py-1 text-xs font-bold text-destructive"
                          >
                            {a.name} ({a.severity})
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground">
                        {isEn ? 'Chronic Conditions' : 'الأمراض المزمنة'}
                      </h3>
                      <ul className="mt-1 space-y-1 text-sm font-semibold">
                        {profileQuery.data.chronic_conditions.map((c, i) => (
                          <li key={`${c.name}-${i}`}>
                            {c.name} {c.since_year ? `(${c.since_year})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground">
                        {isEn ? 'Current Medications' : 'الأدوية الحالية'}
                      </h3>
                      <ul className="mt-1 space-y-1 text-sm font-semibold">
                        {profileQuery.data.current_medications.map((m, i) => (
                          <li key={`${m.name}-${i}`}>
                            <bdi>{m.name}</bdi> · <span className="clinical-num">{m.dose_text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {profileQuery.data.has_shared_contacts && (
                    <button
                      type="button"
                      onClick={() => setShowContacts((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold"
                    >
                      <Phone className="h-4 w-4 text-primary" />
                      <span>{tEr('contactsTitle')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => extendMutation.mutate()}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold"
                  >
                    {tEr('extendSession')}
                  </button>
                  <button
                    type="button"
                    onClick={() => closeMutation.mutate()}
                    className="rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-white"
                  >
                    {tEr('closeSession')}
                  </button>
                </div>

                {showContacts && contactsQuery.data && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <h3 className="text-sm font-bold">{tEr('contactsTitle')}</h3>
                    <div className="mt-2 space-y-2">
                      {contactsQuery.data.data.map((c) => (
                        <div
                          key={`${c.full_name}-${c.priority}`}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>
                            {c.full_name} ({c.relationship})
                          </span>
                          <a
                            href={`tel:${c.phone}`}
                            className="clinical-num font-mono font-bold text-primary"
                            dir="ltr"
                          >
                            {c.phone}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
