import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, localToday } from '@family-ledger/domain';
import { Screen } from '@/components/ui/screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { AppField } from '@/components/ui/app-field';
import { Choice } from '@/components/ui/choice';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { MonthlySummary } from '@/components/monthly-summary';
import { ComparisonBarChart, DistributionDoughnutChart, HorizontalRankingChart, RatioDoughnutChart } from '@/components/report-charts';
import { monthlyReport } from '@/infrastructure/supabase/ledger';
import { useActiveFamily } from '@/providers/active-family-provider';
import { shareCsv, toCsv } from '@/infrastructure/exports';

const monthOptions = ['January','February','March','April','May','June','July','August','September','October','November','December'].map((label, index) => ({ value: String(index + 1), label }));

export default function ReportsScreen() {
  const { activeFamily: family } = useActiveFamily();
  const [currentYear, currentMonth] = localToday(family?.timezone).split('-').map(Number);
  const [selection, setSelection] = useState<{ familyId: string | null; year: number; month: number }>({ familyId: null, year: currentYear, month: currentMonth });
  const [yearInput, setYearInput] = useState(String(currentYear));
  const [showZero, setShowZero] = useState(false);
  const [periodError, setPeriodError] = useState('');
  const year = selection.familyId === family?.id ? selection.year : currentYear;
  const month = selection.familyId === family?.id ? selection.month : currentMonth;
  const currency = family?.currency_code ?? 'INR';
  const currencySymbol = family?.currency_symbol;
  const query = useQuery({ queryKey: ['report', family?.id, year, month], queryFn: () => monthlyReport(family!.id, year, month), enabled: !!family, refetchInterval: 15_000 });
  const moveMonth = (direction: -1 | 1) => { const raw = year * 12 + month - 1 + direction; setSelection({ familyId: family?.id ?? null, year: Math.floor(raw / 12), month: raw % 12 + 1 }); setYearInput(String(Math.floor(raw / 12))); };
  const chooseYear = () => { const nextYear = Number(yearInput); if (!Number.isInteger(nextYear) || nextYear < 1900 || nextYear > 2200) { setPeriodError('Enter a year from 1900 to 2200.'); return; } setPeriodError(''); setSelection({ familyId: family?.id ?? null, year: nextYear, month }); };
  const income = query.data?.categories.filter((item) => item.type === 'INCOME').sort((a, b) => BigInt(a.total_minor) > BigInt(b.total_minor) ? -1 : 1) ?? [];
  const expenses = query.data?.categories.filter((item) => item.type === 'EXPENSE').sort((a, b) => BigInt(a.total_minor) > BigInt(b.total_minor) ? -1 : 1) ?? [];
  const visible = (items: typeof income) => showZero ? items : items.filter((item) => BigInt(item.total_minor) !== 0n);
  async function exportReport() { if (!query.data) return; const data = query.data; try { await shareCsv(`familyledger-monthly-${year}-${String(month).padStart(2, '0')}.csv`, toCsv(['Section','Name','Amount minor','Percentage'], [['Summary','Income',data.income_minor,''],['Summary','Expense',data.expense_minor,data.expense_to_income ?? ''],['Summary','Net savings',data.net_minor,data.savings_rate ?? ''],...data.categories.map((item) => ['Category',`${item.type}: ${item.name}`,item.total_minor,item.percentage ?? ''])])); } catch (cause) { setPeriodError(cause instanceof Error ? cause.message : 'Unable to export report.'); } }

  return <Screen title="Monthly report" subtitle={family?.name}>
    <Card><AppText variant="heading">Choose month</AppText><Choice label="Month" value={String(month)} options={monthOptions} onChange={(value) => setSelection({ familyId: family?.id ?? null, year, month: Number(value) })} /><AppField label="Year" value={yearInput} onChangeText={setYearInput} keyboardType="number-pad" /><AppButton label="Go to month" kind="secondary" onPress={chooseYear} />{periodError && <Notice tone="danger" message={periodError} />}<View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><AppButton label="Previous" kind="secondary" disabled={year === 1900 && month === 1} onPress={() => moveMonth(-1)} /></View><View style={{ flex: 1 }}><AppButton label="Next" kind="secondary" disabled={year === 2200 && month === 12} onPress={() => moveMonth(1)} /></View></View></Card>
    <QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} />
    {query.data && !query.error && <>
      <MonthlySummary report={query.data} currency={currency} currencySymbol={currencySymbol} />
      <ComparisonBarChart title="Income vs expenses" incomeMinor={query.data.income_minor} expenseMinor={query.data.expense_minor} currency={currency} currencySymbol={currencySymbol} />
      <RatioDoughnutChart title="Expense as percentage of income" percentage={query.data.expense_to_income} />
      <DistributionDoughnutChart title="Income distribution" items={income.map((item) => ({ label: item.name, valueMinor: item.total_minor, percentage: item.percentage }))} currency={currency} currencySymbol={currencySymbol} />
      <DistributionDoughnutChart title="Expense distribution" items={expenses.map((item) => ({ label: item.name, valueMinor: item.total_minor, percentage: item.percentage }))} currency={currency} currencySymbol={currencySymbol} />
      <HorizontalRankingChart title="Top 20 income sources" items={income.map((item) => ({ label: item.name, valueMinor: item.total_minor, percentage: item.percentage }))} currency={currency} currencySymbol={currencySymbol} />
      <HorizontalRankingChart title="Top 20 expense sources" items={expenses.map((item) => ({ label: item.name, valueMinor: item.total_minor, percentage: item.percentage }))} currency={currency} currencySymbol={currencySymbol} />
      <AppButton label={showZero ? 'Hide zero-value categories' : 'Show zero-value categories'} kind="secondary" onPress={() => setShowZero(!showZero)} />
      <AppButton label="Share monthly report as CSV" kind="secondary" onPress={() => { void exportReport(); }} />
      <Card><AppText variant="heading">Income summary</AppText>{visible(income).map((item) => <View key={item.id} style={{ marginTop: 8 }}><AppText>{item.name}</AppText><AppText muted>{formatMoney(item.total_minor, currency, currencySymbol)} · {item.percentage ?? 0}% of income</AppText></View>)}{visible(income).length === 0 && <AppText muted>No income categories to show.</AppText>}</Card>
      <Card><AppText variant="heading">Expense summary</AppText>{visible(expenses).map((item) => <View key={item.id} style={{ marginTop: 8 }}><AppText>{item.name}</AppText><AppText muted>{formatMoney(item.total_minor, currency, currencySymbol)} · {item.percentage ?? 0}% of expenses</AppText></View>)}{visible(expenses).length === 0 && <AppText muted>No expense categories to show.</AppText>}</Card>
    </>}
    <AppButton label="Annual report" kind="secondary" onPress={() => router.push('/reports/annual')} />
    <AppButton label="Custom date-range report" kind="secondary" onPress={() => router.push('/reports/custom')} />
    <AppButton label="Refresh report" kind="secondary" onPress={() => { void query.refetch(); }} />
  </Screen>;
}
