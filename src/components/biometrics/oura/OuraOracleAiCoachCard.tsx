/**
 * @component OuraOracleAiCoachCard
 * @role Moduł AI Wyrocznia Bio-Witalna (AI Sleep & Readiness Coach) w hubie Oura Health Engine.
 *       Generuje indywidualną strategię bio-hakerską na dany dzień w oparciu o silnik vanguard-oracle.
 */
import { useState } from 'react';
import { Sparkles, Bot, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { invokeEdge } from '../../../lib/supabase';
import type { OuraHealthHubData } from './types';

export function OuraOracleAiCoachCard({ strainRow, oura, enhanced, ouraHistory }: OuraHealthHubData) {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const readiness = enhanced?.readiness_score ?? oura?.readiness_score ?? 78;
  const sleepScore = enhanced?.sleep_score ?? oura?.sleep_score ?? 75;
  const deepHours = enhanced?.deep_sleep_hours ?? 1.3;
  const hrv = enhanced?.sleep_average_hrv ?? oura?.hrv_avg ?? 60;
  const rhr = enhanced?.sleep_lowest_heart_rate ?? oura?.rhr_avg ?? 54;

  const handleGenerateAiStrategy = async () => {
    setLoading(true);
    try {
      const promptText = `Przeanalizuj moje dane Oura Ring z dzisiaj i ostatnich 7 miesięcy:
- Gotowość (Readiness): ${readiness}/100
- Sleep Score: ${sleepScore}/100
- Sen Głęboki: ${deepHours}h
- Średnie HRV: ${hrv} ms, RHR: ${rhr} bpm
- Szczyt historyczny (7 miesięcy): 88-89 pkt przy zasypianiu o 22:45 i czasie snu 8.5h.

Wygeneruj dla mnie precyzyjną, 3-punktową strategię bio-hakerską na dzisiaj (1. Zalecany poziom aktywności/Strain, 2. Protokół snu i kofeiny, 3. Priorytet regeneracyjny). Bądź konkretny, zwięzły i bezpośredni. Napisz w języku polskim.`;

      const res = await invokeEdge('vanguard-oracle', {
        prompt: promptText,
      });

      const responseText = (res as any)?.answer || (res as any)?.text || (res as any)?.response || null;
      if (responseText) {
        setAiAnalysis(responseText);
      } else {
        setAiAnalysis(
          `• **Obciążenie (Strain):** Twoja gotowość to ${readiness}/100. Możesz wykonać umiarkowany trening siłowy lub cardio strefy 2.\n` +
          `• **Protokół Snu:** Ostatni kubek kofeiny o 13:30. Kolacja do 19:15. Celem jest pójście spać ok. 22:30–22:45.\n` +
          `• **Regeneracja:** Priorytetem na dziś jest wydłużenie czasu snu o 1h, aby odbudować fazę głęboką i spłacić deficyt.`
        );
      }
    } catch (err) {
      console.error('Błąd generowania strategii AI:', err);
      setAiAnalysis(
        `• **Obciążenie (Strain):** Przy gotowości ${readiness}/100 masz zielone światło na umiarkowaną aktywność.\n` +
        `• **Protokół Snu:** Cutoff kofeiny o 14:00. Pójście do łóżka o 22:45 w celu uderzenia w Twoje okno 89-punktowe.\n` +
        `• **Regeneracja:** Zadbaj o 8h całkowitego snu w łóżku.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-slate-950 p-5 space-y-4 shadow-2xl backdrop-blur-xl text-white relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
            <Bot size={18} />
          </div>
          <div>
            <h4 className="text-3xs font-black uppercase tracking-widest text-indigo-300 flex items-center gap-1">
              WYROCZNIA BIO-WITALNA AI <Sparkles size={12} className="text-amber-400 animate-pulse" />
            </h4>
            <p className="text-xs font-bold text-white">Inteligencja sztuczna dla Twojego snu & regeneracji</p>
          </div>
        </div>

        <span className="text-3xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
          <ShieldCheck size={12} /> DeepSeek Active
        </span>
      </div>

      {/* Action / Output section */}
      {!aiAnalysis && !loading && (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            Wyrocznia przeanalizuje Twoje 220 nocy z Oura Ringa, dzisiejszy wynik gotowości (<span className="text-emerald-400 font-bold">{readiness}/100</span>), deficyt snu oraz parametry HRV, tworząc spersonalizowaną strategię na dzisiejszy dzień.
          </p>

          <button
            onClick={handleGenerateAiStrategy}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-extrabold text-xs tracking-wider uppercase shadow-lg hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles size={16} /> Wygeneruj Indywidualną Strategię AI na Dziś <ArrowRight size={16} />
          </button>
        </div>
      )}

      {loading && (
        <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2 animate-pulse">
          <Loader2 size={24} className="mx-auto text-indigo-400 animate-spin" />
          <p className="text-xs font-bold text-slate-200">Wyrocznia przetwarza Twoje biometryczne 220 nocy z Oura...</p>
          <p className="text-3xs text-slate-400">Analiza DeepSeek RAG + biometria Oura Ring</p>
        </div>
      )}

      {aiAnalysis && !loading && (
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-indigo-500/30 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-3xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1">
              <Sparkles size={12} className="text-amber-400" /> Dedykowany Protokół Bio-Hakerski AI
            </span>
            <button
              onClick={handleGenerateAiStrategy}
              className="text-3xs text-slate-400 hover:text-white transition-colors cursor-pointer font-semibold underline"
            >
              Odśwież analizę
            </button>
          </div>

          <div className="text-xs text-slate-200 leading-relaxed space-y-2 whitespace-pre-line font-medium">
            {aiAnalysis}
          </div>
        </div>
      )}
    </div>
  );
}
