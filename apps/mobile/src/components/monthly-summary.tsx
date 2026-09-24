import { formatMoney } from '@family-ledger/domain';
import { StyleSheet, View } from 'react-native';
import { Notice } from './ui/notice';
import { MetricCard } from './ui/metric-card';
import { spacing } from '@/constants/theme';
import type { MonthlyReport } from '@/infrastructure/supabase/ledger';
export function MonthlySummary({ report, currency, currencySymbol }: { report: MonthlyReport; currency: string; currencySymbol?: string }) {
  const savings = report.savings_rate === null ? 'No income yet' : `${report.savings_rate}% saved`;
  return <><MetricCard label="Net position" value={formatMoney(report.net_minor, currency, currencySymbol)} detail={savings} tone="accent" /><View style={styles.row}><MetricCard label="Income" value={formatMoney(report.income_minor, currency, currencySymbol)} detail="Money in" tone="income" /><MetricCard label="Expenses" value={formatMoney(report.expense_minor, currency, currencySymbol)} detail={report.expense_to_income === null ? 'No ratio' : `${report.expense_to_income}% of income`} tone="expense" /></View>{report.savings_rate === null ? <Notice message="Ratios will appear after the first income transaction in this period." /> : report.savings_rate < 0 ? <Notice tone="warning" message={`Expenses exceeded income by ${Math.abs(report.savings_rate)}%. Review the largest categories in Insights.`} /> : <Notice message={`${report.savings_rate}% of income remained after expenses this period.`} />}</>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md } });
