import { useState } from 'react';
import { X } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/notify';
import type { GrowthLinkRow, GrowthTodoRow } from '../../hooks/useGrowthData';
import type { LearningWeekPin } from '../../lib/growth';
import { pinTitle } from './PinPickerModal';
import { usePersistentDraft } from '../../hooks/usePersistentDraft';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function DoneTakeawayModal({
  session,
  pin,
  linksById,
  todosById,
  onClose,
  onSaved,
}: {
  session: Session;
  pin: LearningWeekPin;
  linksById: Map<string, GrowthLinkRow>;
  todosById: Map<string, GrowthTodoRow>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const title = pinTitle(pin, linksById, todosById);
  // Persisted per-pin — a backgrounded-tab kill mid-write-up must not erase the takeaway.
  const [gapText, setGapText] = usePersistentDraft(`vanguard_takeaway_gap_${pin.id}`, '');
  const [recallText, setRecallText] = usePersistentDraft(`vanguard_takeaway_recall_${pin.id}`, '');
  const [critiqueText, setCritiqueText] = usePersistentDraft(`vanguard_takeaway_critique_${pin.id}`, '');
  const [lines, setLines] = useState(['', '']);
  const [saving, setSaving] = useState(false);

  const save = async (skip: boolean) => {
    if (skip) {
      onClose();
      return;
    }
    const gap = gapText.trim();
    const recall = recallText.trim();
    const critique = critiqueText.trim();
    const bullets = lines.map((l) => l.trim()).filter(Boolean);
    if (!gap && !recall && !critique && bullets.length === 0) {
      notify('Wpisz recall, lukę albo wniosek — albo pomiń', 'error');
      return;
    }
    setSaving(true);
    try {
      const link =
        pin.entity_type === 'link' && pin.entity_id ? linksById.get(pin.entity_id) : null;
      const parts = [`<p><strong>${escapeHtml(title)}</strong></p>`];
      if (link?.url) {
        parts.push(
          `<p><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.url)}</a></p>`,
        );
      }
      if (gap) {
        parts.push(`<p><strong>Czego nie wiedziałem:</strong> ${escapeHtml(gap)}</p>`);
      }
      if (recall) {
        parts.push(`<p><strong>Recall (bez materiału):</strong> ${escapeHtml(recall)}</p>`);
      }
      if (critique) {
        parts.push(`<p><strong>Self-critique:</strong> ${escapeHtml(critique)}</p>`);
      }
      if (bullets.length > 0) {
        parts.push(`<ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`);
      }
      parts.push(`<p><em>Źródło: Rozwój · pin:${pin.id}</em></p>`);

      const { error } = await supabase.from('vanguard_notes').insert({
        user_id: session.user.id,
        title: `Rozwój: ${title.slice(0, 80)}`,
        content: parts.join(''),
        color: 'default',
        is_pinned: false,
        is_archived: false,
        tags: ['rozwoj'],
      });
      if (error) throw error;
      setGapText(''); setRecallText(''); setCritiqueText('');
      notify('Wniosek zapisany w Notatkach', 'success');
      onSaved();
      onClose();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Błąd zapisu', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border-custom bg-background shadow-xl">
        <div className="flex items-start justify-between border-b border-border-custom px-4 py-3 gap-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Gotowe</p>
            <h2 className="text-[13px] font-bold text-text-primary leading-snug mt-0.5">{title}</h2>
            <p className="text-[10px] text-text-muted mt-1">Feedback loop — zamknij sesję zanim odejdziesz</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-text-muted cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-text-muted">
              Recall · bez materiału (YanSculpts)
            </label>
            <input
              value={recallText}
              onChange={(e) => setRecallText(e.target.value)}
              placeholder="Co zrobiłeś z pamięci?"
              className="mt-1 w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2 text-[12px]"
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-text-muted">
              Self-critique · vs cel
            </label>
            <input
              value={critiqueText}
              onChange={(e) => setCritiqueText(e.target.value)}
              placeholder="Co pominąłeś / co poszło inaczej niż w referencji?"
              className="mt-1 w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2 text-[12px]"
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-wider text-text-muted">
              Gap · błąd = sygnał (Huberman)
            </label>
            <input
              value={gapText}
              onChange={(e) => setGapText(e.target.value)}
              placeholder="Co poszło inaczej niż zakładałeś?"
              className="mt-1 w-full rounded-xl border border-primary/20 bg-surface-solid px-3 py-2 text-[12px]"
            />
          </div>
          {lines.map((line, i) => (
            <input
              key={i}
              value={line}
              onChange={(e) =>
                setLines((ls) => ls.map((l, j) => (j === i ? e.target.value : l)))
              }
              placeholder={i === 0 ? 'Wniosek / co powtórzyć jutro' : 'Opcjonalnie'}
              className="w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2 text-[12px]"
            />
          ))}
        </div>
        <div className="border-t border-border-custom p-4 flex gap-2">
          <button
            type="button"
            onClick={() => void save(false)}
            disabled={saving}
            className="flex-1 rounded-xl bg-primary py-2.5 text-[11px] font-black uppercase text-white cursor-pointer disabled:opacity-50"
          >
            Zapisz w Notatkach
          </button>
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={saving}
            className="rounded-xl border border-border-custom px-4 py-2.5 text-[11px] font-black uppercase text-text-muted cursor-pointer"
          >
            Pomiń
          </button>
        </div>
      </div>
    </div>
  );
}
