import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { useState } from 'react';
import { HelpCircle, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/Card';

interface Option {
  id: string;
  label: string;
  value: string;
}

interface ClarificationRequest {
  id: string;
  question: string;
  response_type: 'confirm' | 'single_choice' | 'multi_choice' | 'short_text';
  options: Option[];
  proposed_memory?: string;
  confidence?: number | null;
}

interface Props {
  request: ClarificationRequest;
  onAnswered: () => void;
}

const UNCERTAIN_OPT: Option = { id: '__uncertain__', label: 'Nie jestem pewny/a', value: '__uncertain__' };
const OTHER_OPT: Option = { id: '__other__', label: 'Inna odpowiedź', value: '__other__' };

/** @usedBy OracleCard, shared/ActionCenterSheet */
export function ClarificationRequestCard({ request, onAnswered }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customText, setCustomText] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasUncertain = request.options.some(o => o.label.toLowerCase().includes('pewn'));
  const options: Option[] = [
    ...request.options,
    ...(hasUncertain ? [] : [UNCERTAIN_OPT]),
    OTHER_OPT,
  ];

  const toggleId = (id: string) => {
    if (id === '__other__') {
      setShowCustom(!showCustom);
      if (!showCustom) setSelectedIds(prev => [...prev.filter(x => x !== '__other__'), '__other__']);
      else setSelectedIds(prev => prev.filter(x => x !== '__other__'));
      return;
    }
    if (request.response_type === 'single_choice') {
      setSelectedIds([id]);
    } else {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }
  };

  const submit = async (overrideAnswer?: object) => {
    setSubmitting(true);
    const answer = overrideAnswer ?? {
      option_ids: selectedIds,
      text: showCustom ? customText : undefined,
      is_custom_answer: showCustom && !!customText,
      is_uncertain: selectedIds.includes('__uncertain__'),
    };
    const { error } = await supabase
      .from('oracle_clarification_requests')
      .update({ status: 'answered', answer: answer as never, answered_at: new Date().toISOString() })
      .eq('id', request.id);
    if (error) console.error('[clarification] answer failed:', error.message);
    setSubmitting(false);
    onAnswered();
  };

  const dismiss = async () => {
    await supabase
      .from('oracle_clarification_requests')
      .update({ status: 'dismissed' })
      .eq('id', request.id);
    onAnswered();
  };

  return (
    <Card variant="outline" className="border-primary/20 bg-primary/[0.04] mb-3" padding="1rem">
      <div className="flex items-start gap-2 mb-3">
        <HelpCircle size={14} className="text-primary mt-0.5 flex-shrink-0" />
        <p className="text-sm font-semibold leading-snug text-text-primary">
          {request.question}
        </p>
      </div>

      {request.response_type === 'confirm' && (
        <div className="flex gap-2">
          <Pressable
            onClick={() => submit({ option_ids: ['yes'], is_uncertain: false })}
            disabled={submitting}
            className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-on-accent transition-all active:scale-95 disabled:opacity-[var(--opacity-40)]"
          >
            Tak
          </Pressable>
          <Pressable
            onClick={() => submit({ option_ids: ['no'], is_uncertain: false })}
            disabled={submitting}
            className="flex-1 rounded-xl border border-border-custom/30 py-2 text-sm font-semibold text-text-secondary transition-all active:scale-95 disabled:opacity-[var(--opacity-40)]"
          >
            Nie
          </Pressable>
        </div>
      )}

      {(request.response_type === 'single_choice' || request.response_type === 'multi_choice') && (
        <div className="space-y-1.5">
          {options.map(opt => {
            const selected = selectedIds.includes(opt.id);
            return (
              <Pressable
                key={opt.id}
                onClick={() => toggleId(opt.id)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all active:scale-[var(--ds-arbitrary-0-98)] ${
                  selected
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-background border border-border-custom/20 text-text-secondary'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
                  selected ? 'bg-primary border-primary' : 'border-border-custom/40'
                }`}>
                  {selected && <Check size={10} className="text-on-accent" strokeWidth={3} />}
                </div>
                {opt.label}
              </Pressable>
            );
          })}
          {showCustom && (
            <ControlInput
              autoFocus
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="Twoja odpowiedź..."
              className="w-full rounded-xl border border-primary/30 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          )}
          {selectedIds.length > 0 && (
            <Pressable
              onClick={() => submit()}
              disabled={submitting}
              className="w-full rounded-xl bg-primary py-2 text-sm font-bold text-on-accent transition-all active:scale-95 disabled:opacity-[var(--opacity-40)] mt-1"
            >
              {submitting ? '...' : 'Potwierdź'}
            </Pressable>
          )}
        </div>
      )}

      {request.response_type === 'short_text' && (
        <div className="space-y-2">
          <ControlInput
            autoFocus
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && customText.trim()) submit(); }}
            placeholder="Twoja odpowiedź..."
            className="w-full rounded-xl border border-border-custom/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <Pressable
              onClick={() => submit({ text: customText, option_ids: [], is_uncertain: false })}
              disabled={!customText.trim() || submitting}
              className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-on-accent transition-all active:scale-95 disabled:opacity-[var(--opacity-40)]"
            >
              {submitting ? '...' : 'Wyślij'}
            </Pressable>
            <Pressable
              onClick={() => submit({ option_ids: ['__uncertain__'], is_uncertain: true })}
              disabled={submitting}
              className="rounded-xl border border-border-custom/30 px-3 py-2 text-xs text-text-muted transition-all active:scale-95"
            >
              Nie wiem
            </Pressable>
          </div>
        </div>
      )}

      <Pressable
        onClick={dismiss}
        className="w-full mt-2 text-xs text-text-tertiary hover:text-text-muted transition-colors"
      >
        Pomiń
      </Pressable>
    </Card>
  );
}
