import { useState } from 'react';
import { Alert, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/app-text';
import { AppField } from '@/components/ui/app-field';
import { AppButton } from '@/components/ui/app-button';
import { Choice } from '@/components/ui/choice';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { listManagedCategories, rpc } from '@/infrastructure/supabase/ledger';
import { useActiveFamily } from '@/providers/active-family-provider';

export default function CategoriesScreen() {
  const { activeFamily: family } = useActiveFamily();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['managed-categories', family?.id], queryFn: () => listManagedCategories(family!.id), enabled: !!family });
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#5B5BD6');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');
  const [mergingId, setMergingId] = useState<string | null>(null);

  async function addCategory() {
    if (!family || busy) return;
    setBusy(true); setError('');
    try {
      if (!name.trim()) throw new Error('Enter a category name.');
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw new Error('Use a six-digit hex color such as #5B5BD6.');
      await rpc('create_category_extended', { p_family_id: family.id, p_type: type, p_name: name.trim(), p_color: color, p_idempotency_key: Crypto.randomUUID() });
      setName(''); await Promise.all([client.invalidateQueries({ queryKey: ['categories', family.id] }), client.invalidateQueries({ queryKey: ['managed-categories', family.id] })]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create category.'); }
    finally { setBusy(false); }
  }

  async function archive(id: string) {
    if (!family || busy) return;
    setBusy(true); setError('');
    try { await rpc('archive_category', { p_family_id: family.id, p_category_id: id, p_archived: true, p_idempotency_key: Crypto.randomUUID() }); await Promise.all([client.invalidateQueries({ queryKey: ['categories', family.id] }), client.invalidateQueries({ queryKey: ['managed-categories', family.id] })]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to archive category.'); }
    finally { setBusy(false); }
  }

  async function restore(id: string) {
    if (!family || busy) return;
    setBusy(true); setError('');
    try { await rpc('archive_category', { p_family_id: family.id, p_category_id: id, p_archived: false, p_idempotency_key: Crypto.randomUUID() }); await Promise.all([client.invalidateQueries({ queryKey: ['categories', family.id] }), client.invalidateQueries({ queryKey: ['managed-categories', family.id] })]); }
    catch (cause) { setError(cause instanceof Error ? cause.message.replace('CATEGORY_ALREADY_EXISTS', 'An active category with this name already exists. Rename that category before restoring.') : 'Unable to restore category.'); }
    finally { setBusy(false); }
  }

  async function saveEdit(id: string, sortOrder: number) {
    if (!family || busy) return;
    setBusy(true); setError('');
    try {
      if (!editingName.trim()) throw new Error('Enter a category name.');
      if (editingColor && !/^#[0-9A-Fa-f]{6}$/.test(editingColor)) throw new Error('Use a six-digit hex color such as #5B5BD6.');
      await rpc('update_category_extended', { p_family_id: family.id, p_category_id: id, p_name: editingName.trim(), p_sort_order: sortOrder, p_color: editingColor || null, p_idempotency_key: Crypto.randomUUID() });
      setEditingId(null); setEditingName(''); await Promise.all([client.invalidateQueries({ queryKey: ['categories', family.id] }), client.invalidateQueries({ queryKey: ['managed-categories', family.id] })]);
    } catch (cause) { setError(cause instanceof Error ? cause.message.replace('CATEGORY_ALREADY_EXISTS', 'A category with this name already exists.') : 'Unable to update category.'); }
    finally { setBusy(false); }
  }
  async function deleteUnused(id: string) { if (!family || busy) return; setBusy(true); setError(''); try { await rpc('delete_unused_category', { p_family_id: family.id, p_category_id: id, p_idempotency_key: Crypto.randomUUID() }); await Promise.all([client.invalidateQueries({ queryKey: ['categories', family.id] }), client.invalidateQueries({ queryKey: ['managed-categories', family.id] })]); } catch (cause) { setError(cause instanceof Error ? cause.message.replace('CATEGORY_IN_USE', 'This category has transaction history. Archive or merge it instead.') : 'Unable to delete category.'); } finally { setBusy(false); } }
  async function merge(sourceId: string, targetId: string) { if (!family || busy || sourceId === targetId) return; setBusy(true); setError(''); try { const result = await rpc<{ transactions_moved: number }>('merge_categories', { p_family_id: family.id, p_source_category_id: sourceId, p_target_category_id: targetId, p_idempotency_key: Crypto.randomUUID() }); setMergingId(null); await Promise.all([client.invalidateQueries({ queryKey: ['categories', family.id] }), client.invalidateQueries({ queryKey: ['managed-categories', family.id] }), client.invalidateQueries({ queryKey: ['activity', family.id] }), client.invalidateQueries({ queryKey: ['report', family.id] })]); Alert.alert('Categories merged', `${result.transactions_moved} transaction${result.transactions_moved === 1 ? '' : 's'} moved safely.`); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to merge categories.'); } finally { setBusy(false); } }

  async function move(kind: 'INCOME' | 'EXPENSE', index: number, direction: -1 | 1) {
    if (!family || busy) return;
    const rows = (query.data ?? []).filter((category) => category.type === kind && !category.archived_at); const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const ids = rows.map((category) => category.id); [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true); setError('');
    try { await rpc('reorder_categories', { p_family_id: family.id, p_type: kind, p_category_ids: ids, p_idempotency_key: Crypto.randomUUID() }); await Promise.all([client.invalidateQueries({ queryKey: ['categories', family.id] }), client.invalidateQueries({ queryKey: ['managed-categories', family.id] })]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to reorder categories. Refresh and try again.'); }
    finally { setBusy(false); }
  }

  return <Screen title="Categories" subtitle={family?.name}>
    <QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} />
    {error && <Notice tone="danger" message={error} />}
    <Card><AppText variant="heading">Add category</AppText><Choice label="Category type" value={type} options={[{ value: 'INCOME', label: 'Income' }, { value: 'EXPENSE', label: 'Expense' }]} onChange={(value) => setType(value as typeof type)} /><AppField label="Category name" value={name} onChangeText={setName} maxLength={80} /><AppField label="Color (hex)" value={color} onChangeText={setColor} autoCapitalize="characters" maxLength={7} /><AppButton label="Save category" loading={busy} onPress={addCategory} /></Card>
    <AppText variant="heading">Active categories</AppText>
    {(['INCOME', 'EXPENSE'] as const).map((kind) => { const rows = (query.data ?? []).filter((category) => category.type === kind && !category.archived_at); return <Card key={kind}><AppText variant="heading">{kind === 'INCOME' ? 'Income' : 'Expenses'}</AppText>{rows.map((category, index) => <Card key={category.id} style={{ marginTop: 8 }}>{editingId === category.id ? <><AppField label="Category name" value={editingName} onChangeText={setEditingName} maxLength={80} /><AppField label="Color (hex)" value={editingColor} onChangeText={setEditingColor} autoCapitalize="characters" maxLength={7} /><AppButton label="Save category" loading={busy} onPress={() => { void saveEdit(category.id, category.sort_order); }} /><AppButton label="Cancel" kind="secondary" disabled={busy} onPress={() => { setEditingId(null); setEditingName(''); }} /></> : <><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: category.color ?? (kind === 'INCOME' ? '#169B68' : '#E05252') }} /><AppText>{index + 1}. {category.name}</AppText></View><AppButton label="Edit" kind="secondary" disabled={busy} onPress={() => { setEditingId(category.id); setEditingName(category.name); setEditingColor(category.color ?? ''); }} /><AppButton label="Move up" kind="secondary" disabled={busy || index === 0} onPress={() => { void move(kind, index, -1); }} /><AppButton label="Move down" kind="secondary" disabled={busy || index === rows.length - 1} onPress={() => { void move(kind, index, 1); }} /><AppButton label="Archive" kind="secondary" disabled={busy} onPress={() => { void archive(category.id); }} /><AppButton label={mergingId === category.id ? 'Cancel merge' : 'Merge into another'} kind="secondary" disabled={busy || rows.length < 2} onPress={() => setMergingId(mergingId === category.id ? null : category.id)} />{mergingId === category.id && <Choice label="Move all transactions into" value="" options={rows.filter((target) => target.id !== category.id).map((target) => ({ value: target.id, label: target.name }))} onChange={(targetId) => { void merge(category.id, targetId); }} />}<AppButton label="Delete if unused" kind="destructive" disabled={busy} onPress={() => Alert.alert('Delete unused category?', 'Deletion succeeds only when no transaction has ever used this category.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void deleteUnused(category.id); } }])} /></>}</Card>)}{rows.length === 0 && <AppText muted>No active categories.</AppText>}</Card>; })}
    <AppText variant="heading">Archived categories</AppText>
    {(query.data ?? []).filter((category) => !!category.archived_at).map((category) => <Card key={category.id}><AppText variant="heading">{category.name}</AppText><AppText muted>{category.type === 'INCOME' ? 'Income' : 'Expense'} · Archived {new Date(category.archived_at!).toLocaleDateString()}</AppText><AppButton label="Restore category" loading={busy} onPress={() => { void restore(category.id); }} /></Card>)}
    {(query.data ?? []).every((category) => !category.archived_at) && <AppText muted>No archived categories.</AppText>}
    <AppButton label="Back" kind="secondary" onPress={() => router.back()} />
  </Screen>;
}
