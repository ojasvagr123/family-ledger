import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, isLocalDate, localToday } from '@family-ledger/domain';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/app-text';
import { AppField } from '@/components/ui/app-field';
import { AppButton } from '@/components/ui/app-button';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { ComparisonBarChart, DistributionDoughnutChart, HorizontalRankingChart, RatioDoughnutChart } from '@/components/report-charts';
import { customReport } from '@/infrastructure/supabase/ledger';
import { useActiveFamily } from '@/providers/active-family-provider';
import { shareCsv, toCsv } from '@/infrastructure/exports';

function dateParts(value: string) { const [year, month, day] = value.split('-').map(Number); return { year, month, day }; }
function localDate(year: number, month: number, day: number) { return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
function utcDate(value: string) { const { year, month, day } = dateParts(value); return new Date(Date.UTC(year, month - 1, day)); }
function formatUtc(value: Date) { return localDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()); }
function monthEnd(year: number, month: number) { return formatUtc(new Date(Date.UTC(year, month, 0))); }

export default function CustomReportScreen() {
  const { activeFamily: family } = useActiveFamily();
  const today = localToday(family?.timezone); const current = dateParts(today);
  const [start, setStart] = useState(today); const [end, setEnd] = useState(today); const [submitted, setSubmitted] = useState<{ start: string; end: string } | null>(null); const [error, setError] = useState(''); const [showZero, setShowZero] = useState(false);
  const currency = family?.currency_code ?? 'INR';
  const currencySymbol = family?.currency_symbol;
  const query = useQuery({ queryKey: ['custom-report', family?.id, submitted], queryFn: () => customReport(family!.id, submitted!.start, submitted!.end), enabled: !!family && !!submitted, refetchInterval: 15_000 });
  function apply(nextStart = start, nextEnd = end) { setStart(nextStart); setEnd(nextEnd); if (!isLocalDate(nextStart) || !isLocalDate(nextEnd) || nextStart > nextEnd) { setError('Enter valid dates with End on or after Start.'); return; } setError(''); setSubmitted({ start: nextStart, end: nextEnd }); }
  function preset(kind: 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'SIX_MONTHS' | 'FISCAL') {
    if (kind === 'TODAY') { apply(today, today); return; }
    if (kind === 'WEEK') { const value = utcDate(today); const weekday = value.getUTCDay(); const monday = new Date(value); monday.setUTCDate(value.getUTCDate() - (weekday === 0 ? 6 : weekday - 1)); const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6); apply(formatUtc(monday), formatUtc(sunday)); return; }
    if (kind === 'MONTH') { apply(localDate(current.year, current.month, 1), monthEnd(current.year, current.month)); return; }
    if (kind === 'QUARTER') { const firstMonth = Math.floor((current.month - 1) / 3) * 3 + 1; apply(localDate(current.year, firstMonth, 1), monthEnd(current.year, firstMonth + 2)); return; }
    if (kind === 'SIX_MONTHS') { const first = new Date(Date.UTC(current.year, current.month - 6, 1)); apply(formatUtc(first), monthEnd(current.year, current.month)); return; }
    const fiscalMonth = family?.fiscal_start_month ?? 1; const fiscalYear = current.month >= fiscalMonth ? current.year : current.year - 1; const nextStart = new Date(Date.UTC(fiscalYear + 1, fiscalMonth - 1, 1)); nextStart.setUTCDate(nextStart.getUTCDate() - 1); apply(localDate(fiscalYear, fiscalMonth, 1), formatUtc(nextStart));
  }
  const income = query.data?.categories.filter((item) => item.type === 'INCOME').sort((a, b) => BigInt(a.total_minor) > BigInt(b.total_minor) ? -1 : 1) ?? [];
  const expenses = query.data?.categories.filter((item) => item.type === 'EXPENSE').sort((a, b) => BigInt(a.total_minor) > BigInt(b.total_minor) ? -1 : 1) ?? [];
  const visible = <T extends { total_minor: string }>(items: T[]) => showZero ? items : items.filter((item) => BigInt(item.total_minor) !== 0n);
  async function exportReport() { if (!query.data) return; const report = query.data; try { await shareCsv(`familyledger-custom-${report.start}-to-${report.end}.csv`, toCsv(['Section','Name','Amount minor','Percentage'], [['Summary','Income',report.income_minor,''],['Summary','Expense',report.expense_minor,report.expense_to_income ?? ''],['Summary','Net savings',report.net_minor,report.savings_rate ?? ''],...report.categories.map((item) => ['Category',`${item.type}: ${item.name}`,item.total_minor,item.percentage ?? ''])])); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to export report.'); } }

  return <Screen title="Custom report" subtitle={family?.name}>
    <Card><AppText variant="heading">Quick periods</AppText><AppButton label="Today" kind="secondary" onPress={() => preset('TODAY')} /><AppButton label="This week" kind="secondary" onPress={() => preset('WEEK')} /><AppButton label="This month" kind="secondary" onPress={() => preset('MONTH')} /><AppButton label="This quarter" kind="secondary" onPress={() => preset('QUARTER')} /><AppButton label="Six months" kind="secondary" onPress={() => preset('SIX_MONTHS')} /><AppButton label="Current fiscal year" kind="secondary" onPress={() => preset('FISCAL')} /></Card>
    <AppField label="Start date (YYYY-MM-DD)" value={start} onChangeText={setStart} /><AppField label="End date (YYYY-MM-DD, inclusive)" value={end} onChangeText={setEnd} /><AppButton label="Build report" onPress={() => apply()} />
    {error && <Notice tone="danger" message={error} />}
    <QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} />
    {query.data && !query.error && <>
      <Card><AppText variant="heading">{query.data.start} to {query.data.end}</AppText><AppText variant="amount">Income {formatMoney(query.data.income_minor, currency, currencySymbol)}</AppText><AppText variant="amount">Expenses {formatMoney(query.data.expense_minor, currency, currencySymbol)}</AppText><AppText variant="amount">Net savings {formatMoney(query.data.net_minor, currency, currencySymbol)}</AppText><AppText>Savings rate: {query.data.savings_rate ?? '—'}% · Expense to income: {query.data.expense_to_income ?? '—'}%</AppText></Card>
      <ComparisonBarChart title="Income vs expenses" incomeMinor={query.data.income_minor} expenseMinor={query.data.expense_minor} currency={currency} currencySymbol={currencySymbol} />
      <RatioDoughnutChart title="Expense as percentage of income" percentage={query.data.expense_to_income} />
      <DistributionDoughnutChart title="Income distribution" items={income.map((item) => ({ label: item.name, valueMinor: item.total_minor, percentage: item.percentage }))} currency={currency} currencySymbol={currencySymbol} />
      <DistributionDoughnutChart title="Expense distribution" items={expenses.map((item) => ({ label: item.name, valueMinor: item.total_minor, percentage: item.percentage }))} currency={currency} currencySymbol={currencySymbol} />
      <HorizontalRankingChart title="Top 20 income sources" items={income.map((item) => ({ label: item.name, valueMinor: item.total_minor, percentage: item.percentage }))} currency={currency} currencySymbol={currencySymbol} />
      <HorizontalRankingChart title="Top 20 expense sources" items={expenses.map((item) => ({ label: item.name, valueMinor: item.total_minor, percentage: item.percentage }))} currency={currency} currencySymbol={currencySymbol} />
      <AppButton label={showZero ? 'Hide zero-value categories' : 'Show zero-value categories'} kind="secondary" onPress={() => setShowZero(!showZero)} />
      <Card><AppText variant="heading">Income summary</AppText>{visible(income).map((item) => <View key={item.id} style={{ marginTop: 8 }}><AppText>{item.name}</AppText><AppText muted>{formatMoney(item.total_minor, currency, currencySymbol)} · {item.percentage ?? 0}% of income</AppText></View>)}</Card>
      <Card><AppText variant="heading">Expense summary</AppText>{visible(expenses).map((item) => <View key={item.id} style={{ marginTop: 8 }}><AppText>{item.name}</AppText><AppText muted>{formatMoney(item.total_minor, currency, currencySymbol)} · {item.percentage ?? 0}% of expenses</AppText></View>)}</Card>
      <AppButton label="Share custom report as CSV" kind="secondary" onPress={() => { void exportReport(); }} />
    </>}
    <AppButton label="Back" kind="secondary" onPress={() => router.back()} />
  </Screen>;
}
