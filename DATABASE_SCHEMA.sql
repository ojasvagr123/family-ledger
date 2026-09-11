-- FamilyLedger initial PostgreSQL schema (Supabase)
-- Split this file into the numbered migrations described in MOBILE_IMPLEMENTATION_BLUEPRINT.md.
-- All money values are integer minor units. All client access is default-deny through RLS.

create extension if not exists pgcrypto;

create type public.member_role as enum ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
create type public.member_status as enum ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'LEFT', 'REMOVED');
create type public.transaction_type as enum ('INCOME', 'EXPENSE', 'ADJUSTMENT');
create type public.category_type as enum ('INCOME', 'EXPENSE');
create type public.join_request_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
create type public.import_status as enum ('UPLOADED', 'MAPPED', 'VALIDATED', 'COMMITTED', 'FAILED', 'ROLLED_BACK');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  avatar_path text,
  locale text not null default 'en-IN',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  currency_code text not null default 'INR' check (currency_code ~ '^[A-Z]{3}$'),
  currency_symbol_override text check (char_length(currency_symbol_override) <= 8),
  timezone text not null default 'Asia/Kolkata',
  fiscal_start_month smallint not null default 1 check (fiscal_start_month between 1 and 12),
  reporting_start_year smallint not null check (reporting_start_year between 1900 and 2200),
  owner_user_id uuid not null references auth.users(id),
  notes text check (char_length(notes) <= 4000),
  version integer not null default 1 check (version > 0),
  deletion_requested_at timestamptz,
  deletion_effective_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_user_id)
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  status public.member_status not null default 'PENDING',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  joined_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, user_id),
  unique (family_id, id)
);

-- Ownership is a cross-table invariant and is enforced by reviewed RPCs plus database tests.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 100),
  use_count integer not null default 0 check (use_count >= 0 and use_count <= max_uses),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  unique (family_id, id)
);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invitation_id uuid,
  status public.join_request_status not null default 'PENDING',
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (family_id, invitation_id) references public.invitations(family_id, id)
);

create unique index join_requests_one_pending
  on public.join_requests(family_id, user_id) where status = 'PENDING';

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  type public.category_type not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  normalized_name text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, id)
);

create unique index categories_active_name_unique
  on public.categories(family_id, type, normalized_name) where archived_at is null;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  normalized_name text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored,
  account_type text not null check (char_length(trim(account_type)) between 1 and 40),
  opening_date date not null,
  beginning_balance_minor bigint not null default 0,
  sort_order integer not null default 0,
  archived_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, id)
);

create unique index accounts_active_name_unique
  on public.accounts(family_id, normalized_name) where archived_at is null;

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  filename text not null,
  file_sha256 bytea not null,
  mapping jsonb,
  status public.import_status not null default 'UPLOADED',
  source_row_count integer not null default 0 check (source_row_count >= 0),
  valid_row_count integer not null default 0 check (valid_row_count >= 0),
  invalid_row_count integer not null default 0 check (invalid_row_count >= 0),
  duplicate_row_count integer not null default 0 check (duplicate_row_count >= 0),
  created_by uuid not null references auth.users(id),
  committed_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, file_sha256),
  unique (family_id, id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  type public.transaction_type not null,
  local_date date not null,
  amount_minor bigint not null,
  account_id uuid not null,
  category_id uuid,
  description text not null default '' check (char_length(description) <= 240),
  remarks text not null default '' check (char_length(remarks) <= 2000),
  relevant_member_id uuid,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  import_batch_id uuid,
  source_fingerprint bytea,
  version integer not null default 1 check (version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (family_id, account_id) references public.accounts(family_id, id),
  foreign key (family_id, category_id) references public.categories(family_id, id),
  foreign key (family_id, relevant_member_id) references public.family_members(family_id, id),
  foreign key (family_id, import_batch_id) references public.import_batches(family_id, id),
  check (
    (type in ('INCOME', 'EXPENSE') and amount_minor > 0 and category_id is not null)
    or (type = 'ADJUSTMENT' and amount_minor <> 0 and category_id is null)
  ),
  unique (family_id, id)
);

create unique index transactions_import_fingerprint_unique
  on public.transactions(family_id, source_fingerprint)
  where source_fingerprint is not null and deleted_at is null;
create index transactions_family_date_active on public.transactions(family_id, local_date, id) where deleted_at is null;
create index transactions_family_type_date_active on public.transactions(family_id, type, local_date) where deleted_at is null;
create index transactions_family_category_date_active on public.transactions(family_id, category_id, local_date) where deleted_at is null;
create index transactions_family_account_date_active on public.transactions(family_id, account_id, local_date) where deleted_at is null;

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  transaction_id uuid not null,
  storage_path text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size between 1 and 10485760),
  sha256 bytea not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (family_id, transaction_id) references public.transactions(family_id, id)
);

create table public.reconciliations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  account_id uuid not null,
  checked_on date not null,
  expected_balance_minor bigint not null,
  actual_balance_minor bigint not null,
  difference_minor bigint generated always as (actual_balance_minor - expected_balance_minor) stored,
  note text check (char_length(note) <= 1000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (family_id, account_id) references public.accounts(family_id, id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  request_id uuid not null,
  created_at timestamptz not null default now()
);
create index audit_events_family_created on public.audit_events(family_id, created_at desc, id desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread on public.notifications(user_id, created_at desc) where read_at is null;

create table public.device_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  app_version text not null,
  locale text,
  timezone text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.idempotency_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  key uuid not null,
  request_hash bytea not null,
  response jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation, key)
);

create or replace function public.set_updated_at_and_version()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'version' then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

create trigger families_touch before update on public.families
for each row execute function public.set_updated_at_and_version();
create trigger accounts_touch before update on public.accounts
for each row execute function public.set_updated_at_and_version();
create trigger transactions_touch before update on public.transactions
for each row execute function public.set_updated_at_and_version();

create or replace function public.is_active_member(p_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = auth.uid()
      and fm.status = 'ACTIVE'
  );
$$;

create or replace function public.has_family_role(p_family_id uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = auth.uid()
      and fm.status = 'ACTIVE'
      and fm.role = any(p_roles)
  );
$$;

revoke all on function public.is_active_member(uuid) from public;
revoke all on function public.has_family_role(uuid, public.member_role[]) from public;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.has_family_role(uuid, public.member_role[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.invitations enable row level security;
alter table public.join_requests enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.import_batches enable row level security;
alter table public.transactions enable row level security;
alter table public.attachments enable row level security;
alter table public.reconciliations enable row level security;
alter table public.audit_events enable row level security;
alter table public.notifications enable row level security;
alter table public.device_installations enable row level security;
alter table public.idempotency_keys enable row level security;

create policy profiles_select_self on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy families_select_member on public.families for select to authenticated using (public.is_active_member(id));
create policy members_select_member on public.family_members for select to authenticated using (public.is_active_member(family_id));
create policy categories_select_member on public.categories for select to authenticated using (public.is_active_member(family_id));
create policy accounts_select_member on public.accounts for select to authenticated using (public.is_active_member(family_id));
create policy transactions_select_member on public.transactions for select to authenticated using (public.is_active_member(family_id));
create policy reconciliations_select_member on public.reconciliations for select to authenticated using (public.is_active_member(family_id));
create policy audit_select_admin on public.audit_events for select to authenticated
  using (public.has_family_role(family_id, array['OWNER','ADMIN']::public.member_role[]));

create policy categories_write_admin on public.categories for all to authenticated
  using (public.has_family_role(family_id, array['OWNER','ADMIN']::public.member_role[]))
  with check (public.has_family_role(family_id, array['OWNER','ADMIN']::public.member_role[]));
create policy accounts_write_admin on public.accounts for all to authenticated
  using (public.has_family_role(family_id, array['OWNER','ADMIN']::public.member_role[]))
  with check (public.has_family_role(family_id, array['OWNER','ADMIN']::public.member_role[]));

create policy transactions_insert_contributor on public.transactions for insert to authenticated
  with check (
    created_by = auth.uid() and updated_by = auth.uid()
    and public.has_family_role(family_id, array['OWNER','ADMIN','MEMBER']::public.member_role[])
  );
create policy transactions_update_authorized on public.transactions for update to authenticated
  using (
    public.has_family_role(family_id, array['OWNER','ADMIN']::public.member_role[])
    or (created_by = auth.uid() and public.has_family_role(family_id, array['MEMBER']::public.member_role[]))
  )
  with check (
    public.has_family_role(family_id, array['OWNER','ADMIN']::public.member_role[])
    or (created_by = auth.uid() and public.has_family_role(family_id, array['MEMBER']::public.member_role[]))
  );

create policy notifications_self on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_self on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy installations_self on public.device_installations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy idempotency_self on public.idempotency_keys for select to authenticated using (user_id = auth.uid());

-- No direct client insert/update/delete grants for families, memberships, invitations,
-- join requests, imports, attachments, audit events, or reconciliations. Use reviewed RPCs.
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;

-- Required domain RPCs to implement in 0009_domain_rpcs.sql:
-- create_family, update_family_settings, transfer_ownership, request_family_deletion,
-- create_invitation, request_join, decide_join_request, update_member_role,
-- remove_member, leave_family, upsert_category, merge_categories, upsert_account,
-- create_transaction, update_transaction, soft_delete_transaction,
-- restore_transaction, reconcile_account, commit_import, rollback_import.
-- Each must: authenticate, authorize, set search_path, validate expected_version,
-- consume an idempotency key, write audit_events, and return a versioned JSON result.

-- Required report RPCs to implement in 0008_reporting_functions.sql:
-- report_monthly, report_annual, report_custom, account_balance_as_of.
