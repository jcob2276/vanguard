import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Compass, Plus, X, CheckCircle, Wind, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

const TYPES = {
  slide:       { label: 'Slajd',       emoji: '🎯', color: 'text-primary',    border: 'border-primary/30',    bg: 'bg-primary/10'    },
  prayer:      { label: 'Modlitwa',    emoji: '🙏', color: 'text-yellow-400', border: 'border-yellow-400/30', bg: 'bg-yellow-400/10' },
  affirmation: { label: 'Afirmacja',   emoji: '✨', color: 'text-purple-400', border: 'border-purple-400/30', bg: 'bg-purple-400/10' },
  career:      { label: 'Kariera',     emoji: '🚀', color: 'text-blue-400',   border: 'border-blue-400/30',   bg: 'bg-blue-400/10'   },
  goal:        { label: 'Cel życiowy', emoji: '🏔', color: 'text-orange-400', border: 'border-orange-400/30', bg: 'bg-orange-400/10' },
};

export default function ManifestationBoard({ session }) {
  const [intentions, setIntentions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showManifested, setShowManifested] = useState(false);
  const [form, setForm] = useState({ text: '', type: 'slide', importance: 7, notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchIntentions(); }, [session?.user?.id]);

  async function fetchIntentions() {
    setLoading(true);
    const { data } = await supabase
      .from('vanguard_intentions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false });
    setIntentions(data || []);
    setLoading(false);
  }

  async function addIntention() {
    if (!form.text.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('vanguard_intentions').insert({
      user_id: session.user.id,
      text: form.text.trim(),
      type: form.type,
      importance: form.importance,
      notes: form.notes.trim() || null,
    });
    if (!error) {
      setForm({ text: '', type: 'slide', importance: 7, notes: '' });
      setShowForm(false);
      await fetchIntentions();
    }
    setSaving(false);
  }

  async function manifest(id) {
    await supabase
      .from('vanguard_intentions')
      .update({ status: 'manifested', manifested_at: new Date().toISOString() })
      .eq('id', id);
    await fetchIntentions();
  }

  async function release(id) {
    await supabase
      .from('vanguard_intentions')
      .update({ status: 'released' })
      .eq('id', id);
    await fetchIntentions();
  }

  async function deleteIntention(id) {
    await supabase.from('vanguard_intentions').delete().eq('id', id);
    await fetchIntentions();
  }

  const active = intentions.filter(i => i.status === 'active');
  const manifested = intentions.filter(i => i.status === 'manifested');

  if (loading) return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 animate-pulse">
      <div className="h-2 w-32 bg-neutral-800 rounded mb-4" />
      <div className="space-y-2">
        <div className="h-12 bg-neutral-800 rounded-xl" />
        <div className="h-12 bg-neutral-800 rounded-xl" />
      </div>
    </div>
  );

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
          <Compass size={12} className="text-primary" />
          Deklaracje / Intencje
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-[8px] font-black text-neutral-600 uppercase">
            {active.length} aktywnych · {manifested.length} domkniętych
          </span>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800 text-[10px] font-black uppercase text-primary hover:bg-primary hover:text-white transition-all"
          >
            <Plus size={12} /> Dodaj
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-neutral-900 border-2 border-primary/40 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-white">Nowa intencja</span>
            <button onClick={() => setShowForm(false)} className="text-neutral-500 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {/* Type selector */}
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(TYPES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => setForm({ ...form, type: key })}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${form.type === key ? `${t.bg} ${t.border}` : 'border-neutral-800 bg-neutral-950 opacity-50'}`}
              >
                <span className="text-lg">{t.emoji}</span>
                <span className={`text-[7px] font-black uppercase ${form.type === key ? t.color : 'text-neutral-600'}`}>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Text */}
          <textarea
            value={form.text}
            onChange={e => setForm({ ...form, text: e.target.value })}
            placeholder={
              form.type === 'slide' ? 'Opisz swoją wizualizację — jak to wygląda gdy jest już zrealizowane...' :
              form.type === 'prayer' ? 'Twoja modlitwa lub intencja biblijna...' :
              form.type === 'affirmation' ? 'Afirmacja w czasie teraźniejszym — "Jestem / Mam / Robię..."' :
              form.type === 'career' ? 'Cel zawodowy, umiejętność lub kamień milowy...' :
              'Cel życiowy — długoterminowy, głęboki...'
            }
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-[12px] font-bold text-white outline-none focus:border-primary resize-none min-h-[80px] transition-all"
          />

          {/* Importance */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
              Ważność: {form.importance}/10
            </label>
            <input
              type="range" min={1} max={10}
              value={form.importance}
              onChange={e => setForm({ ...form, importance: parseInt(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          {/* Notes (optional) */}
          <input
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Notatka / kontekst (opcjonalnie)..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-[11px] font-bold text-white outline-none focus:border-primary transition-all"
          />

          <button
            onClick={addIntention}
            disabled={saving || !form.text.trim()}
            className="w-full bg-primary text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
          >
            {saving ? 'Zapisuję...' : `Ustaw intencję ${TYPES[form.type].emoji}`}
          </button>
        </div>
      )}

      {/* Active intentions */}
      {active.length === 0 && !showForm ? (
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-8 text-center">
          <p className="text-[10px] font-black text-neutral-700 uppercase tracking-widest italic">Brak aktywnych intencji.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(intention => {
            const t = TYPES[intention.type] || TYPES.goal;
            return (
              <div key={intention.id} className={`bg-neutral-900 border ${t.border} rounded-2xl p-5 space-y-3 relative overflow-hidden`}>
                {/* Glow */}
                <div className={`absolute -top-8 -right-8 w-24 h-24 ${t.bg} rounded-full blur-2xl opacity-40`} />

                <div className="flex items-start justify-between gap-3 relative">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-xl shrink-0 mt-0.5">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[8px] font-black uppercase tracking-widest ${t.color}`}>{t.label}</span>
                        <span className="text-[7px] font-black text-neutral-700 uppercase">· {intention.importance}/10</span>
                      </div>
                      <p className="text-[13px] font-bold text-white leading-relaxed">{intention.text}</p>
                      {intention.notes && (
                        <p className="text-[10px] text-neutral-500 italic mt-1">{intention.notes}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteIntention(intention.id)} className="text-neutral-800 hover:text-red-500 transition-colors shrink-0 mt-1">
                    <X size={12} />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 relative">
                  <button
                    onClick={() => manifest(intention.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-green-500/30 bg-green-500/10 text-[9px] font-black uppercase text-green-400 hover:bg-green-500/20 transition-all"
                  >
                    <CheckCircle size={11} /> Domknięte
                  </button>
                  <button
                    onClick={() => release(intention.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-neutral-700 bg-neutral-950 text-[9px] font-black uppercase text-neutral-500 hover:text-white transition-all"
                  >
                    <Wind size={11} /> Odpuść
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manifested — collapsible */}
      {manifested.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowManifested(!showManifested)}
            className="w-full flex items-center justify-between py-2 text-[9px] font-black text-neutral-600 uppercase tracking-widest hover:text-white transition-colors"
          >
            <span>✅ Domknięte ({manifested.length})</span>
            {showManifested ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showManifested && (
            <div className="space-y-2">
              {manifested.map(intention => {
                const t = TYPES[intention.type] || TYPES.goal;
                return (
                  <div key={intention.id} className="bg-neutral-950 border border-neutral-800/50 rounded-xl p-4 flex items-start gap-3 opacity-70">
                    <span className="text-base shrink-0">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-neutral-400 line-through leading-relaxed">{intention.text}</p>
                      {intention.manifested_at && (
                        <p className="text-[8px] font-black text-green-500/70 uppercase mt-1">
                          ✓ {format(new Date(intention.manifested_at), 'dd.MM.yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
