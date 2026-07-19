import { useState } from 'react';
import { Book, FileText, Headphones, Video, MessageSquare, Plus, Link as LinkIcon, AlertCircle, HelpCircle } from 'lucide-react';
import type { LibraryItem } from '../../../lib/growth/growth.types';
import { Card } from '../../ui/Card';
import Button from '../../ui/Button';

interface GrowthLibrarySectionProps {
  items: LibraryItem[];
  onAdd: () => void;
  onEditItem: (item: LibraryItem) => void;
}

const STATUS_TABS = [
  { value: 'all', label: 'Wszystko' },
  { value: 'inbox', label: 'Skrzynka' },
  { value: 'want_to_learn', label: 'Chcę poznać' },
  { value: 'in_progress', label: 'W trakcie' },
  { value: 'processed', label: 'Przetworzone' },
  { value: 'applied', label: 'Zastosowane' },
  { value: 'deferred', label: 'Odłożone' }
];

const TYPE_ICONS: Record<string, any> = {
  book: Book,
  article: FileText,
  podcast: Headphones,
  video: Video,
  course: Book,
  note: FileText,
  mentor: MessageSquare,
  experiment: HelpCircle
};

export default function GrowthLibrarySection({ items, onAdd, onEditItem }: GrowthLibrarySectionProps) {
  const [activeTab, setActiveTab] = useState<string>('all');

  const filteredItems = activeTab === 'all' 
    ? items 
    : items.filter(item => item.status === activeTab);

  return (
    <Card variant="surface" padding="1.5rem" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-custom/50 pb-4">
        <div>
          <span className="text-2xs font-black uppercase tracking-wider text-text-muted">Baza Wiedzy</span>
          <h3 className="text-lg font-black uppercase font-display mt-0.5">Biblioteka Wiedzy</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd} className="uppercase font-black text-2xs shrink-0 self-start sm:self-center">
          + Dodaj Materiał
        </Button>
      </div>

      {/* Warning Guardrail banner */}
      <div className="rounded-xl border border-warning/20 bg-warning/[0.03] p-4 flex gap-3 items-start">
        <AlertCircle size={18} className="text-warning shrink-0 mt-0.5" />
        <div className="text-xs text-text-secondary leading-relaxed">
          <span className="font-bold text-text-primary">„Przeczytane” nie oznacza „opanowane”.</span> Materiał staje się wartościowy dopiero, kiedy jest połączony z: notatką, umiejętnością, decyzją, praktyką albo zmianą zachowania.
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-1 bg-background/50 border border-border-custom p-1 rounded-xl overflow-x-auto">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === tab.value 
                ? 'bg-primary text-on-accent' 
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid of Materials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filteredItems.map(item => {
          const Icon = TYPE_ICONS[item.type] || HelpCircle;
          const isLinked = item.connectedNotes || item.connectedSkill || item.connectedDecision || item.connectedPractice;

          return (
            <Card
              key={item.id}
              variant="outline"
              padding="1rem"
              onClick={() => onEditItem(item)}
              className="bg-background/20 hover:bg-background/40 transition-all border border-border-custom cursor-pointer flex flex-col justify-between h-44"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-3xs font-black uppercase tracking-wider text-text-muted bg-border-custom rounded px-1.5 py-0.5 flex items-center gap-1">
                    <Icon size={10} /> {item.type}
                  </span>
                  <span className={`text-3xs font-bold px-1.5 py-0.5 rounded-full ${
                    item.status === 'applied' ? 'bg-success/10 text-success' :
                    item.status === 'in_progress' ? 'bg-primary/10 text-primary' : 'bg-border-custom text-text-muted'
                  }`}>
                    {STATUS_TABS.find(t => t.value === item.status)?.label || item.status}
                  </span>
                </div>
                <h4 className="text-sm font-black text-text-primary leading-tight mt-3 line-clamp-2" title={item.title}>
                  {item.title}
                </h4>
              </div>

              {/* Connections/Knowledge loop indicators */}
              <div className="border-t border-border-custom/40 pt-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {item.connectedNotes && <span className="text-3xs bg-success/10 text-success px-1 rounded font-black uppercase">Notatka</span>}
                  {item.connectedSkill && <span className="text-3xs bg-primary/10 text-primary px-1 rounded font-black uppercase">Skill</span>}
                  {item.connectedDecision && <span className="text-3xs bg-warning/10 text-warning px-1 rounded font-black uppercase">Decyzja</span>}
                  {item.connectedPractice && <span className="text-3xs bg-success/10 text-success px-1 rounded font-black uppercase">Praktyka</span>}
                  {!isLinked && <span className="text-3xs bg-red-500/10 text-red-500 px-1 rounded font-black uppercase">Brak pętli</span>}
                </div>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-text-muted hover:text-primary transition-colors">
                    <LinkIcon size={12} />
                  </a>
                )}
              </div>
            </Card>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="rounded-xl border border-dashed border-border-custom py-12 text-center col-span-3">
            <p className="text-xs text-text-muted italic">Brak materiałów w tej zakładce.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
