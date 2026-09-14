import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createClient } from '../apps/mobile/node_modules/@supabase/supabase-js/dist/index.mjs';
const email = process.argv[2];
assert.match(email ?? '', /^codex-(owner|member)-\d+@example\.test$/);
const statusResult = spawnSync('cmd.exe',['/d','/s','/c','node_modules\\.bin\\supabase.cmd status --output json'],{encoding:'utf8'});
assert.equal(statusResult.status,0);
const status = JSON.parse(statusResult.stdout.slice(statusResult.stdout.indexOf('{')));
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1');
const client = createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,flowType:'pkce'}});
const sent = await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:'familyledger:///auth-callback'}});
if(sent.error)throw sent.error;
let code;
for(let attempt=0;attempt<10;attempt++) {
  const inbox=await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
  const message=inbox.messages.find(message=>message.To.some(to=>to.Address===email));
  if(message) { const detail=await (await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json(); code=(detail.Text ?? '').match(/\b\d{6,10}\b/)?.[0]; if(code)break; }
  await new Promise(resolve=>setTimeout(resolve,500));
}
assert.ok(code,'Local email must contain a numeric verification code');
const verified=await client.auth.verifyOtp({email,token:code,type:'email'}); if(verified.error)throw verified.error;
assert.equal(verified.data.user.email,email);
console.log('PASS: email code sent to local inbox, template contains code, native-compatible PKCE client verifies code and obtains session.');
await client.auth.signOut();
