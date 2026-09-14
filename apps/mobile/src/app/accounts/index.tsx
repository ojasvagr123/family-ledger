import { useState } from 'react';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, parseMoney, isLocalDate, localToday } from '@family-ledger/domain';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/app-text';
import { AppField } from '@/components/ui/app-field';
import { AppButton } from '@/components/ui/app-button';
import { Choice } from '@/components/ui/choice';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { listAccounts, rpc } from '@/infrastructure/supabase/ledger';
import { useActiveFamily } from '@/providers/active-family-provider';

export default function AccountsScreen() {
  const { activeFamily: family } = useActiveFamily(); const client = useQueryClient();
  const query = useQuery({ queryKey: ['accounts', family?.id], queryFn: () => listAccounts(family!.id), enabled: !!family });
  const [name, setName] = useState(''); const [type, setType] = useState('CASH'); const [date, setDate] = useState(localToday(family?.timezone));
  const [balance, setBalance] = useState('0'); const [key, setKey] = useState(Crypto.randomUUID); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function save() {
    if (!family || busy) return; setBusy(true); setError('');
    try {
      if (!name.trim() || name.trim().length > 80 || !isLocalDate(date)) throw new Error('Enter a name and valid opening date (YYYY-MM-DD).');
      await rpc('create_account', { p_family_id: family.id, p_name: name.trim(), p_account_type: type, p_opening_date: date, p_balance_minor: parseMoney(balance, true), p_idempotency_key: key });
      setName(''); setBalance('0'); setKey(Crypto.randomUUID()); await client.invalidateQueries({ queryKey: ['accounts', family.id] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save.'); } finally { setBusy(false); }
  }
  return <Screen title="Accounts" subtitle={family?.name}><QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} />{query.data?.map((account) => <Card key={account.id}><AppText variant="heading">{account.name}</AppText><AppText variant="amount">{formatMoney(account.balance_minor, family?.currency_code)}</AppText><AppText muted>{account.account_type.replaceAll('_', ' ')} · Opened {account.opening_date}</AppText></Card>)}{query.data?.length === 0 && <Notice message="Create your first cash, bank or wallet account before adding transactions." />}{(family?.role === 'OWNER' || family?.role === 'ADMIN') && <Card><AppText variant="heading">Add account</AppText>{error && <Notice tone="danger" message={error} />}<AppField label="Account name" value={name} onChangeText={(v) => { setName(v); setKey(Crypto.randomUUID()); }} maxLength={80} /><Choice label="Account type" value={type} onChange={(v) => { setType(v); setKey(Crypto.randomUUID()); }} options={['CASH','SAVINGS','CURRENT','CREDIT_CARD','WALLET','OTHER'].map((v) => ({ value: v, label: v.replaceAll('_', ' ') }))} /><AppField label="Opening date (YYYY-MM-DD)" value={date} onChangeText={(v) => { setDate(v); setKey(Crypto.randomUUID()); }} /><AppField label="Beginning balance (negative for debt)" value={balance} onChangeText={(v) => { setBalance(v); setKey(Crypto.randomUUID()); }} keyboardType="numbers-and-punctuation" /><AppButton label="Save account" loading={busy} onPress={save} /></Card>}<AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}
