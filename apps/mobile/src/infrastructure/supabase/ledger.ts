import { requireSupabase } from './client';
import type { Database } from '@family-ledger/contracts';

export type Category = Pick<Database['public']['Tables']['categories']['Row'], 'id' | 'name' | 'type' | 'sort_order' | 'archived_at'> & { color?: string | null };
export type Account = { id: string; name: string; account_type: string; opening_date: string; beginning_balance_minor: string; balance_minor: string; institution?: string | null; sort_order?: number; display_credit_as_positive?: boolean; total_deposits_minor?: string; total_withdrawals_minor?: string; total_adjustments_minor?: string; actual_balance_minor?: string | null; last_checked_date?: string | null; archived_at?: string | null };
export type Transaction = { id: string; family_id: string; type: 'INCOME' | 'EXPENSE' | 'ADJUSTMENT'; local_date: string; amount_minor: string; account_id: string; category_id: string | null; description: string; remarks: string; created_by: string; paid_by_user_id?: string | null; received_by_user_id?: string | null; transfer_group_id?: string | null; version: number; deleted_at: string | null; account_name?: string; category_name?: string; creator_name?: string };
export type MonthlyReport = { start: string; end: string; income_minor: string; expense_minor: string; net_minor: string; expense_to_income: number | null; savings_rate: number | null; categories: { id: string; name: string; type: string; total_minor: string; percentage: number | null }[] };
export type ReportMonth = { label: string; start: string; income_minor: string; expense_minor: string; net_minor: string };
export type AnnualCategory = { id: string; name: string; total_minor: string; average_minor: string; percentage: number | null; months: { start: string; total_minor: string }[] };
export type AnnualReport = { year: number; start: string; end: string; income_minor: string; expense_minor: string; net_minor: string; average_income_minor: string; average_expense_minor: string; average_net_minor: string; expense_to_income: number | null; savings_rate: number | null; months: ReportMonth[]; income_categories: AnnualCategory[]; expense_categories: AnnualCategory[] };
export type CustomReport = { start: string; end: string; income_minor: string; expense_minor: string; net_minor: string; expense_to_income: number | null; savings_rate: number | null; categories: { id: string; name: string; type: string; total_minor: string; percentage: number | null }[] };
export type TransactionSort = 'NEWEST' | 'OLDEST' | 'HIGHEST_AMOUNT' | 'LOWEST_AMOUNT' | 'CATEGORY' | 'ACCOUNT';
export type Filters = { start?: string; end?: string; type?: string; accountId?: string; categoryId?: string; memberId?: string; search?: string; minAmountMinor?: string; maxAmountMinor?: string; deletedStatus?: 'ACTIVE' | 'DELETED' | 'ALL'; sort?: TransactionSort };
export async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().rpc(name, args);
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No response received. Please retry.');
  return data as T;
}
export async function listCategories(familyId: string): Promise<Category[]> {
  const { data, error } = await requireSupabase().from('categories').select('id,name,type,sort_order,archived_at,color').eq('family_id', familyId).is('archived_at', null).order('sort_order');
  if (error) throw new Error(error.message);
  return data as Category[];
}
export async function listManagedCategories(familyId: string): Promise<Category[]> {
  const { data, error } = await requireSupabase().from('categories').select('id,name,type,sort_order,archived_at,color').eq('family_id', familyId).order('sort_order');
  if (error) throw new Error(error.message);
  return data as Category[];
}
const sortAccounts = (items: Account[]) => items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
export const listAccounts = async (familyId: string) => sortAccounts(await rpc<Account[]>('list_accounts', { p_family_id: familyId }));
export const listAccountsForManagement = async (familyId: string) => sortAccounts(await rpc<Account[]>('list_accounts_for_management', { p_family_id: familyId }));
export const monthlyReport = (familyId: string, year: number, month: number) => rpc<MonthlyReport>('monthly_report', { p_family_id: familyId, p_year: year, p_month: month });
export const annualReport = (familyId: string, year: number) => rpc<AnnualReport>('annual_report', { p_family_id: familyId, p_year: year });
export const customReport = (familyId: string, start: string, end: string) => rpc<CustomReport>('custom_report', { p_family_id: familyId, p_start: start, p_end: end });
export const listTransactions = (familyId: string, filters: Filters = {}, cursor?: Transaction) => rpc<Transaction[]>('list_transactions', { p_family_id: familyId, p_start: filters.start || null, p_end: filters.end || null, p_type: filters.type || null, p_account_id: filters.accountId || null, p_category_id: filters.categoryId || null, p_member_id: filters.memberId || null, p_cursor_date: cursor?.local_date ?? null, p_cursor_id: cursor?.id ?? null, p_limit: 30 });
const searchArgs = (familyId: string, filters: Filters, offset: number, limit: number) => ({ p_family_id: familyId, p_start: filters.start || null, p_end: filters.end || null, p_type: filters.type || null, p_account_id: filters.accountId || null, p_category_id: filters.categoryId || null, p_member_id: filters.memberId || null, p_search: filters.search?.trim() || null, p_min_amount_minor: filters.minAmountMinor || null, p_max_amount_minor: filters.maxAmountMinor || null, p_deleted_status: filters.deletedStatus ?? 'ACTIVE', p_sort: filters.sort ?? 'NEWEST', p_offset: offset, p_limit: limit });
export const searchTransactions = (familyId: string, filters: Filters = {}, offset = 0) => rpc<Transaction[]>('search_transactions_v2', searchArgs(familyId, filters, offset, 30));
export async function exportTransactions(familyId: string, filters: Filters = {}): Promise<Transaction[]> {
  const rows: Transaction[] = []; const pageSize = 100;
  for (let offset = 0; offset < 10_000; offset += pageSize) { const page = await rpc<Transaction[]>('search_transactions_v2', searchArgs(familyId, filters, offset, pageSize)); rows.push(...page); if (page.length < pageSize) break; }
  return rows;
}
export const listDeletedTransactions = (familyId: string) => rpc<Transaction[]>('list_deleted_transactions', { p_family_id: familyId, p_limit: 100 });
export async function getTransaction(familyId: string, id: string): Promise<Transaction> {
  // Cast bigint to text in PostgREST so precision is preserved.
  const { data, error } = await requireSupabase().from('transactions').select('id,family_id,type,local_date,amount_minor::text,account_id,category_id,description,remarks,created_by,version,deleted_at').eq('family_id', familyId).eq('id', id).single();
  if (error) throw new Error(error.message);
  return data as unknown as Transaction;
}
