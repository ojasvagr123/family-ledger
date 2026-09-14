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

export function formatMoney(minor: string, currency = 'INR'): string {
  const [whole, fraction] = decimalMoney(minor).split('.');
  const sign = minor.startsWith('-') ? '-' : '';
  return `${currency} ${sign}${BigInt(whole.replace('-', '')).toLocaleString('en-IN')}.${fraction}`;
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
