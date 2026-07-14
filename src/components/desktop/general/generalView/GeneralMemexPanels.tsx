import { Panel } from '../../shell/Panel';
import ScoreBar from './ScoreBar';
import { Card } from '../../../ui/Card';

import { GeneralViewPattern, GeneralViewCuriosity, GeneralViewWiki } from '../hooks/useGeneralViewData';

interface GeneralMemexPanelsProps {
  patterns: GeneralViewPattern[];
  curiosity: GeneralViewCuriosity[];
  wiki: GeneralViewWiki[];
  emeraldColor: string;
}

export default function GeneralMemexPanels({
  patterns,
  curiosity,
  wiki,
  emeraldColor,
}: GeneralMemexPanelsProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Panel title={`Wzorce zachowań (${patterns.length})`}>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {patterns.map((p, i) => (
              <Card key={i} variant="outline" padding="0.625rem" className="hover:border-primary/20 hover:shadow-sm transition-all duration-150">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-text-primary leading-tight">{p.title || p.pattern_type}</span>
                  <span className={`text-2xs px-1.5 py-0.5 rounded-full font-bold shrink-0 ${p.status === 'active' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex gap-3 text-2xs text-text-muted">
                  <span>n={p.occurrence_count}</span>
                  <span>conf={Math.round((p.confidence || 0) * 100)}%</span>
                  <span className="ml-auto">{p.last_seen?.slice(0, 10)}</span>
                </div>
                <ScoreBar value={(p.confidence || 0) * 100} color={emeraldColor} />
              </Card>
            ))}
            {patterns.length === 0 && <p className="text-text-muted text-xs py-2">Brak wzorców — potrzeba więcej danych</p>}
          </div>
        </Panel>

        <Panel title={`Hipotezy do zbadania (${curiosity.length})`}>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {curiosity.map((c, i) => (
              <Card key={i} variant="outline" padding="0.625rem" className="hover:border-primary/20 hover:shadow-sm transition-all duration-150">
                <p className="text-xs text-text-secondary leading-relaxed mb-1.5">{c.hypothesis}</p>
                {c.provocation && (
                  <p className="text-2xs text-primary italic">→ {c.provocation}</p>
                )}
                <div className="flex gap-3 text-2xs text-text-muted mt-1">
                  <span className="px-1.5 py-0.5 rounded bg-surface-solid text-2xs">{c.category}</span>
                  <span>n={c.evidence_count}</span>
                  <span>conf={Math.round((c.confidence_score || 0) * 100)}%</span>
                </div>
              </Card>
            ))}
            {curiosity.length === 0 && <p className="text-text-muted text-xs py-2">Brak hipotez — system generuje je stopniowo</p>}
          </div>
        </Panel>
      </div>

      {/* Wiki */}
      <Panel title={`Wiki — strony pamięci (${wiki.length})`}>
        <div className="grid grid-cols-1 gap-2 max-h-[260px] overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
          {wiki.map((w, i) => (
            <Card key={i} variant="outline" padding="0.625rem">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${w.status === 'active' ? 'bg-success' : 'bg-warning'}`} />
                <span className="text-xs font-bold text-text-primary truncate">{w.title}</span>
              </div>
              <div className="flex gap-2 text-2xs text-text-muted">
                <span className="px-1 py-0.5 rounded bg-surface-solid text-2xs">{w.page_type}</span>
                <span>{Math.round((w.confidence || 0) * 100)}%</span>
              </div>
              {w.summary && <p className="text-2xs text-text-muted mt-1 leading-relaxed line-clamp-2">{w.summary}</p>}
            </Card>
          ))}
          {wiki.length === 0 && <p className="text-text-muted text-xs py-2 col-span-3">Brak stron wiki</p>}
        </div>
      </Panel>
    </div>
  );
}
