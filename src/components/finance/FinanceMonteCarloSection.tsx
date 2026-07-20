import { useMemo } from 'react';
import { monteCarloFromFireInput, type FireInputs } from '@vanguard/domain';
import { MonteCarloPanel } from './MonteCarloPanel';

interface FinanceMonteCarloSectionProps {
  fireInput: FireInputs;
  fireTarget: number;
}

export function FinanceMonteCarloSection({ fireInput, fireTarget }: FinanceMonteCarloSectionProps) {
  const result = useMemo(
    () => monteCarloFromFireInput(fireInput, 400),
    [fireInput],
  );

  return <MonteCarloPanel result={result} fireTarget={fireTarget} />;
}
