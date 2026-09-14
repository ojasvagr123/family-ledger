// Uses only the local Supabase stack. Credentials remain in memory.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { createClient } from '../apps/mobile/node_modules/@supabase/supabase-js/dist/index.mjs';
const result = spawnSync('cmd.exe', ['/d','/s','/c','node_modules\\.bin\\supabase.cmd status --output json'], { encoding: 'utf8' });
if (result.status !== 0) throw new Error('Local Supabase must be running.');
const status = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const owner = createClient(status.API_URL, status.ANON_KEY, options);
const member = createClient(status.API_URL, status.ANON_KEY, options);
const suffix = Date.now(); const ownerEmail = `codex-owner-${suffix}@example.test`; const memberEmail = `codex-member-${suffix}@example.test`;
async function identity(client, email) {
  const password = randomUUID() + 'Qa1!';
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: email.startsWith('codex-owner') ? 'Pilot Owner' : 'Pilot Member' } });
  if (created.error) throw created.error;
  const login = await client.auth.signInWithPassword({ email, password }); if (login.error) throw login.error;
  return created.data.user;
}
async function rpc(client,name,args) { const result = await client.rpc(name,args); if(result.error) throw new Error(`${name}: ${result.error.message}`); return result.data; }
const o = await identity(owner,ownerEmail); const m = await identity(member,memberEmail);
const family = await rpc(owner,'create_family',{p_name:`Pilot QA ${suffix}`,p_currency_code:'INR',p_timezone:'Asia/Kolkata',p_fiscal_start_month:1,p_reporting_start_year:2026,p_idempotency_key:randomUUID()});
const invite = await rpc(owner,'create_invitation',{p_family_id:family.id,p_expires_in_hours:72,p_max_uses:1,p_idempotency_key:randomUUID()});
assert.equal((await rpc(member,'inspect_invitation',{p_token:invite.token})).status,'VALID');
const join = await rpc(member,'request_join',{p_token:invite.token,p_idempotency_key:randomUUID()});
const denied = await member.rpc('monthly_report',{p_family_id:family.id,p_year:2026,p_month:9}); assert.equal(denied.error?.message,'FORBIDDEN');
await rpc(owner,'decide_join_request',{p_family_id:family.id,p_join_request_id:join.joinRequestId,p_decision:'APPROVED',p_idempotency_key:randomUUID()});
const account = await rpc(owner,'create_account',{p_family_id:family.id,p_name:'QA Cash',p_account_type:'CASH',p_opening_date:'2026-01-01',p_balance_minor:'10000',p_idempotency_key:randomUUID()});
const categories = await owner.from('categories').select('id,type').eq('family_id',family.id); if(categories.error) throw categories.error;
async function transaction(client,type,amount) { return rpc(client,'save_transaction',{p_family_id:family.id,p_transaction_id:null,p_expected_version:null,p_type:type,p_local_date:'2026-09-13',p_amount_minor:amount,p_account_id:account.id,p_category_id:categories.data.find(c=>c.type===type).id,p_description:`QA ${type}`,p_remarks:'',p_idempotency_key:randomUUID()}); }
const income = await transaction(owner,'INCOME','100000'); await transaction(member,'EXPENSE','25000');
const detail = await owner.from('transactions').select('id,amount_minor::text').eq('id',income.id).single(); if(detail.error)throw detail.error; assert.equal(detail.data.amount_minor,'100000');
const report = await rpc(member,'monthly_report',{p_family_id:family.id,p_year:2026,p_month:9}); assert.equal(report.net_minor,'75000'); assert.equal(report.savings_rate,75);
const accounts = await rpc(member,'list_accounts',{p_family_id:family.id}); assert.equal(accounts[0].balance_minor,'85000');
const forbiddenEdit = await member.rpc('set_transaction_deleted',{p_family_id:family.id,p_transaction_id:income.id,p_expected_version:1,p_deleted:true,p_idempotency_key:randomUUID()}); assert.equal(forbiddenEdit.error?.message,'FORBIDDEN');
console.log('PASS: real Auth sessions, invite/request/approval, pending denial, income/expense, bigint REST detail, totals, member permissions.');
console.log(`QA family: ${family.name}. Owner: ${ownerEmail}. Member: ${memberEmail}.`);
if (process.argv.includes('--open-android')) {
  const link = await admin.auth.admin.generateLink({ type:'magiclink', email:ownerEmail }); if(link.error)throw link.error;
  const adb = 'C:\\Users\\lenovo\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
  execFileSync(adb,['shell','am','start','-n','com.familyledger.app/.MainActivity','-a','android.intent.action.VIEW','-d',`familyledger:///auth-callback?token_hash=${link.data.properties.hashed_token}\&type=email`],{stdio:'ignore'});
  console.log('Opened QA Owner session on Android; no credentials logged.');
}
