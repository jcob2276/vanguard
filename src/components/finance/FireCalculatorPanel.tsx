import { computeFireMetrics, type FireInputs } from '@vanguard/domain';

import { formatPct, formatPln, formatYears } from '../../lib/finance/formatMoney';

import { SliderField } from './financeShared';

import { FinanceList, FinanceRow, FinanceSection, financeHeroNumberClass } from './financeUi';



interface FireCalculatorPanelProps {

  input: FireInputs;

  onChange: (patch: Partial<FireInputs>) => void;

}



export function FireCalculatorPanel({ input, onChange }: FireCalculatorPanelProps) {

  const fire = computeFireMetrics(input);



  return (

    <div className="grid gap-8 lg:grid-cols-2">

      <FinanceSection title="Założenia" subtitle="Przesuwaj suwaki — liczby się przeliczają od razu.">

        <div className="space-y-5 px-4 py-4">

          <SliderField

            label="Miesięczne wydatki"

            value={input.monthlyExpenses}

            min={1000}

            max={50000}

            step={100}

            display={formatPln(input.monthlyExpenses)}

            onChange={(v) => onChange({ monthlyExpenses: v })}

          />

          <SliderField

            label="Miesięczny dochód"

            value={input.monthlyIncome}

            min={0}

            max={80000}

            step={500}

            display={formatPln(input.monthlyIncome)}

            onChange={(v) => onChange({ monthlyIncome: v })}

          />

          <p className="text-sm text-text-muted">

            Majątek z kont: <span className="font-medium text-text-primary">{formatPln(input.currentSavings)}</span>

          </p>

          <SliderField

            label="Stopa zwrotu"

            value={input.expectedReturnPct}

            min={0}

            max={15}

            step={0.5}

            suffix="%"

            display={formatPct(input.expectedReturnPct)}

            onChange={(v) => onChange({ expectedReturnPct: v })}

          />

          <SliderField

            label="Inflacja"

            value={input.inflationPct}

            min={0}

            max={10}

            step={0.5}

            suffix="%"

            display={formatPct(input.inflationPct)}

            onChange={(v) => onChange({ inflationPct: v })}

          />

          <SliderField

            label="Safe withdrawal rate"

            value={input.safeWithdrawalRatePct}

            min={3}

            max={5}

            step={0.25}

            suffix="%"

            display={formatPct(input.safeWithdrawalRatePct)}

            onChange={(v) => onChange({ safeWithdrawalRatePct: v })}

          />

        </div>

      </FinanceSection>



      <FinanceSection title="Wynik">

        <div className="px-4 py-5">

          <p className="text-sm text-text-muted">Do FIRE brakuje</p>

          <p className={`mt-1 ${financeHeroNumberClass}`}>{formatPln(Math.max(0, fire.fireNumber - input.currentSavings))}</p>

          <p className="mt-2 text-base text-text-secondary">

            Cel: {formatPln(fire.fireNumber)} · ok. {formatYears(fire.yearsToFire)}

          </p>

        </div>

        <FinanceList>

          <FinanceRow primary="Lean FIRE (70%)" trailing={formatPln(fire.leanFire)} />

          <FinanceRow primary="Fat FIRE (150%)" trailing={formatPln(fire.fatFire)} />

          <FinanceRow primary="Coast FIRE" trailing={formatPln(fire.coastFire)} />

          <FinanceRow primary="Barista FIRE (50%)" trailing={formatPln(fire.baristaFire)} />

          <FinanceRow primary="Odkładasz miesięcznie" trailing={formatPln(fire.monthlySavings)} />

          <FinanceRow primary="Stopa oszczędności" trailing={formatPct(fire.savingsRatePct)} />

          <FinanceRow primary="Runway" trailing={`${fire.runwayMonths.toFixed(1)} mies.`} />

        </FinanceList>

      </FinanceSection>

    </div>

  );

}

