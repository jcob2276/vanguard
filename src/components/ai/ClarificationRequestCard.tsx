import { useState } from 'react';
import { HelpCircle, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
      .update({ status: 'answered', answer: answer as any, answered_at: new Date().toISOString() })
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
    <div className="rounded-2xl border border-[rgba(91,108,255,0.2)] bg-[rgba(91,108,255,0.04)] p-4 mb-3">
      <div className="flex items-start gap-2 mb-3">
        <HelpCircle size={14} className="text-[#5B6CFF] mt-0.5 flex-shrink-0" />
        <p className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
          {request.question}
        </p>
      </div>

      {request.response_type === 'confirm' && (
        <div className="flex gap-2">
          <button
            onClick={() => submit({ option_ids: ['yes'], is_uncertain: false })}
            disabled={submitting}
            className="flex-1 rounded-xl bg-[#5B6CFF] py-2 text-[12px] font-bold text-white transition-all active:scale-95 disabled:opacity-40"
          >
            Tak
          </button>
          <button
            onClick={() => submit({ option_ids: ['no'], is_uncertain: false })}
            disabled={submitting}
            className="flex-1 rounded-xl border border-[rgba(153,161,175,0.3)] py-2 text-[12px] font-semibold text-[var(--text-secondary)] transition-all active:scale-95 disabled:opacity-40"
          >
            Nie
          </button>
        </div>
      )}

      {(request.response_type === 'single_choice' || request.response_type === 'multi_choice') && (
        <div className="space-y-1.5">
          {options.map(opt => {
            const selected = selectedIds.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleId(opt.id)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] font-medium transition-all active:scale-[0.98] ${
                  selected
                    ? 'bg-[rgba(91,108,255,0.12)] text-[#5B6CFF] border border-[rgba(91,108,255,0.3)]'
                    : 'bg-white border border-[rgba(153,161,175,0.2)] text-[var(--text-secondary)]'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
                  selected ? 'bg-[#5B6CFF] border-[#5B6CFF]' : 'border-[rgba(153,161,175,0.4)]'
                }`}>
                  {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                {opt.label}
              </button>
            );
          })}
          {showCustom && (
            <input
              autoFocus
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="Twoja odpowiedź..."
              className="w-full rounded-xl border border-[rgba(91,108,255,0.3)] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#5B6CFF]"
            />
          )}
          {selectedIds.length > 0 && (
            <button
              onClick={() => submit()}
              disabled={submitting}
              className="w-full rounded-xl bg-[#5B6CFF] py-2 text-[12px] font-bold text-white transition-all active:scale-95 disabled:opacity-40 mt-1"
            >
              {submitting ? '...' : 'Potwierdź'}
            </button>
          )}
        </div>
      )}

      {request.response_type === 'short_text' && (
        <div className="space-y-2">
          <input
            autoFocus
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && customText.trim()) submit(); }}
            placeholder="Twoja odpowiedź..."
            className="w-full rounded-xl border border-[rgba(153,161,175,0.2)] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#5B6CFF]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => submit({ text: customText, option_ids: [], is_uncertain: false })}
              disabled={!customText.trim() || submitting}
              className="flex-1 rounded-xl bg-[#5B6CFF] py-2 text-[12px] font-bold text-white transition-all active:scale-95 disabled:opacity-40"
            >
              {submitting ? '...' : 'Wyślij'}
            </button>
            <button
              onClick={() => submit({ option_ids: ['__uncertain__'], is_uncertain: true })}
              disabled={submitting}
              className="rounded-xl border border-[rgba(153,161,175,0.3)] px-3 py-2 text-[11px] text-[var(--text-muted)] transition-all active:scale-95"
            >
              Nie wiem
            </button>
          </div>
        </div>
      )}

      <button
        onClick={dismiss}
        className="w-full mt-2 text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--text-muted)] transition-colors"
      >
        Pomiń
      </button>
    </div>
  );
}
