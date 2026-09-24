import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { formatMoney, isLocalDate, parseMoney } from '@family-ledger/domain';
import { Screen } from '@/components/ui/screen';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppField } from '@/components/ui/app-field';
import { Choice } from '@/components/ui/choice';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { useActiveFamily } from '@/providers/active-family-provider';
import { exportTransactions, listAccounts, listCategories, searchTransactions, type Filters, type TransactionSort } from '@/infrastructure/supabase/ledger';
import { useAuth } from '@/providers/auth-provider';
import { listFamilyMembers } from '@/infrastructure/supabase/families';
import { shareCsv, toCsv } from '@/infrastructure/exports';

type ActivityState = { familyId: string | null; filters: Filters; start: string; end: string; search: string; minAmount: string; maxAmount: string; expanded: boolean };
const remembered = new Map<string, Omit<ActivityState, 'familyId'>>();
const emptyState = (familyId: string | null): ActivityState => ({ familyId, filters: { sort: 'NEWEST', deletedStatus: 'ACTIVE' }, start: '', end: '', search: '', minAmount: '', maxAmount: '', expanded: false });
const sortOptions: { value: TransactionSort; label: string }[] = [
  { value: 'NEWEST', label: 'Newest' }, { value: 'OLDEST', label: 'Oldest' }, { value: 'HIGHEST_AMOUNT', label: 'Highest amount' },
  { value: 'LOWEST_AMOUNT', label: 'Lowest amount' }, { value: 'CATEGORY', label: 'Category' }, { value: 'ACCOUNT', label: 'Account' },
];

export default function TransactionsScreen() {
  const { activeFamily: family } = useActiveFamily(); const { user } = useAuth();
  const [stored, setStored] = useState<ActivityState>(() => emptyState(family?.id ?? null)); const [error, setError] = useState('');
  const recalled = family ? remembered.get(family.id) : undefined;
  const fallback: ActivityState = family ? (recalled ? { familyId: family.id, ...recalled } : emptyState(family.id)) : emptyState(null);
  const state = stored.familyId === family?.id ? stored : fallback;
  const saveState = (patch: Partial<Omit<ActivityState, 'familyId'>>) => { const next = { ...state, ...patch, familyId: family?.id ?? null }; if (family) remembered.set(family.id, { filters: next.filters, start: next.start, end: next.end, search: next.search, minAmount: next.minAmount, maxAmount: next.maxAmount, expanded: next.expanded }); setStored(next); };
  const setFilters = (patch: Partial<Filters>) => saveState({ filters: { ...state.filters, ...patch } });
  const accounts = useQuery({ queryKey: ['accounts', family?.id], queryFn: () => listAccounts(family!.id), enabled: !!family });
  const categories = useQuery({ queryKey: ['categories', family?.id], queryFn: () => listCategories(family!.id), enabled: !!family });
  const members = useQuery({ queryKey: ['members', family?.id], queryFn: () => listFamilyMembers(family!.id), enabled: !!family && state.expanded });
  const query = useInfiniteQuery({ queryKey: ['activity', family?.id, state.filters], queryFn: ({ pageParam }) => searchTransactions(family!.id, state.filters, pageParam), initialPageParam: 0, getNextPageParam: (last, pages) => last.length === 30 ? pages.length * 30 : undefined, enabled: !!family, refetchInterval: 15_000, maxPages: 10 });
  const rows = query.data?.pages.flat() ?? [];
  async function exportCurrentView() { if (!family) return; setError(''); try { const data = await exportTransactions(family.id, state.filters); await shareCsv(`familyledger-transactions-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(['Date','Type','Amount minor','Account','Category','Description','Remarks','Created by','Transaction ID'], data.map((item) => [item.local_date,item.type,item.amount_minor,item.account_name ?? '',item.category_name ?? '',item.description,item.remarks,item.creator_name ?? item.created_by,item.id]))); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to export transactions.'); } }

  return <Screen title="Activity" subtitle={family?.name} scroll={false} action={family?.role !== 'VIEWER' && <AppButton label="Add" onPress={() => router.push('/transaction/new')} />}>
    <FlatList data={query.error ? [] : rows} keyExtractor={(item) => item.id} refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 12 }}>
        <AppField label="Search description, remarks, category or account" value={state.search} onChangeText={(search) => saveState({ search })} />
        <AppButton label="Apply search" kind="secondary" onPress={() => setFilters({ search: state.search })} />
        <Choice label="Sort" value={state.filters.sort ?? 'NEWEST'} options={sortOptions} onChange={(sort) => setFilters({ sort: sort as TransactionSort })} />
        <Choice label="Transaction type" value={state.filters.type ?? ''} options={[{ value: '', label: 'All' },{ value: 'INCOME', label: 'Income' },{ value: 'EXPENSE', label: 'Expenses' },{ value: 'ADJUSTMENT', label: 'Balance adjustments' }]} onChange={(type) => setFilters({ type })} />
        <AppButton label="Export this view as CSV" kind="secondary" onPress={() => { void exportCurrentView(); }} />
        <AppButton label={state.expanded ? 'Hide filters' : 'More filters'} kind="secondary" onPress={() => saveState({ expanded: !state.expanded })} />
        {state.expanded && <><AppField label="From (YYYY-MM-DD, inclusive)" value={state.start} onChangeText={(start) => saveState({ start })} /><AppField label="Until (YYYY-MM-DD, exclusive)" value={state.end} onChangeText={(end) => saveState({ end })} /><AppButton label="Apply dates" kind="secondary" onPress={() => { if ((state.start && !isLocalDate(state.start)) || (state.end && !isLocalDate(state.end)) || (state.start && state.end && state.start >= state.end)) { setError('Choose valid dates with Until later than From.'); return; } setError(''); setFilters({ start: state.start, end: state.end }); }} />
          <Choice label="Account" value={state.filters.accountId ?? ''} options={[{ value: '', label: 'All accounts' },...(accounts.data ?? []).map((account) => ({ value: account.id, label: account.name }))]} onChange={(accountId) => setFilters({ accountId })} />
          <Choice label="Category" value={state.filters.categoryId ?? ''} options={[{ value: '', label: 'All categories' },...(categories.data ?? []).map((category) => ({ value: category.id, label: category.name }))]} onChange={(categoryId) => setFilters({ categoryId })} />
          <QueryFeedback pending={members.isPending} error={members.error} retry={members.refetch} />
          <Choice label="Created by" value={state.filters.memberId ?? ''} options={[{ value: '', label: 'Everyone' },...(members.data ?? []).map((member) => ({ value: member.user_id, label: member.user_id === user?.id ? `${member.display_name} (Me)` : member.display_name }))]} onChange={(memberId) => setFilters({ memberId })} />
          <AppField label="Minimum amount" value={state.minAmount} onChangeText={(minAmount) => saveState({ minAmount })} keyboardType="decimal-pad" /><AppField label="Maximum amount" value={state.maxAmount} onChangeText={(maxAmount) => saveState({ maxAmount })} keyboardType="decimal-pad" /><AppButton label="Apply amount range" kind="secondary" onPress={() => { try { const minAmountMinor = state.minAmount ? parseMoney(state.minAmount) : undefined; const maxAmountMinor = state.maxAmount ? parseMoney(state.maxAmount) : undefined; if (minAmountMinor && maxAmountMinor && BigInt(minAmountMinor) > BigInt(maxAmountMinor)) throw new Error('Minimum must not exceed maximum.'); setError(''); setFilters({ minAmountMinor, maxAmountMinor }); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Enter valid amounts.'); } }} /><Choice label="Record status" value={state.filters.deletedStatus ?? 'ACTIVE'} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'DELETED', label: 'Deleted' }, { value: 'ALL', label: 'All' }]} onChange={(deletedStatus) => setFilters({ deletedStatus: deletedStatus as Filters['deletedStatus'] })} /><AppButton label="Clear filters" kind="secondary" onPress={() => { setError(''); saveState({ filters: { sort: 'NEWEST', deletedStatus: 'ACTIVE' }, start: '', end: '', search: '', minAmount: '', maxAmount: '' }); }} /></>}
        {error && <Notice tone="danger" message={error} />}<QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} />
      </View>}
      renderItem={({ item }) => <Card tone={item.type === 'INCOME' ? 'income' : item.type === 'EXPENSE' ? 'expense' : 'default'} style={{ marginBottom: 12 }}><AppText variant="eyebrow">{item.deleted_at ? 'Deleted · ' : ''}{item.type.replaceAll('_', ' ')}</AppText><AppText variant="amount">{item.type === 'INCOME' ? '+' : item.type === 'EXPENSE' ? '−' : ''}{formatMoney(item.amount_minor, family?.currency_code, family?.currency_symbol)}</AppText><AppText>{item.description || item.category_name || 'Balance adjustment'}</AppText><AppText muted>{item.category_name ?? 'Account balance'} · {item.account_name} · {item.local_date}</AppText>{item.remarks && <AppText muted>{item.remarks}</AppText>}<AppButton label="View details" kind="secondary" onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })} /></Card>}
      ListEmptyComponent={!query.isPending && !query.error ? <AppText muted>No transactions match. Add a transaction or clear your filters.</AppText> : null}
      ListFooterComponent={query.hasNextPage ? <AppButton label="Load more" loading={query.isFetchingNextPage} kind="secondary" onPress={() => { void query.fetchNextPage(); }} /> : null} />
  </Screen>;
}
