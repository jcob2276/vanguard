import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useFaceDistance } from '../../hooks/useFaceDistance';
import { supabase } from '../../lib/supabase';
import { Check, ArrowLeft, Ruler, ZoomIn, ZoomOut, AlertCircle, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import VisionJournal from './VisionJournal';
import GlassesCabinet from './GlassesCabinet';

// True Snellen proportions: each row ~1.26x smaller than the one above
const SNELLEN_ROWS = [
  { letters: 'E',           size: 4.8 },
  { letters: 'F P',         size: 3.6 },
  { letters: 'T O Z',       size: 2.7 },
  { letters: 'L P E D',     size: 2.0 },
  { letters: 'P E C F D',   size: 1.5 },
  { letters: 'E D F C Z P', size: 1.1 },
];

type Eye = 'left' | 'right';
type Phase = 'calibrate' | 'select-eye' | 'measure' | 'captured' | 'saved';

// SVG stability ring
function StabilityRing({ progress, size = 64 }: { progress: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * progress;
  const color = progress === 1 ? '#22c55e' : progress > 0.5 ? '#f59e0b' : '#3b82f6';

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.1s linear, stroke 0.3s' }}
      />
    </svg>
  );
}

export default function EndMyopiaCalculator() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { distance, stability, isReady, calibrationFactor, calibrate, resetCalibration, resetStability } = useFaceDistance(videoRef);

  const [phase, setPhase] = useState<Phase>('calibrate');
  const [selectedEye, setSelectedEye] = useState<Eye>('left');
  const [capturedDistance, setCapturedDistance] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [snellenRows, setSnellenRows] = useState(4); // how many rows to show

  const faceDetected = distance !== null;
  const capturedDiopters = capturedDistance ? (-100 / capturedDistance) : null;

  // Skip calibrate phase if already calibrated
  useEffect(() => {
    if (calibrationFactor && phase === 'calibrate') {
      setPhase('select-eye');
    }
  }, [calibrationFactor]);

  // Auto-capture when stability reaches 1
  useEffect(() => {
    if (phase === 'measure' && stability >= 1 && distance !== null) {
      // Haptic feedback
      if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);
      setCapturedDistance(distance);
      setPhase('captured');
      resetStability();
    }
  }, [stability, phase, distance]);

  // Camera setup
  useEffect(() => {
    let stream: MediaStream | null = null;
    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Camera error:', err);
      }
    }
    setupCamera();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  const handleCalibrate = () => {
    calibrate(40);
    setPhase('select-eye');
  };

  const startMeasure = (eye: Eye) => {
    setSelectedEye(eye);
    setCapturedDistance(null);
    setSaveError(false);
    resetStability();
    setPhase('measure');
  };

  const handleRetry = () => {
    setCapturedDistance(null);
    setSaveError(false);
    resetStability();
    setPhase('measure');
  };

  const handleSave = async () => {
    if (!capturedDistance || !capturedDiopters) return;
    setIsSaving(true);
    setSaveError(false);
    try {
      const { error } = await supabase.from('endmyopia_measurements').insert({
        eye_measured: selectedEye,
        blur_distance_cm: parseFloat(capturedDistance.toFixed(2)),
        diopters: parseFloat(capturedDiopters.toFixed(2)),
      });
      if (error) throw error;
      setPhase('saved');
      setRefreshTrigger(prev => prev + 1);
      setTimeout(() => setPhase('select-eye'), 2000);
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col">

      {/* Hidden video (PIP only in measure phase) */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />

      {/* ══════════════════════════════════════════════
          MEASURE PHASE — full-screen, immersive
      ══════════════════════════════════════════════ */}
      {phase === 'measure' && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">

          {/* PIP Camera - top right corner */}
          <div className="absolute top-4 right-4 w-16 h-20 rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg">
            <video ref={undefined} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" style={{ objectFit: 'cover' }} />
          </div>

          {/* Back + status bar */}
          <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
            <button
              onClick={() => setPhase('select-eye')}
              className="p-2 rounded-xl bg-black/5 text-gray-500 hover:bg-black/10 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              faceDetected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-emerald-500' : 'bg-red-400 animate-pulse'}`} />
              {faceDetected ? `${distance!.toFixed(1)} cm` : 'Brak twarzy'}
            </div>
          </div>

          {/* Stability ring — top center */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10">
            <StabilityRing progress={stability} size={52} />
          </div>

          {/* Snellen letters — centered, full-screen feel */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-24">
            {SNELLEN_ROWS.slice(0, snellenRows).map((row, i) => (
              <p
                key={i}
                className="text-black font-black tracking-[0.3em] text-center leading-none mb-1"
                style={{ fontSize: `${row.size}rem` }}
              >
                {row.letters}
              </p>
            ))}
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6 px-8">
            <button
              onClick={() => setSnellenRows(r => Math.max(1, r - 1))}
              className="p-3 rounded-full bg-black/5 text-gray-500 hover:bg-black/10 active:scale-90 transition-all"
            >
              <ZoomOut size={20} />
            </button>
            <div className="flex flex-col items-center text-center">
              <p className="text-xs text-gray-400 font-medium">Stój nieruchomo na krawędzi rozmycia</p>
              <p className="text-[10px] text-gray-300 mt-0.5">Kółko wypełni się samo i zapisze</p>
            </div>
            <button
              onClick={() => setSnellenRows(r => Math.min(6, r + 1))}
              className="p-3 rounded-full bg-black/5 text-gray-500 hover:bg-black/10 active:scale-90 transition-all"
            >
              <ZoomIn size={20} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          CAPTURED PHASE — result screen
      ══════════════════════════════════════════════ */}
      {phase === 'captured' && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 gap-8">
          <div className="w-full max-w-xs rounded-3xl bg-surface border-2 border-primary/30 p-8 text-center shadow-2xl">
            <p className="text-[10px] uppercase tracking-widest text-text-muted mb-5 font-bold">
              {selectedEye === 'left' ? '👁 Lewe oko' : 'Prawe oko 👁'}
            </p>
            <div className="flex items-end justify-center gap-4">
              <div>
                <p className="text-6xl font-black font-display tabular-nums">{capturedDistance?.toFixed(1)}</p>
                <p className="text-sm text-text-muted font-bold mt-1">cm</p>
              </div>
              <p className="text-3xl font-black text-text-muted mb-3">=</p>
              <div>
                <p className="text-6xl font-black font-display text-primary tabular-nums">{capturedDiopters?.toFixed(2)}</p>
                <p className="text-sm text-text-muted font-bold mt-1">D</p>
              </div>
            </div>
          </div>

          {saveError && (
            <div className="w-full max-w-xs flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="shrink-0" />
              Błąd zapisu. Spróbuj ponownie.
            </div>
          )}

          <div className="w-full max-w-xs flex flex-col gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-5 bg-primary text-background font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              <Check size={18} />
              {isSaving ? 'Zapisywanie...' : 'Zapisz pomiar'}
            </button>
            <button
              onClick={handleRetry}
              className="w-full py-3 text-sm text-text-muted flex items-center justify-center gap-1.5 hover:text-text-primary transition-colors"
            >
              <RotateCcw size={14} />
              Zmierz ponownie
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          SAVED PHASE — success flash
      ══════════════════════════════════════════════ */}
      {phase === 'saved' && (
        <div className="fixed inset-0 z-50 bg-emerald-950 flex flex-col items-center justify-center gap-4">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check size={36} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">Zapisano!</p>
          <p className="text-sm text-emerald-700">Wracam do wyboru oka...</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          NORMAL PHASES (calibrate / select-eye)
      ══════════════════════════════════════════════ */}
      {(phase === 'calibrate' || phase === 'select-eye') && (
        <>
          <header className="sticky top-0 z-40 w-full px-4 py-3 flex items-center gap-3 border-b border-border-custom bg-background/90 backdrop-blur-md">
            <Link to="/medical" className="rounded-xl border border-border-custom p-2 text-text-muted hover:text-text-primary bg-surface transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-base font-black uppercase tracking-tight leading-none">Vanguard Optics</h1>
              <p className="text-[10px] text-text-muted mt-0.5">
                {phase === 'calibrate' ? 'Kalibracja wymagana' : 'Wybierz oko do pomiaru'}
              </p>
            </div>
          </header>

          <main className="flex-1 flex flex-col items-center px-4 pt-10 pb-32 gap-6">

            {/* Calibration */}
            {phase === 'calibrate' && (
              <div className="w-full max-w-sm bg-surface border border-border-custom rounded-3xl p-7 text-center shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
                  <Ruler className="text-amber-400" size={24} />
                </div>
                <h2 className="text-xl font-black mb-2">Kalibracja jednorazowa</h2>
                <p className="text-sm text-text-muted mb-6 leading-relaxed">
                  Wyciągnij rękę, trzymaj telefon dokładnie <span className="text-text-primary font-bold">40 cm</span> od twarzy. Twarz prosto w kamerę.
                </p>
                {isReady && !faceDetected && (
                  <div className="flex items-center gap-2 text-xs text-amber-400/80 mb-5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    Skieruj twarz na kamerę
                  </div>
                )}
                {isReady && faceDetected && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 mb-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    Twarz wykryta — gotowy do kalibracji
                  </div>
                )}
                <button
                  onClick={handleCalibrate}
                  disabled={!isReady || !faceDetected}
                  className="w-full bg-primary text-background font-bold py-4 rounded-2xl disabled:opacity-30 active:scale-95 transition-all"
                >
                  {!isReady ? 'Ładowanie AI...' : 'Skalibruj na 40 cm'}
                </button>
              </div>
            )}

            {/* Eye selection */}
            {phase === 'select-eye' && (
              <>
                <div className="w-full max-w-sm text-center mb-2">
                  <h2 className="text-2xl font-black mb-1">Które oko?</h2>
                  <p className="text-sm text-text-muted">Zasłoń drugie oko i dotknij odpowiedniego</p>
                </div>

                <div className="w-full max-w-sm grid grid-cols-2 gap-4">
                  <button
                    onClick={() => startMeasure('left')}
                    className="aspect-square bg-surface border border-border-custom rounded-3xl flex flex-col items-center justify-center gap-3 active:scale-95 transition-all hover:border-primary/50 hover:bg-primary/5"
                  >
                    <span className="text-5xl">👁</span>
                    <span className="font-black text-lg">Lewe</span>
                  </button>
                  <button
                    onClick={() => startMeasure('right')}
                    className="aspect-square bg-surface border border-border-custom rounded-3xl flex flex-col items-center justify-center gap-3 active:scale-95 transition-all hover:border-primary/50 hover:bg-primary/5"
                  >
                    <span className="text-5xl">👁</span>
                    <span className="font-black text-lg">Prawe</span>
                  </button>
                </div>

                <button
                  onClick={resetCalibration}
                  className="text-xs text-text-muted/50 hover:text-text-muted transition-colors underline underline-offset-4 mt-2"
                >
                  Powtórz kalibrację
                </button>
              </>
            )}
          </main>

          {/* Glasses Cabinet + History */}
          <div className="w-full max-w-4xl mx-auto px-4 pb-24 space-y-10">
            <GlassesCabinet />
            <div>
              <h2 className="text-2xl font-black font-display uppercase tracking-tight mb-6">Dziennik EndMyopia</h2>
              <VisionJournal refreshTrigger={refreshTrigger} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
