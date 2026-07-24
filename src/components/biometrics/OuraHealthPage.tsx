/**
 * @component OuraHealthPage
 * @role Pełnoekranowa, dedykowana aplikacja Oura Health Engine (110% możliwości Oura App).
 * @route /oura
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Moon, Activity, TrendingUp, ArrowLeft } from 'lucide-react';
import { useUserId } from '../../store/useStore';
import { useDailyStrainOura, useOuraHistory30Days } from '../../lib/biometricsApi';

import { OuraReadinessTab } from './oura/OuraReadinessTab';
import { OuraSleepTab } from './oura/OuraSleepTab';
import { OuraActivityTab } from './oura/OuraActivityTab';
import { OuraTrendsTab } from './oura/OuraTrendsTab';

export default function OuraHealthPage() {
  const navigate = useNavigate();
  const userId = useUserId();
  const [activeTab, setActiveTab] = useState<'readiness' | 'sleep' | 'activity' | 'trends'>('readiness');

  const { data: dbData, isLoading: loading1 } = useDailyStrainOura(userId ?? '');
  const { data: historyData, isLoading: loading2 } = useOuraHistory30Days(userId ?? '');

  if (!userId) return null;

  const isLoading = loading1 || loading2;
  const strainRow = dbData?.row ?? null;
  const oura = dbData?.oura ?? null;
  const ouraYesterday = dbData?.ouraYesterday ?? null;
  const enhanced = dbData?.enhanced ?? null;
  const enhancedYesterday = dbData?.enhancedYesterday ?? null;
  const ouraHistory = historyData?.ouraHistory ?? [];
  const enhancedHistory = historyData?.enhancedHistory ?? [];

  const dataProps = {
    strainRow,
    oura,
    ouraYesterday,
    enhanced,
    enhancedYesterday,
    ouraHistory,
    enhancedHistory,
  };


  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 space-y-5 pb-24">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} /> Powrót do Vanguard
        </button>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-3xs font-black uppercase tracking-widest text-slate-400">Oura Engine Live</span>
        </div>
      </div>

      {/* Floating Dark Oura App Navigation Dock */}
      <div className="grid grid-cols-4 gap-1 p-1.5 rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl backdrop-blur-xl">
        {[
          { id: 'readiness', label: 'Gotowość', icon: Zap },
          { id: 'sleep', label: 'Sen', icon: Moon },
          { id: 'activity', label: 'Aktywność', icon: Activity },
          { id: 'trends', label: 'Trendy', icon: TrendingUp },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 text-3xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === id
                ? 'bg-slate-800 text-teal-400 shadow-md border border-white/10 scale-[1.02]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon size={18} />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="p-12 text-center text-xs font-bold uppercase tracking-widest text-slate-500 animate-pulse">
          Wczytywanie wskaźników bio-witalnych Oura...
        </div>
      ) : (
        <main className="space-y-4">
          {activeTab === 'readiness' && <OuraReadinessTab {...dataProps} />}
          {activeTab === 'sleep' && <OuraSleepTab {...dataProps} />}
          {activeTab === 'activity' && <OuraActivityTab {...dataProps} />}
          {activeTab === 'trends' && <OuraTrendsTab {...dataProps} />}
        </main>
      )}
    </div>
  );
}
