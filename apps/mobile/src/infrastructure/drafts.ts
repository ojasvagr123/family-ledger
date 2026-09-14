import * as SQLite from 'expo-sqlite';
let database: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  database ??= SQLite.openDatabaseAsync('family-ledger-drafts.db').then(async (value) => { await value.execAsync('CREATE TABLE IF NOT EXISTS drafts (user_id TEXT NOT NULL, family_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(user_id,family_id));'); return value; });
  return database;
}
export type Draft = { type: 'INCOME' | 'EXPENSE'; date: string; amount: string; account: string; category: string; description: string; remarks: string; key: string };
export async function saveDraft(userId: string, familyId: string, draft: Draft) { await (await db()).runAsync('INSERT OR REPLACE INTO drafts (user_id,family_id,payload) VALUES (?,?,?)', userId, familyId, JSON.stringify(draft)); }
export async function loadDraft(userId: string, familyId: string): Promise<Draft | null> { const row = await (await db()).getFirstAsync<{ payload: string }>('SELECT payload FROM drafts WHERE user_id=? AND family_id=?', userId, familyId); return row ? JSON.parse(row.payload) : null; }
export async function deleteDraft(userId: string, familyId: string) { await (await db()).runAsync('DELETE FROM drafts WHERE user_id=? AND family_id=?', userId, familyId); }
export async function clearDrafts() { await (await db()).runAsync('DELETE FROM drafts'); }
export async function pruneDrafts(userId: string, allowedFamilies: string[]) {
  const rows = await (await db()).getAllAsync<{ user_id: string; family_id: string }>('SELECT user_id,family_id FROM drafts');
  for (const row of rows) if (row.user_id !== userId || !allowedFamilies.includes(row.family_id)) await deleteDraft(row.user_id, row.family_id);
}
