import { useState } from 'react';
import { Card } from '../../ui/Card';
import Button from '../../ui/Button';
import { Calendar, Bell, Plus, CheckSquare, EyeOff, MessageSquare, AlertTriangle } from 'lucide-react';
import { notify } from '../../../lib/notify';
import type { RetestSuggestion } from '../../../lib/health/medicalRetestSuggestions';

interface MedicalSuggestionsProps {
  suggestions: RetestSuggestion[];
  loading: boolean;
}

export default function MedicalSuggestions({ suggestions, loading }: MedicalSuggestionsProps) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [doctorQuestions, setDoctorQuestions] = useState<Record<string, string>>({});

  const handleAction = (id: string, actionType: string) => {
    if (actionType === 'hide') {
      setHiddenIds(prev => [...prev, id]);
      notify('Sugestia została ukryta.', 'info');
    } else if (actionType === 'panel') {
      notify('Dodano marker do planowanego kolejnego panelu.', 'success');
    } else if (actionType === 'reminder') {
      notify('Ustawiono przypomnienie o badaniu.', 'success');
    } else if (actionType === 'calendar') {
      notify('Dodano termin badania do kalendarza.', 'success');
    }
  };

  const handleSaveQuestion = (id: string, text: string) => {
    setDoctorQuestions(prev => ({ ...prev, [id]: text }));
    notify('Pytanie do lekarza zostało zapisane.', 'success');
  };

  // Categorize suggestions
  const categorized = suggestions
    .filter(s => !hiddenIds.includes(s.id))
    .reduce((acc, curr) => {
      const text = (curr.title + ' ' + curr.reason).toLowerCase();
      if (text.includes('lekarz') || text.includes('specjalist') || curr.priority === 'high') {
        acc.toDiscuss.push(curr);
      } else if (text.includes('odchyle') || text.includes('potwierdz') || text.includes('spade')) {
        acc.toVerify.push(curr);
      } else if (text.includes('brak') || text.includes('niekomplet')) {
        acc.missing.push(curr);
      } else {
        acc.toRefresh.push(curr);
      }
      return acc;
    }, {
      toRefresh: [] as RetestSuggestion[],
      toVerify: [] as RetestSuggestion[],
      missing: [] as RetestSuggestion[],
      toDiscuss: [] as RetestSuggestion[]
    });

  const renderCategoryList = (title: string, items: RetestSuggestion[], badgeColor: string) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3">
        <span className={`text-3xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeColor}`}>
          {title}
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(item => (
            <Card
              key={item.id}
              variant="outline"
              padding="1rem"
              className="bg-background/20 border-border-custom/50 flex flex-col justify-between space-y-4"
            >
              <div>
                <h4 className="text-xs font-bold text-text-primary leading-tight">{item.title}</h4>
                <p className="text-3xs text-text-secondary mt-1.5 leading-relaxed">{item.reason}</p>
              </div>

              {/* Physician questions field if discuss category */}
              {title === 'Do omówienia ze specjalistą' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-text-muted">Notatka do omówienia / Pytanie</label>
                  <input
                    type="text"
                    placeholder="Wpisz o co zapytać lekarza..."
                    defaultValue={doctorQuestions[item.id] || ''}
                    onBlur={e => handleSaveQuestion(item.id, e.target.value)}
                    className="w-full bg-background/50 border border-border-custom rounded-lg px-2 py-1 text-3xs focus:outline-none focus:border-primary text-text-primary"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border-custom/40">
                <Button variant="ghost" size="sm" onClick={() => handleAction(item.id, 'panel')} title="Dodaj do kolejnego panelu">
                  <Plus size={10} /> Panel
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleAction(item.id, 'reminder')} title="Ustaw przypomnienie">
                  <Bell size={10} /> Przypomnij
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleAction(item.id, 'calendar')} title="Dodaj do kalendarza">
                  <Calendar size={10} /> Kalendarz
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleAction(item.id, 'hide')} className="text-text-muted" title="Ukryj sugestię">
                  <EyeOff size={10} /> Ukryj
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border-custom/50 pb-3">
        <h2 className="text-lg font-black uppercase font-display">Planowanie i Sugestie</h2>
        <p className="text-2xs text-text-muted mt-0.5">Automatyczne wnioski oponujące o kolejne kroki diagnostyczne</p>
      </div>

      {loading ? (
        <p className="text-xs text-text-muted italic">Analizowanie brakujących markerów...</p>
      ) : suggestions.length === 0 ? (
        <p className="text-xs text-text-muted italic">Brak nowych rekomendacji. Panele są aktualne i kompletne.</p>
      ) : (
        <div className="space-y-6">
          {renderCategoryList('Do omówienia ze specjalistą', categorized.toDiscuss, 'bg-red-500/10 text-red-500')}
          {renderCategoryList('Warto potwierdzić', categorized.toVerify, 'bg-warning/10 text-warning')}
          {renderCategoryList('Warto odświeżyć', categorized.toRefresh, 'bg-primary/10 text-primary')}
          {renderCategoryList('Brakuje do pełnego obrazu', categorized.missing, 'bg-border-custom text-text-muted')}
        </div>
      )}
    </div>
  );
}
