import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { unwrapList } from '../../lib/supabaseUtils';
import { Activity, Brain, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { useUserId } from '../../store/useStore';
import { Card } from '../ui/Card';
import Button from '../ui/Button';

interface BrainHealthRow {
  table_name: string;
  total_records: number;
  embedded_records: number;
  coverage_percent: number;
}

export default function BrainHealth() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  const reportQuery = useQuery({
    queryKey: ['brain-health', userId],
    queryFn: async () => {
      const res = await supabase.rpc('get_brain_health_report', { user_id_param: userId! });
      return unwrapList(res) as BrainHealthRow[];
    },
    enabled: !!userId,
  });

  const report = reportQuery.data ?? [];
  const loading = reportQuery.isLoading;

  if (!userId) return null;

  return (
    <Card variant="glass" className="border border-border-custom backdrop-blur-md space-y-4" style={{ background: 'rgba(var(--color-surface), 0.4)' }} padding="1.25rem">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
          <Brain size={14} className="text-primary" /> Vanguard Brain Health
        </h4>
        <Button
          onClick={() => void queryClient.invalidateQueries({ queryKey: ['brain-health', userId] })}
          variant="ghost"
          size="sm"
          className="!px-0 uppercase tracking-widest"
        >
          Odśwież
        </Button>
      </div>

      {loading ? (
        <div className="h-24 flex items-center justify-center">
            <Activity size={24} className="text-primary animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {report.map((row: BrainHealthRow) => (
            <div key={row.table_name} className="bg-surface border border-border-custom p-3.5 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-2xs font-black text-text-secondary uppercase tracking-tight">
                  {row.table_name.replace('vanguard_', '')}
                </span>
                {row.coverage_percent >= 90 ? (
                  <CheckCircle2 size={11} className="text-success" />
                ) : row.coverage_percent > 0 ? (
                  <AlertCircle size={11} className="text-warning" />
                ) : (
                  <ShieldAlert size={11} className="text-danger" />
                )}
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-text-primary italic font-display">{row.total_records}</span>
                <span className="text-2xs font-bold text-text-muted uppercase">rekordów</span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-2xs font-black uppercase">
                  <span className="text-text-muted italic">Semantic coverage</span>
                  <span className={row.coverage_percent < 50 ? 'text-danger' : 'text-primary'}>
                    {row.coverage_percent}%
                  </span>
                </div>
                <div className="w-full h-1 bg-text-primary/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${row.coverage_percent < 50 ? 'bg-danger' : 'bg-primary'}`}
                    style={{ width: `${row.coverage_percent}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-2xs text-text-muted font-bold leading-relaxed uppercase">
        * "Semantic Coverage" oznacza procent rekordów posiadających wygenerowane embeddingi wektorowe, gotowe do użycia przez Oracle.
      </p>
    </Card>
  );
}
