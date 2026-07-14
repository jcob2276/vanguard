import { Suspense, lazy, useState } from 'react';

import { Sparkles } from 'lucide-react';

import type { FullPanelInfo } from '../../lib/health/medicalRetestContext';
import Skeleton from '../ui/Skeleton';
import Button from '../ui/Button';
import { Card, type CardVariant } from '../ui/Card';

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



const PRIORITY_VARIANT: Record<RetestSuggestion['priority'], CardVariant> = {
  high: 'danger',
  medium: 'notice',
  low: 'outline',
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

      <p className="text-xs text-text-muted leading-relaxed">

        Propozycje z reguł (stary panel, luki, trening). Oracle oceni sens i priorytet z kontekstem

        laboratoryjnym + reszty Vanguard — tylko tutaj, bez zapisu wniosków do bazy.

      </p>



      {loading ? (

        <Skeleton variant="text" lines={2} className="h-24 rounded-xl" />

      ) : suggestions.length === 0 ? (

        <p className="text-sm text-text-muted leading-relaxed">

          Brak automatycznych propozycji — panel może być wystarczająco świeży albo brakuje markerów do reguł.

        </p>

      ) : (

        <ul className="space-y-2">

          {suggestions.map((s) => (

            <Card as="li" key={s.id} variant={PRIORITY_VARIANT[s.priority]} padding="0.75rem 1rem" className="!rounded-xl">

              <div className="flex items-start justify-between gap-2">

                <p className="text-sm font-bold text-text-primary leading-snug">{s.title}</p>

                <span className="shrink-0 text-2xs font-black uppercase text-text-muted">

                  {PRIORITY_LABEL[s.priority]}

                </span>

              </div>

              <p className="text-xs text-text-muted mt-1 leading-relaxed">{s.reason}</p>

            </Card>

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
