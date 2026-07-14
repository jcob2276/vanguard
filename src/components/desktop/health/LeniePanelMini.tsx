import { TIMEZONE } from '../../../lib/date';
import React from 'react';
import { Card } from '../../ui/Card';
import { computeLenieInsight, daysBefore, type LenieLogRow } from '../desktopUtils';

export interface LeniePanelMiniProps {
  logs?: LenieLogRow[];
}

export default function LeniePanelMini({ logs }: LeniePanelMiniProps) {
  const totalMonth = (logs || []).filter(l => l.date >= daysBefore(30)).length;
  const totalWeek = (logs || []).filter(l => l.date >= daysBefore(7)).length;
  const lastDate = (logs || [])[0]?.date ?? null;
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const daysFree = lastDate ? Math.round((new Date(todayStr + 'T12:00:00Z').getTime() - new Date(lastDate + 'T12:00:00Z').getTime()) / 86400000) : null;
  const freeColor =
    daysFree === null
      ? 'text-text-muted'
      : daysFree === 0
      ? 'text-danger'
      : daysFree <= 2
      ? 'text-warning'
      : 'text-success';

  const insight = computeLenieInsight(logs || []);

  if (!logs?.length) return null;

  return (
    <Card variant="glass" padding="1rem 1.5rem" className="flex items-center gap-8"
      style={{ border: 'var(--border-width-thin) solid var(--legacy-color-112)', background: 'var(--legacy-color-108)' }}>
      <p className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-039)] text-danger/50 shrink-0">Lenie</p>

      <div className="flex items-center gap-6 shrink-0">
        {[
          { label: 'Ten tydzień', val: totalWeek, color: totalWeek > 0 ? 'text-danger' : 'text-success' },
          { label: '30 dni', val: totalMonth, color: 'text-text-secondary' },
          {
            label: 'Czyste dni',
            val: daysFree === 0 ? 'dziś' : daysFree !== null ? `${daysFree}d` : '—',
            color: freeColor
          }
        ].map(({ label, val, color }) => (
          <div key={label} className="text-center">
            <p className="text-3xs font-black uppercase tracking-wider text-text-muted mb-0.5">{label}</p>
            <p className={`font-display text-lg font-black leading-none ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 min-w-0 border-l border-border-custom/40 pl-6">
        {insight ? (
          <p className="text-xs text-text-secondary leading-relaxed">{insight}</p>
        ) : (
          <p className="text-xs text-text-muted italic">Za mało danych do analizy.</p>
        )}
      </div>
    </Card>
  );
}
