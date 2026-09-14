// Rebuild the public application schema in a disposable database, never reset the active app database.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
const container = 'supabase_db_family-ledger-local';
const database = `familyledger_verify_${Date.now()}`;
if (!/^familyledger_verify_\d+$/.test(database)) throw new Error('Invalid disposable database name');
const sql = (db, input) => execFileSync('docker',['exec','-i',container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d',db],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']});
sql('postgres',`CREATE DATABASE ${database};`);
try {
  sql(database, `CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; CREATE EXTENSION pgtap;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, aud text, role text, email text, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,extensions,public TO anon,authenticated;`);
  const migrations=readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).sort();
  for(const migration of migrations) sql(database,readFileSync(`supabase/migrations/${migration}`,'utf8'));
  for(const test of readdirSync('supabase/tests/database').filter(name=>name.endsWith('.sql')).sort()) {
    const output=sql(database,readFileSync(`supabase/tests/database/${test}`,'utf8'));
    if(/not ok|Looks like you failed|Bad plan/i.test(output)) throw new Error(`${test}: ${output}`);
    console.log(`PASS fresh-schema ${test}`);
  }
  console.log(`PASS: ${migrations.length} ordered migrations on an empty application schema. Active local data untouched.`);
} finally {
  sql('postgres',`DROP DATABASE ${database};`);
}
