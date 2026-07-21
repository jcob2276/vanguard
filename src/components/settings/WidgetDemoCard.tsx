import { useEffect, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { notify } from '../../lib/notify';
import {
  cycleWidgetDemoFromApp,
  fetchWidgetDemoState,
  initWidgetDemoSync,
  requestPinDemoWidget,
  WIDGET_DEMO_MODE_COLORS,
} from '../../lib/native/widgetDemo';
import type { WidgetDemoState } from '../../lib/native/widgetBridgePlugin';

export default function WidgetDemoCard() {
  const [state, setState] = useState<WidgetDemoState | null>(null);
  const [pinning, setPinning] = useState(false);

  useEffect(() => {
    return initWidgetDemoSync(setState);
  }, []);

  const cycleFromApp = async () => {
    const next = await cycleWidgetDemoFromApp();
    setState(next);
    notify(`Tryb: ${next.modeLabel} (z apki → widget też)`, 'success');
  };

  const pinWidget = async () => {
    setPinning(true);
    try {
      const ok = await requestPinDemoWidget();
      if (ok) {
        notify('Wybierz „Vanguard Demo” na ekranie głównym', 'info');
      } else {
        notify('Pin widgetu niedostępny — dodaj ręcznie z listy widgetów', 'error');
      }
    } finally {
      setPinning(false);
    }
  };

  const refresh = async () => {
    setState(await fetchWidgetDemoState());
  };

  const modeClass = state ? (WIDGET_DEMO_MODE_COLORS[state.modeId] ?? 'text-text-primary') : 'text-text-muted';

  return (
    <Card padding="1rem" className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-text-muted">
        <LayoutGrid size={13} /> Widget demo
      </div>

      <div className="rounded-xl border border-border-custom/40 bg-surface-solid/40 p-4 space-y-1">
        <p className="text-2xs font-black uppercase tracking-widest text-text-muted">Stan w apce</p>
        <p className={`text-2xl font-bold tabular-nums ${modeClass}`}>
          {state?.modeLabel ?? '…'}
        </p>
        <p className="text-xs text-text-muted">
          Tapnięć z widgetu: <span className="font-semibold text-text-primary">{state?.tapCount ?? '…'}</span>
        </p>
      </div>

      <p className="text-2xs text-text-muted">
        Tap na widgetcie na pulpicie przełącza Focus → Odpoczynek → Ruch. Jeśli apka jest otwarta (Ustawienia),
        stan aktualizuje się od razu — bez ponownego otwierania.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void pinWidget()} loading={pinning} className="flex-1">
          Dodaj widget
        </Button>
        <Button type="button" variant="primary" onClick={() => void cycleFromApp()} className="flex-1">
          Zmień z apki
        </Button>
        <Button type="button" variant="ghost" onClick={() => void refresh()} className="flex-1">
          Odśwież
        </Button>
      </div>
    </Card>
  );
}
