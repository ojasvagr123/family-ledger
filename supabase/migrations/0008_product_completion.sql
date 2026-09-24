-- Product-completion foundation: richer profiles, family lifecycle, household notes,
-- atomic transfers, notifications, account/category metadata, and import provenance.

alter table public.profiles add column if not exists avatar_url text;

alter table public.families add column if not exists notes text not null default '';
alter table public.families add column if not exists notes_updated_by uuid references auth.users(id);
alter table public.families add column if not exists notes_updated_at timestamptz;

alter table public.categories add column if not exists color text;
alter table public.categories drop constraint if exists categories_color_check;
alter table public.categories add constraint categories_color_check check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.accounts add column if not exists institution text;
alter table public.accounts add column if not exists sort_order integer not null default 0;
alter table public.accounts add column if not exists display_credit_as_positive boolean not null default false;
alter table public.accounts drop constraint if exists accounts_account_type_check;
alter table public.accounts add constraint accounts_account_type_check
  check (account_type in ('CASH','BANK','SAVINGS','CURRENT','CREDIT_CARD','WALLET','EWALLET','INVESTMENT','LOAN','OTHER'));

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  filename text not null check (char_length(trim(filename)) between 1 and 240),
  file_sha256 text,
  mapping jsonb not null default '{}'::jsonb,
  status text not null default 'IMPORTING' check (status in ('IMPORTING','COMPLETED','CANCELLED','ROLLED_BACK','FAILED')),
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  skipped_rows integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  rolled_back_at timestamptz,
  unique (family_id, id)
);

alter table public.transactions add column if not exists transfer_group_id uuid;
alter table public.transactions add column if not exists paid_by_user_id uuid references auth.users(id);
alter table public.transactions add column if not exists received_by_user_id uuid references auth.users(id);
alter table public.transactions add column if not exists import_batch_id uuid;
alter table public.transactions add column if not exists import_row_number integer;
alter table public.transactions add column if not exists import_fingerprint text;
alter table public.transactions drop constraint if exists transactions_import_batch_fk;
alter table public.transactions add constraint transactions_import_batch_fk
  foreign key (family_id, import_batch_id) references public.import_batches(family_id, id);
create unique index if not exists transactions_import_fingerprint_unique
  on public.transactions(family_id, import_fingerprint)
  where import_fingerprint is not null and deleted_at is null;
create index if not exists transactions_transfer_group on public.transactions(family_id, transfer_group_id)
  where transfer_group_id is not null;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null default '',
  route text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.account_reconciliations (
  id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade,
  account_id uuid not null, checked_on date not null, expected_balance_minor bigint not null, actual_balance_minor bigint not null,
  difference_minor bigint not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  foreign key (family_id,account_id) references public.accounts(family_id,id), unique(family_id,id)
);
create index if not exists notifications_recipient_unread
  on public.notifications(recipient_user_id, created_at desc) where read_at is null;

do $$
declare v_table text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach v_table in array array['transactions','accounts','categories','family_members','join_requests','notifications'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then execute format('alter publication supabase_realtime add table public.%I',v_table); end if;
    end loop;
  end if;
end; $$;

alter table public.import_batches enable row level security;
alter table public.notifications enable row level security;
alter table public.account_reconciliations enable row level security;
drop policy if exists import_batches_select on public.import_batches;
create policy import_batches_select on public.import_batches for select to authenticated
  using (public.is_active_member(family_id));
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (recipient_user_id=auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_user_id=auth.uid()) with check (recipient_user_id=auth.uid());
drop policy if exists account_reconciliations_select on public.account_reconciliations;
create policy account_reconciliations_select on public.account_reconciliations for select to authenticated using(public.is_active_member(family_id));

revoke all on public.import_batches, public.notifications, public.account_reconciliations from public,anon,authenticated;
grant select on public.import_batches to authenticated;
grant select,update(read_at) on public.notifications to authenticated;
grant select on public.account_reconciliations to authenticated;

create or replace function public.capture_account_reconciliation()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_expected bigint;
begin
  if new.actual_balance_minor is null or new.last_checked_date is null or (new.actual_balance_minor is not distinct from old.actual_balance_minor and new.last_checked_date is not distinct from old.last_checked_date) then return new; end if;
  select new.beginning_balance_minor+coalesce(sum(case when t.type='EXPENSE' then -t.amount_minor else t.amount_minor end),0) into v_expected from public.transactions t where t.family_id=new.family_id and t.account_id=new.id and t.deleted_at is null;
  insert into public.account_reconciliations(family_id,account_id,checked_on,expected_balance_minor,actual_balance_minor,difference_minor,created_by) values(new.family_id,new.id,new.last_checked_date,v_expected,new.actual_balance_minor,new.actual_balance_minor-v_expected,auth.uid());
  return new;
end; $$;
drop trigger if exists account_reconciliation_history on public.accounts;
create trigger account_reconciliation_history after update of actual_balance_minor,last_checked_date on public.accounts for each row execute function public.capture_account_reconciliation();

create or replace function public.get_my_profile()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  return (select jsonb_build_object('user_id',user_id,'display_name',display_name,'avatar_url',avatar_url,'locale',locale,'timezone',timezone,'updated_at',updated_at) from public.profiles where user_id=auth.uid());
end; $$;

create or replace function public.update_my_profile(p_display_name text,p_avatar_url text,p_locale text,p_timezone text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_row public.profiles; v_result jsonb;
begin
  if char_length(trim(coalesce(p_display_name,''))) not between 1 and 80 or char_length(trim(coalesce(p_locale,''))) not between 2 and 20 or char_length(trim(coalesce(p_timezone,''))) not between 1 and 100 then raise exception 'VALIDATION_FAILED'; end if;
  if p_avatar_url is not null and char_length(p_avatar_url)>500 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved:=public.begin_idempotent('update_my_profile',p_idempotency_key,jsonb_build_array(trim(p_display_name),nullif(trim(p_avatar_url),''),trim(p_locale),trim(p_timezone)));
  if v_saved is not null then return v_saved; end if;
  update public.profiles set display_name=trim(p_display_name),avatar_url=nullif(trim(p_avatar_url),''),locale=trim(p_locale),timezone=trim(p_timezone),updated_at=now() where user_id=auth.uid() returning * into v_row;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_result:=jsonb_build_object('user_id',v_row.user_id,'display_name',v_row.display_name,'avatar_url',v_row.avatar_url,'locale',v_row.locale,'timezone',v_row.timezone,'updated_at',v_row.updated_at);
  perform public.finish_idempotent('update_my_profile',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.get_family_notes(p_family_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return (select jsonb_build_object('notes',notes,'updated_by',notes_updated_by,'updated_at',notes_updated_at,'version',version) from public.families where id=p_family_id);
end; $$;

create or replace function public.update_family_notes(p_family_id uuid,p_notes text,p_expected_version integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_row public.families; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if char_length(coalesce(p_notes,''))>8000 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved:=public.begin_idempotent('update_family_notes',p_idempotency_key,jsonb_build_array(p_family_id,p_notes,p_expected_version)); if v_saved is not null then return v_saved; end if;
  select * into v_row from public.families where id=p_family_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_row.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  update public.families set notes=coalesce(p_notes,''),notes_updated_by=auth.uid(),notes_updated_at=now(),version=version+1,updated_at=now() where id=p_family_id returning * into v_row;
  v_result:=jsonb_build_object('notes',v_row.notes,'updated_by',v_row.notes_updated_by,'updated_at',v_row.notes_updated_at,'version',v_row.version);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id) values(p_family_id,auth.uid(),'FAMILY_NOTES_UPDATED','family',p_family_id,jsonb_build_object('length',char_length(v_row.notes)),p_idempotency_key);
  perform public.finish_idempotent('update_family_notes',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.transfer_family_ownership(p_family_id uuid,p_new_owner_user_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_member public.family_members; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_new_owner_user_id=auth.uid() then raise exception 'ALREADY_OWNER'; end if;
  v_saved:=public.begin_idempotent('transfer_family_ownership',p_idempotency_key,jsonb_build_array(p_family_id,p_new_owner_user_id)); if v_saved is not null then return v_saved; end if;
  perform 1 from public.families where id=p_family_id for update;
  select * into v_member from public.family_members where family_id=p_family_id and user_id=p_new_owner_user_id and status='ACTIVE' for update;
  if not found then raise exception 'MEMBER_NOT_ACTIVE'; end if;
  update public.family_members set role='ADMIN',updated_at=now() where family_id=p_family_id and user_id=auth.uid() and role='OWNER';
  update public.family_members set role='OWNER',updated_at=now() where id=v_member.id;
  update public.families set owner_user_id=p_new_owner_user_id,version=version+1,updated_at=now() where id=p_family_id;
  v_result:=jsonb_build_object('owner_user_id',p_new_owner_user_id,'previous_owner_user_id',auth.uid());
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id) values(p_family_id,auth.uid(),'OWNERSHIP_TRANSFERRED','family',p_family_id,v_result,p_idempotency_key);
  insert into public.notifications(family_id,recipient_user_id,event_type,title,body,route) values(p_family_id,p_new_owner_user_id,'OWNERSHIP_TRANSFERRED','You are now the family Owner','Ownership was transferred to you.','/family/members');
  perform public.finish_idempotent('transfer_family_ownership',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.leave_family(p_family_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_member public.family_members; v_result jsonb;
begin
  select * into v_member from public.family_members where family_id=p_family_id and user_id=auth.uid() and status='ACTIVE' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_member.role='OWNER' then raise exception 'TRANSFER_OWNERSHIP_FIRST'; end if;
  v_saved:=public.begin_idempotent('leave_family',p_idempotency_key,jsonb_build_array(p_family_id)); if v_saved is not null then return v_saved; end if;
  update public.family_members set status='LEFT',updated_at=now() where id=v_member.id;
  v_result:=jsonb_build_object('left',true,'family_id',p_family_id);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,request_id) values(p_family_id,auth.uid(),'MEMBER_LEFT','member',auth.uid(),p_idempotency_key);
  perform public.finish_idempotent('leave_family',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.set_family_member_status(p_family_id uuid,p_user_id uuid,p_status public.member_status,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor public.family_members; v_target public.family_members; v_saved jsonb; v_result jsonb;
begin
  select * into v_actor from public.family_members where family_id=p_family_id and user_id=auth.uid() and status='ACTIVE';
  if not found or v_actor.role not in ('OWNER','ADMIN') then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('ACTIVE','SUSPENDED','REMOVED') then raise exception 'VALIDATION_FAILED'; end if;
  select * into v_target from public.family_members where family_id=p_family_id and user_id=p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_target.role='OWNER' or p_user_id=auth.uid() or (v_actor.role='ADMIN' and v_target.role='ADMIN') then raise exception 'PROTECTED_MEMBER'; end if;
  v_saved:=public.begin_idempotent('set_family_member_status',p_idempotency_key,jsonb_build_array(p_family_id,p_user_id,p_status)); if v_saved is not null then return v_saved; end if;
  update public.family_members set status=p_status,updated_at=now() where id=v_target.id;
  v_result:=jsonb_build_object('user_id',p_user_id,'status',p_status);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id) values(p_family_id,auth.uid(),'MEMBER_STATUS_CHANGED','member',p_user_id,jsonb_build_object('status',v_target.status),v_result,p_idempotency_key);
  insert into public.notifications(family_id,recipient_user_id,event_type,title,body) values(p_family_id,p_user_id,'MEMBER_STATUS_CHANGED','Family access changed','Your membership status is now '||p_status::text||'.');
  perform public.finish_idempotent('set_family_member_status',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.create_account_transfer(p_family_id uuid,p_from_account_id uuid,p_to_account_id uuid,p_local_date date,p_amount_minor text,p_description text,p_remarks text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_amount bigint; v_group uuid:=gen_random_uuid(); v_out uuid; v_in uuid; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN','MEMBER']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_from_account_id=p_to_account_id or p_local_date is null or p_amount_minor !~ '^[0-9]{1,15}$' then raise exception 'VALIDATION_FAILED'; end if;
  v_amount:=p_amount_minor::bigint; if v_amount<=0 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved:=public.begin_idempotent('create_account_transfer',p_idempotency_key,jsonb_build_array(p_family_id,p_from_account_id,p_to_account_id,p_local_date,p_amount_minor,p_description,p_remarks)); if v_saved is not null then return v_saved; end if;
  perform 1 from public.accounts where family_id=p_family_id and id in (p_from_account_id,p_to_account_id) and archived_at is null and opening_date<=p_local_date for share;
  if (select count(*) from public.accounts where family_id=p_family_id and id in (p_from_account_id,p_to_account_id) and archived_at is null and opening_date<=p_local_date)<>2 then raise exception 'ACCOUNT_INVALID'; end if;
  insert into public.transactions(family_id,type,local_date,amount_minor,account_id,description,remarks,created_by,updated_by,transfer_group_id) values(p_family_id,'ADJUSTMENT',p_local_date,-v_amount,p_from_account_id,coalesce(nullif(trim(p_description),''),'Transfer out'),coalesce(p_remarks,''),auth.uid(),auth.uid(),v_group) returning id into v_out;
  insert into public.transactions(family_id,type,local_date,amount_minor,account_id,description,remarks,created_by,updated_by,transfer_group_id) values(p_family_id,'ADJUSTMENT',p_local_date,v_amount,p_to_account_id,coalesce(nullif(trim(p_description),''),'Transfer in'),coalesce(p_remarks,''),auth.uid(),auth.uid(),v_group) returning id into v_in;
  v_result:=jsonb_build_object('transfer_group_id',v_group,'out_transaction_id',v_out,'in_transaction_id',v_in);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id) values(p_family_id,auth.uid(),'ACCOUNT_TRANSFER_CREATED','transfer',v_group,v_result,p_idempotency_key);
  perform public.finish_idempotent('create_account_transfer',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.save_transaction_v2(p_family_id uuid,p_transaction_id uuid,p_expected_version integer,p_type public.transaction_type,p_local_date date,p_amount_minor text,p_account_id uuid,p_category_id uuid,p_related_user_id uuid,p_description text,p_remarks text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_result jsonb; v_id uuid; v_row public.transactions;
begin
  if p_related_user_id is not null and not exists(select 1 from public.family_members where family_id=p_family_id and user_id=p_related_user_id and status='ACTIVE') then raise exception 'MEMBER_INVALID'; end if;
  v_saved:=public.begin_idempotent('save_transaction_v2',p_idempotency_key,jsonb_build_array(p_family_id,p_transaction_id,p_expected_version,p_type,p_local_date,p_amount_minor,p_account_id,p_category_id,p_related_user_id,p_description,p_remarks)); if v_saved is not null then return v_saved; end if;
  v_result:=public.save_transaction(p_family_id,p_transaction_id,p_expected_version,p_type,p_local_date,p_amount_minor,p_account_id,p_category_id,p_description,p_remarks,p_idempotency_key); v_id:=(v_result->>'id')::uuid;
  update public.transactions set paid_by_user_id=case when p_type='EXPENSE' then coalesce(p_related_user_id,auth.uid()) else null end,received_by_user_id=case when p_type='INCOME' then coalesce(p_related_user_id,auth.uid()) else null end where id=v_id returning * into v_row;
  v_result:=public.ledger_json(v_row); perform public.finish_idempotent('save_transaction_v2',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.create_account_extended(p_family_id uuid,p_name text,p_account_type text,p_opening_date date,p_balance_minor text,p_institution text,p_sort_order integer,p_display_credit_as_positive boolean,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_row public.accounts; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 80 or p_account_type not in ('CASH','BANK','SAVINGS','CURRENT','CREDIT_CARD','WALLET','EWALLET','INVESTMENT','LOAN','OTHER') or p_opening_date is null or p_balance_minor !~ '^-?[0-9]{1,15}$' or char_length(coalesce(p_institution,''))>120 or coalesce(p_sort_order,0)<0 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved:=public.begin_idempotent('create_account_extended',p_idempotency_key,jsonb_build_array(p_family_id,trim(p_name),p_account_type,p_opening_date,p_balance_minor,p_institution,p_sort_order,p_display_credit_as_positive)); if v_saved is not null then return v_saved; end if;
  insert into public.accounts(family_id,name,account_type,opening_date,beginning_balance_minor,institution,sort_order,display_credit_as_positive,created_by) values(p_family_id,trim(p_name),p_account_type,p_opening_date,p_balance_minor::bigint,nullif(trim(p_institution),''),coalesce(p_sort_order,0),coalesce(p_display_credit_as_positive,false),auth.uid()) returning * into v_row;
  v_result:=to_jsonb(v_row)||jsonb_build_object('beginning_balance_minor',v_row.beginning_balance_minor::text);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id) values(p_family_id,auth.uid(),'ACCOUNT_CREATED','account',v_row.id,v_result,p_idempotency_key);
  perform public.finish_idempotent('create_account_extended',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.create_category_extended(p_family_id uuid,p_type public.category_type,p_name text,p_color text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_row public.categories; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_type is null or char_length(trim(coalesce(p_name,''))) not between 1 and 80 or (p_color is not null and trim(p_color)<>'' and trim(p_color)!~'^#[0-9A-Fa-f]{6}$') then raise exception 'VALIDATION_FAILED'; end if;
  v_saved:=public.begin_idempotent('create_category_extended',p_idempotency_key,jsonb_build_array(p_family_id,p_type,trim(p_name),p_color)); if v_saved is not null then return v_saved; end if;
  insert into public.categories(family_id,type,name,color,sort_order,created_by) select p_family_id,p_type,trim(p_name),nullif(trim(p_color),''),coalesce(max(sort_order),0)+1,auth.uid() from public.categories where family_id=p_family_id and type=p_type returning * into v_row;
  v_result:=to_jsonb(v_row); insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id) values(p_family_id,auth.uid(),'CATEGORY_CREATED','category',v_row.id,v_result,p_idempotency_key); perform public.finish_idempotent('create_category_extended',p_idempotency_key,v_result); return v_result;
exception when unique_violation then raise exception 'CATEGORY_ALREADY_EXISTS'; end; $$;

create or replace function public.update_category_extended(p_family_id uuid,p_category_id uuid,p_name text,p_sort_order integer,p_color text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_row public.categories; v_before jsonb; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 80 or p_sort_order<0 or (p_color is not null and trim(p_color)<>'' and trim(p_color)!~'^#[0-9A-Fa-f]{6}$') then raise exception 'VALIDATION_FAILED'; end if;
  v_saved:=public.begin_idempotent('update_category_extended',p_idempotency_key,jsonb_build_array(p_family_id,p_category_id,p_name,p_sort_order,p_color)); if v_saved is not null then return v_saved; end if;
  select * into v_row from public.categories where family_id=p_family_id and id=p_category_id for update; if not found then raise exception 'NOT_FOUND'; end if; v_before:=to_jsonb(v_row);
  update public.categories set name=trim(p_name),sort_order=p_sort_order,color=nullif(trim(p_color),''),updated_at=now() where id=p_category_id returning * into v_row;
  v_result:=to_jsonb(v_row); insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id) values(p_family_id,auth.uid(),'CATEGORY_UPDATED','category',v_row.id,v_before,v_result,p_idempotency_key); perform public.finish_idempotent('update_category_extended',p_idempotency_key,v_result); return v_result;
exception when unique_violation then raise exception 'CATEGORY_ALREADY_EXISTS'; end; $$;

create or replace function public.delete_unused_category(p_family_id uuid,p_category_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_row public.categories; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  v_saved:=public.begin_idempotent('delete_unused_category',p_idempotency_key,jsonb_build_array(p_family_id,p_category_id)); if v_saved is not null then return v_saved; end if;
  select * into v_row from public.categories where family_id=p_family_id and id=p_category_id for update; if not found then raise exception 'NOT_FOUND'; end if;
  if exists(select 1 from public.transactions where family_id=p_family_id and category_id=p_category_id) then raise exception 'CATEGORY_IN_USE'; end if;
  delete from public.categories where id=p_category_id; v_result:=jsonb_build_object('deleted',true,'id',p_category_id); insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id) values(p_family_id,auth.uid(),'CATEGORY_DELETED','category',p_category_id,to_jsonb(v_row),v_result,p_idempotency_key); perform public.finish_idempotent('delete_unused_category',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.merge_categories(p_family_id uuid,p_source_category_id uuid,p_target_category_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_source public.categories; v_target public.categories; v_count integer; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_source_category_id=p_target_category_id then raise exception 'VALIDATION_FAILED'; end if;
  v_saved:=public.begin_idempotent('merge_categories',p_idempotency_key,jsonb_build_array(p_family_id,p_source_category_id,p_target_category_id)); if v_saved is not null then return v_saved; end if;
  select * into v_source from public.categories where family_id=p_family_id and id=p_source_category_id for update; select * into v_target from public.categories where family_id=p_family_id and id=p_target_category_id and archived_at is null for update;
  if v_source.id is null or v_target.id is null then raise exception 'NOT_FOUND'; end if; if v_source.type<>v_target.type then raise exception 'CATEGORY_TYPE_MISMATCH'; end if;
  update public.transactions set category_id=p_target_category_id,updated_at=now(),updated_by=auth.uid(),version=version+1 where family_id=p_family_id and category_id=p_source_category_id; get diagnostics v_count=row_count;
  update public.categories set archived_at=coalesce(archived_at,now()),updated_at=now() where id=p_source_category_id;
  v_result:=jsonb_build_object('source_id',p_source_category_id,'target_id',p_target_category_id,'transactions_moved',v_count); insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id) values(p_family_id,auth.uid(),'CATEGORIES_MERGED','category',p_source_category_id,to_jsonb(v_source),v_result,p_idempotency_key); perform public.finish_idempotent('merge_categories',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.update_account_extended(p_family_id uuid,p_account_id uuid,p_name text,p_account_type text,p_institution text,p_sort_order integer,p_display_credit_as_positive boolean,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_row public.accounts; v_before jsonb; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 80 or p_account_type not in ('CASH','BANK','SAVINGS','CURRENT','CREDIT_CARD','WALLET','EWALLET','INVESTMENT','LOAN','OTHER') or char_length(coalesce(p_institution,''))>120 or coalesce(p_sort_order,0)<0 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved:=public.begin_idempotent('update_account_extended',p_idempotency_key,jsonb_build_array(p_family_id,p_account_id,p_name,p_account_type,p_institution,p_sort_order,p_display_credit_as_positive)); if v_saved is not null then return v_saved; end if;
  select * into v_row from public.accounts where family_id=p_family_id and id=p_account_id for update; if not found then raise exception 'NOT_FOUND'; end if; v_before:=to_jsonb(v_row);
  update public.accounts set name=trim(p_name),account_type=p_account_type,institution=nullif(trim(p_institution),''),sort_order=coalesce(p_sort_order,0),display_credit_as_positive=coalesce(p_display_credit_as_positive,false),version=version+1,updated_at=now() where id=p_account_id returning * into v_row;
  v_result:=to_jsonb(v_row)||jsonb_build_object('beginning_balance_minor',v_row.beginning_balance_minor::text);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id) values(p_family_id,auth.uid(),'ACCOUNT_UPDATED','account',v_row.id,v_before,v_result,p_idempotency_key);
  perform public.finish_idempotent('update_account_extended',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.inspect_invitation(p_token text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_invite public.invitations; v_status text; v_family_name text; v_inviter text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_invite from public.invitations where token_hash=extensions.digest(p_token,'sha256');
  if not found then return jsonb_build_object('status','INVALID'); end if;
  select f.name,p.display_name into v_family_name,v_inviter from public.families f join public.profiles p on p.user_id=v_invite.created_by where f.id=v_invite.family_id;
  v_status:=case when public.is_active_member(v_invite.family_id) then 'ALREADY_MEMBER' when exists(select 1 from public.join_requests where family_id=v_invite.family_id and user_id=auth.uid() and status='PENDING') then 'PENDING' when v_invite.revoked_at is not null then 'REVOKED' when v_invite.expires_at<=now() then 'EXPIRED' when v_invite.use_count>=v_invite.max_uses then 'EXHAUSTED' else 'VALID' end;
  return jsonb_build_object('status',v_status,'expiresAt',v_invite.expires_at,'familyName',v_family_name,'inviterName',v_inviter,'usesRemaining',greatest(v_invite.max_uses-v_invite.use_count,0));
end; $$;

create or replace function public.list_family_members(p_family_id uuid)
returns table(user_id uuid,display_name text,role public.member_role,status public.member_status)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return query select m.user_id,p.display_name,m.role,m.status from public.family_members m join public.profiles p on p.user_id=m.user_id where m.family_id=p_family_id and m.status in ('ACTIVE','SUSPENDED') order by (m.role='OWNER') desc,(m.status='ACTIVE') desc,p.display_name;
end; $$;

create or replace function public.list_my_notifications(p_limit integer default 50)
returns setof public.notifications language sql stable security definer set search_path=public as $$
  select * from public.notifications where recipient_user_id=auth.uid() order by created_at desc limit greatest(1,least(coalesce(p_limit,50),100));
$$;

create or replace function public.list_account_reconciliations(p_family_id uuid,p_account_id uuid)
returns setof public.account_reconciliations language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return query select * from public.account_reconciliations where family_id=p_family_id and account_id=p_account_id order by checked_on desc,created_at desc limit 100;
end; $$;

create or replace function public.mark_notification_read(p_notification_id uuid,p_read boolean default true)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.notifications;
begin
  update public.notifications set read_at=case when p_read then coalesce(read_at,now()) else null end where id=p_notification_id and recipient_user_id=auth.uid() returning * into v_row;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('id',v_row.id,'read_at',v_row.read_at);
end; $$;

create or replace function public.preview_import_duplicates(p_family_id uuid,p_fingerprints text[])
returns text[] language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return coalesce((select array_agg(distinct import_fingerprint) from public.transactions where family_id=p_family_id and deleted_at is null and import_fingerprint=any(coalesce(p_fingerprints,array[]::text[]))),array[]::text[]);
end; $$;

create or replace function public.search_transactions_v2(p_family_id uuid,p_start date default null,p_end date default null,p_type text default null,p_account_id uuid default null,p_category_id uuid default null,p_member_id uuid default null,p_search text default null,p_min_amount_minor text default null,p_max_amount_minor text default null,p_deleted_status text default 'ACTIVE',p_sort text default 'NEWEST',p_offset integer default 0,p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_min bigint; v_max bigint;
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if coalesce(p_sort,'NEWEST') not in ('NEWEST','OLDEST','HIGHEST_AMOUNT','LOWEST_AMOUNT','CATEGORY','ACCOUNT') or coalesce(p_deleted_status,'ACTIVE') not in ('ACTIVE','DELETED','ALL') or coalesce(p_offset,0)<0 or (p_min_amount_minor is not null and p_min_amount_minor!~'^[0-9]{1,15}$') or (p_max_amount_minor is not null and p_max_amount_minor!~'^[0-9]{1,15}$') then raise exception 'VALIDATION_FAILED'; end if;
  v_min:=p_min_amount_minor::bigint; v_max:=p_max_amount_minor::bigint; if v_min is not null and v_max is not null and v_min>v_max then raise exception 'VALIDATION_FAILED'; end if;
  return coalesce((select jsonb_agg(public.ledger_json(r.transaction_row)||jsonb_build_object('account_name',r.account_name,'category_name',r.category_name,'creator_name',r.creator_name) order by case when p_sort='OLDEST' then (r.transaction_row).local_date end asc,case when p_sort='HIGHEST_AMOUNT' then abs((r.transaction_row).amount_minor) end desc,case when p_sort='LOWEST_AMOUNT' then abs((r.transaction_row).amount_minor) end asc,case when p_sort='CATEGORY' then r.category_name end asc nulls last,case when p_sort='ACCOUNT' then r.account_name end asc,case when p_sort='NEWEST' then (r.transaction_row).local_date end desc,(r.transaction_row).id desc) from (
    select x transaction_row,a.name account_name,c.name category_name,p.display_name creator_name from public.transactions x join public.accounts a on a.family_id=x.family_id and a.id=x.account_id join public.profiles p on p.user_id=x.created_by left join public.categories c on c.family_id=x.family_id and c.id=x.category_id where x.family_id=p_family_id
      and (p_deleted_status='ALL' or (p_deleted_status='ACTIVE' and x.deleted_at is null) or (p_deleted_status='DELETED' and x.deleted_at is not null))
      and (x.deleted_at is null or x.created_by=auth.uid() or public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]))
      and (p_start is null or x.local_date>=p_start) and (p_end is null or x.local_date<p_end) and (p_type is null or p_type='' or x.type::text=p_type) and (p_account_id is null or x.account_id=p_account_id) and (p_category_id is null or x.category_id=p_category_id) and (p_member_id is null or x.created_by=p_member_id)
      and (v_min is null or abs(x.amount_minor)>=v_min) and (v_max is null or abs(x.amount_minor)<=v_max)
      and (p_search is null or trim(p_search)='' or to_tsvector('simple',coalesce(x.description,'')||' '||coalesce(x.remarks,''))@@plainto_tsquery('simple',trim(p_search)) or strpos(lower(a.name),lower(trim(p_search)))>0 or strpos(lower(coalesce(c.name,'')),lower(trim(p_search)))>0)
    order by case when p_sort='OLDEST' then x.local_date end asc,case when p_sort='HIGHEST_AMOUNT' then abs(x.amount_minor) end desc,case when p_sort='LOWEST_AMOUNT' then abs(x.amount_minor) end asc,case when p_sort='CATEGORY' then c.name end asc nulls last,case when p_sort='ACCOUNT' then a.name end asc,case when p_sort='NEWEST' then x.local_date end desc,x.id desc offset coalesce(p_offset,0) limit greatest(1,least(coalesce(p_limit,30),100))
  ) r),'[]');
end; $$;

create or replace function public.begin_import_batch(p_family_id uuid,p_filename text,p_file_sha256 text,p_mapping jsonb,p_total_rows integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_row public.import_batches; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN','MEMBER']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(coalesce(p_filename,''))) not between 1 and 240 or p_total_rows not between 1 and 10000 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved:=public.begin_idempotent('begin_import_batch',p_idempotency_key,jsonb_build_array(p_family_id,p_filename,p_file_sha256,p_mapping,p_total_rows)); if v_saved is not null then return v_saved; end if;
  insert into public.import_batches(family_id,filename,file_sha256,mapping,total_rows,created_by) values(p_family_id,trim(p_filename),nullif(trim(p_file_sha256),''),coalesce(p_mapping,'{}'::jsonb),p_total_rows,auth.uid()) returning * into v_row;
  v_result:=jsonb_build_object('id',v_row.id,'status',v_row.status,'total_rows',v_row.total_rows);
  perform public.finish_idempotent('begin_import_batch',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.import_batch_transaction(p_family_id uuid,p_batch_id uuid,p_row_number integer,p_fingerprint text,p_type public.transaction_type,p_local_date date,p_amount_minor text,p_account_id uuid,p_category_id uuid,p_description text,p_remarks text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_batch public.import_batches; v_row public.transactions; v_existing uuid; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN','MEMBER']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_type not in ('INCOME','EXPENSE') or p_local_date is null or p_amount_minor !~ '^[0-9]{1,15}$' or p_amount_minor::bigint<=0 or p_row_number<1 or char_length(coalesce(p_fingerprint,''))<16 or length(coalesce(p_description,''))>240 or length(coalesce(p_remarks,''))>2000 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved:=public.begin_idempotent('import_batch_transaction',p_idempotency_key,jsonb_build_array(p_family_id,p_batch_id,p_row_number,p_fingerprint,p_type,p_local_date,p_amount_minor,p_account_id,p_category_id,p_description,p_remarks)); if v_saved is not null then return v_saved; end if;
  select * into v_batch from public.import_batches where family_id=p_family_id and id=p_batch_id and status='IMPORTING' for update;
  if not found or (v_batch.created_by<>auth.uid() and not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[])) then raise exception 'BATCH_INVALID'; end if;
  select id into v_existing from public.transactions where family_id=p_family_id and import_fingerprint=p_fingerprint and deleted_at is null limit 1;
  if found then update public.import_batches set skipped_rows=skipped_rows+1 where id=p_batch_id; v_result:=jsonb_build_object('status','EXACT_DUPLICATE','transaction_id',v_existing); perform public.finish_idempotent('import_batch_transaction',p_idempotency_key,v_result); return v_result; end if;
  perform 1 from public.accounts where family_id=p_family_id and id=p_account_id and archived_at is null and opening_date<=p_local_date for share; if not found then raise exception 'ACCOUNT_INVALID'; end if;
  perform 1 from public.categories where family_id=p_family_id and id=p_category_id and archived_at is null and type::text=p_type::text for share; if not found then raise exception 'CATEGORY_INVALID'; end if;
  insert into public.transactions(family_id,type,local_date,amount_minor,account_id,category_id,description,remarks,created_by,updated_by,import_batch_id,import_row_number,import_fingerprint) values(p_family_id,p_type,p_local_date,p_amount_minor::bigint,p_account_id,p_category_id,trim(p_description),trim(p_remarks),auth.uid(),auth.uid(),p_batch_id,p_row_number,p_fingerprint) returning * into v_row;
  update public.import_batches set imported_rows=imported_rows+1 where id=p_batch_id;
  v_result:=jsonb_build_object('status','IMPORTED','transaction_id',v_row.id);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id) values(p_family_id,auth.uid(),'TRANSACTION_IMPORTED','transaction',v_row.id,jsonb_build_object('batch_id',p_batch_id,'row',p_row_number),p_idempotency_key);
  perform public.finish_idempotent('import_batch_transaction',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.finish_import_batch(p_family_id uuid,p_batch_id uuid,p_cancelled boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.import_batches;
begin
  update public.import_batches set status=case when p_cancelled then 'CANCELLED' else 'COMPLETED' end,completed_at=now() where family_id=p_family_id and id=p_batch_id and status='IMPORTING' and (created_by=auth.uid() or public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[])) returning * into v_row;
  if not found then raise exception 'BATCH_INVALID'; end if;
  return jsonb_build_object('id',v_row.id,'status',v_row.status,'imported_rows',v_row.imported_rows,'skipped_rows',v_row.skipped_rows);
end; $$;

create or replace function public.list_import_batches(p_family_id uuid)
returns setof public.import_batches language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return query select * from public.import_batches where family_id=p_family_id order by created_at desc limit 50;
end; $$;

create or replace function public.rollback_import_batch(p_family_id uuid,p_batch_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_count integer; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  v_saved:=public.begin_idempotent('rollback_import_batch',p_idempotency_key,jsonb_build_array(p_family_id,p_batch_id)); if v_saved is not null then return v_saved; end if;
  update public.transactions set deleted_at=now(),updated_at=now(),updated_by=auth.uid(),version=version+1 where family_id=p_family_id and import_batch_id=p_batch_id and deleted_at is null; get diagnostics v_count=row_count;
  update public.import_batches set status='ROLLED_BACK',rolled_back_at=now() where family_id=p_family_id and id=p_batch_id and status in ('COMPLETED','CANCELLED','FAILED'); if not found then raise exception 'BATCH_INVALID'; end if;
  v_result:=jsonb_build_object('id',p_batch_id,'status','ROLLED_BACK','transactions_removed',v_count);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id) values(p_family_id,auth.uid(),'IMPORT_BATCH_ROLLED_BACK','import_batch',p_batch_id,v_result,p_idempotency_key);
  perform public.finish_idempotent('rollback_import_batch',p_idempotency_key,v_result); return v_result;
end; $$;

create or replace function public.notify_join_request_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.notifications(family_id,recipient_user_id,event_type,title,body,route)
      select new.family_id,m.user_id,'JOIN_REQUESTED','New family join request','A person is waiting for approval.','/family/join-requests'
      from public.family_members m where m.family_id=new.family_id and m.status='ACTIVE' and m.role in ('OWNER','ADMIN');
  elsif old.status='PENDING' and new.status in ('APPROVED','REJECTED') then
    insert into public.notifications(family_id,recipient_user_id,event_type,title,body,route)
      values(new.family_id,new.user_id,'JOIN_'||new.status::text,case when new.status='APPROVED' then 'Welcome to the family' else 'Join request declined' end,case when new.status='APPROVED' then 'Your family access is now active.' else 'Your request was not approved.' end,'/');
  end if;
  return new;
end; $$;
drop trigger if exists join_request_notifications on public.join_requests;
create trigger join_request_notifications after insert or update of status on public.join_requests for each row execute function public.notify_join_request_change();

revoke all on function public.get_my_profile() from public,anon,authenticated;
revoke all on function public.update_my_profile(text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.get_family_notes(uuid) from public,anon,authenticated;
revoke all on function public.update_family_notes(uuid,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.transfer_family_ownership(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.leave_family(uuid,uuid) from public,anon,authenticated;
revoke all on function public.set_family_member_status(uuid,uuid,public.member_status,uuid) from public,anon,authenticated;
revoke all on function public.create_account_transfer(uuid,uuid,uuid,date,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.save_transaction_v2(uuid,uuid,integer,public.transaction_type,date,text,uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.create_account_extended(uuid,text,text,date,text,text,integer,boolean,uuid) from public,anon,authenticated;
revoke all on function public.update_account_extended(uuid,uuid,text,text,text,integer,boolean,uuid) from public,anon,authenticated;
revoke all on function public.create_category_extended(uuid,public.category_type,text,text,uuid) from public,anon,authenticated;
revoke all on function public.update_category_extended(uuid,uuid,text,integer,text,uuid) from public,anon,authenticated;
revoke all on function public.delete_unused_category(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.merge_categories(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.inspect_invitation(text) from public,anon,authenticated;
revoke all on function public.list_family_members(uuid) from public,anon,authenticated;
revoke all on function public.list_my_notifications(integer) from public,anon,authenticated;
revoke all on function public.mark_notification_read(uuid,boolean) from public,anon,authenticated;
revoke all on function public.preview_import_duplicates(uuid,text[]) from public,anon,authenticated;
revoke all on function public.search_transactions_v2(uuid,date,date,text,uuid,uuid,uuid,text,text,text,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.begin_import_batch(uuid,text,text,jsonb,integer,uuid) from public,anon,authenticated;
revoke all on function public.import_batch_transaction(uuid,uuid,integer,text,public.transaction_type,date,text,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.finish_import_batch(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.list_import_batches(uuid) from public,anon,authenticated;
revoke all on function public.rollback_import_batch(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.notify_join_request_change() from public,anon,authenticated;
revoke all on function public.capture_account_reconciliation() from public,anon,authenticated;
revoke all on function public.list_account_reconciliations(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_my_profile(text,text,text,text,uuid) to authenticated;
grant execute on function public.get_family_notes(uuid) to authenticated;
grant execute on function public.update_family_notes(uuid,text,integer,uuid) to authenticated;
grant execute on function public.transfer_family_ownership(uuid,uuid,uuid) to authenticated;
grant execute on function public.leave_family(uuid,uuid) to authenticated;
grant execute on function public.set_family_member_status(uuid,uuid,public.member_status,uuid) to authenticated;
grant execute on function public.create_account_transfer(uuid,uuid,uuid,date,text,text,text,uuid) to authenticated;
grant execute on function public.save_transaction_v2(uuid,uuid,integer,public.transaction_type,date,text,uuid,uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.create_account_extended(uuid,text,text,date,text,text,integer,boolean,uuid) to authenticated;
grant execute on function public.update_account_extended(uuid,uuid,text,text,text,integer,boolean,uuid) to authenticated;
grant execute on function public.create_category_extended(uuid,public.category_type,text,text,uuid) to authenticated;
grant execute on function public.update_category_extended(uuid,uuid,text,integer,text,uuid) to authenticated;
grant execute on function public.delete_unused_category(uuid,uuid,uuid) to authenticated;
grant execute on function public.merge_categories(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.inspect_invitation(text) to authenticated;
grant execute on function public.list_family_members(uuid) to authenticated;
grant execute on function public.list_my_notifications(integer) to authenticated;
grant execute on function public.mark_notification_read(uuid,boolean) to authenticated;
grant execute on function public.list_account_reconciliations(uuid,uuid) to authenticated;
grant execute on function public.preview_import_duplicates(uuid,text[]) to authenticated;
grant execute on function public.search_transactions_v2(uuid,date,date,text,uuid,uuid,uuid,text,text,text,text,text,integer,integer) to authenticated;
grant execute on function public.begin_import_batch(uuid,text,text,jsonb,integer,uuid) to authenticated;
grant execute on function public.import_batch_transaction(uuid,uuid,integer,text,public.transaction_type,date,text,uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.finish_import_batch(uuid,uuid,boolean) to authenticated;
grant execute on function public.list_import_batches(uuid) to authenticated;
grant execute on function public.rollback_import_batch(uuid,uuid,uuid) to authenticated;
