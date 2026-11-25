'use client';

import { motion } from 'motion/react';
import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';

export function RxSeal({
  status,
  kid,
  rxNumber,
}: {
  status: 'verifying' | 'valid' | 'invalid' | 'expired';
  kid?: string;
  rxNumber?: string;
}) {
  const isValid = status === 'valid';
  const isInvalid = status === 'invalid';

  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.28 }}
      className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 ${
        isValid
          ? 'border-success/50 bg-success-surface text-foreground'
          : isInvalid
            ? 'border-destructive bg-danger-surface text-destructive'
            : 'border-border bg-muted text-foreground'
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-current/25">
        {isValid ? (
          <ShieldCheck className="h-5 w-5 text-success" aria-hidden="true" />
        ) : isInvalid ? (
          <ShieldAlert className="h-5 w-5 text-destructive" aria-hidden="true" />
        ) : (
          <ShieldQuestion className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="text-start">
        <p className="text-xs font-bold">
          {isValid
            ? 'Ed25519 Signature Verified'
            : isInvalid
              ? 'Signature Tamper Detected'
              : status === 'expired'
                ? 'Expired Artifact'
                : 'Verifying Signature'}
        </p>
        <p className="clinical-num font-mono text-xs text-muted-foreground">
          {rxNumber ? `${rxNumber} · ` : ''}
          {kid ? `kid=${kid}` : 'EdDSA'}
        </p>
      </div>
    </motion.div>
  );
}
