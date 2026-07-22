import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { BorderBeam } from '../ui/BorderBeam';
import { ThinkingOrb, type ThinkingOrbState } from '../ui/ThinkingOrb';
import { Card } from '../ui/Card';
import Button from '../ui/Button';

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-base font-black text-text-primary">
        {icon}{title}
      </h2>
      {children}
    </section>
  );
}

export function BorderBeamGallery() {
  return (
    <Section icon={<Sparkles size={16} />} title="BorderBeam (Jakub Antalik)">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card variant="surface" className="relative overflow-hidden p-6">
          <BorderBeam size={220} duration={10} colorFrom="var(--color-primary, #38bdf8)" colorTo="#818cf8" />
          <h4 className="text-sm font-bold text-text-primary">Główny cel dnia (Focus Card)</h4>
          <p className="mt-1 text-xs text-text-muted">
            Karta ze świecącym promieniem brzegowym podświetlającym aktywny cel rano.
          </p>
        </Card>

        <Card variant="glass" className="relative overflow-hidden p-6">
          <BorderBeam size={180} duration={6} colorFrom="#10b981" colorTo="#38bdf8" />
          <h4 className="text-sm font-bold text-text-primary">Aktywny status Vanguard</h4>
          <p className="mt-1 text-xs text-text-muted">
            Szybki promień z zielono-cyjanowym gradientem dla alertów i odzyskiwania.
          </p>
        </Card>
      </div>
    </Section>
  );
}

export function ThinkingOrbGallery() {
  const [state, setState] = useState<ThinkingOrbState>('thinking');
  const states: ThinkingOrbState[] = ['idle', 'thinking', 'working', 'solving', 'searching', 'listening'];

  return (
    <Section icon={<Sparkles size={16} />} title="ThinkingOrb (Jakub Antalik)">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {states.map((st) => (
            <Button
              key={st}
              variant={state === st ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setState(st)}
            >
              {st}
            </Button>
          ))}
        </div>

        <Card variant="surface" className="flex items-center gap-4 p-4">
          <ThinkingOrb state={state} size="lg" />
          <div>
            <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              Stan AI: {state}
            </h4>
            <p className="text-xs text-text-muted">
              Organiczny, kropkowany wskaźnik Canvas 2D dedykowany dla agentów AI.
            </p>
          </div>
        </Card>
      </div>
    </Section>
  );
}
