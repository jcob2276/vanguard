/**
 * @component OuraHealthHubModal
 * @role Pełnoekranowy kontener w ciemnym motywie glassmorphic dla Oura / NOOP Health Engine (110%).
 * @usedBy DailyStrainCard
 */
import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Zap, Moon, Activity, TrendingUp } from 'lucide-react';
import type { Tables } from '../../lib/database.types';
import type { StrainComponents } from './dailyStrainCardStyles';

import { OuraReadinessTab } from './oura/OuraReadinessTab';
import { OuraSleepTab } from './oura/OuraSleepTab';
import { OuraActivityTab } from './oura/OuraActivityTab';
import { OuraTrendsTab } from './oura/OuraTrendsTab';

interface OuraHealthHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  strainRow: Tables<'daily_strain'> | null;
  oura: Tables<'oura_daily_summary'> | null;
  ouraYesterday?: Tables<'oura_daily_summary'> | null;
  enhanced?: Tables<'oura_enhanced'> | null;
  enhancedYesterday?: Tables<'oura_enhanced'> | null;
  comp?: StrainComponents;
}

export default function OuraHealthHubModal({
  isOpen,
  onClose,
  strainRow,
  oura,
  ouraYesterday,
  enhanced,
  enhancedYesterday,
}: OuraHealthHubModalProps) {
  const [activeTab, setActiveTab] = useState<'readiness' | 'sleep' | 'activity' | 'trends'>('readiness');

  if (!isOpen) return null;

  const dataProps = {
    strainRow,
    oura,
    ouraYesterday,
    enhanced,
    enhancedYesterday,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Oura Health Hub (110%)">
      <div className="space-y-4">
        {/* Floating Dark Oura App Navigation Dock */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl border border-white/10 bg-slate-950/90 shadow-xl backdrop-blur-xl">
          {[
            { id: 'readiness', label: 'Gotowość', icon: Zap },
            { id: 'sleep', label: 'Sen', icon: Moon },
            { id: 'activity', label: 'Aktywność', icon: Activity },
            { id: 'trends', label: 'Trendy', icon: TrendingUp },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 px-1 text-3xs font-black uppercase tracking-wider transition-all ${
                activeTab === id
                  ? 'bg-slate-800 text-teal-400 shadow-md border border-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* TAB CONTENTS */}
        {activeTab === 'readiness' && <OuraReadinessTab {...dataProps} />}
        {activeTab === 'sleep' && <OuraSleepTab {...dataProps} />}
        {activeTab === 'activity' && <OuraActivityTab {...dataProps} />}
        {activeTab === 'trends' && <OuraTrendsTab {...dataProps} />}

        <Button variant="secondary" onClick={onClose} className="w-full">
          Zamknij
        </Button>
      </div>
    </Modal>
  );
}
