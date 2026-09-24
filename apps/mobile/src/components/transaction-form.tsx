import { useState, useEffect } from 'react';
import { Alert, BackHandler } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { canEditTransaction, decimalMoney, parseMoney, isLocalDate, localToday } from '@family-ledger/domain';
import { Screen } from './ui/screen';
import { AppText } from './ui/app-text';
import { AppField } from './ui/app-field';
import { AppButton } from './ui/app-button';
import { Choice } from './ui/choice';
import { Notice } from './ui/notice';
import { QueryFeedback } from './ui/query-feedback';
import { useActiveFamily } from '@/providers/active-family-provider';
import { useAuth } from '@/providers/auth-provider';
import { listAccounts, listCategories, rpc, type Transaction } from '@/infrastructure/supabase/ledger';
import { listFamilyMembers } from '@/infrastructure/supabase/families';

import { saveDraft, loadDraft, deleteDraft } from '@/infrastructure/drafts';

export function TransactionForm({ existing }: { existing?: Transaction }) {
  const { activeFamily: family } = useActiveFamily(); const { user } = useAuth(); const client = useQueryClient();
  const accounts = useQuery({ queryKey: ['accounts', family?.id], queryFn: () => listAccounts(family!.id), enabled: !!family });
  const categories = useQuery({ queryKey: ['categories', family?.id], queryFn: () => listCategories(family!.id), enabled: !!family });
  const members = useQuery({ queryKey: ['members', family?.id], queryFn: () => listFamilyMembers(family!.id), enabled: !!family });
  const [type, setType] = useState(existing?.type ?? 'EXPENSE'); const [date, setDate] = useState(existing?.local_date ?? localToday(family?.timezone));
  const [amount, setAmount] = useState(existing ? decimalMoney(existing.amount_minor) : ''); const [account, setAccount] = useState(existing?.account_id ?? '');
  const [category, setCategory] = useState(existing?.category_id ?? ''); const [description, setDescription] = useState(existing?.description ?? ''); const [remarks, setRemarks] = useState(existing?.remarks ?? '');
  const [relatedUser, setRelatedUser] = useState(existing?.type === 'EXPENSE' ? existing.paid_by_user_id ?? existing.created_by : existing?.received_by_user_id ?? existing?.created_by ?? user?.id ?? '');
  const [key, setKey] = useState(Crypto.randomUUID); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [dirty, setDirty] = useState(false);
  const editable = !!family && !!user && (existing ? canEditTransaction(family.role, user.id, existing.created_by) : family.role !== 'VIEWER');
  const changed = () => { setDirty(true); setKey(Crypto.randomUUID()); };
  useEffect(() => {
    if (!dirty) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { Alert.alert('Discard changes?', 'Save a draft first to keep your entry.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => router.back() }]); return true; });
    return () => subscription.remove();
  }, [dirty]);
  async function persistDraft() {
    if (!user || !family) return;
    try { await saveDraft(user.id, family.id, { type, date, amount, account, category, relatedUser, description, remarks, key }); setDirty(false); Alert.alert('Draft saved', 'It stays on this device until saved as a transaction or you sign out.'); } catch { setError('Unable to save draft on this device.'); }
  }
  async function restoreDraft() {
    if (!user || !family) return;
    try { const draft = await loadDraft(user.id, family.id); if (!draft) { setError('There is no saved draft for this family.'); return; } setType(draft.type); setDate(draft.date); setAmount(draft.amount); setAccount(draft.account); setCategory(draft.category); setRelatedUser(draft.relatedUser ?? user.id); setDescription(draft.description); setRemarks(draft.remarks); setKey(draft.key); setDirty(true); } catch { setError('Unable to restore draft.'); }
  }
  async function refresh() { await Promise.all(['accounts','activity','report','transaction'].map((name) => client.invalidateQueries({ queryKey: [name, family!.id] }))); }
  async function save() {
    if (!family || !editable || busy) return; setBusy(true); setError('');
    try {
      if (!isLocalDate(date)) throw new Error('Enter a valid date as YYYY-MM-DD.');
      if (!account || (type !== 'ADJUSTMENT' && !category)) throw new Error(type === 'ADJUSTMENT' ? 'Choose an account.' : 'Choose an account and category.');
      if (type === 'ADJUSTMENT') {
        await rpc('save_adjustment', { p_family_id: family.id, p_transaction_id: existing?.id ?? null, p_expected_version: existing?.version ?? null, p_local_date: date, p_amount_minor: parseMoney(amount, true), p_account_id: account, p_description: description, p_remarks: remarks, p_idempotency_key: key });
      } else {
        await rpc('save_transaction_v2', { p_family_id: family.id, p_transaction_id: existing?.id ?? null, p_expected_version: existing?.version ?? null, p_type: type, p_local_date: date, p_amount_minor: parseMoney(amount), p_account_id: account, p_category_id: category, p_related_user_id: relatedUser || user?.id, p_description: description, p_remarks: remarks, p_idempotency_key: key });
      }
      if (!existing && user) await deleteDraft(user.id, family.id).catch(() => undefined);
      setDirty(false); await refresh(); router.replace('/(tabs)/transactions');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save. Retry when connected.'); } finally { setBusy(false); }
  }
  async function remove() {
    if (!family || !existing || busy) return; setBusy(true); setError('');
    try { await rpc('set_transaction_deleted', { p_family_id: family.id, p_transaction_id: existing.id, p_expected_version: existing.version, p_deleted: true, p_idempotency_key: key }); setDirty(false); await refresh(); router.replace('/(tabs)/transactions'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete.'); } finally { setBusy(false); }
  }
  async function duplicate() {
    if (!family || !existing || busy || existing.deleted_at) return; setBusy(true); setError('');
    try { if (type === 'ADJUSTMENT') await rpc('save_adjustment', { p_family_id: family.id, p_transaction_id: null, p_expected_version: null, p_local_date: date, p_amount_minor: parseMoney(amount, true), p_account_id: account, p_description: description, p_remarks: remarks, p_idempotency_key: Crypto.randomUUID() }); else await rpc('save_transaction_v2', { p_family_id: family.id, p_transaction_id: null, p_expected_version: null, p_type: type, p_local_date: date, p_amount_minor: parseMoney(amount), p_account_id: account, p_category_id: category, p_related_user_id: relatedUser || user?.id, p_description: description, p_remarks: remarks, p_idempotency_key: Crypto.randomUUID() }); await refresh(); router.replace('/(tabs)/transactions'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to duplicate transaction.'); } finally { setBusy(false); }
  }
  const back = () => dirty ? Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => router.back() }]) : router.back();
  return <Screen title={existing ? 'Transaction details' : 'Add transaction'} subtitle={family?.name}><QueryFeedback pending={accounts.isPending || categories.isPending || members.isPending} error={accounts.error || categories.error || members.error} retry={() => { void accounts.refetch(); void categories.refetch(); void members.refetch(); }} />{error && <Notice tone="danger" message={error === 'VERSION_CONFLICT' ? 'This transaction changed on another device. Go back and reopen it before editing.' : error} />}{!editable && <Notice message="You can view this transaction. Only its creator or a family Owner/Admin may change it." />}{accounts.data?.length === 0 && <><Notice message="Ask your family Owner to create an account first." /><AppButton label="Accounts" onPress={() => router.push('/accounts')} /></>}<Choice label="Type" value={type} options={[{ value: 'EXPENSE', label: 'Expense' },{ value: 'INCOME', label: 'Income' },{ value: 'ADJUSTMENT', label: 'Balance adjustment' }]} onChange={(v) => { if (!editable || busy) return; setType(v as typeof type); setCategory(''); changed(); }} />{type === 'ADJUSTMENT' && <AppText muted>Use a positive value to increase the account balance or a negative value to decrease it.</AppText>}<AppField label="Amount" value={amount} editable={editable && !busy} onChangeText={(v) => { setAmount(v); changed(); }} keyboardType={type === 'ADJUSTMENT' ? 'numbers-and-punctuation' : 'decimal-pad'} /><AppField label="Date (YYYY-MM-DD)" value={date} editable={editable && !busy} onChangeText={(v) => { setDate(v); changed(); }} /><Choice label="Account" value={account} options={(accounts.data ?? []).map((a) => ({ value: a.id, label: a.name }))} onChange={(v) => { if (editable && !busy) { setAccount(v); changed(); } }} />{type !== 'ADJUSTMENT' && <><Choice label="Category" value={category} options={(categories.data ?? []).filter((c) => c.type === type).map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => { if (editable && !busy) { setCategory(v); changed(); } }} /><Choice label={type === 'EXPENSE' ? 'Paid by' : 'Received by'} value={relatedUser} options={(members.data ?? []).filter((member) => member.status !== 'SUSPENDED').map((member) => ({ value: member.user_id, label: member.user_id === user?.id ? `${member.display_name} (Me)` : member.display_name }))} onChange={(value) => { setRelatedUser(value); changed(); }} /></>}<AppField label="Description" value={description} maxLength={240} editable={editable && !busy} onChangeText={(v) => { setDescription(v); changed(); }} /><AppField label="Remarks" value={remarks} multiline maxLength={2000} editable={editable && !busy} onChangeText={(v) => { setRemarks(v); changed(); }} />{editable && <AppButton label={type === 'ADJUSTMENT' ? 'Save balance adjustment' : 'Save transaction'} loading={busy} disabled={!accounts.data?.length || !!existing?.deleted_at} onPress={save} />}{editable && existing && !existing.deleted_at && <AppButton label="Duplicate transaction" kind="secondary" loading={busy} onPress={() => Alert.alert('Create a copy?', 'A new transaction with these values will be created. You can edit the new copy afterward.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Create copy', onPress: () => { void duplicate(); } }])} />}{editable && existing && !existing.deleted_at && <AppButton label="Delete transaction" kind="destructive" loading={busy} onPress={() => Alert.alert('Delete transaction?', 'It will be removed from activity and totals. The database retains a recoverable record.', [{ text: 'Cancel', style: 'cancel' },{ text: 'Delete', style: 'destructive', onPress: remove }])} />}{!existing && editable && <><AppButton label="Save draft on this device" kind="secondary" disabled={busy} onPress={persistDraft} /><AppButton label="Restore saved draft" kind="secondary" disabled={busy} onPress={restoreDraft} /></>}<AppButton label="Back" kind="secondary" onPress={back} /></Screen>;
}
