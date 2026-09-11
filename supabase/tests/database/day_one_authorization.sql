-- Run after `supabase db reset` with `supabase test db` or psql.
begin;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'families') then
    raise exception 'families must have an RLS policy';
  end if;
  if not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions') then
    raise exception 'transactions must have an RLS policy';
  end if;
  if has_table_privilege('anon', 'public.audit_events', 'SELECT') then
    raise exception 'anon can read audit events';
  end if;
  if has_table_privilege('authenticated', 'public.audit_events', 'INSERT') then
    raise exception 'authenticated can insert audit events directly';
  end if;
  if has_table_privilege('authenticated', 'public.family_members', 'INSERT') then
    raise exception 'authenticated can insert memberships directly';
  end if;
  if has_table_privilege('authenticated', 'public.invitations', 'SELECT') then
    raise exception 'authenticated can enumerate invitation hashes';
  end if;
end;
$$;

rollback;
