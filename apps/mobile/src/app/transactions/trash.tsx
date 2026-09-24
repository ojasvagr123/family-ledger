import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { canEditTransaction, formatMoney } from '@family-ledger/domain';
import { Screen } from '@/components/ui/screen';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { useActiveFamily } from '@/providers/active-family-provider';
import { useAuth } from '@/providers/auth-provider';
import { listDeletedTransactions, rpc, type Transaction } from '@/infrastructure/supabase/ledger';

export default function TransactionTrashScreen() {
  const { activeFamily: family } = useActiveFamily();
  const { user } = useAuth();
  const client = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['deleted-transactions', family?.id],
    queryFn: () => listDeletedTransactions(family!.id),
    enabled: !!family,
  });
  const restore = useMutation({
    mutationFn: (transaction: Transaction) => rpc('set_transaction_deleted', {
      p_family_id: family!.id,
      p_transaction_id: transaction.id,
      p_expected_version: transaction.version,
      p_deleted: false,
      p_idempotency_key: Crypto.randomUUID(),
    }),
    onSuccess: async () => {
      setMessage('Transaction restored to Activity.');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['deleted-transactions', family?.id] }),
        client.invalidateQueries({ queryKey: ['activity', family?.id] }),
        client.invalidateQueries({ queryKey: ['accounts', family?.id] }),
        client.invalidateQueries({ queryKey: ['monthly-report', family?.id] }),
        client.invalidateQueries({ queryKey: ['annual-report', family?.id] }),
        client.invalidateQueries({ queryKey: ['custom-report', family?.id] }),
      ]);
    },
    onError: (error) => Alert.alert('Unable to restore', error.message),
  });

  return <Screen title="Transaction trash" subtitle={family?.name}>
    <Notice message="Deleted transactions do not affect balances or reports. Restore returns the transaction to Activity." />
    {message && <Notice message={message} />}
    <QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} />
    {query.data?.length === 0 && <AppText muted>Trash is empty.</AppText>}
    {query.data?.map((transaction) => {
      const editable = !!family && !!user && canEditTransaction(family.role, user.id, transaction.created_by);
      return <Card key={transaction.id}>
        <AppText variant="heading">{transaction.type === 'INCOME' ? 'Income' : transaction.type === 'EXPENSE' ? 'Expense' : 'Balance adjustment'} · {formatMoney(transaction.amount_minor, family?.currency_code, family?.currency_symbol)}</AppText>
        <AppText>{transaction.category_name ?? 'Account balance'} · {transaction.account_name}</AppText>
        <AppText muted>Transaction date: {transaction.local_date}</AppText>
        <AppText muted>Created by: {transaction.creator_name ?? 'Family member'}</AppText>
        <AppText muted>Deleted: {transaction.deleted_at ? new Date(transaction.deleted_at).toLocaleString() : 'Unknown'}</AppText>
        {transaction.description && <AppText>{transaction.description}</AppText>}
        {editable
          ? <AppButton label="Restore transaction" loading={restore.isPending && restore.variables?.id === transaction.id} disabled={restore.isPending} onPress={() => restore.mutate(transaction)} />
          : <AppText muted>Only the creator, an Admin, or the Owner can restore this transaction.</AppText>}
      </Card>;
    })}
    <AppButton label="Back" kind="secondary" onPress={() => router.back()} />
  </Screen>;
}
