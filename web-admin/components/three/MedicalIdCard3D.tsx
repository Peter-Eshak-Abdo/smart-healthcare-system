'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { QrCode, ShieldAlert } from 'lucide-react';
import type { PointerEvent } from 'react';
import { detectMotionTier } from '@/lib/motion/tier';

export function MedicalIdCard3D({
  fullName,
  mrn,
  bloodType,
  allergies,
  emergencyMode = false,
}: {
  fullName: string;
  mrn: string;
  bloodType: string;
  allergies: string[];
  emergencyMode?: boolean;
}) {
  const tier = detectMotionTier({ isEmergency: emergencyMode });
  const interactive = tier === 'A';

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const smoothRx = useSpring(rx, { stiffness: 180, damping: 20 });
  const smoothRy = useSpring(ry, { stiffness: 180, damping: 20 });
  const foilOffset = useTransform(smoothRy, [-12, 12], ['-25%', '125%']);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rx.set(-py * 16);
    ry.set(px * 20);
  };

  const resetTilt = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <div className="[perspective:1000px]">
      <motion.div
        onPointerMove={onPointerMove}
        onPointerLeave={resetTilt}
        {...(interactive ? { style: { rotateX: smoothRx, rotateY: smoothRy } } : {})}
        className="relative overflow-hidden rounded-2xl border border-primary/30 bg-primary p-5 text-primary-foreground shadow-lg"
      >
        {interactive ? (
          <motion.div
            aria-hidden="true"
            style={{ insetInlineStart: foilOffset }}
            className="pointer-events-none absolute inset-y-0 w-1/3 bg-primary-foreground/15 blur-xl"
          />
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider opacity-80">SmartHealth Medical ID</p>
            <h3 className="mt-1 text-lg font-bold">{fullName}</h3>
            <p className="clinical-num mt-0.5 font-mono text-xs opacity-90">{mrn}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-1.5 text-card-foreground">
            <QrCode className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="clinical-num text-base font-extrabold text-destructive">
              <bdi>{bloodType}</bdi>
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {allergies.length > 0 ? (
            allergies.map((al) => (
              <span
                key={al}
                className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground"
              >
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                <bdi>{al}</bdi>
              </span>
            ))
          ) : (
            <span className="rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-xs">
              No recorded severe allergies
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
