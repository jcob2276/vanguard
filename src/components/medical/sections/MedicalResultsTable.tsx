import { useState, useMemo } from 'react';
import { HelpCircle, ChevronRight, AlertTriangle, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { MedicalLabRow } from '../../../lib/health/medicalAnalytics';

interface MedicalResultsTableProps {
  labs: MedicalLabRow[];
  onSelectMarker: (markerKey: string) => void;
}

const FILTER_TABS = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'attention', label: 'Wymaga uwagi' },
  { value: 'changed', label: 'Zmienione' },
  { value: 'new', label: 'Nowe' }
];

export default function MedicalResultsTable({ labs, onSelectMarker }: MedicalResultsTableProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Compute latest results per marker
  const latestMarkers = useMemo(() => {
    const latestMap = new Map<string, { current: MedicalLabRow; previous: MedicalLabRow | null; count: number }>();
    
    // Sort labs chronologically ascending to track history
    const sortedLabs = [...labs].sort((a, b) => a.result_date.localeCompare(b.result_date));
    
    sortedLabs.forEach(row => {
      const existing = latestMap.get(row.marker_key);
      if (existing) {
        latestMap.set(row.marker_key, {
          current: row,
          previous: existing.current,
          count: existing.count + 1
        });
      } else {
        latestMap.set(row.marker_key, {
          current: row,
          previous: null,
          count: 1
        });
      }
    });

    return [...latestMap.values()].sort((a, b) => a.current.marker_name.localeCompare(b.current.marker_name));
  }, [labs]);

  // Unique categories list
  const categories = useMemo(() => {
    const set = new Set(labs.map(l => l.category).filter(Boolean) as string[]);
    return ['all', ...set];
  }, [labs]);

  // Filtering logic
  const filteredMarkers = useMemo(() => {
    return latestMarkers.filter(m => {
      // 1. Category Filter
      if (selectedCategory !== 'all' && m.current.category !== selectedCategory) {
        return false;
      }

      // 2. Status Tab Filter
      if (activeTab === 'attention') {
        return m.current.flag && m.current.flag !== 'N' && m.current.flag !== 'normal';
      }
      if (activeTab === 'changed') {
        return m.previous !== null && m.current.value !== m.previous.value;
      }
      if (activeTab === 'new') {
        return m.count === 1;
      }

      return true;
    });
  }, [latestMarkers, activeTab, selectedCategory]);

  const renderDelta = (current: number, previous: MedicalLabRow | null) => {
    if (!previous) return <span className="text-text-muted flex items-center gap-0.5"><Minus size={10} /> Brak</span>;
    const prevVal = Number(previous.value);
    const diff = current - prevVal;
    if (diff === 0) return <span className="text-text-secondary flex items-center gap-0.5"><Minus size={10} /> 0</span>;
    
    const isUp = diff > 0;
    const formattedDiff = Math.abs(diff) < 0.01 ? diff.toFixed(3) : diff.toFixed(1);
    
    return (
      <span className={`flex items-center gap-0.5 font-bold ${isUp ? 'text-primary' : 'text-text-muted'}`}>
        {isUp ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
        {formattedDiff}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-border-custom/50 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black uppercase font-display">2. Wyniki Laboratoryjne</h2>
          <p className="text-2xs text-text-muted mt-0.5">Surowe fakty bezpośrednio z laboratoriów</p>
        </div>

        {/* Categories drop-down */}
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="rounded-xl border border-border-custom bg-background px-3 py-1.5 text-xs font-bold outline-none cursor-pointer"
        >
          <option value="all">Układy biologiczne (Wszystkie)</option>
          {categories.filter(c => c !== 'all').map(c => (
            <option key={c || ''} value={c || ''}>{c}</option>
          ))}
        </select>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border-custom/60 pb-2">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
              activeTab === tab.value 
                ? 'bg-primary/10 text-primary border border-primary/20' 
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table display */}
      <div className="overflow-x-auto rounded-2xl border border-border-custom bg-background/30">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border-custom text-2xs font-black uppercase text-text-muted tracking-wider bg-background/50">
              <th className="px-4 py-3">Nazwa</th>
              <th className="px-4 py-3">Wynik</th>
              <th className="px-4 py-3 text-center">Norma Lab</th>
              <th className="px-4 py-3">Zmiana</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Metoda / Lab</th>
              <th className="px-4 py-3 text-right">Szczegóły</th>
            </tr>
          </thead>
          <tbody>
            {filteredMarkers.map(m => {
              const hasFlag = m.current.flag && m.current.flag !== 'N' && m.current.flag !== 'normal';
              const normStr = m.current.ref_low != null && m.current.ref_high != null
                ? `${m.current.ref_low} – ${m.current.ref_high}`
                : m.current.ref_text || '—';

              return (
                <tr
                  key={m.current.id}
                  onClick={() => onSelectMarker(m.current.marker_key)}
                  className="border-b border-border-custom/50 hover:bg-background/50 transition-all cursor-pointer last:border-0"
                >
                  <td className="px-4 py-3 font-bold text-text-primary flex items-center gap-1.5">
                    {hasFlag && <AlertTriangle size={12} className="text-warning shrink-0" />}
                    {m.current.marker_name}
                  </td>
                  <td className={`px-4 py-3 font-extrabold ${hasFlag ? 'text-warning' : 'text-text-primary'}`}>
                    {m.current.value} <span className="text-3xs font-semibold text-text-muted uppercase ml-0.5">{m.current.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-text-secondary font-mono">{normStr}</td>
                  <td className="px-4 py-3 font-mono">{renderDelta(m.current.value, m.previous)}</td>
                  <td className="px-4 py-3 text-text-muted">{m.current.result_date}</td>
                  <td className="px-4 py-3 text-text-secondary truncate max-w-[120px]" title={m.current.provider || m.current.source_name}>
                    {m.current.provider || m.current.source_name}
                  </td>
                  <td className="px-4 py-3 text-right text-text-muted">
                    <ChevronRight size={14} className="inline" />
                  </td>
                </tr>
              );
            })}

            {filteredMarkers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-text-muted italic">
                  Brak markerów spełniających kryteria filtrowania.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
