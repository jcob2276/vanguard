import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { Save, MapPin, Watch, Calendar, ArrowLeft, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { useSyncActions } from '../../hooks/useSyncActions';
import { notify } from '../../lib/notify';
import type { Tables } from '../../lib/database.types';

export default function SettingsView({ session }: { session: Session }) {
  const { userSettings, fetchUserSettings } = useStore();
  const [form, setForm] = useState<Partial<Tables<'user_settings'>>>({});
  const [profile, setProfile] = useState<Partial<Tables<'nutrition_profile'>>>({});
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
    if (userSettings) void (async () => { setForm(userSettings); })();
  }, [userSettings]);

  useEffect(() => {
    async function fetchProfile() {
      const { data } = await supabase
        .from('nutrition_profile')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data) setProfile(data);
    }
    void fetchProfile();
  }, [session.user.id]);

  const save = async () => {
    setSaving(true);
    try {
      const { error: settingsErr } = await supabase.from('user_settings').upsert({
        user_id: session.user.id,
        oura_token: form.oura_token || null,
        home_lat: form.home_lat ?? null,
        home_lng: form.home_lng ?? null,
        updated_at: new Date().toISOString(),
      });
      if (settingsErr) throw settingsErr;

      const { error: profileErr } = await supabase.from('nutrition_profile').upsert({
        user_id: session.user.id,
        birth_date: profile.birth_date || null,
        sex: profile.sex || null,
        height_cm: profile.height_cm ? Number(profile.height_cm) : null,
        goal_body_fat: profile.goal_body_fat ? Number(profile.goal_body_fat) : null,
        goal_target_date: profile.goal_target_date || null,
        protein_g_per_kg: profile.protein_g_per_kg ? Number(profile.protein_g_per_kg) : 2.0,
        weekly_loss_kg: profile.weekly_loss_kg ? Number(profile.weekly_loss_kg) : 0.5,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (profileErr) throw profileErr;

      await fetchUserSettings();
      notify('Ustawienia zapisane.', 'success');
    } catch (e: unknown) {
      notify(e instanceof Error ? (e as Error).message : 'Błąd zapisu', 'error');
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

      <NutritionProfileSettings profile={profile} onChange={setProfile} />

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

interface NutritionProfileSettingsProps {
  profile: Partial<Tables<'nutrition_profile'>>;
  onChange: (profile: Partial<Tables<'nutrition_profile'>>) => void;
}

function NutritionProfileSettings({ profile, onChange }: NutritionProfileSettingsProps) {
  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-text-muted">
        <User size={13} /> Profil Żywieniowy & Biometria
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-text-muted block mb-1 font-bold">Płeć</label>
          <select
            value={profile.sex ?? ''}
            onChange={(e) => onChange({ ...profile, sex: e.target.value || null })}
            className="w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2.5 text-[13px]"
          >
            <option value="">Wybierz...</option>
            <option value="M">Mężczyzna</option>
            <option value="F">Kobieta</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1 font-bold">Wzrost (cm)</label>
          <input
            type="number"
            placeholder="np. 180"
            value={profile.height_cm ?? ''}
            onChange={(e) => onChange({ ...profile, height_cm: e.target.value ? Number(e.target.value) : null })}
            className="w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2.5 text-[13px]"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-text-muted block mb-1 font-bold">Data urodzenia</label>
        <input
          type="date"
          value={profile.birth_date ? profile.birth_date.slice(0, 10) : ''}
          onChange={(e) => onChange({ ...profile, birth_date: e.target.value || null })}
          className="w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2.5 text-[13px]"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-text-muted block mb-1 font-bold">Docelowy tłuszcz (%)</label>
          <input
            type="number"
            step="0.1"
            placeholder="np. 12"
            value={profile.goal_body_fat ?? ''}
            onChange={(e) => onChange({ ...profile, goal_body_fat: e.target.value ? Number(e.target.value) : null })}
            className="w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2.5 text-[13px]"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1 font-bold">Cel chudnięcia (kg/tydz)</label>
          <input
            type="number"
            step="0.05"
            placeholder="np. 0.5"
            value={profile.weekly_loss_kg ?? ''}
            onChange={(e) => onChange({ ...profile, weekly_loss_kg: e.target.value ? Number(e.target.value) : 0.5 })}
            className="w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2.5 text-[13px]"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-text-muted block mb-1 font-bold">Białko na kg (g)</label>
          <input
            type="number"
            step="0.1"
            placeholder="np. 2.0"
            value={profile.protein_g_per_kg ?? ''}
            onChange={(e) => onChange({ ...profile, protein_g_per_kg: e.target.value ? Number(e.target.value) : 2.0 })}
            className="w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2.5 text-[13px]"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-1 font-bold">Data docelowa</label>
          <input
            type="date"
            value={profile.goal_target_date ? profile.goal_target_date.slice(0, 10) : ''}
            onChange={(e) => onChange({ ...profile, goal_target_date: e.target.value || null })}
            className="w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2.5 text-[13px]"
          />
        </div>
      </div>
    </section>
  );
}
