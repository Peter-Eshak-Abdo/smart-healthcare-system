'use client';

export type MotionTier = 'A' | 'B' | 'C' | 'E';

export function detectMotionTier(options: { isEmergency?: boolean } = {}): MotionTier {
  if (options.isEmergency) return 'E';
  if (typeof window === 'undefined') return 'B';
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return 'C';
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) {
    return 'C';
  }
  return 'A';
}
