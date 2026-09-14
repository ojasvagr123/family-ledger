import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, localToday } from '@family-ledger/domain';
import { Screen } from '@/components/ui/screen';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { MonthlySummary } from '@/components/monthly-summary';
import { useActiveFamily } from '@/providers/active-family-provider';
import { listAccounts, listTransactions, monthlyReport } from '@/infrastructure/supabase/ledger';
export default function HomeScreen() {
  const { activeFamily: family } = useActiveFamily();
  const [year, month] = localToday(family?.timezone).split('-').map(Number); const today = new Date(year, month - 1, 1);
  const report = useQuery({ queryKey: ['report', family?.id, year, month], queryFn: () => monthlyReport(family!.id, year, month), enabled: !!family, refetchInterval: 15_000 });
  const accounts = useQuery({ queryKey: ['accounts', family?.id], queryFn: () => listAccounts(family!.id), enabled: !!family, refetchInterval: 15_000 });
  const activity = useQuery({ queryKey: ['activity', family?.id, 'recent'], queryFn: () => listTransactions(family!.id), enabled: !!family, refetchInterval: 15_000 });
  return <Screen title={family?.name ?? 'Home'} subtitle={`${today.toLocaleString('en-IN', { month: 'long' })} ${year}`} action={family?.role !== 'VIEWER' && <AppButton label="Add" onPress={() => router.push('/transaction/new')} />}><QueryFeedback pending={report.isPending} error={report.error || accounts.error || activity.error} retry={() => { void report.refetch(); void accounts.refetch(); void activity.refetch(); }} />{report.data && !report.error && <MonthlySummary report={report.data} currency={family?.currency_code ?? 'INR'} />}{accounts.data && !accounts.error && <Card><AppText variant="heading">Total account balance</AppText><AppText variant="amount">{formatMoney(accounts.data.reduce((sum, a) => sum + BigInt(a.balance_minor), 0n).toString(), family?.currency_code)}</AppText><AppButton label={accounts.data.length ? 'View accounts' : 'Set up first account'} kind="secondary" onPress={() => router.push('/accounts')} /></Card>}<AppText variant="heading">Recent activity</AppText>{activity.data?.length === 0 && <AppText muted>No transactions yet. Add income or an expense to begin.</AppText>}{!activity.error && activity.data?.slice(0, 5).map((t) => <Card key={t.id}><AppText>{t.type === 'INCOME' ? '+ Income' : '− Expense'} · {formatMoney(t.amount_minor, family?.currency_code)}</AppText><AppText muted>{t.category_name} · {t.local_date}</AppText><AppButton label={t.description || 'View transaction'} kind="secondary" onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })} /></Card>)}<AppButton label="Refresh totals" kind="secondary" onPress={() => { void report.refetch(); void accounts.refetch(); void activity.refetch(); }} /></Screen>;
}
