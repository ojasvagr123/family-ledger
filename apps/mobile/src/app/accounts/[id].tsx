import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@family-ledger/domain';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { exportTransactions, listAccountsForManagement, rpc } from '@/infrastructure/supabase/ledger';
import { shareCsv, toCsv } from '@/infrastructure/exports';
import { useActiveFamily } from '@/providers/active-family-provider';

type Reconciliation = { id: string; checked_on: string; expected_balance_minor: string; actual_balance_minor: string; difference_minor: string; created_at: string };
type LedgerTransaction = Awaited<ReturnType<typeof exportTransactions>>[number];

function buildLedgerRows(transactions: LedgerTransaction[], openingBalance: string) {
  let balance = BigInt(openingBalance);
  return transactions.map((transaction) => {
    balance += transaction.type === 'EXPENSE' ? -BigInt(transaction.amount_minor) : BigInt(transaction.amount_minor);
    return { transaction, balance: balance.toString() };
  });
}

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { activeFamily: family } = useActiveFamily(); const [error, setError] = useState('');
  const accounts = useQuery({ queryKey: ['accounts-screen', family?.id], queryFn: () => listAccountsForManagement(family!.id), enabled: !!family });
  const ledger = useQuery({ queryKey: ['account-ledger', family?.id, id], queryFn: () => exportTransactions(family!.id, { accountId: id, sort: 'OLDEST', deletedStatus: 'ACTIVE' }), enabled: !!family && !!id });
  const reconciliations = useQuery({ queryKey: ['account-reconciliations', family?.id, id], queryFn: () => rpc<Reconciliation[]>('list_account_reconciliations', { p_family_id: family!.id, p_account_id: id }), enabled: !!family && !!id });
  const account = accounts.data?.find((item) => item.id === id);
  const rows = useMemo(() => buildLedgerRows(ledger.data ?? [], account?.beginning_balance_minor ?? '0'), [account?.beginning_balance_minor, ledger.data]);
  async function exportLedger() { if (!account) return; setError(''); try { await shareCsv(`familyledger-${account.name}-ledger.csv`, toCsv(['Date','Type','Description','Amount minor','Running balance minor'], rows.map(({ transaction, balance }) => [transaction.local_date,transaction.type,transaction.description,transaction.amount_minor,balance]))); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to export account ledger.'); } }
  return <Screen title={account?.name ?? 'Account detail'} subtitle="Account ledger"><QueryFeedback pending={accounts.isPending || ledger.isPending || reconciliations.isPending} error={accounts.error || ledger.error || reconciliations.error} retry={() => { void accounts.refetch(); void ledger.refetch(); void reconciliations.refetch(); }} />{error && <Notice tone="danger" message={error} />}{account && <Card tone="accent"><AppText variant="eyebrow">Current balance</AppText><AppText variant="display">{formatMoney(account.balance_minor, family?.currency_code, family?.currency_symbol)}</AppText><AppText muted>{account.account_type.replaceAll('_', ' ')}{account.institution ? ` · ${account.institution}` : ''} · Opened {account.opening_date}</AppText><AppButton label="Share account ledger as CSV" kind="secondary" onPress={() => { void exportLedger(); }} /></Card>}<AppText variant="heading">Running balance</AppText>{rows.length === 0 && <Notice message="No transactions for this account yet." />}{rows.map(({ transaction, balance }) => <Card compact key={transaction.id}><AppText variant="eyebrow">{transaction.local_date} · {transaction.type.replaceAll('_', ' ')}</AppText><AppText variant="heading">{transaction.description || transaction.category_name || 'Balance adjustment'}</AppText><AppText>{formatMoney(transaction.amount_minor, family?.currency_code, family?.currency_symbol)} · Balance {formatMoney(balance, family?.currency_code, family?.currency_symbol)}</AppText></Card>)}<AppText variant="heading">Reconciliation history</AppText>{reconciliations.data?.length === 0 && <AppText muted>No balance checks recorded.</AppText>}{reconciliations.data?.map((item) => <Card compact key={item.id}><AppText>{item.checked_on}</AppText><AppText muted>Expected {formatMoney(item.expected_balance_minor, family?.currency_code, family?.currency_symbol)} · Actual {formatMoney(item.actual_balance_minor, family?.currency_code, family?.currency_symbol)} · Difference {formatMoney(item.difference_minor, family?.currency_code, family?.currency_symbol)}</AppText></Card>)}<AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}
