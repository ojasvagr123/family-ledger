import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useActiveFamily } from '@/providers/active-family-provider';
import { getTransaction } from '@/infrastructure/supabase/ledger';
import { TransactionForm } from '@/components/transaction-form';
import { Screen } from '@/components/ui/screen';
import { QueryFeedback } from '@/components/ui/query-feedback';
export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { activeFamily } = useActiveFamily();
  const query = useQuery({ queryKey: ['transaction', activeFamily?.id, id], queryFn: () => getTransaction(activeFamily!.id, id), enabled: !!activeFamily });
  if (!query.data) return <Screen title="Transaction"><QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} /></Screen>;
  return <TransactionForm key={`${query.data.id}:${query.data.version}`} existing={query.data} />;
}
