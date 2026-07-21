import { Smartphone, RefreshCw, MapPin, Battery, Zap } from 'lucide-react';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import {
  openAutostartSettings,
  openBackgroundLocationSettings,
  requestIgnoreBatteryOptimizations,
} from '../../lib/native/backgroundSync';
import { openUsageStatsSettings } from '../../lib/native/usageStatsSync';
import { useNativePermissionsCard } from './useNativePermissionsCard';

interface NativePermissionsCardProps {
  userId: string;
}

export default function NativePermissionsCard({ userId }: NativePermissionsCardProps) {
  const {
    usageGranted,
    locationGranted,
    batteryIgnored,
    bgSyncOn,
    syncing,
    lastTotal,
    lastUnlocks,
    locationCount,
    latestPlace,
    toggleBackgroundSync,
    syncNow,
  } = useNativePermissionsCard(userId);

  return (
    <Card padding="1rem" className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-text-muted">
        <Smartphone size={13} /> Telefon (APK)
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span>Statystyki użycia</span>
          <span className={usageGranted ? 'text-success' : 'text-warning'}>
            {usageGranted === null ? '…' : usageGranted ? 'OK' : 'Wył.'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1"><MapPin size={12} /> Lokalizacja</span>
          <span className={locationGranted ? 'text-success' : 'text-warning'}>
            {locationGranted === null ? '…' : locationGranted ? 'OK' : 'Wył.'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1"><Battery size={12} /> Bez optym. baterii</span>
          <span className={batteryIgnored ? 'text-success' : 'text-warning'}>
            {batteryIgnored === null ? '…' : batteryIgnored ? 'OK' : 'Wył.'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1"><Zap size={12} /> Sync w tle (FGS)</span>
          <span className={bgSyncOn ? 'text-success' : 'text-text-muted'}>
            {bgSyncOn === null ? '…' : bgSyncOn ? 'Aktywny' : 'Wył.'}
          </span>
        </div>
      </div>

      {lastTotal !== null && (
        <p className="text-sm text-text-primary font-medium">
          Dziś: {lastTotal} min ekranu
          {lastUnlocks !== null ? ` · ${lastUnlocks} odblokowań` : ''}
        </p>
      )}
      {locationCount !== null && locationCount > 0 && (
        <p className="text-xs text-text-muted">
          Lokalizacja: {locationCount} punktów dziś
          {latestPlace ? ` · ostatnio: ${latestPlace}` : ''}
        </p>
      )}

      <p className="text-2xs text-text-muted">
        Sync w tle utrzymuje proces przy życiu (powiadomienie). Na Xiaomi włącz autostart i „bez ograniczeń”.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => openUsageStatsSettings()} className="flex-1">
          Użycie
        </Button>
        <Button type="button" variant="outline" onClick={() => openBackgroundLocationSettings()} className="flex-1">
          GPS
        </Button>
        <Button type="button" variant="outline" onClick={() => requestIgnoreBatteryOptimizations()} className="flex-1">
          Bateria
        </Button>
        <Button type="button" variant="outline" onClick={() => openAutostartSettings()} className="flex-1">
          Autostart
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={bgSyncOn ? 'outline' : 'primary'}
          onClick={toggleBackgroundSync}
          className="flex-1"
        >
          {bgSyncOn ? 'Wyłącz tło' : 'Sync w tle'}
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={syncing}
          onClick={syncNow}
          icon={<RefreshCw size={14} />}
          className="flex-1"
        >
          Sync teraz
        </Button>
      </div>
    </Card>
  );
}
