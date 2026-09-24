import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, localToday } from '@family-ledger/domain';
import { Screen } from '@/components/ui/screen';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { ActionRow } from '@/components/ui/action-row';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { MonthlySummary } from '@/components/monthly-summary';
import { useActiveFamily } from '@/providers/active-family-provider';
import { listAccounts, listTransactions, monthlyReport } from '@/infrastructure/supabase/ledger';
import { palette, radius, spacing } from '@/constants/theme';
export default function HomeScreen() {
  const { activeFamily: family } = useActiveFamily();
  const [year, month] = localToday(family?.timezone).split('-').map(Number); const today = new Date(year, month - 1, 1);
  const report = useQuery({ queryKey: ['report', family?.id, year, month], queryFn: () => monthlyReport(family!.id, year, month), enabled: !!family, refetchInterval: 15_000 });
  const accounts = useQuery({ queryKey: ['accounts', family?.id], queryFn: () => listAccounts(family!.id), enabled: !!family, refetchInterval: 15_000 });
  const activity = useQuery({ queryKey: ['activity', family?.id, 'recent'], queryFn: () => listTransactions(family!.id), enabled: !!family, refetchInterval: 15_000 });
  const balance = accounts.data?.reduce((sum, account) => sum + BigInt(account.balance_minor), 0n).toString() ?? '0';
  return <Screen title={`Hello, ${family?.name ?? 'family'}`} subtitle={`${today.toLocaleString('en-IN', { month: 'long' })} ${year}`} action={family?.role !== 'VIEWER' && <AppButton label="＋ Add" onPress={() => router.push('/transaction/new')} />}>
    <QueryFeedback pending={report.isPending} error={report.error || accounts.error || activity.error} retry={() => { void report.refetch(); void accounts.refetch(); void activity.refetch(); }} />
    {report.data && !report.error && <MonthlySummary report={report.data} currency={family?.currency_code ?? 'INR'} currencySymbol={family?.currency_symbol} />}
    {accounts.data && !accounts.error && <Card><View style={styles.sectionHeader}><View><AppText variant="eyebrow">Across {accounts.data.length} account{accounts.data.length === 1 ? '' : 's'}</AppText><AppText variant="heading">Available balance</AppText></View><View style={styles.balanceMark}><AppText style={styles.balanceMarkText}>₹</AppText></View></View><AppText variant="display">{formatMoney(balance, family?.currency_code, family?.currency_symbol)}</AppText><AppButton label={accounts.data.length ? 'Manage accounts' : 'Set up first account'} kind="secondary" onPress={() => router.push('/accounts')} /></Card>}
    <View style={styles.sectionHeader}><View><AppText variant="eyebrow">Latest</AppText><AppText variant="heading">Recent activity</AppText></View><AppButton label="See all" kind="secondary" onPress={() => router.push('/(tabs)/transactions')} /></View>
    {activity.data?.length === 0 && <Card tone="accent"><AppText variant="heading">Your ledger is ready</AppText><AppText muted>Add the first income or expense to bring your dashboard to life.</AppText></Card>}
    {!activity.error && activity.data?.slice(0, 5).map((transaction) => <Card compact key={transaction.id} style={styles.activityCard}><ActionRow title={transaction.description || transaction.category_name || 'Balance adjustment'} detail={`${transaction.category_name ?? 'Account balance'} · ${transaction.local_date}`} symbol={transaction.type === 'INCOME' ? '↑' : transaction.type === 'EXPENSE' ? '↓' : '↕'} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })} /><AppText variant="heading" style={transaction.type === 'INCOME' ? styles.income : transaction.type === 'EXPENSE' ? styles.expense : undefined}>{transaction.type === 'INCOME' ? '+' : transaction.type === 'EXPENSE' ? '−' : ''}{formatMoney(transaction.amount_minor, family?.currency_code, family?.currency_symbol)}</AppText></Card>)}
    <AppButton label="Refresh dashboard" kind="secondary" onPress={() => { void report.refetch(); void accounts.refetch(); void activity.refetch(); }} />
  </Screen>;
}
const styles = StyleSheet.create({ sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, balanceMark: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: palette.actionSoft, alignItems: 'center', justifyContent: 'center' }, balanceMarkText: { color: palette.action, fontWeight: '800', fontSize: 20 }, activityCard: { flexDirection: 'row', alignItems: 'center', padding: 0, paddingRight: spacing.lg, overflow: 'hidden' }, income: { color: palette.incomeStrong }, expense: { color: palette.expenseStrong } });
