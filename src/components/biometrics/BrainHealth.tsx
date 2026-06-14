import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, Brain, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

export default function BrainHealth({ session }) {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_brain_health_report', { 
        user_id_param: session.user.id 
      });
      if (error) throw error;
      setReport(data || []);
    } catch (err) {
      console.error('Error fetching brain health:', err);
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="rounded-[24px] border border-border-custom bg-surface/40 backdrop-blur-md p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
          <Brain size={14} className="text-primary" /> Vanguard Brain Health
        </h4>
        <button 
          onClick={fetchReport}
          className="text-[8px] font-black text-text-muted hover:text-text-primary uppercase tracking-widest transition-colors"
        >
          Odśwież
        </button>
      </div>

      {loading ? (
        <div className="h-24 flex items-center justify-center">
            <Activity size={24} className="text-primary animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {report.map((row) => (
            <div key={row.table_name} className="bg-surface border border-border-custom p-3.5 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black text-text-secondary uppercase tracking-tight">
                  {row.table_name.replace('vanguard_', '')}
                </span>
                {row.coverage_percent >= 90 ? (
                  <CheckCircle2 size={11} className="text-green-500" />
                ) : row.coverage_percent > 0 ? (
                  <AlertCircle size={11} className="text-amber-500" />
                ) : (
                  <ShieldAlert size={11} className="text-red-500" />
                )}
              </div>
              
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-text-primary italic font-display">{row.total_records}</span>
                <span className="text-[8px] font-bold text-text-muted uppercase">rekordów</span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-black uppercase">
                  <span className="text-text-muted italic">Semantic coverage</span>
                  <span className={row.coverage_percent < 50 ? 'text-red-500' : 'text-primary'}>
                    {row.coverage_percent}%
                  </span>
                </div>
                <div className="w-full h-1 bg-text-primary/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${row.coverage_percent < 50 ? 'bg-red-500' : 'bg-primary'}`}
                    style={{ width: `${row.coverage_percent}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[8px] text-text-muted font-bold leading-relaxed uppercase">
        * "Semantic Coverage" oznacza procent rekordów posiadających wygenerowane embeddingi wektorowe, gotowe do użycia przez Oracle.
      </p>
    </div>
  );
}
