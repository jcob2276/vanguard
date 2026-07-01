import React, { useRef, useState, useEffect } from 'react';
import { useFaceDistance } from '../../hooks/useFaceDistance';
import { supabase } from '../../lib/supabase';
import { Camera, ScanFace, Check, ArrowLeft, Ruler, ZoomIn, ZoomOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import VisionJournal from './VisionJournal';
import GlassesCabinet from './GlassesCabinet';
import EndMyopiaDailyLog from './EndMyopiaDailyLog';

export default function EndMyopiaCalculator() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { distance, isReady, calibrationFactor, calibrate, resetCalibration } = useFaceDistance(videoRef);
  
  const [streamActive, setStreamActive] = useState(false);
  const [selectedEye, setSelectedEye] = useState<'left' | 'right' | 'both'>('left');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [textSize, setTextSize] = useState(3); // 1 to 5 scale

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamActive(true);
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
      }
    }
    setupCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const diopters = distance ? (-100 / distance).toFixed(2) : '0.00';

  const handleSave = async () => {
    if (!distance) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase.from('endmyopia_measurements').insert({
        eye_measured: selectedEye,
        blur_distance_cm: parseFloat(distance.toFixed(2)),
        diopters: parseFloat(diopters),
      });
      if (error) throw error;
      
      setSaveSuccess(true);
      setRefreshTrigger(prev => prev + 1);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Error saving measurement', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col relative overflow-hidden">
      {/* PIP Video */}
      <div className="fixed bottom-6 right-6 z-50 w-24 h-32 md:w-32 md:h-48 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-border-custom ring-4 ring-background">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform -scale-x-100"
        />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <ScanFace className="text-white/50 animate-pulse" size={24} />
          </div>
        )}
      </div>

      <header className="relative z-10 w-full p-4 flex items-center justify-between border-b border-border-custom bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to="/medical"
            className="rounded-xl border border-border-custom p-2 text-text-muted hover:text-text-primary bg-surface"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-black font-display uppercase tracking-tight">Vanguard Optics</h1>
        </div>
        <div className="flex items-center gap-2">
           {!isReady && <span className="text-xs text-text-muted animate-pulse">Ładowanie AI...</span>}
           {isReady && <ScanFace size={18} className="text-emerald-500" />}
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 pb-20">
        {!calibrationFactor ? (
          <div className="bg-surface/90 backdrop-blur-md border border-border-custom p-6 rounded-3xl max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Ruler className="text-primary" size={28} />
            </div>
            <h2 className="text-xl font-bold mb-2">Kalibracja Kamery</h2>
            <p className="text-sm text-text-muted mb-6">
              Aby pomiar był dokładny do centymetra, wyciągnij rękę i ustaw telefon dokładnie <strong className="text-text-primary">40 cm</strong> od swojej twarzy. Następnie kliknij przycisk poniżej.
            </p>
            <button
              onClick={() => calibrate(40)}
              disabled={!isReady}
              className="w-full bg-primary text-background font-bold py-3.5 px-4 rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
            >
              {isReady ? 'Skalibruj (40 cm)' : 'Czekam na kamerę...'}
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md flex flex-col items-center">
            {/* The Text to focus on - Snellen Box */}
            <div className="bg-white p-8 rounded-[2rem] mb-8 w-full shadow-2xl flex flex-col items-center text-center border-4 border-white">
              <div className="w-full flex justify-between items-center mb-6">
                <button 
                  onClick={() => setTextSize(Math.max(1, textSize - 1))}
                  className="p-2 text-gray-400 hover:text-black transition-colors rounded-full hover:bg-gray-100"
                >
                  <ZoomOut size={20} />
                </button>
                <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Snellen Box</span>
                <button 
                  onClick={() => setTextSize(Math.min(5, textSize + 1))}
                  className="p-2 text-gray-400 hover:text-black transition-colors rounded-full hover:bg-gray-100"
                >
                  <ZoomIn size={20} />
                </button>
              </div>

              <div className="text-black font-sans font-black tracking-tight" style={{ fontSize: `${textSize * 1.5}rem`, lineHeight: 1.1 }}>
                <p>E</p>
                <p>F P</p>
                <p>T O Z</p>
                {textSize > 2 && <p>L P E D</p>}
                {textSize > 3 && <p>P E C F D</p>}
                {textSize > 4 && <p>E D F C Z P</p>}
              </div>
            </div>

            {/* Readouts */}
            <div className="grid grid-cols-2 gap-4 w-full mb-8">
              <div className="bg-surface/80 backdrop-blur-md border border-border-custom rounded-2xl p-4 flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-text-muted mb-1">Odległość</span>
                <span className="text-3xl font-black font-display">
                  {distance ? distance.toFixed(1) : '--'}
                  <span className="text-sm font-medium text-text-muted ml-1">cm</span>
                </span>
              </div>
              <div className="bg-surface/80 backdrop-blur-md border border-border-custom rounded-2xl p-4 flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-text-muted mb-1">Dioptrie</span>
                <span className="text-3xl font-black font-display text-primary">
                  {distance ? diopters : '--'}
                  <span className="text-sm font-medium text-text-muted ml-1">D</span>
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="w-full bg-surface/80 backdrop-blur-md border border-border-custom rounded-3xl p-2 flex gap-1 mb-6">
              {(['left', 'both', 'right'] as const).map((eye) => (
                <button
                  key={eye}
                  onClick={() => setSelectedEye(eye)}
                  className={`flex-1 py-3 text-xs font-bold uppercase rounded-2xl transition-colors ${
                    selectedEye === eye
                      ? 'bg-background text-primary shadow-sm border border-border-custom'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {eye === 'left' ? 'Lewe' : eye === 'right' ? 'Prawe' : 'Obje'}
                </button>
              ))}
            </div>

            <button
              onClick={handleSave}
              disabled={!distance || isSaving || saveSuccess}
              className={`w-full py-5 rounded-2xl font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                saveSuccess
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-primary text-background'
              } disabled:opacity-50`}
            >
              {saveSuccess ? (
                <>
                  <Check size={18} />
                  Zapisano
                </>
              ) : isSaving ? (
                'Zapisywanie...'
              ) : (
                'Zapisz Pomiar'
              )}
            </button>
            
            <button
              onClick={resetCalibration}
              className="mt-6 text-xs text-text-muted hover:text-text-primary underline decoration-border-custom underline-offset-4"
            >
              Rekalibracja kamery
            </button>
          </div>
        )}
      </main>

      <div className="relative z-10 w-full max-w-4xl mx-auto p-6 pb-24 space-y-12">
        <div>
          <GlassesCabinet />
        </div>
        
        <div>
          <h2 className="text-2xl font-black font-display uppercase tracking-tight mb-6">Dziennik EndMyopia</h2>
          <VisionJournal refreshTrigger={refreshTrigger} />
        </div>
        
        <div>
          <EndMyopiaDailyLog onLogSaved={() => setRefreshTrigger(prev => prev + 1)} />
        </div>
      </div>
    </div>
  );
}
