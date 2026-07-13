import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { Save, MapPin, Watch, Calendar, ArrowLeft, User } from 'lucide-react';
import {
  fetchNutritionProfile,
  upsertUserSettings,
  upsertNutritionProfile,
} from '../../lib/userSettingsApi';
import { useStore } from '../../store/useStore';
import { useSyncActions } from '../../hooks/useSyncActions';
import { notify } from '../../lib/notify';
import type { Tables } from '../../lib/database.types';
import Button from '../ui/Button';
import { Card } from '../ui/Card';

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
    async function loadProfile() {
      try {
        const data = await fetchNutritionProfile(session.user.id);
        if (data) setProfile(data);
      } catch (err: unknown) {
        console.error('[SettingsView] Failed to load profile:', err);
      }
    }
    void loadProfile();
  }, [session.user.id]);

  const save = async () => {
    setSaving(true);
    try {
      await upsertUserSettings({
        user_id: session.user.id,
        oura_token: form.oura_token || null,
        home_lat: form.home_lat ?? null,
        home_lng: form.home_lng ?? null,
        updated_at: new Date().toISOString(),
      });
 
      await upsertNutritionProfile({
        user_id: session.user.id,
        birth_date: profile.birth_date || null,
        sex: profile.sex || null,
        height_cm: profile.height_cm ? Number(profile.height_cm) : null,
        goal_body_fat: profile.goal_body_fat ? Number(profile.goal_body_fat) : null,
        goal_target_date: profile.goal_target_date || null,
        protein_g_per_kg: profile.protein_g_per_kg ? Number(profile.protein_g_per_kg) : 2.0,
        weekly_loss_kg: profile.weekly_loss_kg ? Number(profile.weekly_loss_kg) : 0.5,
        updated_at: new Date().toISOString(),
      });

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

      <Card padding="1rem" className="space-y-3">
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
      </Card>

      <Card padding="1rem" className="space-y-3">
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
      </Card>

      <NutritionProfileSettings profile={profile} onChange={setProfile} />

      <Card padding="1rem" className="space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-text-muted">
          <Calendar size={13} /> Google Calendar
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={startGoogleAuth} className="flex-1">
            Połącz konto
          </Button>
          <Button type="button" variant="primary" onClick={() => syncCalendar().then(() => notify('Kalendarz zsynchronizowany', 'success'))} className="flex-1">
            Sync teraz
          </Button>
        </div>
      </Card>

      <Button
        type="button"
        variant="primary"
        size="lg"
        loading={saving}
        onClick={save}
        icon={<Save size={14} />}
        className="w-full uppercase tracking-wider"
      >
        {saving ? 'Zapisuję…' : 'Zapisz ustawienia'}
      </Button>
    </div>
  );
}

interface NutritionProfileSettingsProps {
  profile: Partial<Tables<'nutrition_profile'>>;
  onChange: (profile: Partial<Tables<'nutrition_profile'>>) => void;
}

function NutritionProfileSettings({ profile, onChange }: NutritionProfileSettingsProps) {
  return (
    <Card padding="1rem" className="space-y-3">
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
    </Card>
  );
}
