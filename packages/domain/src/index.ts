export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type MemberStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'LEFT' | 'REMOVED';

export const canApproveMembers = (role: MemberRole) => role === 'OWNER' || role === 'ADMIN';

export const canEditTransaction = (
  role: MemberRole,
  actorUserId: string,
  creatorUserId: string,
) => role === 'OWNER' || role === 'ADMIN' || (role === 'MEMBER' && actorUserId === creatorUserId);

export const calculateSummary = (incomeMinor: bigint, expenseMinor: bigint) => {
  const netMinor = incomeMinor - expenseMinor;
  return {
    incomeMinor,
    expenseMinor,
    netMinor,
    expenseToIncome: incomeMinor === 0n ? null : Number(expenseMinor * 10_000n / incomeMinor) / 100,
    savingsRate: incomeMinor === 0n ? null : Number(netMinor * 10_000n / incomeMinor) / 100,
  };
};

// Decimal text is converted without passing money through floating point.
export function parseMoney(value: string, signed = false): string {
  const clean = value.trim();
  if (!(signed ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(clean)) throw new Error('Enter an amount with up to two decimal places.');
  const negative = clean.startsWith('-');
  const [whole, fraction = ''] = clean.replace('-', '').split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor > 999999999999999n || (!signed && minor === 0n)) throw new Error('Amount must be positive and within the supported limit.');
  return ((negative ? -1n : 1n) * minor).toString();
}

export function decimalMoney(minor: string): string {
  const amount = BigInt(minor); const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function suggestedCurrencySymbol(currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

export function formatMoney(minor: string, currency = 'INR', customSymbol?: string): string {
  const [whole, fraction] = decimalMoney(minor).split('.');
  const sign = minor.startsWith('-') ? '-' : '';
  const symbol = customSymbol?.trim() || suggestedCurrencySymbol(currency);
  return `${sign}${symbol}${BigInt(whole.replace('-', '')).toLocaleString('en-IN')}.${fraction}`;
}

export function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 2200;
}

export function localToday(timezone = 'Asia/Kolkata', instant = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export type CsvDateOrder = 'AUTO' | 'YMD' | 'MDY' | 'DMY';

export function detectCsvDelimiter(text: string): ',' | ';' | '\t' | '|' {
  const sample = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  const candidates = [',', ';', '\t', '|'] as const;
  const counts = candidates.map((delimiter) => { let count = 0; let quoted = false; for (let index = 0; index < sample.length; index += 1) { if (sample[index] === '"') quoted = !quoted; else if (!quoted && sample[index] === delimiter) count += 1; } return { delimiter, count }; });
  return counts.reduce((best, item) => item.count > best.count ? item : best).delimiter;
}

export function parseDelimitedText(text: string, delimiter = detectCsvDelimiter(text)): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false; const clean = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < clean.length; index += 1) {
    const character = clean[index];
    if (character === '"' && quoted && clean[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && clean[index + 1] === '\n') index += 1; row.push(cell.trim()); if (row.some((value) => value !== '')) rows.push(row); row = []; cell = ''; }
    else cell += character;
  }
  row.push(cell.trim()); if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

export function normalizeImportedDate(value: string, order: CsvDateOrder = 'AUTO'): string {
  const clean = value.trim(); if (isLocalDate(clean)) return clean;
  const parts = clean.split(/[\/.-]/).map((part) => Number(part.trim())); if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return clean;
  let year: number; let month: number; let day: number;
  if (order === 'YMD' || (order === 'AUTO' && parts[0] >= 1900)) [year, month, day] = parts;
  else { year = parts[2] < 100 ? 2000 + parts[2] : parts[2]; if (order === 'DMY' || (order === 'AUTO' && parts[0] > 12)) [day, month] = parts; else [month, day] = parts; }
  const result = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isLocalDate(result) ? result : clean;
}
