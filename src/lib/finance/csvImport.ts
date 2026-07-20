import type { FinanceExpenseCategory } from '@vanguard/domain';

export type CsvBank = 'pekao' | 'pko' | 'mbank' | 'ing' | 'santander' | 'revolut' | 'unknown';

export interface ParsedTransaction {
  transaction_date: string; // YYYY-MM-DD
  amount: number;           // negative = expense, positive = income
  description: string;
  kind: 'expense' | 'income';
  category: FinanceExpenseCategory;
  source_bank: CsvBank;
  dedup_hash: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function toIso(raw: string): string | null {
  // Formats: DD.MM.YYYY  DD-MM-YYYY  YYYY-MM-DD  MM/DD/YYYY
  const clean = raw.trim();
  const dmy = clean.match(/^(\d{2})[.\-/](\d{2})[.\-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const iso = clean.match(/^\d{4}-\d{2}-\d{2}$/);
  if (iso) return clean;
  const mdy = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1]}-${mdy[2]}`;
  return null;
}

function parseAmount(raw: string): number {
  // Polish: "1 234,56" or "-1234.56" or "1 234.56"
  const s = raw.trim().replace(/\s/g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

function hashRow(date: string, amount: number, desc: string): string {
  return btoa(`${date}|${amount}|${desc.slice(0, 40)}`).slice(0, 24);
}

function guessCategory(desc: string): FinanceExpenseCategory {
  const d = desc.toLowerCase();
  if (/biedronka|lidl|zabka|kaufland|carrefour|aldi|tesco|spar|sklep|spozywa|grocery/.test(d)) return 'Jedzenie';
  if (/restaur|pizza|burger|sushi|mcdon|kfc|pyszne|uber eat|wolt|jedzenie|cafe|kawiar/.test(d)) return 'Jedzenie';
  if (/orlen|bp |shell|lotos|paliwo|pkp|mzk|mpk|bilety|tram|metro|uber|bolt|taxi/.test(d)) return 'Transport';
  if (/apteka|lekarz|stomatolog|przychodn|szpital|zdrowie|medycyn/.test(d)) return 'Zdrowie';
  if (/netflix|spotify|hbo|disney|cinema|kino|teatr|game|steam|playstation/.test(d)) return 'Rozrywka';
  if (/udemy|coursera|ksiazka|książka|kurs|szkolenie|edukacja/.test(d)) return 'Rozwój';
  if (/czynsz|prąd|prad|gaz |woda |internet|media |allegro|amazon/.test(d)) return 'Dom';
  if (/gym|fitness|sport|siłown|silownia|decathlon/.test(d)) return 'Hobby';
  return 'Inne';
}

// ─── Bank Pekao / PeoPay ─────────────────────────────────────────────────────
// "Data księgowania";"Data operacji";"Opis operacji";"Tytuł";"Kontrahent";…;"Kwota";…
function parsePekao(rows: string[][]): ParsedTransaction[] {
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes('Data księgowania') || c.includes('Data operacji')));
  if (headerIdx === -1) return [];
  const header = rows[headerIdx].map((c) => c.trim().replace(/^"|"$/g, ''));
  const dateCol = header.findIndex((c) => c === 'Data operacji' || c === 'Data księgowania');
  const descCol = header.findIndex((c) => c === 'Opis operacji' || c === 'Tytuł');
  const contraCol = header.findIndex((c) => c === 'Kontrahent' || c.includes('Nadawca'));
  const amtCol = header.findIndex((c) => c === 'Kwota' || c.includes('Kwota transakcji'));

  return rows.slice(headerIdx + 1).flatMap((r) => {
    const date = toIso(r[dateCol] ?? '');
    const desc = [(r[contraCol] ?? ''), (r[descCol] ?? '')].filter(Boolean).join(' ').trim();
    const amount = parseAmount(r[amtCol] ?? '');
    if (!date || amount === 0) return [];
    return [{
      transaction_date: date,
      amount,
      description: desc,
      kind: amount < 0 ? 'expense' : 'income',
      category: guessCategory(desc),
      source_bank: 'pekao' as CsvBank,
      dedup_hash: hashRow(date, amount, desc),
    }];
  });
}

// ─── PKO BP ─────────────────────────────────────────────────────────────────
// Header (row ~25+): "Data operacji";"Opis operacji";"Rachunek";"Kategoria";"Kwota";"Saldo po operacji"
function parsePko(rows: string[][]): ParsedTransaction[] {
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes('Data operacji')));
  if (headerIdx === -1) return [];
  const header = rows[headerIdx].map((c) => c.trim());
  const dateCol = header.findIndex((c) => c.includes('Data operacji'));
  const descCol = header.findIndex((c) => c.includes('Opis operacji'));
  const amtCol = header.findIndex((c) => c.includes('Kwota'));

  return rows.slice(headerIdx + 1).flatMap((r) => {
    const date = toIso(r[dateCol] ?? '');
    const desc = (r[descCol] ?? '').trim();
    const amount = parseAmount(r[amtCol] ?? '');
    if (!date || amount === 0) return [];
    return [{
      transaction_date: date,
      amount,
      description: desc,
      kind: amount < 0 ? 'expense' : 'income',
      category: guessCategory(desc),
      source_bank: 'pko' as CsvBank,
      dedup_hash: hashRow(date, amount, desc),
    }];
  });
}

// ─── mBank ──────────────────────────────────────────────────────────────────
// Header: #Data operacji;#Data księgowania;#Opis operacji;#Tytuł;#Nadawca/Odbiorca;#Numer rachunku;#Kwota;#Saldo po operacji
function parseMbank(rows: string[][]): ParsedTransaction[] {
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes('#Data operacji')));
  if (headerIdx === -1) return [];
  const header = rows[headerIdx].map((c) => c.trim().replace(/^#/, ''));
  const dateCol = header.findIndex((c) => c === 'Data operacji');
  const descCol = header.findIndex((c) => c === 'Opis operacji');
  const titleCol = header.findIndex((c) => c === 'Tytuł');
  const amtCol = header.findIndex((c) => c === 'Kwota');

  return rows.slice(headerIdx + 1).flatMap((r) => {
    const date = toIso(r[dateCol] ?? '');
    const desc = [(r[descCol] ?? ''), (r[titleCol] ?? '')].filter(Boolean).join(' ').trim();
    const amount = parseAmount(r[amtCol] ?? '');
    if (!date || amount === 0) return [];
    return [{
      transaction_date: date,
      amount,
      description: desc,
      kind: amount < 0 ? 'expense' : 'income',
      category: guessCategory(desc),
      source_bank: 'mbank' as CsvBank,
      dedup_hash: hashRow(date, amount, desc),
    }];
  });
}

// ─── ING ────────────────────────────────────────────────────────────────────
// Header: "Data transakcji";"Data księgowania";"Dane kontrahenta";"Tytuł";"Nr rachunku";"Nazwa banku";"Szczegóły";"Nr transakcji";"Kwota transakcji (waluta rachunku)";"Waluta";"Kwota blokady/zwolnienie blokady";"Kwota w walucie";"Waluta";"Saldo po transakcji"
function parseIng(rows: string[][]): ParsedTransaction[] {
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes('Data transakcji')));
  if (headerIdx === -1) return [];
  const header = rows[headerIdx].map((c) => c.trim());
  const dateCol = header.findIndex((c) => c === 'Data transakcji');
  const descCol = header.findIndex((c) => c === 'Tytuł');
  const contraCol = header.findIndex((c) => c.includes('Dane kontrahenta'));
  const amtCol = header.findIndex((c) => c.includes('Kwota transakcji'));

  return rows.slice(headerIdx + 1).flatMap((r) => {
    const date = toIso(r[dateCol] ?? '');
    const desc = [(r[contraCol] ?? ''), (r[descCol] ?? '')].filter(Boolean).join(' ').trim();
    const amount = parseAmount(r[amtCol] ?? '');
    if (!date || amount === 0) return [];
    return [{
      transaction_date: date,
      amount,
      description: desc,
      kind: amount < 0 ? 'expense' : 'income',
      category: guessCategory(desc),
      source_bank: 'ing' as CsvBank,
      dedup_hash: hashRow(date, amount, desc),
    }];
  });
}

// ─── Santander ───────────────────────────────────────────────────────────────
// Header: "Numer rachunku";"Data transakcji";"Data księgowania";"Opis transakcji";"Kwota";"Waluta";"Saldo po transakcji";"Kategoria"
function parseSantander(rows: string[][]): ParsedTransaction[] {
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes('Data transakcji') || c.includes('Opis transakcji')));
  if (headerIdx === -1) return [];
  const header = rows[headerIdx].map((c) => c.trim());
  const dateCol = header.findIndex((c) => c === 'Data transakcji');
  const descCol = header.findIndex((c) => c.includes('Opis transakcji') || c.includes('Tytuł'));
  const amtCol = header.findIndex((c) => c === 'Kwota');

  return rows.slice(headerIdx + 1).flatMap((r) => {
    const date = toIso(r[dateCol] ?? '');
    const desc = (r[descCol] ?? '').trim();
    const amount = parseAmount(r[amtCol] ?? '');
    if (!date || amount === 0) return [];
    return [{
      transaction_date: date,
      amount,
      description: desc,
      kind: amount < 0 ? 'expense' : 'income',
      category: guessCategory(desc),
      source_bank: 'santander' as CsvBank,
      dedup_hash: hashRow(date, amount, desc),
    }];
  });
}

// ─── Revolut ────────────────────────────────────────────────────────────────
// Header: Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
function parseRevolut(rows: string[][]): ParsedTransaction[] {
  const headerIdx = rows.findIndex((r) => r.some((c) => c === 'Started Date' || c === 'Completed Date'));
  if (headerIdx === -1) return [];
  const header = rows[headerIdx].map((c) => c.trim());
  const dateCol = header.findIndex((c) => c === 'Completed Date');
  const descCol = header.findIndex((c) => c === 'Description');
  const amtCol = header.findIndex((c) => c === 'Amount');
  const stateCol = header.findIndex((c) => c === 'State');

  return rows.slice(headerIdx + 1).flatMap((r) => {
    if ((r[stateCol] ?? '').trim().toLowerCase() !== 'completed') return [];
    const date = toIso((r[dateCol] ?? '').split(' ')[0] ?? '');
    const desc = (r[descCol] ?? '').trim();
    const amount = parseAmount(r[amtCol] ?? '');
    if (!date || amount === 0) return [];
    return [{
      transaction_date: date,
      amount,
      description: desc,
      kind: amount < 0 ? 'expense' : 'income',
      category: guessCategory(desc),
      source_bank: 'revolut' as CsvBank,
      dedup_hash: hashRow(date, amount, desc),
    }];
  });
}

// ─── CSV tokenizer ──────────────────────────────────────────────────────────

function tokenize(line: string, sep: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (!inQuote && ch === sep) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

function splitRows(text: string, sep: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((l) => tokenize(l, sep))
    .filter((r) => r.some((c) => c.trim()));
}

function detectBank(text: string): CsvBank {
  if (/pekao|peopay/i.test(text)) return 'pekao';
  if (text.includes('#Data operacji') || text.includes('mBank')) return 'mbank';
  if (text.includes('Data transakcji') && text.includes('Dane kontrahenta')) return 'ing';
  if (text.includes('Started Date') || text.includes('Completed Date')) return 'revolut';
  if (text.includes('Data księgowania') && text.includes('Opis operacji')) return 'pekao';
  if (text.includes('Data operacji') && text.includes('Kategoria')) return 'pko';
  if (text.includes('Opis transakcji')) return 'santander';
  if (text.includes('Data operacji') && text.includes('Saldo po operacji')) return 'pko';
  return 'unknown';
}

function detectSep(text: string): string {
  const firstLine = text.split('\n')[0] ?? '';
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ';' : ',';
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface CsvParseResult {
  bank: CsvBank;
  transactions: ParsedTransaction[];
  rawRowCount: number;
  errors: string[];
}

export function parseBankCsv(text: string): CsvParseResult {
  const sep = detectSep(text);
  const bank = detectBank(text);
  const rows = splitRows(text, sep);
  const errors: string[] = [];

  let transactions: ParsedTransaction[] = [];

  try {
    if (bank === 'pekao') transactions = parsePekao(rows);
    else if (bank === 'pko') transactions = parsePko(rows);
    else if (bank === 'mbank') transactions = parseMbank(rows);
    else if (bank === 'ing') transactions = parseIng(rows);
    else if (bank === 'santander') transactions = parseSantander(rows);
    else if (bank === 'revolut') transactions = parseRevolut(rows);
    else errors.push('Nie rozpoznano formatu — obsługujemy Pekao/PeoPay, mBank, ING, PKO BP, Santander, Revolut');
  } catch (e) {
    errors.push(`Błąd parsowania: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    bank,
    transactions: transactions.filter((t) => t.transaction_date && t.amount !== 0),
    rawRowCount: rows.length,
    errors,
  };
}

export const BANK_LABELS: Record<CsvBank, string> = {
  pekao: 'Pekao / PeoPay',
  pko: 'PKO BP',
  mbank: 'mBank',
  ing: 'ING',
  santander: 'Santander',
  revolut: 'Revolut',
  unknown: 'Nieznany',
};
