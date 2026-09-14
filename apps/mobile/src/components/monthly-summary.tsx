import { formatMoney } from '@family-ledger/domain';
import { Card } from './ui/card';
import { AppText } from './ui/app-text';
import { Notice } from './ui/notice';
import type { MonthlyReport } from '@/infrastructure/supabase/ledger';
export function MonthlySummary({ report, currency }: { report: MonthlyReport; currency: string }) {
  return <><Card><AppText variant="heading">Income</AppText><AppText variant="amount">+ {formatMoney(report.income_minor, currency)}</AppText><AppText variant="heading">Expenses</AppText><AppText variant="amount">− {formatMoney(report.expense_minor, currency)}</AppText><AppText variant="heading">Net savings</AppText><AppText variant="amount">{formatMoney(report.net_minor, currency)}</AppText><AppText>Savings rate: {report.savings_rate === null ? '—' : `${report.savings_rate}%`}</AppText><AppText>Expense to income: {report.expense_to_income === null ? '—' : `${report.expense_to_income}%`}</AppText></Card>{report.savings_rate === null && <Notice message="Ratios are unavailable because this month has no income." />}</>;
}
