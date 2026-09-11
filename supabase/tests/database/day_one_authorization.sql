begin;

select plan(14);

select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'families'), 'families has RLS policy');
select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions'), 'transactions has RLS policy');
select ok(not has_table_privilege('anon', 'public.audit_events', 'SELECT'), 'anonymous users cannot read audit events');
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'INSERT'), 'clients cannot insert audit events');
select ok(not has_table_privilege('authenticated', 'public.family_members', 'INSERT'), 'clients cannot insert memberships');
select ok(not has_table_privilege('authenticated', 'public.family_members', 'UPDATE'), 'clients cannot update memberships');
select ok(not has_table_privilege('authenticated', 'public.families', 'INSERT'), 'clients cannot insert families directly');
select ok(not has_table_privilege('authenticated', 'public.invitations', 'SELECT'), 'clients cannot enumerate invitation hashes');
select ok(not has_table_privilege('authenticated', 'public.invitations', 'INSERT'), 'clients cannot insert invitations directly');
select ok(not has_table_privilege('authenticated', 'public.join_requests', 'INSERT'), 'clients cannot insert join requests directly');
select ok(not has_table_privilege('authenticated', 'public.transactions', 'INSERT'), 'Day 1 clients cannot bypass transaction RPCs');
select ok(has_function_privilege('authenticated', 'public.create_family(text,text,text,smallint,smallint,uuid)', 'EXECUTE'), 'authenticated users can call create_family');
select ok(has_function_privilege('authenticated', 'public.request_join(text,uuid)', 'EXECUTE'), 'authenticated users can request to join');
select ok(not has_function_privilege('anon', 'public.request_join(text,uuid)', 'EXECUTE'), 'anonymous users cannot request to join');

select * from finish();
rollback;
