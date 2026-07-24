import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mic, Send, X, Radio, Utensils, CheckSquare, FileText, Zap, Pill } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { captureEntry } from '../../lib/chatApi';
import { notify } from '../../lib/notify';
import FoodQuickCapture from '../core/nutrition/FoodQuickCapture';

interface CategoryChip {
  id: string;
  label: string;
  prefix: string;
  icon: React.ElementType;
}

const CATEGORIES: CategoryChip[] = [
  { id: 'food', label: 'Posiłek', prefix: 'Posiłek: ', icon: Utensils },
  { id: 'todo', label: 'Zadanie', prefix: 'Zadanie: ', icon: CheckSquare },
  { id: 'note', label: 'Notatka', prefix: 'Notatka: ', icon: FileText },
  { id: 'friction', label: 'Tarcie', prefix: 'Tarcie: ', icon: Zap },
  { id: 'supps', label: 'Suplement', prefix: 'Suplement: ', icon: Pill },
];

export default function QuickCaptureWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    const checkUrlParams = () => {
      const search = window.location.search;
      if (search.includes('capture=food')) {
        setOpen(true);
        setActiveCategory('food');
      } else if (search.includes('capture=voice') || search.includes('capture=open')) {
        setOpen(true);
      }
    };

    checkUrlParams();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectCategory = (cat: CategoryChip) => {
    if (activeCategory === cat.id) {
      setActiveCategory(null);
      if (input.startsWith(cat.prefix)) {
        setInput(input.slice(cat.prefix.length));
      }
    } else {
      setActiveCategory(cat.id);
      if (cat.id !== 'food') {
        const cleanInput = CATEGORIES.reduce((acc, curr) => {
          return acc.startsWith(curr.prefix) ? acc.slice(curr.prefix.length) : acc;
        }, input);
        setInput(cat.prefix + cleanInput);
      }
    }
  };

  const handleCapture = async () => {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput('');
    setActiveCategory(null);
    setLoading(true);

    try {
      await captureEntry({ content, source: activeCategory ? `quick_${activeCategory}` : 'quick_capture_widget' });
      notify('Wpis zapisany w Vanguard Stream', 'success');
      setOpen(false);
    } catch (err) {
      notify('Błąd zapisu wpisu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        setLoading(true);
        try {
          await captureEntry({ audioBlob, source: activeCategory ? `quick_voice_${activeCategory}` : 'quick_widget_voice' });
          notify('Notatka głosowa zapisana w streamie', 'success');
          setOpen(false);
        } catch (err) {
          notify('Błąd przetwarzania głosu', 'error');
        } finally {
          setLoading(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      notify('Brak dostępu do mikrofonu', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  if (location.pathname === '/czat') return null;

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-primary text-primary-foreground rounded-full shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
        title="Quick Capture (Cmd+K)"
      >
        <Sparkles className="w-5 h-5 animate-pulse" />
      </button>

      {/* Popover Capture Dialog */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className={`fixed bottom-24 right-6 z-50 ${
              activeCategory === 'food' ? 'w-[90vw] sm:w-[460px]' : 'w-80 sm:w-96'
            } bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl p-4 shadow-2xl space-y-3 max-h-[85vh] overflow-y-auto`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2 text-xs font-bold text-primary tracking-wide">
                <Radio className="w-4 h-4 text-primary animate-pulse" />
                <span>QUICK CAPTURE</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Quick Chips */}
            <div className="flex flex-wrap gap-1.5 py-1">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]'
                        : 'bg-muted/40 hover:bg-muted/80 text-muted-foreground hover:text-foreground border-border/40'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary-foreground' : 'text-primary'}`} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Interactive Food Card vs Standard Capture */}
            {activeCategory === 'food' ? (
              <div className="pt-1">
                <FoodQuickCapture
                  onSaved={() => {
                    notify('Posiłek zapisany!', 'success');
                  }}
                />
              </div>
            ) : recording ? (
              <div className="py-6 flex flex-col items-center justify-center gap-3 bg-destructive/5 rounded-xl border border-destructive/20">
                <div className="w-14 h-14 rounded-full bg-destructive/20 border border-destructive/40 flex items-center justify-center animate-pulse">
                  <Mic className="w-7 h-7 text-destructive animate-bounce" />
                </div>
                <span className="text-xs text-destructive font-semibold">Nagrywanie notatki ({recordingTime}s)...</span>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-xl text-xs font-semibold shadow hover:opacity-90 transition-opacity"
                >
                  Zatrzymaj i zapisz
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && handleCapture()}
                  placeholder="Wpisz treść wpisu... (Ctrl+Enter wysyła)"
                  className="w-full h-28 bg-background/80 border border-border/80 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none placeholder:text-muted-foreground/60 shadow-inner"
                />

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-muted/60 hover:bg-muted text-foreground rounded-xl text-xs font-semibold transition-colors border border-border/40"
                  >
                    <Mic className="w-4 h-4 text-primary" />
                    <span>Nagraj głos</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCapture}
                    disabled={!input.trim() || loading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow hover:opacity-90 disabled:opacity-40 transition-all"
                  >
                    <span>Wyślij</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
