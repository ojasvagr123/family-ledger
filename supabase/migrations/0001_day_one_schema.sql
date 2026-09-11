create extension if not exists pgcrypto;

create type public.member_role as enum ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
create type public.member_status as enum ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'LEFT', 'REMOVED');
create type public.join_request_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
create type public.category_type as enum ('INCOME', 'EXPENSE');
create type public.transaction_type as enum ('INCOME', 'EXPENSE', 'ADJUSTMENT');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  locale text not null default 'en-IN',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  currency_code text not null default 'INR' check (currency_code ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Kolkata',
  fiscal_start_month smallint not null default 1 check (fiscal_start_month between 1 and 12),
  reporting_start_year smallint not null check (reporting_start_year between 1900 and 2200),
  owner_user_id uuid not null references auth.users(id),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_user_id)
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'MEMBER',
  status public.member_status not null default 'PENDING',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, user_id),
  unique (family_id, id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 20),
  use_count integer not null default 0 check (use_count between 0 and max_uses),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  unique (family_id, id)
);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invitation_id uuid not null,
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
  account_type text not null default 'CASH' check (account_type in ('CASH','SAVINGS','CURRENT','CREDIT_CARD','WALLET','OTHER')),
  opening_date date not null,
  beginning_balance_minor bigint not null default 0,
  archived_at timestamptz,
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, id)
);

create unique index accounts_active_name_unique
  on public.accounts(family_id, normalized_name) where archived_at is null;

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
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (family_id, account_id) references public.accounts(family_id, id),
  foreign key (family_id, category_id) references public.categories(family_id, id),
  check ((type in ('INCOME','EXPENSE') and amount_minor > 0 and category_id is not null) or (type = 'ADJUSTMENT' and amount_minor <> 0 and category_id is null)),
  unique (family_id, id)
);

create index transactions_family_date_active on public.transactions(family_id, local_date desc, id) where deleted_at is null;
create index transactions_family_type_date_active on public.transactions(family_id, type, local_date) where deleted_at is null;
create index transactions_family_account_date_active on public.transactions(family_id, account_id, local_date) where deleted_at is null;
create index transactions_family_category_date_active on public.transactions(family_id, category_id, local_date) where deleted_at is null;

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

create table public.idempotency_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  key uuid not null,
  request_hash bytea not null,
  response jsonb,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  primary key (user_id, operation, key)
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(user_id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(coalesce(new.email, 'Family member'), '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger auth_user_profile after insert on auth.users
for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.is_active_member(p_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.family_members m where m.family_id = p_family_id and m.user_id = auth.uid() and m.status = 'ACTIVE');
$$;

create or replace function public.has_family_role(p_family_id uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.family_members m where m.family_id = p_family_id and m.user_id = auth.uid() and m.status = 'ACTIVE' and m.role = any(p_roles));
$$;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.invitations enable row level security;
alter table public.join_requests enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.audit_events enable row level security;
alter table public.idempotency_keys enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy families_active_select on public.families for select to authenticated using (public.is_active_member(id));
create policy members_active_select on public.family_members for select to authenticated using (public.is_active_member(family_id));
create policy categories_active_select on public.categories for select to authenticated using (public.is_active_member(family_id));
create policy accounts_active_select on public.accounts for select to authenticated using (public.is_active_member(family_id));
create policy transactions_active_select on public.transactions for select to authenticated using (public.is_active_member(family_id));

revoke all on public.profiles, public.families, public.family_members, public.invitations,
  public.join_requests, public.categories, public.accounts, public.transactions,
  public.audit_events, public.idempotency_keys from anon, authenticated;
grant select on public.profiles, public.families, public.family_members, public.categories, public.accounts, public.transactions to authenticated;
grant update on public.profiles to authenticated;
revoke all on function public.is_active_member(uuid) from public, anon, authenticated;
revoke all on function public.has_family_role(uuid, public.member_role[]) from public, anon, authenticated;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.has_family_role(uuid, public.member_role[]) to authenticated;
