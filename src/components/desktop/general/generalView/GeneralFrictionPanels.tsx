import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Panel, Tip } from '../../shell/Panel';

import { GeneralViewFriction } from '../hooks/useGeneralViewData';

interface FrictionBarItem {
  type: string;
  count: number;
  color: string;
}

interface GeneralFrictionPanelsProps {
  frictionBar: FrictionBarItem[];
  friction: GeneralViewFriction[];
  frictionColor: Record<string, string>;
  tick: string;
}

export default function GeneralFrictionPanels({
  frictionBar,
  friction,
  frictionColor,
  tick,
}: GeneralFrictionPanelsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      <Panel title="Tarcia wg typu">
        <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
          <BarChart data={frictionBar} margin={{ top: 4, right: 4, left: -20, bottom: 20 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
            <XAxis type="number" tick={{ fontSize: 9, fill: tick }} />
            <YAxis type="category" dataKey="type" tick={{ fontSize: 8, fill: tick }} width={90} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {frictionBar.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <div className="lg:col-span-2">
        <Panel title="Ostatnie tarcia">
          <div className="space-y-1.5 max-h-[var(--legacy-h-017)] overflow-y-auto pr-1">
            {friction.slice(-20).reverse().map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-border-custom/40 last:border-0">
                <span className="shrink-0 font-mono text-text-muted">{f.occurred_at?.slice(5, 10)}</span>
                <span
                  className="font-bold px-1.5 py-0.5 rounded text-2xs shrink-0"
                  style={{
                    backgroundColor: (frictionColor[f.friction_type ?? 'other'] || 'var(--color-text-muted)') + '22',
                    color: frictionColor[f.friction_type ?? 'other'] || 'var(--color-text-muted)',
                  }}
                >
                  {(f.friction_type || 'other').replace(/_/g, ' ')}
                </span>
                <span className="text-text-secondary truncate">{f.actual_behavior || f.immediate_cost || '–'}</span>
              </div>
            ))}
            {friction.length === 0 && <p className="text-text-muted text-xs py-2">Brak danych</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
