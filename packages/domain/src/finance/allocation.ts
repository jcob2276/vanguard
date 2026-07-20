export interface AllocationSlice {
  key: string;
  label: string;
  amount: number;
  pct: number;
}

export function computeAllocation(
  accounts: { account_type: string; balance: number }[],
  labels: Record<string, string>,
): AllocationSlice[] {
  const totals = new Map<string, number>();
  let sum = 0;
  for (const a of accounts) {
    if (a.balance <= 0) continue;
    totals.set(a.account_type, (totals.get(a.account_type) ?? 0) + a.balance);
    sum += a.balance;
  }
  if (sum <= 0) return [];

  return [...totals.entries()]
    .map(([key, amount]) => ({
      key,
      label: labels[key] ?? key,
      amount,
      pct: (amount / sum) * 100,
    }))
    .sort((a, b) => b.amount - a.amount);
}
