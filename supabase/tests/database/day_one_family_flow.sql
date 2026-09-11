begin;

select plan(15);

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'owner@example.test', '{}', '{"display_name":"Test Owner"}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'member@example.test', '{}', '{"display_name":"Test Member"}', now(), now());

select is((select count(*) from public.profiles where user_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'))::bigint, 2::bigint, 'auth trigger creates both profiles');

create temporary table test_state(family_id uuid, invitation_id uuid, token text, join_request_id uuid);
grant all on test_state to authenticated;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;

insert into test_state(family_id)
select (public.create_family('Flow Test Family', 'INR', 'Asia/Kolkata', 1::smallint, 2026::smallint, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)->>'id')::uuid;

select is(
  (public.create_family('Flow Test Family', 'INR', 'Asia/Kolkata', 1::smallint, 2026::smallint, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)->>'id')::uuid,
  (select family_id from test_state),
  'create_family retry returns the original family'
);
select is((select count(*) from public.families)::bigint, 1::bigint, 'idempotent retry creates one family');
select is((select count(*) from public.family_members where role = 'OWNER' and status = 'ACTIVE')::bigint, 1::bigint, 'creator is the single active Owner');
select is((select count(*) from public.categories)::bigint, 16::bigint, 'family creation seeds sixteen default categories');

update test_state set invitation_id = (payload->>'invitationId')::uuid, token = payload->>'token'
from (select public.create_invitation((select family_id from test_state), 72, 1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid) payload) created;
select ok((select length(token) >= 32 from test_state), 'invitation returns one strong raw token');

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select is((select count(*) from public.families)::bigint, 0::bigint, 'outsider cannot read the family');

update test_state set join_request_id = (payload->>'joinRequestId')::uuid
from (select public.request_join((select token from test_state), 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid) payload) joined;
select is((select status::text from public.list_my_families()), 'PENDING', 'join request creates a pending membership');
select is((select count(*) from public.families)::bigint, 0::bigint, 'pending member still cannot read family data');
select ok(not public.is_active_member((select family_id from test_state)), 'pending member is not active');

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
select is((select count(*) from public.list_pending_join_requests((select family_id from test_state)))::bigint, 1::bigint, 'Owner sees one pending request');
select is(
  public.decide_join_request((select family_id from test_state), (select join_request_id from test_state), 'APPROVED'::public.join_request_status, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid)->>'status',
  'APPROVED',
  'Owner can approve the request'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select ok(public.is_active_member((select family_id from test_state)), 'approved member becomes active');
select is((select count(*) from public.families)::bigint, 1::bigint, 'approved member can read the family');
select throws_ok(
  format('select public.create_invitation(%L::uuid, 72, 1, %L::uuid)', (select family_id from test_state), 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'P0001',
  'FORBIDDEN',
  'Member cannot create invitations'
);

select * from finish();
rollback;
