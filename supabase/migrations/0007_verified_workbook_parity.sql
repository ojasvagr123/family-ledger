-- Close the remaining workbook-parity gaps discovered during runtime verification:
-- preserve a user-selected currency symbol, expose it to every family view, and
-- allow a custom report whose start and end are the same day.

create or replace function public.default_currency_symbol(p_currency_code text)
returns text language sql immutable set search_path = public as $$
  select case upper(coalesce(p_currency_code,''))
    when 'INR' then '₹'
    when 'USD' then '$'
    when 'EUR' then '€'
    when 'GBP' then '£'
    when 'JPY' then '¥'
    when 'CNY' then '¥'
    when 'PHP' then '₱'
    when 'THB' then '฿'
    when 'KRW' then '₩'
    when 'VND' then '₫'
    when 'TRY' then '₺'
    else upper(coalesce(nullif(trim(p_currency_code),''),'¤'))
  end;
$$;

alter table public.families add column if not exists currency_symbol text;
update public.families
set currency_symbol=public.default_currency_symbol(currency_code)
where currency_symbol is null or trim(currency_symbol)='';
alter table public.families alter column currency_symbol set not null;
alter table public.families drop constraint if exists families_currency_symbol_check;
alter table public.families add constraint families_currency_symbol_check
  check (char_length(trim(currency_symbol)) between 1 and 8);

create or replace function public.set_default_family_currency_symbol()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.currency_symbol is null or trim(new.currency_symbol)='' then
    new.currency_symbol := public.default_currency_symbol(new.currency_code);
  else
    new.currency_symbol := trim(new.currency_symbol);
  end if;
  return new;
end;
$$;

drop trigger if exists families_currency_symbol_default on public.families;
create trigger families_currency_symbol_default
before insert on public.families
for each row execute function public.set_default_family_currency_symbol();

drop function if exists public.list_my_families();
create function public.list_my_families()
returns table(id uuid, name text, currency_code text, currency_symbol text, timezone text, fiscal_start_month smallint, role public.member_role, status public.member_status, version integer)
language sql stable security definer set search_path = public as $$
  select f.id, f.name, f.currency_code, f.currency_symbol, f.timezone, f.fiscal_start_month, m.role, m.status, f.version
  from public.family_members m join public.families f on f.id=m.family_id
  where m.user_id=auth.uid() and m.status in ('PENDING','ACTIVE')
  order by (m.status='ACTIVE') desc,f.created_at;
$$;

create or replace function public.create_family(
  p_name text,
  p_currency_code text,
  p_currency_symbol text,
  p_timezone text,
  p_fiscal_start_month smallint,
  p_reporting_start_year smallint,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_family public.families%rowtype;
  v_saved jsonb;
  v_request jsonb := jsonb_build_object('name',trim(p_name),'currency',p_currency_code,'symbol',trim(p_currency_symbol),'timezone',p_timezone,'month',p_fiscal_start_month,'year',p_reporting_start_year);
  v_response jsonb;
  v_names text[];
  v_name text;
  v_index integer;
begin
  v_saved := public.begin_idempotent('create_family_v2',p_idempotency_key,v_request);
  if v_saved is not null then return v_saved; end if;
  if char_length(trim(p_name)) not between 1 and 100 then raise exception 'VALIDATION_FAILED: name' using errcode='P0001'; end if;
  if p_currency_code !~ '^[A-Z]{3}$' or p_currency_symbol is null or char_length(trim(p_currency_symbol)) not between 1 and 8 or p_fiscal_start_month not between 1 and 12 or p_reporting_start_year not between 1900 and 2200 then raise exception 'VALIDATION_FAILED: settings' using errcode='P0001'; end if;

  insert into public.families(name,currency_code,currency_symbol,timezone,fiscal_start_month,reporting_start_year,owner_user_id)
  values(trim(p_name),p_currency_code,trim(p_currency_symbol),p_timezone,p_fiscal_start_month,p_reporting_start_year,auth.uid())
  returning * into v_family;
  insert into public.family_members(family_id,user_id,role,status,approved_by,approved_at,joined_at)
  values(v_family.id,auth.uid(),'OWNER','ACTIVE',auth.uid(),now(),now());

  v_names := array['Salary','Business income','Interest','Reimbursement','Other income'];
  for v_index in 1..array_length(v_names,1) loop
    v_name := v_names[v_index];
    insert into public.categories(family_id,type,name,sort_order,created_by) values(v_family.id,'INCOME',v_name,v_index,auth.uid());
  end loop;
  v_names := array['Groceries','Housing','Utilities','Transport','Education','Healthcare','Dining','Shopping','Entertainment','Insurance','Other expense'];
  for v_index in 1..array_length(v_names,1) loop
    v_name := v_names[v_index];
    insert into public.categories(family_id,type,name,sort_order,created_by) values(v_family.id,'EXPENSE',v_name,v_index,auth.uid());
  end loop;

  v_response := jsonb_build_object('id',v_family.id,'name',v_family.name,'currency_code',v_family.currency_code,'currency_symbol',v_family.currency_symbol,'timezone',v_family.timezone,'fiscal_start_month',v_family.fiscal_start_month,'role','OWNER','status','ACTIVE','version',v_family.version);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id)
  values(v_family.id,auth.uid(),'FAMILY_CREATED','family',v_family.id,jsonb_build_object('name',v_family.name,'currency_symbol',v_family.currency_symbol),p_idempotency_key);
  perform public.finish_idempotent('create_family_v2',p_idempotency_key,v_response);
  return v_response;
end;
$$;

create or replace function public.get_family_settings(p_family_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return (select jsonb_build_object('id',id,'name',name,'currency_code',currency_code,'currency_symbol',currency_symbol,'timezone',timezone,'fiscal_start_month',fiscal_start_month,'reporting_start_year',reporting_start_year,'version',version) from public.families where id=p_family_id);
end;
$$;

create or replace function public.update_family_settings(
  p_family_id uuid,
  p_expected_version integer,
  p_name text,
  p_currency_code text,
  p_currency_symbol text,
  p_timezone text,
  p_fiscal_start_month smallint,
  p_reporting_start_year smallint,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_saved jsonb; v_before jsonb; v_row public.families; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 100 or p_currency_code !~ '^[A-Z]{3}$' or p_currency_symbol is null or char_length(trim(p_currency_symbol)) not between 1 and 8 or p_timezone is null or char_length(trim(p_timezone)) not between 1 and 100 or p_fiscal_start_month not between 1 and 12 or p_reporting_start_year not between 1900 and 2200 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved := public.begin_idempotent('update_family_settings_v2',p_idempotency_key,jsonb_build_array(p_family_id,p_expected_version,trim(p_name),p_currency_code,trim(p_currency_symbol),trim(p_timezone),p_fiscal_start_month,p_reporting_start_year));
  if v_saved is not null then return v_saved; end if;
  select * into v_row from public.families where id=p_family_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_expected_version is distinct from v_row.version then raise exception 'VERSION_CONFLICT'; end if;
  v_before := to_jsonb(v_row);
  update public.families set name=trim(p_name),currency_code=p_currency_code,currency_symbol=trim(p_currency_symbol),timezone=trim(p_timezone),fiscal_start_month=p_fiscal_start_month,reporting_start_year=p_reporting_start_year,version=version+1,updated_at=now() where id=p_family_id returning * into v_row;
  v_result := jsonb_build_object('id',v_row.id,'name',v_row.name,'currency_code',v_row.currency_code,'currency_symbol',v_row.currency_symbol,'timezone',v_row.timezone,'fiscal_start_month',v_row.fiscal_start_month,'reporting_start_year',v_row.reporting_start_year,'version',v_row.version);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
    values(p_family_id,auth.uid(),'FAMILY_SETTINGS_UPDATED','family',p_family_id,v_before,v_result,p_idempotency_key);
  perform public.finish_idempotent('update_family_settings_v2',p_idempotency_key,v_result);
  return v_result;
end;
$$;

create or replace function public.custom_report(p_family_id uuid,p_start date,p_end date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_income numeric; v_expense numeric; v_categories jsonb;
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_start is null or p_end is null or p_start>p_end then raise exception 'VALIDATION_FAILED'; end if;
  select coalesce(sum(amount_minor) filter(where type='INCOME'),0),coalesce(sum(amount_minor) filter(where type='EXPENSE'),0) into v_income,v_expense from public.transactions where family_id=p_family_id and deleted_at is null and local_date>=p_start and local_date<=p_end;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'type',s.type,'total_minor',s.total::text,'percentage',coalesce(round(100*s.total/nullif(case when s.type='INCOME' then v_income else v_expense end,0),2),0)) order by s.type,s.total desc,s.name,s.id),'[]') into v_categories
    from (
      select c.id,c.name,c.type,coalesce(t.total,0) total
      from public.categories c
      left join lateral (select sum(x.amount_minor) total from public.transactions x where x.family_id=p_family_id and x.category_id=c.id and x.deleted_at is null and x.local_date>=p_start and x.local_date<=p_end) t on true
      where c.family_id=p_family_id and (c.archived_at is null or t.total is not null)
    ) s;
  return jsonb_build_object('start',p_start,'end',p_end,'income_minor',v_income::text,'expense_minor',v_expense::text,'net_minor',(v_income-v_expense)::text,'expense_to_income',round(100*v_expense/nullif(v_income,0),2),'savings_rate',round(100*(v_income-v_expense)/nullif(v_income,0),2),'categories',v_categories);
end;
$$;

revoke all on function public.default_currency_symbol(text) from public,anon,authenticated;
revoke all on function public.set_default_family_currency_symbol() from public,anon,authenticated;
revoke all on function public.list_my_families() from public,anon,authenticated;
revoke all on function public.create_family(text,text,text,text,smallint,smallint,uuid) from public,anon,authenticated;
revoke all on function public.update_family_settings(uuid,integer,text,text,text,text,smallint,smallint,uuid) from public,anon,authenticated;
grant execute on function public.list_my_families() to authenticated;
grant execute on function public.create_family(text,text,text,text,smallint,smallint,uuid) to authenticated;
grant execute on function public.update_family_settings(uuid,integer,text,text,text,text,smallint,smallint,uuid) to authenticated;

