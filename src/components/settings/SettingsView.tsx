import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { Save, MapPin, Watch, Calendar, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { useSyncActions } from '../../hooks/useSyncActions';
import { notify } from '../../lib/notify';
import type { Tables } from '../../lib/database.types';

export default function SettingsView({ session }: { session: Session }) {
  const { userSettings, fetchUserSettings } = useStore();
  const [form, setForm] = useState<Partial<Tables<'user_settings'>>>({});
  const [saving, setSaving] = useState(false);

  const { syncCalendar, startGoogleAuth } = useSyncActions({
    userId: session.user.id,
    accessToken: session.access_token,
    onRefresh: () => fetchUserSettings(),
    setSyncing: () => {},
  });

  useEffect(() => {
    fetchUserSettings();
  }, [fetchUserSettings]);

  useEffect(() => {
    if (userSettings) setForm(userSettings);
  }, [userSettings]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('user_settings').upsert({
        user_id: session.user.id,
        oura_token: form.oura_token || null,
        home_lat: form.home_lat ?? null,
        home_lng: form.home_lng ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await fetchUserSettings();
      notify('Ustawienia zapisane.', 'success');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Błąd zapisu', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-5 pb-24 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="rounded-xl border border-border-custom p-2 text-text-muted hover:text-text-primary">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-lg font-black font-display text-text-primary">Ustawienia</h1>
      </div>

      <section className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-text-muted">
          <Watch size={13} /> Oura
        </div>
        <input
          type="password"
          placeholder="Oura personal access token"
          value={form.oura_token ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, oura_token: e.target.value }))}
          className="w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2.5 text-[13px]"
        />
      </section>

      <section className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-text-muted">
          <MapPin size={13} /> Lokalizacja domu
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="any"
            placeholder="Lat"
            value={form.home_lat ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, home_lat: e.target.value ? Number(e.target.value) : null }))}
            className="rounded-xl border border-border-custom bg-surface-solid px-3 py-2.5 text-[13px]"
          />
          <input
            type="number"
            step="any"
            placeholder="Lng"
            value={form.home_lng ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, home_lng: e.target.value ? Number(e.target.value) : null }))}
            className="rounded-xl border border-border-custom bg-surface-solid px-3 py-2.5 text-[13px]"
          />
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-text-muted">
          <Calendar size={13} /> Google Calendar
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={startGoogleAuth} className="flex-1 rounded-xl border border-border-custom py-2.5 text-[11px] font-bold cursor-pointer hover:bg-surface-solid">
            Połącz konto
          </button>
          <button type="button" onClick={() => syncCalendar().then(() => notify('Kalendarz zsynchronizowany', 'success'))} className="flex-1 rounded-xl bg-primary py-2.5 text-[11px] font-bold text-white cursor-pointer hover:bg-primary-hover">
            Sync teraz
          </button>
        </div>
      </section>

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-50 cursor-pointer"
      >
        <Save size={14} />
        {saving ? 'Zapisuję…' : 'Zapisz ustawienia'}
      </button>
    </div>
  );
}
