import React, { useRef, useState, useEffect } from 'react';
import { useFaceDistance } from '../../hooks/useFaceDistance';
import { supabase } from '../../lib/supabase';
import {
  ScanFace, Check, ArrowLeft, Ruler, ZoomIn, ZoomOut,
  AlertCircle, Eye, Camera, Lock, RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import VisionJournal from './VisionJournal';
import GlassesCabinet from './GlassesCabinet';

const SNELLEN_ROWS = ['E', 'F P', 'T O Z', 'L P E D', 'P E C F D', 'E D F C Z P'];

type MeasureState = 'live' | 'frozen' | 'saved';
type Eye = 'left' | 'right';

export default function EndMyopiaCalculator() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { distance, isReady, calibrationFactor, calibrate, resetCalibration } = useFaceDistance(videoRef);

  const [selectedEye, setSelectedEye] = useState<Eye>('left');
  const [measureState, setMeasureState] = useState<MeasureState>('live');
  const [frozenDistance, setFrozenDistance] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [textSize, setTextSize] = useState(3);

  const faceDetected = distance !== null;
  const activeDistance = measureState === 'frozen' ? frozenDistance : distance;
  const activeDiopters = activeDistance ? (-100 / activeDistance) : null;

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

  // Reset freeze when face leaves frame
  useEffect(() => {
    if (!faceDetected && measureState === 'live') {
      setFrozenDistance(null);
    }
  }, [faceDetected, measureState]);

  const handleFreeze = () => {
    if (!distance) return;
    setFrozenDistance(distance);
    setMeasureState('frozen');
  };

  const handleUnfreeze = () => {
    setMeasureState('live');
    setFrozenDistance(null);
    setSaveError(false);
  };

  const handleSave = async () => {
    if (!frozenDistance || !activeDiopters) return;
    setIsSaving(true);
    setSaveError(false);
    try {
      const { error } = await supabase.from('endmyopia_measurements').insert({
        eye_measured: selectedEye,
        blur_distance_cm: parseFloat(frozenDistance.toFixed(2)),
        diopters: parseFloat(activeDiopters.toFixed(2)),
      });
      if (error) throw error;
      setMeasureState('saved');
      setRefreshTrigger(prev => prev + 1);
      setTimeout(() => {
        setMeasureState('live');
        setFrozenDistance(null);
      }, 2000);
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col">

      {/* PIP Camera */}
      <div className="fixed bottom-24 right-4 z-50 w-20 h-28 rounded-2xl overflow-hidden shadow-xl border-2 border-border-custom ring-2 ring-background">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
        <div className={`absolute bottom-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-black/30 transition-colors ${
          faceDetected ? 'bg-emerald-400' : isReady ? 'bg-red-400 animate-pulse' : 'bg-yellow-400 animate-pulse'
        }`} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full px-4 py-3 flex items-center justify-between border-b border-border-custom bg-background/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link to="/medical" className="rounded-xl border border-border-custom p-2 text-text-muted hover:text-text-primary bg-surface transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-black uppercase tracking-tight leading-none">Vanguard Optics</h1>
            <p className="text-[10px] text-text-muted mt-0.5">
              {!calibrationFactor ? 'Kalibracja wymagana' : measureState === 'live' ? 'Pomiar aktywny' : measureState === 'frozen' ? 'Odczyt zamrożony' : 'Zapisano!'}
            </p>
          </div>
        </div>
        {isReady && (
          <div className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
            faceDetected
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-red-400 bg-red-500/10 border-red-500/20'
          }`}>
            {faceDetected ? <Eye size={11} /> : <AlertCircle size={11} />}
            {faceDetected ? 'Twarz OK' : 'Brak twarzy'}
          </div>
        )}
        {!isReady && (
          <span className="text-[11px] text-amber-400 animate-pulse font-medium flex items-center gap-1">
            <ScanFace size={13} /> AI...
          </span>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pt-6 pb-32 gap-5">

        {/* ── CALIBRATION STEP ── */}
        {!calibrationFactor && (
          <div className="w-full max-w-sm bg-surface border border-border-custom rounded-3xl p-6 text-center shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Ruler className="text-amber-400" size={22} />
            </div>
            <h2 className="text-lg font-black mb-1">Kalibracja</h2>
            <p className="text-sm text-text-muted mb-5 leading-relaxed">
              Trzymaj telefon w odległości <span className="text-text-primary font-bold">40 cm</span> od twarzy, twarz skierowana prosto w kamerę.
            </p>
            {isReady && !faceDetected && (
              <div className="flex items-center gap-2 text-xs text-amber-400/80 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                <Camera size={13} />
                Skieruj twarz na kamerę (zielona kropka)
              </div>
            )}
            <button
              onClick={() => calibrate(40)}
              disabled={!isReady || !faceDetected}
              className="w-full bg-primary text-background font-bold py-4 rounded-2xl disabled:opacity-35 active:scale-95 transition-all"
            >
              {!isReady ? 'Ładowanie AI...' : !faceDetected ? 'Pokaż twarz kamerze' : '✓  Skalibruj na 40 cm'}
            </button>
          </div>
        )}

        {/* ── MEASUREMENT FLOW ── */}
        {calibrationFactor && (
          <>
            {/* Eye selector — top, before Snellen */}
            <div className="w-full max-w-sm bg-surface border border-border-custom rounded-2xl p-1.5 flex gap-1">
              {(['left', 'right'] as const).map(eye => (
                <button
                  key={eye}
                  onClick={() => { setSelectedEye(eye); if (measureState !== 'live') handleUnfreeze(); }}
                  className={`flex-1 py-3 text-sm font-black rounded-xl transition-all active:scale-95 ${
                    selectedEye === eye
                      ? 'bg-primary text-background shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {eye === 'left' ? '👁 Lewe' : 'Prawe 👁'}
                </button>
              ))}
            </div>

            {/* Snellen Box */}
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <button
                  onClick={() => setTextSize(s => Math.max(1, s - 1))}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors active:scale-90"
                >
                  <ZoomOut size={17} />
                </button>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-300">Skup wzrok tu</p>
                <button
                  onClick={() => setTextSize(s => Math.min(6, s + 1))}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors active:scale-90"
                >
                  <ZoomIn size={17} />
                </button>
              </div>
              <div className="flex flex-col items-center py-6 px-4 gap-0.5 select-none">
                {SNELLEN_ROWS.slice(0, textSize).map((row, i) => (
                  <p
                    key={i}
                    className="text-black font-black tracking-[0.25em] text-center font-mono leading-tight"
                    style={{ fontSize: `${Math.max(0.65, (textSize - i) * 0.72)}rem` }}
                  >
                    {row}
                  </p>
                ))}
              </div>
            </div>

            {/* ── LIVE readings ── */}
            {measureState === 'live' && (
              <>
                <div className="w-full max-w-sm grid grid-cols-2 gap-3">
                  <div className={`rounded-2xl p-4 flex flex-col items-center border transition-all ${faceDetected ? 'bg-surface border-border-custom' : 'bg-surface/30 border-border-custom/30'}`}>
                    <span className="text-[10px] uppercase font-bold text-text-muted mb-1">Odległość</span>
                    <span className={`text-3xl font-black font-display ${faceDetected ? '' : 'text-text-muted/30'}`}>
                      {distance ? distance.toFixed(1) : '--'}
                      <span className="text-sm font-medium text-text-muted ml-1">cm</span>
                    </span>
                  </div>
                  <div className={`rounded-2xl p-4 flex flex-col items-center border transition-all ${faceDetected ? 'bg-surface border-border-custom' : 'bg-surface/30 border-border-custom/30'}`}>
                    <span className="text-[10px] uppercase font-bold text-text-muted mb-1">Dioptrie</span>
                    <span className={`text-3xl font-black font-display ${faceDetected ? 'text-primary' : 'text-text-muted/30'}`}>
                      {activeDiopters ? activeDiopters.toFixed(2) : '--'}
                      <span className="text-sm font-medium text-text-muted ml-1">D</span>
                    </span>
                  </div>
                </div>

                {!faceDetected && (
                  <p className="text-xs text-text-muted flex items-center gap-1.5">
                    <AlertCircle size={13} className="text-amber-400" />
                    Wróć do kadru kamery (prawy dolny róg)
                  </p>
                )}

                <button
                  onClick={handleFreeze}
                  disabled={!faceDetected}
                  className="w-full max-w-sm py-5 bg-primary text-background font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-30"
                >
                  <Lock size={18} />
                  Zatrzymaj odczyt
                </button>
              </>
            )}

            {/* ── FROZEN reading ── */}
            {(measureState === 'frozen' || measureState === 'saved') && (
              <>
                {/* Big frozen readout */}
                <div className={`w-full max-w-sm rounded-3xl p-6 text-center border-2 transition-all ${
                  measureState === 'saved'
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : 'bg-surface border-primary/40'
                }`}>
                  {measureState === 'saved' ? (
                    <div className="flex flex-col items-center gap-2">
                      <Check size={32} className="text-emerald-400" />
                      <p className="text-emerald-400 font-black text-lg">Zapisano!</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-[10px] uppercase tracking-widest text-text-muted mb-3 font-bold flex items-center justify-center gap-1.5">
                        <Lock size={10} /> Odczyt zamrożony
                      </p>
                      <div className="flex items-end justify-center gap-6">
                        <div>
                          <p className="text-5xl font-black font-display">{frozenDistance?.toFixed(1)}</p>
                          <p className="text-xs text-text-muted font-bold mt-1">cm</p>
                        </div>
                        <div className="text-text-muted text-2xl font-black mb-1">=</div>
                        <div>
                          <p className="text-5xl font-black font-display text-primary">{activeDiopters?.toFixed(2)}</p>
                          <p className="text-xs text-text-muted font-bold mt-1">dioptrie</p>
                        </div>
                      </div>
                      <p className="text-xs text-text-muted mt-3">
                        {selectedEye === 'left' ? '👁 Lewe oko' : 'Prawe oko 👁'}
                      </p>
                    </>
                  )}
                </div>

                {saveError && (
                  <div className="w-full max-w-sm flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                    <AlertCircle size={14} />
                    Błąd zapisu — sprawdź połączenie
                  </div>
                )}

                {measureState === 'frozen' && (
                  <div className="w-full max-w-sm flex flex-col gap-2">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="w-full py-5 bg-primary text-background font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Check size={18} />
                      {isSaving ? 'Zapisywanie...' : 'Zapisz pomiar'}
                    </button>
                    <button
                      onClick={handleUnfreeze}
                      className="w-full py-3 text-sm text-text-muted font-semibold flex items-center justify-center gap-1.5 hover:text-text-primary transition-colors"
                    >
                      <RotateCcw size={14} />
                      Zmierz ponownie
                    </button>
                  </div>
                )}
              </>
            )}

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
    </div>
  );
}
