import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, localToday } from '@family-ledger/domain';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/app-text';
import { AppField } from '@/components/ui/app-field';
import { AppButton } from '@/components/ui/app-button';
import { Choice } from '@/components/ui/choice';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { AreaTrendChart, ComparisonBarChart, DistributionDoughnutChart, HorizontalRankingChart, MonthlyComboChart, RatioDoughnutChart, TrendBarChart } from '@/components/report-charts';
import { annualReport, rpc, type AnnualCategory } from '@/infrastructure/supabase/ledger';
import { useActiveFamily } from '@/providers/active-family-provider';
import { palette } from '@/constants/theme';
import { shareCsv, toCsv } from '@/infrastructure/exports';

function CashFlowSummary({ report, currency, currencySymbol }: { report: { income_minor: string; expense_minor: string; net_minor: string; average_income_minor: string; average_expense_minor: string; average_net_minor: string; savings_rate: number | null }; currency: string; currencySymbol?: string }) {
  const rows = [
    { label: 'Income', total: report.income_minor, average: report.average_income_minor },
    { label: 'Expenses', total: report.expense_minor, average: report.average_expense_minor },
    { label: 'Net savings', total: report.net_minor, average: report.average_net_minor },
  ];
  return <Card><AppText variant="heading">Cash-flow summary</AppText>{rows.map((row) => <View key={row.label} style={{ marginTop: 10 }}><AppText>{row.label}</AppText><AppText muted>Total {formatMoney(row.total, currency, currencySymbol)} · Monthly average {formatMoney(row.average, currency, currencySymbol)}</AppText></View>)}<AppText style={{ marginTop: 10 }}>Savings rate: {report.savings_rate === null ? '—' : `${report.savings_rate}%`}</AppText></Card>;
}

function CategoryMatrix({ title, categories, months, currency, currencySymbol }: { title: string; categories: AnnualCategory[]; months: { label: string; start: string }[]; currency: string; currencySymbol?: string }) {
  return <Card><AppText variant="heading">{title}</AppText>{categories.length === 0 ? <AppText muted>No category values in this fiscal year.</AppText> : <ScrollView horizontal accessibilityLabel={`${title} table`}><View>
    <View style={{ flexDirection: 'row', backgroundColor: palette.surfaceMuted }}><AppText style={{ width: 150, padding: 8 }} variant="caption">Category</AppText><AppText style={{ width: 120, padding: 8 }} variant="caption">Total</AppText><AppText style={{ width: 120, padding: 8 }} variant="caption">Average</AppText>{months.map((month) => <AppText key={month.start} style={{ width: 110, padding: 8 }} variant="caption">{month.label}</AppText>)}</View>
    {categories.map((category) => <View key={category.id} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.border }}><AppText style={{ width: 150, padding: 8 }}>{category.name}</AppText><AppText style={{ width: 120, padding: 8 }}>{formatMoney(category.total_minor, currency, currencySymbol)}</AppText><AppText style={{ width: 120, padding: 8 }}>{formatMoney(category.average_minor, currency, currencySymbol)}</AppText>{months.map((month) => { const value = category.months.find((item) => item.start === month.start)?.total_minor ?? '0'; return <AppText key={month.start} style={{ width: 110, padding: 8 }}>{formatMoney(value, currency, currencySymbol)}</AppText>; })}</View>)}
  </View></ScrollView>}</Card>;
}

export default function AnnualReportScreen() {
  const { activeFamily: family } = useActiveFamily();
  const todayYear = Number(localToday(family?.timezone).slice(0, 4));
  const settings = useQuery({ queryKey: ['family-settings', family?.id], queryFn: () => rpc<{ reporting_start_year: number }>('get_family_settings', { p_family_id: family!.id }), enabled: !!family });
  const firstCoverageYear = (settings.data?.reporting_start_year ?? todayYear) + (family?.fiscal_start_month === 1 ? 0 : 1);
  const coverageYears = [firstCoverageYear, firstCoverageYear + 1, firstCoverageYear + 2];
  const [selection, setSelection] = useState<{ familyId: string | null; year: number }>({ familyId: null, year: firstCoverageYear });
  const year = selection.familyId === family?.id ? selection.year : firstCoverageYear;
  const [yearText, setYearText] = useState(String(firstCoverageYear));
  const [error, setError] = useState('');
  const currency = family?.currency_code ?? 'INR';
  const currencySymbol = family?.currency_symbol;
  const query = useQuery({ queryKey: ['annual-report', family?.id, year], queryFn: () => annualReport(family!.id, year), enabled: !!family && year >= 1900 && year <= 2200, refetchInterval: 15_000 });
  const selectYear = (value: string) => { const next = Number(value); setSelection({ familyId: family?.id ?? null, year: next }); setYearText(value); setError(''); };
  const applyYear = () => { const next = Number(yearText); if (!Number.isInteger(next) || next < 1900 || next > 2200) { setError('Enter a reporting year from 1900 to 2200.'); return; } selectYear(yearText); };
  async function exportReport() { if (!query.data) return; const report = query.data; try { await shareCsv(`familyledger-annual-${year}.csv`, toCsv(['Section','Period or category','Income minor','Expense minor','Net or total minor','Average minor','Percentage'], [['Summary',`${report.start} to ${report.end}`,report.income_minor,report.expense_minor,report.net_minor,report.average_net_minor,report.savings_rate ?? ''],...report.months.map((month) => ['Month',month.label,month.income_minor,month.expense_minor,month.net_minor,'','']),...report.income_categories.map((item) => ['Income category',item.name,'','',item.total_minor,item.average_minor,item.percentage ?? '']),...report.expense_categories.map((item) => ['Expense category',item.name,'','',item.total_minor,item.average_minor,item.percentage ?? ''])])); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to export report.'); } }

  return <Screen title="Annual report" subtitle={family?.name}>
    <Card><AppText variant="heading">Workbook coverage years</AppText><Choice label="Fiscal year ending" value={String(year)} options={coverageYears.map((item) => ({ value: String(item), label: String(item) }))} onChange={selectYear} /><AppField label="Another fiscal year" value={yearText} keyboardType="number-pad" onChangeText={setYearText} /><AppButton label="Build annual report" kind="secondary" onPress={applyYear} />{error && <Notice tone="danger" message={error} />}<AppText muted>For non-January fiscal years, the label is the calendar year in which the fiscal period ends.</AppText></Card>
    <QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} />
    {query.data && !query.error && <>
      <Card><AppText variant="heading">{query.data.start} to {query.data.end}</AppText><AppText variant="amount">Income {formatMoney(query.data.income_minor, currency, currencySymbol)}</AppText><AppText variant="amount">Expenses {formatMoney(query.data.expense_minor, currency, currencySymbol)}</AppText><AppText variant="amount">Net savings {formatMoney(query.data.net_minor, currency, currencySymbol)}</AppText><AppText>Savings rate: {query.data.savings_rate ?? '—'}% · Expense to income: {query.data.expense_to_income ?? '—'}%</AppText></Card>
      <ComparisonBarChart title="Annual income vs expenses" incomeMinor={query.data.income_minor} expenseMinor={query.data.expense_minor} currency={currency} currencySymbol={currencySymbol} />
      <RatioDoughnutChart title="Expense as percentage of income" percentage={query.data.expense_to_income} />
      <AreaTrendChart title="Income growth" items={query.data.months.map((month) => ({ label: month.label, valueMinor: month.income_minor }))} currency={currency} currencySymbol={currencySymbol} />
      <TrendBarChart title="Savings trend" items={query.data.months.map((month) => ({ label: month.label, valueMinor: month.net_minor }))} currency={currency} currencySymbol={currencySymbol} />
      <MonthlyComboChart title="Monthly income, expenses and net savings" months={query.data.months} currency={currency} currencySymbol={currencySymbol} />
      <DistributionDoughnutChart title="Income breakdown" items={query.data.income_categories.map((item) => ({ label: item.name, valueMinor: item.total_minor, percentage: item.percentage }))} currency={currency} currencySymbol={currencySymbol} variant="pie" />
      <DistributionDoughnutChart title="Expense breakdown" items={query.data.expense_categories.map((item) => ({ label: item.name, valueMinor: item.total_minor, percentage: item.percentage }))} currency={currency} currencySymbol={currencySymbol} variant="pie" />
      <HorizontalRankingChart title="Annual top 20 income sources" items={query.data.income_categories.map((item) => ({ label: item.name, valueMinor: item.total_minor, percentage: item.percentage }))} currency={currency} currencySymbol={currencySymbol} />
      <HorizontalRankingChart title="Annual top 20 expense sources" items={query.data.expense_categories.map((item) => ({ label: item.name, valueMinor: item.total_minor, percentage: item.percentage }))} currency={currency} currencySymbol={currencySymbol} />
      <Card><AppText variant="heading">Twelve-month overview</AppText>{query.data.months.map((month) => <View key={month.start} style={{ marginTop: 10 }}><AppText>{month.label}</AppText><AppText muted>Income {formatMoney(month.income_minor, currency, currencySymbol)} · Expense {formatMoney(month.expense_minor, currency, currencySymbol)} · Net {formatMoney(month.net_minor, currency, currencySymbol)}</AppText></View>)}</Card>
      <CashFlowSummary report={query.data} currency={currency} currencySymbol={currencySymbol} />
      <CategoryMatrix title="Income category matrix" categories={query.data.income_categories} months={query.data.months} currency={currency} currencySymbol={currencySymbol} />
      <CategoryMatrix title="Expense category matrix" categories={query.data.expense_categories} months={query.data.months} currency={currency} currencySymbol={currencySymbol} />
      <AppButton label="Share annual report as CSV" kind="secondary" onPress={() => { void exportReport(); }} />
    </>}
    <AppButton label="Custom date-range report" kind="secondary" onPress={() => router.push('/reports/custom')} />
    <AppButton label="Back" kind="secondary" onPress={() => router.back()} />
  </Screen>;
}
