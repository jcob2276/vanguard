import React, { useRef, useState, useEffect } from 'react';
import { useFaceDistance } from '../../hooks/useFaceDistance';
import { supabase } from '../../lib/supabase';
import { ScanFace, Check, ArrowLeft, Ruler, ZoomIn, ZoomOut, AlertCircle, Eye, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import VisionJournal from './VisionJournal';
import GlassesCabinet from './GlassesCabinet';

const EYE_LABELS = { left: 'Lewe 👁', right: 'Prawe 👁', both: 'Oba 👀' } as const;
const SNELLEN_ROWS = ['E', 'F P', 'T O Z', 'L P E D', 'P E C F D', 'E D F C Z P'];

export default function EndMyopiaCalculator() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { distance, isReady, calibrationFactor, calibrate, resetCalibration } = useFaceDistance(videoRef);

  const [selectedEye, setSelectedEye] = useState<'left' | 'right' | 'both'>('left');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [textSize, setTextSize] = useState(3); // 1–6
  const [faceDetected, setFaceDetected] = useState(false);

  // Track face detection status
  useEffect(() => {
    setFaceDetected(distance !== null);
  }, [distance]);

  // Setup camera
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

  const diopters = distance ? (-100 / distance) : null;
  const diopterStr = diopters ? diopters.toFixed(2) : null;

  const handleSave = async () => {
    if (!distance || !diopterStr) return;
    setIsSaving(true);
    setSaveError(false);
    try {
      const { error } = await supabase.from('endmyopia_measurements').insert({
        eye_measured: selectedEye,
        blur_distance_cm: parseFloat(distance.toFixed(2)),
        diopters: parseFloat(diopterStr),
      });
      if (error) throw error;
      setSaveSuccess(true);
      setRefreshTrigger(prev => prev + 1);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col">

      {/* PIP Camera — bottom right, always visible */}
      <div className="fixed bottom-6 right-4 z-50 w-20 h-28 md:w-28 md:h-40 rounded-2xl overflow-hidden shadow-2xl border-2 border-border-custom ring-2 ring-background">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
        {/* Face detection indicator */}
        <div className={`absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-background transition-colors duration-300 ${faceDetected ? 'bg-emerald-500' : isReady ? 'bg-red-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`} />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <ScanFace className="text-white/60 animate-pulse" size={20} />
          </div>
        )}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full px-4 py-3 flex items-center justify-between border-b border-border-custom bg-background/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link to="/medical" className="rounded-xl border border-border-custom p-2 text-text-muted hover:text-text-primary bg-surface transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-black uppercase tracking-tight leading-none">Vanguard Optics</h1>
            <p className="text-[10px] text-text-muted mt-0.5">Pomiar odległości rozmycia</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isReady && <span className="text-[11px] text-amber-500 animate-pulse font-medium">Ładowanie AI...</span>}
          {isReady && faceDetected && <span className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1"><Eye size={12} /> Twarz wykryta</span>}
          {isReady && !faceDetected && <span className="text-[11px] text-red-400 font-medium flex items-center gap-1"><AlertCircle size={12} /> Brak twarzy</span>}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-6 gap-6 pb-28">

        {/* STEP 1: Calibration */}
        {!calibrationFactor && (
          <div className="w-full max-w-sm">
            <div className="bg-surface border border-border-custom p-6 rounded-3xl text-center shadow-xl">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <Ruler className="text-amber-500" size={26} />
              </div>
              <h2 className="text-lg font-black mb-1">Krok 1: Kalibracja</h2>
              <p className="text-sm text-text-muted mb-5 leading-relaxed">
                Wyciągnij rękę przed siebie i trzymaj telefon w odległości dokładnie <strong className="text-text-primary">40 cm</strong> od twarzy. Poczekaj aż kamera zobaczy Twoją twarz i kliknij przycisk.
              </p>

              {/* Face status hint */}
              {isReady && !faceDetected && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-4">
                  <AlertCircle size={14} />
                  Ustaw twarz przed kamerą (zielona kropka = wykryto)
                </div>
              )}

              <button
                onClick={() => calibrate(40)}
                disabled={!isReady || !faceDetected}
                className="w-full bg-primary text-background font-bold py-4 rounded-xl disabled:opacity-40 active:scale-95 transition-all text-sm"
              >
                {!isReady ? '⏳ Ładowanie kamery AI...' : !faceDetected ? '👁 Pokaż twarz kamerze' : '✓ Skalibruj na 40 cm'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Measurement */}
        {calibrationFactor && (
          <>
            {/* Instruction */}
            <div className="w-full max-w-sm">
              <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-3">
                <Activity size={16} className="text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-300 leading-relaxed">
                  Przesuń telefon powoli od oka w kierunku tekstu poniżej. Zatrzymaj dokładnie w miejscu, gdzie litery zaczynają być wyraźne <strong className="text-blue-200">(Edge of Blur)</strong>. Kliknij Zapisz.
                </p>
              </div>
            </div>

            {/* Snellen Box */}
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <button
                  onClick={() => setTextSize(s => Math.max(1, s - 1))}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors active:scale-90"
                >
                  <ZoomOut size={18} />
                </button>
                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">
                  Tablica Snellena
                </span>
                <button
                  onClick={() => setTextSize(s => Math.min(6, s + 1))}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors active:scale-90"
                >
                  <ZoomIn size={18} />
                </button>
              </div>
              {/* Letters */}
              <div className="flex flex-col items-center py-6 px-4 gap-1 select-none">
                {SNELLEN_ROWS.slice(0, textSize).map((row, i) => (
                  <p
                    key={i}
                    className="text-black font-black tracking-widest leading-tight text-center font-mono"
                    style={{ fontSize: `${Math.max(0.7, (textSize - i) * 0.75)}rem` }}
                  >
                    {row}
                  </p>
                ))}
              </div>
            </div>

            {/* Readouts */}
            <div className="w-full max-w-sm grid grid-cols-2 gap-3">
              <div className={`rounded-2xl p-4 flex flex-col items-center border transition-all ${faceDetected ? 'bg-surface border-border-custom' : 'bg-surface/40 border-border-custom/40'}`}>
                <span className="text-[10px] uppercase font-bold text-text-muted mb-1">Odległość</span>
                <span className={`text-3xl font-black font-display transition-colors ${faceDetected ? '' : 'text-text-muted/30'}`}>
                  {distance ? distance.toFixed(1) : '--'}
                  <span className="text-sm font-medium text-text-muted ml-1">cm</span>
                </span>
              </div>
              <div className={`rounded-2xl p-4 flex flex-col items-center border transition-all ${faceDetected ? 'bg-surface border-border-custom' : 'bg-surface/40 border-border-custom/40'}`}>
                <span className="text-[10px] uppercase font-bold text-text-muted mb-1">Dioptrie</span>
                <span className={`text-3xl font-black font-display transition-colors ${faceDetected ? 'text-primary' : 'text-text-muted/30'}`}>
                  {diopterStr ?? '--'}
                  <span className="text-sm font-medium text-text-muted ml-1">D</span>
                </span>
              </div>
            </div>

            {/* Face not detected warning */}
            {!faceDetected && (
              <div className="w-full max-w-sm flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                <AlertCircle size={14} className="shrink-0" />
                Twarz poza kadrem. Wróć do podglądu kamery (prawy dolny róg).
              </div>
            )}

            {/* Eye selector */}
            <div className="w-full max-w-sm bg-surface border border-border-custom rounded-2xl p-1.5 flex gap-1">
              {(['left', 'both', 'right'] as const).map(eye => (
                <button
                  key={eye}
                  onClick={() => setSelectedEye(eye)}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                    selectedEye === eye
                      ? 'bg-primary text-background shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {EYE_LABELS[eye]}
                </button>
              ))}
            </div>

            {/* Save button */}
            <div className="w-full max-w-sm flex flex-col gap-2">
              <button
                onClick={handleSave}
                disabled={!distance || isSaving || saveSuccess}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:cursor-not-allowed ${
                  saveSuccess
                    ? 'bg-emerald-500 text-white'
                    : saveError
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : !distance
                    ? 'bg-surface text-text-muted border border-border-custom opacity-50'
                    : 'bg-primary text-background hover:opacity-90'
                }`}
              >
                {saveSuccess ? <><Check size={18} /> Zapisano!</> :
                 saveError ? <><AlertCircle size={18} /> Błąd zapisu</> :
                 isSaving ? 'Zapisywanie...' :
                 !distance ? 'Brak pomiaru' :
                 `Zapisz — ${EYE_LABELS[selectedEye]}, ${diopterStr} D`}
              </button>

              <button
                onClick={resetCalibration}
                className="text-xs text-text-muted hover:text-text-primary transition-colors underline underline-offset-4 decoration-border-custom py-1"
              >
                Powtórz kalibrację
              </button>
            </div>
          </>
        )}
      </main>

      {/* Glasses Cabinet + History below */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 pb-24 space-y-10">
        <GlassesCabinet />
        <div>
          <h2 className="text-2xl font-black font-display uppercase tracking-tight mb-6">Dziennik EndMyopia</h2>
          <VisionJournal refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </div>
  );
}
