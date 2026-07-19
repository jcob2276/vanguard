import { Shield, Sparkles, AlertCircle, Check } from 'lucide-react';
import type { VanguardIdentityData } from '../../../lib/growth/growth.types';
import { Card } from '../../ui/Card';
import Button from '../../ui/Button';

interface GrowthIdentitySectionProps {
  identity: VanguardIdentityData | null;
  onEdit: () => void;
}

export default function GrowthIdentitySection({ identity, onEdit }: GrowthIdentitySectionProps) {
  const values = identity?.values_standards || [];
  const confirming = identity?.confirming_behaviors || [];
  const conflicting = identity?.conflicting_behaviors || [];

  return (
    <Card variant="surface" padding="1.5rem" className="space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-border-custom/50 pb-4">
        <div>
          <span className="text-2xs font-black uppercase tracking-wider text-text-muted">Deklaracja Tożsamości</span>
          <h3 className="text-lg font-black uppercase font-display mt-0.5">Kim się staję</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit} className="uppercase font-black text-2xs">
          Edytuj Tożsamość
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border-custom bg-background/30 p-4">
          <p className="text-2xs font-black uppercase text-text-muted tracking-wider">Obecna rola</p>
          <p className="text-base font-bold text-text-primary mt-1">{identity?.current_role || 'Nie zdefiniowano'}</p>
        </div>
        <div className="rounded-xl border border-border-custom bg-primary/10 p-4">
          <p className="text-2xs font-black uppercase text-primary tracking-wider">Rozwijana rola</p>
          <p className="text-base font-bold text-text-primary mt-1 flex items-center gap-1.5">
            <Sparkles size={14} className="text-primary animate-pulse" />
            {identity?.developed_role || 'Nie zdefiniowano'}
          </p>
        </div>
      </div>

      {values.length > 0 && (
        <div>
          <p className="text-2xs font-black uppercase text-text-muted tracking-wider mb-2">Wartości i Standardy</p>
          <div className="flex flex-wrap gap-2">
            {values.map((v, i) => (
              <span key={i} className="rounded-full bg-border-custom px-3 py-1 text-xs font-semibold text-text-secondary border border-border-custom">
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="text-2xs font-black uppercase text-success tracking-wider flex items-center gap-1">
            <Shield size={12} /> Zachowania potwierdzające kierunek
          </p>
          {confirming.length > 0 ? (
            <ul className="space-y-1.5">
              {confirming.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-text-secondary bg-success/[0.03] border border-success/10 rounded-lg p-2">
                  <Check size={12} className="text-success shrink-0 mt-0.5" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-text-muted italic">Brak zdefiniowanych zachowań potwierdzających.</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-2xs font-black uppercase text-warning tracking-wider flex items-center gap-1">
            <AlertCircle size={12} /> Zachowania w konflikcie z kierunkiem
          </p>
          {conflicting.length > 0 ? (
            <ul className="space-y-1.5">
              {conflicting.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-text-secondary bg-warning/[0.03] border border-warning/10 rounded-lg p-2">
                  <span className="text-warning shrink-0 font-bold mt-0.5">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-text-muted italic">Brak zdefiniowanych zachowań konfliktowych.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-background/50 border border-border-custom p-3.5 text-2xs text-text-muted leading-relaxed">
        System pokazuje zgodność deklaracji z zachowaniem, ale sam nie orzeka, kim użytkownik „naprawdę jest”.
      </div>
    </Card>
  );
}
