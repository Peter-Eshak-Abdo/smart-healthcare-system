'use client';

import { Camera, CameraOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function FaceMeshScanner({
  hint,
  onCaptureFrame,
}: {
  hint: string;
  onCaptureFrame?: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;

    async function start() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(true);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setCameraError(true);
      }
    }

    void start();
    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const capture = () => {
    if (!videoRef.current || !onCaptureFrame) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) onCaptureFrame(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="relative flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="relative h-56 w-56 overflow-hidden rounded-full border-2 border-primary bg-muted">
        {cameraError ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
            <CameraOff className="h-6 w-6" aria-hidden="true" />
            <span>Camera unavailable — use QR / ID fallback</span>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <p className="text-xs font-medium text-foreground">{hint}</p>
      {!cameraError && onCaptureFrame ? (
        <button
          type="button"
          onClick={capture}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          <span>Capture Frame</span>
        </button>
      ) : null}
    </div>
  );
}
