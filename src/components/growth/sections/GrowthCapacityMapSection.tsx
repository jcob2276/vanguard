import { useState } from 'react';
import { BookOpen, Key, Link as LinkIcon, Calendar } from 'lucide-react';
import type { SkillInventoryRow } from '../../../lib/growth/growthOverview';
import { Card } from '../../ui/Card';
import { Pressable } from '../../ui/ControlPrimitives';

const LEVEL_LABELS = [
  'odkrywam',
  'rozumiem',
  'ćwiczę',
  'stosuję samodzielnie',
  'potrafię powtarzać',
  'potrafię uczyć innych'
];

interface GrowthCapacityMapSectionProps {
  skillInventory: SkillInventoryRow[];
  onEdit: () => void;
}

const AREAS = [
  { name: 'Biznes', keys: ['closing', 'negotiation'] },
  { name: 'Technologia', keys: ['tech', 'programming', 'code'] },
  { name: 'Komunikacja', keys: ['storytelling', 'setting', 'voice_presence'] },
  { name: 'Ciało', keys: ['body_base'] },
  { name: 'Relacje', keys: ['social_exposure'] },
  { name: 'Samoorganizacja', keys: ['deep_work'] }
];

export default function GrowthCapacityMapSection({ skillInventory, onEdit }: GrowthCapacityMapSectionProps) {
  const [activeArea, setActiveArea] = useState<string | null>(null);

  // Helper to categorize parent skills into areas
  const getAreaForSkill = (key: string): string => {
    const matched = AREAS.find(a => a.keys.some(k => key.toLowerCase().includes(k)));
    return matched ? matched.name : 'Samoorganizacja';
  };

  const getSkillsByArea = (areaName: string) => {
    return skillInventory.filter(row => getAreaForSkill(row.parent.key) === areaName);
  };

  return (
    <Card variant="surface" padding="1.5rem" className="space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-border-custom/50 pb-4">
        <div>
          <span className="text-2xs font-black uppercase tracking-wider text-text-muted">Poziomy Kompetencji</span>
          <h3 className="text-lg font-black uppercase font-display mt-0.5">Mapa Zdolności</h3>
        </div>
        <Pressable onClick={onEdit} className="rounded-xl border border-border-custom px-3 py-1.5 text-xs font-black uppercase hover:bg-border-custom/40 transition-all cursor-pointer">
          Oceń Umiejętności
        </Pressable>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {AREAS.map(area => {
          const list = getSkillsByArea(area.name);
          const count = list.length;
          const avgScore = count > 0 
            ? Math.round(list.reduce((acc, curr) => acc + curr.parentScore, 0) / count * 10) / 10 
            : 0;

          return (
            <Pressable
              key={area.name}
              onClick={() => setActiveArea(activeArea === area.name ? null : area.name)}
              className={`rounded-xl border p-3.5 text-left transition-all cursor-pointer flex flex-col justify-between h-28 ${
                activeArea === area.name 
                  ? 'border-primary bg-primary/[0.04]' 
                  : 'border-border-custom bg-background/30 hover:bg-background/60'
              }`}
            >
              <p className="text-sm font-black text-text-primary leading-tight">{area.name}</p>
              <div className="mt-3">
                <span className="text-2xs font-black text-primary uppercase bg-primary/10 rounded-full px-2 py-0.5">{count} skilli</span>
                <p className="text-xs font-bold text-text-secondary mt-1">Średnia: {avgScore}/5</p>
              </div>
            </Pressable>
          );
        })}
      </div>

      {activeArea && (
        <div className="rounded-2xl border border-border-custom bg-background/50 p-4 space-y-4 animate-fade-in">
          <h4 className="text-sm font-black uppercase tracking-wider text-primary">{activeArea} — Umiejętności</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {getSkillsByArea(activeArea).map(row => {
              const score = Math.max(0, Math.min(5, Math.round(row.parentScore)));
              const levelText = LEVEL_LABELS[score];

              return (
                <div key={row.parent.id} className="rounded-xl border border-border-custom/80 bg-background/40 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-text-primary">{row.parent.label}</p>
                      <p className="text-2xs text-primary font-bold mt-1 uppercase tracking-wider flex items-center gap-1">
                        <BookOpen size={10} /> {levelText}
                      </p>
                    </div>
                    <span className="text-lg font-black text-primary tabular-nums">{score}/5</span>
                  </div>

                  {row.subskills.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-2xs font-black uppercase tracking-wider text-text-muted flex items-center gap-1">
                        <Key size={10} /> Pod-zdolności
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {row.subskills.map(sub => (
                          <div key={sub.skill.id} className="rounded bg-background/50 border border-border-custom px-2 py-1 text-2xs flex justify-between gap-1 items-center">
                            <span className="text-text-secondary truncate">{sub.skill.label}</span>
                            <span className="font-bold text-primary shrink-0">{sub.score}/5</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-2xs text-text-muted border-t border-border-custom/40 pt-2">
                    <span className="flex items-center gap-1"><LinkIcon size={10} /> Zależności: brak</span>
                    <span className="flex items-center gap-1"><Calendar size={10} /> Ostatnie użycie: dzisiaj</span>
                  </div>
                </div>
              );
            })}

            {getSkillsByArea(activeArea).length === 0 && (
              <p className="text-xs text-text-muted italic col-span-2">Brak umiejętności przypisanych do tego obszaru.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
