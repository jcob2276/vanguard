import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Sun, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function MiddayCheckInCard({ session }: { session: any }) {
  const userId = session?.user?.id;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  const hour = new Date().toLocaleTimeString('en-CA', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false });
  const hourNum = parseInt(hour, 10);

  const [status, setStatus] = useState('');
  const [blocker, setBlocker] = useState('');
  const [showBlocker, setShowBlocker] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!userId) return;
    (supabase as any)
      .from('daily_reconciliations')
      .select('midday_status')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data?.midday_status) setSaved(true);
        setChecked(true);
      });
  }, [userId, today]);

  const save = async () => {
    const text = status.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await (supabase as any).from('daily_reconciliations').upsert(
        {
          user_id: userId,
          date: today,
          status: 'answered',
          mode: 'checkin',
          midday_status: text,
          midday_blocker: blocker.trim() || null,
        },
        { onConflict: 'user_id,date', ignoreDuplicates: false }
      );
      setSaved(true);
    } catch {}
    setSaving(false);
  };

  // Show only between 11:00 and 22:00, and only until submitted
  if (!checked || saved || hourNum < 11 || hourNum >= 22) return null;

  return (
    <section className="rounded-[24px] border border-sky-500/15 bg-sky-500/[0.04] p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sun size={12} className="text-sky-500" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-500/70">
            {hourNum < 15 ? 'Midday check-in' : 'Wieczorny check-in'}
          </span>
        </div>
        <button
          onClick={() => setSaved(true)}
          className="rounded-full p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>

      <textarea
        ref={inputRef}
        value={status}
        onChange={e => setStatus(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } }}
        placeholder="Jak idzie? Co robisz, gdzie jesteś energetycznie..."
        rows={2}
        className="w-full resize-none bg-transparent text-[12px] font-medium text-text-primary placeholder:text-text-muted/40 outline-none leading-relaxed"
      />

      {showBlocker && (
        <textarea
          value={blocker}
          onChange={e => setBlocker(e.target.value)}
          placeholder="Co Cię blokuje? (opcjonalnie)"
          rows={1}
          className="w-full resize-none bg-sky-500/[0.05] rounded-xl px-3 py-2 text-[12px] font-medium text-text-primary placeholder:text-text-muted/40 outline-none leading-relaxed border border-sky-500/10"
        />
      )}

      <div className="flex items-center gap-2">
        {!showBlocker && (
          <button
            onClick={() => setShowBlocker(true)}
            className="text-[10px] font-bold text-sky-500/60 hover:text-sky-500 transition-colors cursor-pointer"
          >
            + bloker
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={save}
          disabled={!status.trim() || saving}
          className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-1.5 text-[11px] font-black text-white disabled:opacity-30 hover:bg-sky-600 transition-all active:scale-95 cursor-pointer"
        >
          <CheckCircle2 size={11} />
          {saving ? 'Zapisuję...' : 'Zapisz'}
        </button>
      </div>
    </section>
  );
}
