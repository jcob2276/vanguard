export const FINANCE_EXPENSE_CATEGORIES = [
  'Jedzenie',
  'Transport',
  'Zdrowie',
  'Hobby',
  'Rozrywka',
  'Rozwój',
  'Dom',
  'Praca',
  'Prezenty',
  'Inne',
] as const;

export type FinanceExpenseCategory = (typeof FINANCE_EXPENSE_CATEGORIES)[number];

export const FINANCE_ACCOUNT_TYPES = [
  'cash',
  'bank',
  'etf',
  'stocks',
  'btc',
  'bonds',
  'ike',
  'ikze',
  'other',
] as const;

export type FinanceAccountType = (typeof FINANCE_ACCOUNT_TYPES)[number];

export const FINANCE_INCOME_TYPES = [
  'salary',
  'sales',
  'commission',
  'interest',
  'dividend',
  'refund',
  'other',
] as const;

export type FinanceIncomeType = (typeof FINANCE_INCOME_TYPES)[number];

export const FINANCE_INCOME_LABELS: Record<FinanceIncomeType, string> = {
  salary: 'UoZ / etat',
  sales: 'Setter / sprzedaż',
  commission: 'Closer / prowizje',
  interest: 'Odsetki',
  dividend: 'Dywidendy',
  refund: 'Zwroty',
  other: 'Inne stałe',
};

export const FINANCE_ACCOUNT_LABELS: Record<FinanceAccountType, string> = {
  cash: 'Gotówka',
  bank: 'Bank',
  etf: 'ETF',
  stocks: 'Akcje',
  btc: 'Krypto',
  bonds: 'Obligacje',
  ike: 'Konto IKE (0% Belka)',
  ikze: 'Konto IKZE (Tax Relief)',
  other: 'Inne',
};
