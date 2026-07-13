import { Suspense, lazy, useState } from 'react';

import { Sparkles } from 'lucide-react';

import type { FullPanelInfo } from '../../lib/health/medicalRetestContext';
import Skeleton from '../ui/Skeleton';
import Button from '../ui/Button';

import {

  buildOracleLabPrompt,

  type MedicalUserContext,

  type RetestSuggestion,

} from '../../lib/health/medicalRetestSuggestions';



const OracleCard = lazy(() => import('../ai/OracleCard'));



const PRIORITY_LABEL: Record<RetestSuggestion['priority'], string> = {

  high: 'Wysoki',

  medium: 'Średni',

  low: 'Niski',

};



const PRIORITY_CLASS: Record<RetestSuggestion['priority'], string> = {

  high: 'border-rose-500/25 bg-rose-500/[0.04]',

  medium: 'border-amber-500/25 bg-amber-500/[0.04]',

  low: 'border-border-custom bg-surface/30',

};



export default function MedicalRetestPanel({
  suggestions,
  userContext,
  fullPanel,
  loading,
}: {
  suggestions: RetestSuggestion[];
  userContext: MedicalUserContext;
  fullPanel: FullPanelInfo | null;
  loading: boolean;
}) {

  const [oracleOpen, setOracleOpen] = useState(false);

  const [oracleQuery, setOracleQuery] = useState('');



  const handleOracle = () => {

    setOracleQuery(buildOracleLabPrompt(suggestions, userContext, fullPanel));

    setOracleOpen(true);

  };



  return (

    <div className="space-y-4">

      <p className="text-[11px] text-text-muted leading-relaxed">

        Propozycje z reguł (stary panel, luki, trening). Oracle oceni sens i priorytet z kontekstem

        laboratoryjnym + reszty Vanguard — tylko tutaj, bez zapisu wniosków do bazy.

      </p>



      {loading ? (

        <Skeleton variant="text" lines={2} className="h-24 rounded-xl" />

      ) : suggestions.length === 0 ? (

        <p className="text-[12px] text-text-muted leading-relaxed">

          Brak automatycznych propozycji — panel może być wystarczająco świeży albo brakuje markerów do reguł.

        </p>

      ) : (

        <ul className="space-y-2">

          {suggestions.map((s) => (

            <li

              key={s.id}

              className={`rounded-xl border px-4 py-3 ${PRIORITY_CLASS[s.priority]}`}

            >

              <div className="flex items-start justify-between gap-2">

                <p className="text-[12px] font-bold text-text-primary leading-snug">{s.title}</p>

                <span className="shrink-0 text-[8px] font-black uppercase text-text-muted">

                  {PRIORITY_LABEL[s.priority]}

                </span>

              </div>

              <p className="text-[10px] text-text-muted mt-1 leading-relaxed">{s.reason}</p>

            </li>

          ))}

        </ul>

      )}



      {!oracleOpen ? (

        <Button
          type="button"
          onClick={handleOracle}
          variant="tonal"
          icon={<Sparkles size={14} />}
          className="uppercase tracking-wide"
        >
          Zapytaj Oracle — co ma dla mnie największe przełożenie
        </Button>

      ) : (

        <Suspense fallback={<Skeleton variant="card" className="h-40 rounded-[24px]" />}>

          <OracleCard


            embedded

            defaultOpen

            initialQuery={oracleQuery}

            storageScope="medical"

          />

        </Suspense>

      )}

    </div>

  );

}
