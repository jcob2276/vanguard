import { useEffect, useRef, useState } from 'react';
import { Loader2, Keyboard } from 'lucide-react';

declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
    };
  }
}

export interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
  loading: boolean;
}

export default function BarcodeScanner({ onDetected, onClose, loading }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const detectorSupported = typeof window !== 'undefined' && !!window.BarcodeDetector;

  useEffect(() => {
    if (!detectorSupported) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let rafId: number;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const detector = new window.BarcodeDetector!({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try { const codes = await detector.detect(videoRef.current); if (codes.length > 0) { onDetected(codes[0].rawValue); return; } } catch { /* ignore mid-frame decode errors */ }
          rafId = requestAnimationFrame(() => { scan(); });
        };
        scan();
      } catch (err) {
        console.error('[BarcodeScanner] camera failed', err);
        setCameraError('Brak dostępu do kamery — wpisz kod ręcznie');
      }
    })();
    return () => { stopped = true; if (rafId) cancelAnimationFrame(rafId); stream?.getTracks().forEach((t) => t.stop()); };
  }, [detectorSupported, onDetected]);

  return (
    <div className="space-y-3">
      <button onClick={onClose} className="text-[11px] font-bold text-text-muted hover:text-text-primary cursor-pointer">← Wstecz</button>
      {detectorSupported && !cameraError ? (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          <div className="absolute inset-8 border-2 border-primary/70 rounded-xl pointer-events-none" />
          {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 size={24} className="text-white animate-spin" /></div>}
        </div>
      ) : (
        <p className="text-[11px] text-text-muted text-center py-2">{cameraError || 'Skaner kamery niedostępny — wpisz kod ręcznie'}</p>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Keyboard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={manualCode} onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && manualCode.trim()) onDetected(manualCode.trim()); }}
            inputMode="numeric" placeholder="Wpisz kod kreskowy..."
            className="w-full rounded-xl border border-border-custom bg-surface-solid/40 pl-9 pr-2 py-2.5 text-[13px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40" />
        </div>
        <button onClick={() => manualCode.trim() && onDetected(manualCode.trim())} disabled={!manualCode.trim() || loading}
          className="rounded-xl bg-primary px-4 py-2.5 text-[12px] font-black text-white disabled:opacity-40 cursor-pointer">Szukaj</button>
      </div>
    </div>
  );
}
