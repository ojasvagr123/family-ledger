import { requireSupabase } from './client';
import type { Database } from '@family-ledger/contracts';

export type Category = Pick<Database['public']['Tables']['categories']['Row'], 'id' | 'name' | 'type'>;
export type Account = { id: string; name: string; account_type: string; opening_date: string; beginning_balance_minor: string; balance_minor: string };
export type Transaction = { id: string; family_id: string; type: 'INCOME' | 'EXPENSE'; local_date: string; amount_minor: string; account_id: string; category_id: string; description: string; remarks: string; created_by: string; version: number; deleted_at: string | null; account_name?: string; category_name?: string };
export type MonthlyReport = { start: string; end: string; income_minor: string; expense_minor: string; net_minor: string; expense_to_income: number | null; savings_rate: number | null; categories: { id: string; name: string; type: string; total_minor: string; percentage: number }[] };
export type Filters = { start?: string; end?: string; type?: string; accountId?: string; categoryId?: string; memberId?: string };
export async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().rpc(name, args);
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No response received. Please retry.');
  return data as T;
}
export async function listCategories(familyId: string): Promise<Category[]> {
  const { data, error } = await requireSupabase().from('categories').select('id,name,type').eq('family_id', familyId).is('archived_at', null).order('sort_order');
  if (error) throw new Error(error.message);
  return data as Category[];
}
export const listAccounts = (familyId: string) => rpc<Account[]>('list_accounts', { p_family_id: familyId });
export const monthlyReport = (familyId: string, year: number, month: number) => rpc<MonthlyReport>('monthly_report', { p_family_id: familyId, p_year: year, p_month: month });
export const listTransactions = (familyId: string, filters: Filters = {}, cursor?: Transaction) => rpc<Transaction[]>('list_transactions', { p_family_id: familyId, p_start: filters.start || null, p_end: filters.end || null, p_type: filters.type || null, p_account_id: filters.accountId || null, p_category_id: filters.categoryId || null, p_member_id: filters.memberId || null, p_cursor_date: cursor?.local_date ?? null, p_cursor_id: cursor?.id ?? null, p_limit: 30 });
export async function getTransaction(familyId: string, id: string): Promise<Transaction> {
  // Cast bigint to text in PostgREST so precision is preserved.
  const { data, error } = await requireSupabase().from('transactions').select('id,family_id,type,local_date,amount_minor::text,account_id,category_id,description,remarks,created_by,version,deleted_at').eq('family_id', familyId).eq('id', id).single();
  if (error) throw new Error(error.message);
  return data as unknown as Transaction;
}
