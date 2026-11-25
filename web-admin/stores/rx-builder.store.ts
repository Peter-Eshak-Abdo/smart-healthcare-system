'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface DraftRxItem {
  client_key: string;
  drug_id: string;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  is_controlled: boolean;
  base_unit: string;
  dose: string;
  route: string;
  frequency:
    | 'once_daily'
    | 'twice_daily'
    | 'three_times_daily'
    | 'four_times_daily'
    | 'every_x_hours'
    | 'at_bedtime'
    | 'as_needed'
    | 'once'
    | 'weekly';
  frequency_interval_hours: number | null;
  duration_days: number;
  quantity: number;
  instructions: string;
  substitution_allowed: boolean;
}

export interface OverrideDraft {
  alert_key: string;
  reason_code:
    | 'benefit_outweighs_risk'
    | 'allergy_disputed'
    | 'desensitisation_protocol'
    | 'monitored_setting'
    | 'other';
  justification: string;
}

interface PatientDraftState {
  items: DraftRxItem[];
  overrides: Record<string, OverrideDraft>;
  manualReviewAttested: boolean;
  notesToPharmacist: string;
  idempotencyKey: string;
}

interface RxBuilderStore {
  drafts: Record<string, PatientDraftState>;
  getDraft: (patientId: string) => PatientDraftState;
  addItem: (patientId: string, item: DraftRxItem) => void;
  updateItem: (patientId: string, clientKey: string, patch: Partial<DraftRxItem>) => void;
  removeItem: (patientId: string, clientKey: string) => void;
  setOverride: (patientId: string, ov: OverrideDraft) => void;
  pruneOverrides: (patientId: string, activeAlertKeys: Set<string>) => void;
  setManualAttested: (patientId: string, attested: boolean) => void;
  setNotes: (patientId: string, notes: string) => void;
  resetDraft: (patientId: string) => void;
  clearAllDrafts: () => void;
}

function emptyDraft(): PatientDraftState {
  return {
    items: [],
    overrides: {},
    manualReviewAttested: false,
    notesToPharmacist: '',
    idempotencyKey: typeof crypto !== 'undefined' ? crypto.randomUUID() : '00000000-0000-4000-8000-000000000000',
  };
}

export const useRxBuilderStore = create<RxBuilderStore>()(
  persist(
    (set, get) => ({
      drafts: {},
      getDraft(patientId) {
        return get().drafts[patientId] ?? emptyDraft();
      },
      addItem(patientId, item) {
        const cur = get().drafts[patientId] ?? emptyDraft();
        set({
          drafts: {
            ...get().drafts,
            [patientId]: { ...cur, items: [...cur.items, item] },
          },
        });
      },
      updateItem(patientId, clientKey, patch) {
        const cur = get().drafts[patientId] ?? emptyDraft();
        set({
          drafts: {
            ...get().drafts,
            [patientId]: {
              ...cur,
              items: cur.items.map((it) =>
                it.client_key === clientKey ? { ...it, ...patch } : it,
              ),
            },
          },
        });
      },
      removeItem(patientId, clientKey) {
        const cur = get().drafts[patientId] ?? emptyDraft();
        set({
          drafts: {
            ...get().drafts,
            [patientId]: {
              ...cur,
              items: cur.items.filter((it) => it.client_key !== clientKey),
            },
          },
        });
      },
      setOverride(patientId, ov) {
        const cur = get().drafts[patientId] ?? emptyDraft();
        set({
          drafts: {
            ...get().drafts,
            [patientId]: {
              ...cur,
              overrides: { ...cur.overrides, [ov.alert_key]: ov },
            },
          },
        });
      },
      pruneOverrides(patientId, activeAlertKeys) {
        const cur = get().drafts[patientId] ?? emptyDraft();
        const nextOverrides: Record<string, OverrideDraft> = {};
        for (const [k, v] of Object.entries(cur.overrides)) {
          if (activeAlertKeys.has(k)) nextOverrides[k] = v;
        }
        set({
          drafts: {
            ...get().drafts,
            [patientId]: { ...cur, overrides: nextOverrides },
          },
        });
      },
      setManualAttested(patientId, attested) {
        const cur = get().drafts[patientId] ?? emptyDraft();
        set({
          drafts: {
            ...get().drafts,
            [patientId]: { ...cur, manualReviewAttested: attested },
          },
        });
      },
      setNotes(patientId, notes) {
        const cur = get().drafts[patientId] ?? emptyDraft();
        set({
          drafts: {
            ...get().drafts,
            [patientId]: { ...cur, notesToPharmacist: notes },
          },
        });
      },
      resetDraft(patientId) {
        const next = { ...get().drafts };
        delete next[patientId];
        set({ drafts: next });
      },
      clearAllDrafts() {
        set({ drafts: {} });
      },
    }),
    {
      name: 'sh-rx-builder-drafts',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
