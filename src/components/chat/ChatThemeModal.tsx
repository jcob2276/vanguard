import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Palette, MessageSquare, Moon, Sun, Check } from 'lucide-react';
import { useChatThemeStore, type AccentColor, type BubbleStyle, type BgMode } from '../../store/useChatThemeStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ACCENTS: { id: AccentColor; name: string; bgClass: string; hex: string }[] = [
  { id: 'blue', name: 'Apple Blue', bgClass: 'bg-[#007AFF]', hex: '#007AFF' },
  { id: 'emerald', name: 'Vanguard Emerald', bgClass: 'bg-[#10B981]', hex: '#10B981' },
  { id: 'amber', name: 'Cyber Amber', bgClass: 'bg-[#F59E0B]', hex: '#F59E0B' },
  { id: 'violet', name: 'Deep Violet', bgClass: 'bg-[#8B5CF6]', hex: '#8B5CF6' },
  { id: 'rose', name: 'Neon Rose', bgClass: 'bg-[#F43F5E]', hex: '#F43F5E' },
];

const STYLES: { id: BubbleStyle; name: string; desc: string }[] = [
  { id: 'imessage', name: 'iMessage', desc: 'Asymetryczny łuk rogów' },
  { id: 'pill', name: 'Rounded Pill', desc: 'Gładka zaokrąglona pigułka' },
  { id: 'card', name: 'Modern Card', desc: 'Czysta karta z obramowaniem' },
];

const BACKGROUNDS: { id: BgMode; name: string; icon: React.ElementType }[] = [
  { id: 'amoled', name: 'AMOLED Black (#000)', icon: Moon },
  { id: 'dark', name: 'Night Slate (#1C1C1E)', icon: Moon },
  { id: 'light', name: 'Clean Light (#F2F2F7)', icon: Sun },
];

export default function ChatThemeModal({ open, onClose }: Props) {
  const { accentColor, bubbleStyle, bgMode, setAccentColor, setBubbleStyle, setBgMode } = useChatThemeStore();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-sans">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md bg-[#1C1C1E] text-white border border-[#38383A] rounded-3xl p-6 shadow-2xl space-y-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Palette className="w-4 h-4 text-[#3894F6]" />
                <span>Personalizacja Czatu</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Accent Color Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 block">Kolor Akcentu (Accent Color)</label>
              <div className="flex items-center justify-between gap-2 bg-[#2C2C2E] p-3 rounded-2xl border border-[#38383A]">
                {ACCENTS.map((acc) => {
                  const isActive = accentColor === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setAccentColor(acc.id)}
                      className={`w-10 h-10 rounded-full ${acc.bgClass} flex items-center justify-center text-white shadow-md transition-transform hover:scale-105 ${
                        isActive ? 'ring-3 ring-white ring-offset-2 ring-offset-[#2C2C2E] scale-110' : ''
                      }`}
                      title={acc.name}
                    >
                      {isActive && <Check className="w-5 h-5 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bubble Style Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Kształt Bąbelków (Bubble Shape)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((st) => {
                  const isActive = bubbleStyle === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setBubbleStyle(st.id)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        isActive
                          ? 'bg-[#3894F6] border-[#3894F6] text-white font-bold shadow-md'
                          : 'bg-[#2C2C2E] border-[#38383A] hover:bg-[#3A3A3C] text-gray-300'
                      }`}
                    >
                      <div className="text-xs font-semibold">{st.name}</div>
                      <div className="text-[10px] opacity-80 mt-0.5 leading-tight">{st.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Background Theme Mode Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 block">Motyw Tła</label>
              <div className="grid grid-cols-3 gap-2">
                {BACKGROUNDS.map((bg) => {
                  const Icon = bg.icon;
                  const isActive = bgMode === bg.id;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setBgMode(bg.id)}
                      className={`p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                        isActive
                          ? 'bg-[#3894F6] text-white border-[#3894F6] font-bold shadow-md'
                          : 'bg-[#2C2C2E] border-[#38383A] text-gray-300 hover:bg-[#3A3A3C]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{bg.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save & Close Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-[#3894F6] hover:bg-[#2080E5] text-white rounded-2xl text-xs font-bold shadow-lg transition-all active:scale-98"
              >
                Zapisz Ustawienia
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
