import { useMemo, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isLocalDate, normalizeImportedDate, parseDelimitedText, parseMoney, type CsvDateOrder } from '@family-ledger/domain';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/app-text';
import { AppField } from '@/components/ui/app-field';
import { AppButton } from '@/components/ui/app-button';
import { Choice } from '@/components/ui/choice';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { listAccounts, listCategories, rpc } from '@/infrastructure/supabase/ledger';
import { useActiveFamily } from '@/providers/active-family-provider';

type MappingKey = 'date' | 'category' | 'amount' | 'account' | 'description' | 'remarks';
type Mapping = Record<MappingKey, string>;
type ParsedRow = { date: string; category: string; amount: string; account: string; description: string; remarks: string; categoryId?: string; accountId?: string; error?: string };
type ImportBatch = { id: string; filename: string; status: string; total_rows: number; imported_rows: number; skipped_rows: number; created_at: string; rolled_back_at: string | null };
const emptyMapping: Mapping = { date: '', category: '', amount: '', account: '', description: '', remarks: '' };

function normalized(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function autoMapping(headers: string[]): Mapping {
  const find = (names: string[]) => { const index = headers.findIndex((header) => names.includes(normalized(header))); return index < 0 ? '' : String(index); };
  return {
    date: find(['date','transactiondate','posteddate','valuedate']),
    category: find(['category','type','classification']),
    amount: find(['amount','transactionamount','debit','credit','value']),
    account: find(['account','accountname','bankaccount','card']),
    description: find(['description','narration','merchant','details','payee']),
    remarks: find(['remarks','memo','notes','note']),
  };
}
function mapped(row: string[], index: string) { return index === '' ? '' : row[Number(index)]?.trim() ?? ''; }
function positiveAmount(value: string) { const clean = value.replace(/[^0-9.-]/g, ''); return clean.startsWith('-') ? clean.slice(1) : clean; }

export default function CsvImportScreen() {
  const { activeFamily: family } = useActiveFamily(); const client = useQueryClient(); const cancel = useRef(false);
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE'); const [csv, setCsv] = useState(''); const [filename, setFilename] = useState(''); const [hasHeader, setHasHeader] = useState(true); const [mapping, setMapping] = useState<Mapping>(emptyMapping); const [dateOrder, setDateOrder] = useState<CsvDateOrder>('AUTO'); const [defaultAccountId, setDefaultAccountId] = useState(''); const [defaultCategoryId, setDefaultCategoryId] = useState(''); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(''); const [error, setError] = useState(''); const [result, setResult] = useState(''); const [duplicateFingerprints, setDuplicateFingerprints] = useState<Set<string>>(new Set()); const [rowFingerprints, setRowFingerprints] = useState<string[]>([]);
  const accounts = useQuery({ queryKey: ['accounts', family?.id], queryFn: () => listAccounts(family!.id), enabled: !!family });
  const categories = useQuery({ queryKey: ['categories', family?.id], queryFn: () => listCategories(family!.id), enabled: !!family });
  const batches = useQuery({ queryKey: ['import-batches', family?.id], queryFn: () => rpc<ImportBatch[]>('list_import_batches', { p_family_id: family!.id }), enabled: !!family });
  const grid = useMemo(() => parseDelimitedText(csv), [csv]);
  const headers = useMemo(() => hasHeader ? (grid[0] ?? []) : (grid[0] ?? []).map((_, index) => `Column ${index + 1}`), [grid, hasHeader]);
  const columnOptions = [{ value: '', label: 'Not included / use default' }, ...headers.map((header, index) => ({ value: String(index), label: `${index + 1}. ${header || `Column ${index + 1}`}` }))];
  const availableCategories = (categories.data ?? []).filter((item) => item.type === type);
  const parsed = useMemo<ParsedRow[]>(() => {
    const rows = hasHeader ? grid.slice(1) : grid; const categoryMap = new Map(availableCategories.map((item) => [item.name.trim().toLowerCase(), item.id])); const accountMap = new Map((accounts.data ?? []).map((item) => [item.name.trim().toLowerCase(), item.id]));
    return rows.slice(0, 500).map((row) => {
      const date = normalizeImportedDate(mapped(row, mapping.date), dateOrder); const category = mapped(row, mapping.category); const amount = positiveAmount(mapped(row, mapping.amount)); const account = mapped(row, mapping.account); const description = mapped(row, mapping.description); const remarks = mapped(row, mapping.remarks);
      const categoryId = mapping.category === '' ? defaultCategoryId : categoryMap.get(category.toLowerCase()); const accountId = mapping.account === '' ? defaultAccountId : accountMap.get(account.toLowerCase()); let rowError = '';
      try { parseMoney(amount); } catch { rowError = 'Invalid amount'; }
      if (!isLocalDate(date)) rowError = rowError || 'Invalid date'; if (!categoryId) rowError = rowError || 'Category not found'; if (!accountId) rowError = rowError || 'Account not found';
      return { date, category: category || availableCategories.find((item) => item.id === categoryId)?.name || '', amount, account: account || accounts.data?.find((item) => item.id === accountId)?.name || '', description, remarks, categoryId, accountId, error: rowError };
    });
  }, [accounts.data, availableCategories, dateOrder, defaultAccountId, defaultCategoryId, grid, hasHeader, mapping]);

  async function chooseFile() {
    setError(''); const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv','text/comma-separated-values','text/plain','application/vnd.ms-excel'], copyToCacheDirectory: true, multiple: false }); if (picked.canceled) return;
    const asset = picked.assets[0]; if (asset.size && asset.size > 5_000_000) { setError('Choose a CSV file smaller than 5 MB.'); return; }
    try { const text = await new File(asset.uri).text(); const nextGrid = parseDelimitedText(text); setCsv(text); setFilename(asset.name); setHasHeader(true); setMapping(autoMapping(nextGrid[0] ?? [])); setResult(''); setDuplicateFingerprints(new Set()); setRowFingerprints([]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to read this file.'); }
  }
  function remap() { setMapping(autoMapping(headers)); }
  async function fingerprint(row: ParsedRow) { return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, [family?.id,type,row.date,parseMoney(row.amount),row.accountId,row.categoryId,row.description.trim().toLowerCase()].join('|')); }
  async function checkDuplicates() {
    if (!family) return; const valid = parsed.filter((row) => !row.error && row.categoryId && row.accountId); if (!valid.length) { setError('There are no valid rows to check.'); return; }
    setBusy(true); setError(''); try { const values = await Promise.all(valid.map(fingerprint)); const duplicates = await rpc<string[]>('preview_import_duplicates', { p_family_id: family.id, p_fingerprints: values }); setRowFingerprints(values); setDuplicateFingerprints(new Set(duplicates)); setResult(`${duplicates.length} exact duplicate${duplicates.length === 1 ? '' : 's'} found. Exact duplicates will be skipped.`); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to check duplicates.'); } finally { setBusy(false); }
  }
  async function importRows() {
    if (!family || busy) return; if (!mapping.date || !mapping.amount) { setError('Map both the Date and Amount columns.'); return; } const valid = parsed.filter((row) => !row.error && row.categoryId && row.accountId); if (!valid.length) { setError('There are no valid rows to import.'); return; }
    setBusy(true); cancel.current = false; setError(''); setResult(''); let imported = 0; let duplicates = 0;
    try { const fileHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, csv); const batch = await rpc<{ id: string }>('begin_import_batch', { p_family_id: family.id, p_filename: filename || 'pasted-transactions.csv', p_file_sha256: fileHash, p_mapping: { ...mapping, type, dateOrder }, p_total_rows: valid.length, p_idempotency_key: Crypto.randomUUID() }); const values = rowFingerprints.length === valid.length ? rowFingerprints : await Promise.all(valid.map(fingerprint)); for (const [index, row] of valid.entries()) { if (cancel.current) break; const outcome = await rpc<{ status: 'IMPORTED' | 'EXACT_DUPLICATE' }>('import_batch_transaction', { p_family_id: family.id, p_batch_id: batch.id, p_row_number: index + 1, p_fingerprint: values[index], p_type: type, p_local_date: row.date, p_amount_minor: parseMoney(row.amount), p_account_id: row.accountId, p_category_id: row.categoryId, p_description: row.description, p_remarks: row.remarks, p_idempotency_key: Crypto.randomUUID() }); if (outcome.status === 'IMPORTED') imported += 1; else duplicates += 1; setProgress(`${index + 1} of ${valid.length}`); } await rpc('finish_import_batch', { p_family_id: family.id, p_batch_id: batch.id, p_cancelled: cancel.current }); await Promise.all([client.invalidateQueries({ queryKey: ['accounts', family.id] }), client.invalidateQueries({ queryKey: ['activity', family.id] }), client.invalidateQueries({ queryKey: ['report', family.id] }), client.invalidateQueries({ queryKey: ['import-batches', family.id] })]); setResult(`${cancel.current ? 'Import stopped safely.' : 'Import complete.'} Added ${imported}; skipped ${duplicates} exact duplicate${duplicates === 1 ? '' : 's'} and ${parsed.length - valid.length} invalid row${parsed.length - valid.length === 1 ? '' : 's'}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : `Imported ${imported} rows before the error.`); }
    finally { setBusy(false); setProgress(''); }
  }
  async function rollback(batch: ImportBatch) { if (!family) return; setBusy(true); setError(''); try { const outcome = await rpc<{ transactions_removed: number }>('rollback_import_batch', { p_family_id: family.id, p_batch_id: batch.id, p_idempotency_key: Crypto.randomUUID() }); setResult(`Rolled back ${outcome.transactions_removed} imported transaction${outcome.transactions_removed === 1 ? '' : 's'}.`); await Promise.all([client.invalidateQueries({ queryKey: ['import-batches', family.id] }), client.invalidateQueries({ queryKey: ['activity', family.id] }), client.invalidateQueries({ queryKey: ['accounts', family.id] }), client.invalidateQueries({ queryKey: ['report', family.id] })]); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to roll back this batch.'); } finally { setBusy(false); } }
  function previewFingerprint(index: number) { const validIndex = parsed.slice(0, index + 1).filter((row) => !row.error && row.categoryId && row.accountId).length - 1; return rowFingerprints[validIndex]; }

  return <Screen title="Import CSV" subtitle="Select a bank CSV or paste CSV text">
    <QueryFeedback pending={accounts.isPending || categories.isPending} error={accounts.error || categories.error} retry={() => { void accounts.refetch(); void categories.refetch(); }} />
    <Card><AppButton label="Choose CSV file" onPress={() => { void chooseFile(); }} />{filename && <AppText muted>Selected: {filename}</AppText>}<AppField label="Or paste CSV data" value={csv} onChangeText={(text) => { setCsv(text); setFilename(''); setDuplicateFingerprints(new Set()); setRowFingerprints([]); }} multiline placeholder="Date,Category,Amount,Account,Description,Remarks" /><Choice label="First row" value={hasHeader ? 'HEADER' : 'DATA'} options={[{ value: 'HEADER', label: 'Column names' }, { value: 'DATA', label: 'Transaction data' }]} onChange={(value) => { const next = value === 'HEADER'; setHasHeader(next); setMapping(next ? autoMapping(grid[0] ?? []) : emptyMapping); setDuplicateFingerprints(new Set()); setRowFingerprints([]); }} /></Card>
    {grid.length > 0 && <Card><AppText variant="heading">Map columns</AppText><AppButton label="Auto-map common bank headings" kind="secondary" onPress={remap} /><Choice label="Date column" value={mapping.date} options={columnOptions} onChange={(value) => setMapping({ ...mapping, date: value })} /><Choice label="Amount column" value={mapping.amount} options={columnOptions} onChange={(value) => setMapping({ ...mapping, amount: value })} /><Choice label="Category column" value={mapping.category} options={columnOptions} onChange={(value) => setMapping({ ...mapping, category: value })} /><Choice label="Account column" value={mapping.account} options={columnOptions} onChange={(value) => setMapping({ ...mapping, account: value })} /><Choice label="Description column" value={mapping.description} options={columnOptions} onChange={(value) => setMapping({ ...mapping, description: value })} /><Choice label="Remarks column" value={mapping.remarks} options={columnOptions} onChange={(value) => setMapping({ ...mapping, remarks: value })} /></Card>}
    {grid.length > 0 && <Card><AppText variant="heading">Import rules</AppText><Choice label="Import as" value={type} options={[{ value: 'EXPENSE', label: 'Expenses' }, { value: 'INCOME', label: 'Income' }]} onChange={(value) => { setType(value as typeof type); setDefaultCategoryId(''); setDuplicateFingerprints(new Set()); setRowFingerprints([]); }} /><Choice label="Date order" value={dateOrder} options={[{ value: 'AUTO', label: 'Automatic' }, { value: 'DMY', label: 'Day / Month / Year' }, { value: 'MDY', label: 'Month / Day / Year' }, { value: 'YMD', label: 'Year / Month / Day' }]} onChange={(value) => setDateOrder(value as CsvDateOrder)} />{mapping.account === '' && <Choice label="Default account" value={defaultAccountId} options={(accounts.data ?? []).map((item) => ({ value: item.id, label: item.name }))} onChange={setDefaultAccountId} />}{mapping.category === '' && <Choice label="Default category" value={defaultCategoryId} options={availableCategories.map((item) => ({ value: item.id, label: item.name }))} onChange={setDefaultCategoryId} />}<AppButton label="Check for duplicates" kind="secondary" loading={busy} disabled={!parsed.length} onPress={() => { void checkDuplicates(); }} /><AppButton label="Import new rows" loading={busy} disabled={!parsed.length} onPress={() => { void importRows(); }} />{busy && <AppButton label={`Stop after current row${progress ? ` (${progress})` : ''}`} kind="destructive" onPress={() => { cancel.current = true; }} />}</Card>}
    {error && <Notice tone="danger" message={error} />}{result && <Notice message={result} />}
    {parsed.length > 0 && <Card><AppText variant="heading">Preview ({parsed.length} rows, maximum 500 per import)</AppText><AppText muted>{parsed.filter((row) => !row.error).length} valid · {parsed.filter((row) => !!row.error).length} rejected · {duplicateFingerprints.size} exact duplicates</AppText>{parsed.slice(0, 30).map((row, index) => <AppText key={`${row.date}-${index}`} muted>{index + 1}. {row.date} · {row.category || 'No category'} · {row.amount} · {row.account || 'No account'}{row.error ? ` — ${row.error}` : previewFingerprint(index) && duplicateFingerprints.has(previewFingerprint(index)) ? ' — exact duplicate' : ' — ready'}</AppText>)}</Card>}
    {(batches.data?.length ?? 0) > 0 && <Card><AppText variant="heading">Import history</AppText>{batches.data?.map((batch) => <Card compact key={batch.id} tone={batch.status === 'ROLLED_BACK' ? 'expense' : 'default'}><AppText style={{ fontWeight: '700' }}>{batch.filename}</AppText><AppText muted>{batch.status.replaceAll('_', ' ')} · {batch.imported_rows} added · {batch.skipped_rows} skipped</AppText><AppText variant="caption" muted>{new Date(batch.created_at).toLocaleString()}</AppText>{(family?.role === 'OWNER' || family?.role === 'ADMIN') && ['COMPLETED','CANCELLED','FAILED'].includes(batch.status) && <AppButton label="Roll back this import" kind="destructive" disabled={busy} onPress={() => { void rollback(batch); }} />}</Card>)}</Card>}
    <Notice message="Negative bank debits are imported as positive expense amounts. Unknown categories or accounts are skipped unless you choose defaults." />
    <AppButton label="Back" kind="secondary" onPress={() => router.back()} />
  </Screen>;
}
