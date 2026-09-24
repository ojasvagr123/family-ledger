-- Spreadsheet-parity completion: adjustments, category/account maintenance,
-- reconciliation metadata, annual reporting and custom-period reporting.

alter table public.accounts
  add column if not exists last_checked_date date,
  add column if not exists actual_balance_minor bigint;

create or replace function public.get_family_settings(p_family_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return (select jsonb_build_object('id',id,'name',name,'currency_code',currency_code,'timezone',timezone,'fiscal_start_month',fiscal_start_month,'reporting_start_year',reporting_start_year,'version',version) from public.families where id=p_family_id);
end; $$;

create or replace function public.update_family_settings(
  p_family_id uuid,
  p_expected_version integer,
  p_name text,
  p_currency_code text,
  p_timezone text,
  p_fiscal_start_month smallint,
  p_reporting_start_year smallint,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_saved jsonb; v_before jsonb; v_row public.families; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 100 or p_currency_code !~ '^[A-Z]{3}$' or p_timezone is null or char_length(trim(p_timezone)) not between 1 and 100 or p_fiscal_start_month not between 1 and 12 or p_reporting_start_year not between 1900 and 2200 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved := public.begin_idempotent('update_family_settings',p_idempotency_key,jsonb_build_array(p_family_id,p_expected_version,trim(p_name),p_currency_code,trim(p_timezone),p_fiscal_start_month,p_reporting_start_year));
  if v_saved is not null then return v_saved; end if;
  select * into v_row from public.families where id=p_family_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_expected_version is distinct from v_row.version then raise exception 'VERSION_CONFLICT'; end if;
  v_before := to_jsonb(v_row);
  update public.families set name=trim(p_name),currency_code=p_currency_code,timezone=trim(p_timezone),fiscal_start_month=p_fiscal_start_month,reporting_start_year=p_reporting_start_year,version=version+1,updated_at=now() where id=p_family_id returning * into v_row;
  v_result := jsonb_build_object('id',v_row.id,'name',v_row.name,'currency_code',v_row.currency_code,'timezone',v_row.timezone,'fiscal_start_month',v_row.fiscal_start_month,'reporting_start_year',v_row.reporting_start_year,'version',v_row.version);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
    values(p_family_id,auth.uid(),'FAMILY_SETTINGS_UPDATED','family',p_family_id,v_before,v_result,p_idempotency_key);
  perform public.finish_idempotent('update_family_settings',p_idempotency_key,v_result);
  return v_result;
end; $$;

create or replace function public.create_category(
  p_family_id uuid,
  p_type public.category_type,
  p_name text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_saved jsonb; v_row public.categories; v_result jsonb; v_order integer;
begin
  if not public.has_family_role(p_family_id, array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_type is null or p_name is null or char_length(trim(p_name)) not between 1 and 80 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved := public.begin_idempotent('create_category', p_idempotency_key, jsonb_build_array(p_family_id,p_type,trim(p_name)));
  if v_saved is not null then return v_saved; end if;
  select coalesce(max(sort_order),0)+1 into v_order from public.categories where family_id=p_family_id and type=p_type;
  insert into public.categories(family_id,type,name,sort_order,created_by)
    values(p_family_id,p_type,trim(p_name),v_order,auth.uid()) returning * into v_row;
  v_result := to_jsonb(v_row);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id)
    values(p_family_id,auth.uid(),'CATEGORY_CREATED','category',v_row.id,v_result,p_idempotency_key);
  perform public.finish_idempotent('create_category',p_idempotency_key,v_result);
  return v_result;
exception when unique_violation then
  raise exception 'CATEGORY_ALREADY_EXISTS';
end; $$;

create or replace function public.update_category(
  p_family_id uuid,
  p_category_id uuid,
  p_name text,
  p_sort_order integer,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_saved jsonb; v_before jsonb; v_row public.categories; v_result jsonb;
begin
  if not public.has_family_role(p_family_id, array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 80 or p_sort_order is null or p_sort_order < 0 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved := public.begin_idempotent('update_category', p_idempotency_key, jsonb_build_array(p_family_id,p_category_id,trim(p_name),p_sort_order));
  if v_saved is not null then return v_saved; end if;
  select * into v_row from public.categories where family_id=p_family_id and id=p_category_id and archived_at is null for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_before := to_jsonb(v_row);
  update public.categories set name=trim(p_name),sort_order=p_sort_order,updated_at=now() where family_id=p_family_id and id=p_category_id returning * into v_row;
  v_result := to_jsonb(v_row);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
    values(p_family_id,auth.uid(),'CATEGORY_UPDATED','category',v_row.id,v_before,v_result,p_idempotency_key);
  perform public.finish_idempotent('update_category',p_idempotency_key,v_result);
  return v_result;
exception when unique_violation then
  raise exception 'CATEGORY_ALREADY_EXISTS';
end; $$;

create or replace function public.archive_category(
  p_family_id uuid,
  p_category_id uuid,
  p_archived boolean,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_saved jsonb; v_row public.categories; v_result jsonb;
begin
  if not public.has_family_role(p_family_id, array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  v_saved := public.begin_idempotent('archive_category', p_idempotency_key, jsonb_build_array(p_family_id,p_category_id,p_archived));
  if v_saved is not null then return v_saved; end if;
  update public.categories set archived_at=case when p_archived then now() else null end,updated_at=now()
    where family_id=p_family_id and id=p_category_id returning * into v_row;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_result := to_jsonb(v_row);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id)
    values(p_family_id,auth.uid(),case when p_archived then 'CATEGORY_ARCHIVED' else 'CATEGORY_RESTORED' end,'category',v_row.id,v_result,p_idempotency_key);
  perform public.finish_idempotent('archive_category',p_idempotency_key,v_result);
  return v_result;
end; $$;

create or replace function public.reorder_categories(
  p_family_id uuid,
  p_type public.category_type,
  p_category_ids uuid[],
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_saved jsonb; v_active_count integer; v_unique_count integer; v_index integer; v_id uuid; v_result jsonb;
begin
  if not public.has_family_role(p_family_id, array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_type is null or coalesce(cardinality(p_category_ids),0)=0 then raise exception 'VALIDATION_FAILED'; end if;
  select count(*),count(distinct value) into v_active_count,v_unique_count from unnest(p_category_ids) value;
  if v_active_count<>v_unique_count then raise exception 'VALIDATION_FAILED'; end if;
  select count(*) into v_active_count from public.categories where family_id=p_family_id and type=p_type and archived_at is null;
  if v_active_count<>cardinality(p_category_ids) or v_active_count<>(select count(*) from public.categories where family_id=p_family_id and type=p_type and archived_at is null and id=any(p_category_ids)) then raise exception 'CATEGORY_SET_CHANGED'; end if;
  v_saved := public.begin_idempotent('reorder_categories',p_idempotency_key,jsonb_build_object('family',p_family_id,'type',p_type,'ids',to_jsonb(p_category_ids)));
  if v_saved is not null then return v_saved; end if;
  for v_id,v_index in select value,ordinality::integer from unnest(p_category_ids) with ordinality loop
    update public.categories set sort_order=v_index,updated_at=now() where family_id=p_family_id and id=v_id and type=p_type and archived_at is null;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order,c.name),'[]') into v_result from public.categories c where c.family_id=p_family_id and c.type=p_type and c.archived_at is null;
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,request_id,after_data)
    values(p_family_id,auth.uid(),'CATEGORIES_REORDERED','category_order',p_idempotency_key,v_result);
  perform public.finish_idempotent('reorder_categories',p_idempotency_key,v_result);
  return v_result;
end; $$;

create or replace function public.update_account(
  p_family_id uuid,
  p_account_id uuid,
  p_name text,
  p_account_type text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_saved jsonb; v_row public.accounts; v_result jsonb;
begin
  if not public.has_family_role(p_family_id, array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 80 or p_account_type not in ('CASH','SAVINGS','CURRENT','CREDIT_CARD','WALLET','OTHER') then raise exception 'VALIDATION_FAILED'; end if;
  v_saved := public.begin_idempotent('update_account',p_idempotency_key,jsonb_build_array(p_family_id,p_account_id,trim(p_name),p_account_type));
  if v_saved is not null then return v_saved; end if;
  update public.accounts set name=trim(p_name),account_type=p_account_type,version=version+1,updated_at=now()
    where family_id=p_family_id and id=p_account_id and archived_at is null returning * into v_row;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_result := to_jsonb(v_row) || jsonb_build_object('beginning_balance_minor',v_row.beginning_balance_minor::text);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id)
    values(p_family_id,auth.uid(),'ACCOUNT_UPDATED','account',v_row.id,v_result,p_idempotency_key);
  perform public.finish_idempotent('update_account',p_idempotency_key,v_result);
  return v_result;
exception when unique_violation then
  raise exception 'ACCOUNT_ALREADY_EXISTS';
end; $$;

create or replace function public.archive_account(
  p_family_id uuid,
  p_account_id uuid,
  p_archived boolean,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_saved jsonb; v_row public.accounts; v_result jsonb;
begin
  if not public.has_family_role(p_family_id, array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  v_saved := public.begin_idempotent('archive_account',p_idempotency_key,jsonb_build_array(p_family_id,p_account_id,p_archived));
  if v_saved is not null then return v_saved; end if;
  if p_archived and exists(select 1 from public.accounts where family_id=p_family_id and id=p_account_id and archived_at is null)
    and (select count(*) from public.accounts where family_id=p_family_id and archived_at is null)<=1 then
    raise exception 'FINAL_ACTIVE_ACCOUNT';
  end if;
  update public.accounts set archived_at=case when p_archived then now() else null end,version=version+1,updated_at=now()
    where family_id=p_family_id and id=p_account_id returning * into v_row;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_result := to_jsonb(v_row);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id)
    values(p_family_id,auth.uid(),case when p_archived then 'ACCOUNT_ARCHIVED' else 'ACCOUNT_RESTORED' end,'account',v_row.id,v_result,p_idempotency_key);
  perform public.finish_idempotent('archive_account',p_idempotency_key,v_result);
  return v_result;
exception when unique_violation then
  raise exception 'ACCOUNT_ALREADY_EXISTS';
end; $$;

create or replace function public.reconcile_account(
  p_family_id uuid,
  p_account_id uuid,
  p_actual_balance_minor text,
  p_checked_date date,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_saved jsonb; v_row public.accounts; v_result jsonb;
begin
  if not public.has_family_role(p_family_id, array['OWNER','ADMIN','MEMBER']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_actual_balance_minor is null or p_actual_balance_minor !~ '^-?[0-9]{1,15}$' or p_checked_date is null then raise exception 'VALIDATION_FAILED'; end if;
  v_saved := public.begin_idempotent('reconcile_account',p_idempotency_key,jsonb_build_array(p_family_id,p_account_id,p_actual_balance_minor,p_checked_date));
  if v_saved is not null then return v_saved; end if;
  update public.accounts set actual_balance_minor=p_actual_balance_minor::bigint,last_checked_date=p_checked_date,updated_at=now()
    where family_id=p_family_id and id=p_account_id and archived_at is null returning * into v_row;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_result := to_jsonb(v_row) || jsonb_build_object('actual_balance_minor',v_row.actual_balance_minor::text);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id)
    values(p_family_id,auth.uid(),'ACCOUNT_RECONCILED','account',v_row.id,v_result,p_idempotency_key);
  perform public.finish_idempotent('reconcile_account',p_idempotency_key,v_result);
  return v_result;
end; $$;

create or replace function public.save_adjustment(
  p_family_id uuid,
  p_transaction_id uuid,
  p_expected_version integer,
  p_local_date date,
  p_amount_minor text,
  p_account_id uuid,
  p_description text,
  p_remarks text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_saved jsonb; v_row public.transactions; v_before jsonb; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN','MEMBER']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_local_date is null or p_amount_minor is null or p_amount_minor !~ '^-?[0-9]{1,15}$' or p_amount_minor::bigint=0 or p_description is null or length(p_description)>240 or p_remarks is null or length(p_remarks)>2000 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved := public.begin_idempotent('save_adjustment',p_idempotency_key,jsonb_build_array(p_family_id,p_transaction_id,p_expected_version,p_local_date,p_amount_minor,p_account_id,p_description,p_remarks));
  if v_saved is not null then return v_saved; end if;
  perform 1 from public.accounts where family_id=p_family_id and id=p_account_id and archived_at is null and opening_date<=p_local_date for share;
  if not found then raise exception 'ACCOUNT_INVALID_OR_DATE_BEFORE_OPENING'; end if;
  if p_transaction_id is null then
    insert into public.transactions(family_id,type,local_date,amount_minor,account_id,category_id,description,remarks,created_by,updated_by)
      values(p_family_id,'ADJUSTMENT',p_local_date,p_amount_minor::bigint,p_account_id,null,trim(p_description),trim(p_remarks),auth.uid(),auth.uid()) returning * into v_row;
  else
    select * into v_row from public.transactions where family_id=p_family_id and id=p_transaction_id for update;
    if not found or v_row.deleted_at is not null or v_row.type <> 'ADJUSTMENT' then raise exception 'NOT_FOUND'; end if;
    if v_row.created_by<>auth.uid() and not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
    if p_expected_version is distinct from v_row.version then raise exception 'VERSION_CONFLICT' using detail=public.ledger_json(v_row)::text; end if;
    v_before := public.ledger_json(v_row);
    update public.transactions set local_date=p_local_date,amount_minor=p_amount_minor::bigint,account_id=p_account_id,description=trim(p_description),remarks=trim(p_remarks),version=version+1,updated_by=auth.uid(),updated_at=now() where id=p_transaction_id returning * into v_row;
  end if;
  v_result := public.ledger_json(v_row);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
    values(p_family_id,auth.uid(),case when p_transaction_id is null then 'ADJUSTMENT_CREATED' else 'ADJUSTMENT_UPDATED' end,'transaction',v_row.id,v_before,v_result,p_idempotency_key);
  perform public.finish_idempotent('save_adjustment',p_idempotency_key,v_result);
  return v_result;
end; $$;

create or replace function public.annual_report(p_family_id uuid, p_year integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_start date; v_end date; v_income numeric; v_expense numeric; v_months jsonb; v_income_categories jsonb; v_expense_categories jsonb;
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_year is null or p_year not between 1900 and 2200 then raise exception 'VALIDATION_FAILED'; end if;
  select make_date(case when fiscal_start_month=1 then p_year else p_year-1 end,fiscal_start_month,1) into v_start from public.families where id=p_family_id;
  if v_start is null then raise exception 'NOT_FOUND'; end if;
  v_end := (v_start + interval '1 year')::date;
  select coalesce(sum(amount_minor) filter(where type='INCOME'),0),coalesce(sum(amount_minor) filter(where type='EXPENSE'),0) into v_income,v_expense from public.transactions where family_id=p_family_id and deleted_at is null and local_date>=v_start and local_date<v_end;
  select coalesce(jsonb_agg(jsonb_build_object('label',to_char(m,'Mon YYYY'),'start',m,'income_minor',coalesce(i,0)::text,'expense_minor',coalesce(e,0)::text,'net_minor',(coalesce(i,0)-coalesce(e,0))::text) order by m),'[]') into v_months
    from (select generate_series(v_start,v_end-interval '1 month','1 month')::date m) months
    left join lateral (select sum(amount_minor) i from public.transactions where family_id=p_family_id and deleted_at is null and type='INCOME' and local_date>=m and local_date<(m+interval '1 month')::date) income on true
    left join lateral (select sum(amount_minor) e from public.transactions where family_id=p_family_id and deleted_at is null and type='EXPENSE' and local_date>=m and local_date<(m+interval '1 month')::date) expense on true;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'name',s.name,'total_minor',s.total::text,'average_minor',(round(s.total/12))::bigint::text,
    'percentage',round(100*s.total/nullif(v_income,0),2),
    'months',(select coalesce(jsonb_agg(jsonb_build_object('start',m.month_start,'total_minor',coalesce(mt.total,0)::text) order by m.month_start),'[]')
      from (select generate_series(v_start,v_end-interval '1 month','1 month')::date month_start) m
      left join lateral (select sum(t2.amount_minor) total from public.transactions t2 where t2.family_id=p_family_id and t2.category_id=s.id and t2.type='INCOME' and t2.deleted_at is null and t2.local_date>=m.month_start and t2.local_date<(m.month_start+interval '1 month')::date) mt on true)
  ) order by s.total desc,s.name,s.id),'[]') into v_income_categories
    from (
      select c.id,c.name,coalesce(t.total,0) total
      from public.categories c
      left join lateral (select sum(x.amount_minor) total from public.transactions x where x.family_id=p_family_id and x.category_id=c.id and x.type='INCOME' and x.deleted_at is null and x.local_date>=v_start and x.local_date<v_end) t on true
      where c.family_id=p_family_id and c.type='INCOME' and (c.archived_at is null or t.total is not null)
    ) s;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'name',s.name,'total_minor',s.total::text,'average_minor',(round(s.total/12))::bigint::text,
    'percentage',round(100*s.total/nullif(v_expense,0),2),
    'months',(select coalesce(jsonb_agg(jsonb_build_object('start',m.month_start,'total_minor',coalesce(mt.total,0)::text) order by m.month_start),'[]')
      from (select generate_series(v_start,v_end-interval '1 month','1 month')::date month_start) m
      left join lateral (select sum(t2.amount_minor) total from public.transactions t2 where t2.family_id=p_family_id and t2.category_id=s.id and t2.type='EXPENSE' and t2.deleted_at is null and t2.local_date>=m.month_start and t2.local_date<(m.month_start+interval '1 month')::date) mt on true)
  ) order by s.total desc,s.name,s.id),'[]') into v_expense_categories
    from (
      select c.id,c.name,coalesce(t.total,0) total
      from public.categories c
      left join lateral (select sum(x.amount_minor) total from public.transactions x where x.family_id=p_family_id and x.category_id=c.id and x.type='EXPENSE' and x.deleted_at is null and x.local_date>=v_start and x.local_date<v_end) t on true
      where c.family_id=p_family_id and c.type='EXPENSE' and (c.archived_at is null or t.total is not null)
    ) s;
  return jsonb_build_object(
    'start',v_start,'end',v_end,'year',p_year,
    'income_minor',v_income::text,'expense_minor',v_expense::text,'net_minor',(v_income-v_expense)::text,
    'average_income_minor',(round(v_income/12))::bigint::text,'average_expense_minor',(round(v_expense/12))::bigint::text,'average_net_minor',(round((v_income-v_expense)/12))::bigint::text,
    'expense_to_income',round(100*v_expense/nullif(v_income,0),2),'savings_rate',round(100*(v_income-v_expense)/nullif(v_income,0),2),
    'months',v_months,'income_categories',v_income_categories,'expense_categories',v_expense_categories
  );
end; $$;

create or replace function public.monthly_report(p_family_id uuid,p_year integer,p_month integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_start date; v_end date; v_income numeric; v_expense numeric; v_categories jsonb;
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_year is null or p_year not between 1900 and 2200 or p_month is null or p_month not between 1 and 12 then raise exception 'VALIDATION_FAILED'; end if;
  v_start:=make_date(p_year,p_month,1); v_end:=(v_start+interval '1 month')::date;
  select coalesce(sum(amount_minor) filter(where type='INCOME'),0),coalesce(sum(amount_minor) filter(where type='EXPENSE'),0) into v_income,v_expense
    from public.transactions where family_id=p_family_id and deleted_at is null and local_date>=v_start and local_date<v_end;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'name',s.name,'type',s.type,'total_minor',s.total::text,
    'percentage',coalesce(case when s.type='INCOME' then round(100*s.total/nullif(v_income,0),2) else round(100*s.total/nullif(v_expense,0),2) end,0)
  ) order by s.type,s.total desc,s.name,s.id),'[]') into v_categories
  from (
    select c.id,c.name,c.type,coalesce(t.total,0) total
    from public.categories c
    left join lateral (select sum(x.amount_minor) total from public.transactions x where x.family_id=p_family_id and x.category_id=c.id and x.deleted_at is null and x.local_date>=v_start and x.local_date<v_end) t on true
    where c.family_id=p_family_id and (c.archived_at is null or t.total is not null)
  ) s;
  return jsonb_build_object('start',v_start,'end',v_end,'income_minor',v_income::text,'expense_minor',v_expense::text,'net_minor',(v_income-v_expense)::text,'expense_to_income',round(100*v_expense/nullif(v_income,0),2),'savings_rate',round(100*(v_income-v_expense)/nullif(v_income,0),2),'categories',v_categories);
end; $$;

create or replace function public.custom_report(p_family_id uuid, p_start date, p_end date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_income numeric; v_expense numeric; v_categories jsonb;
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_start is null or p_end is null or p_start>=p_end then raise exception 'VALIDATION_FAILED'; end if;
  select coalesce(sum(amount_minor) filter(where type='INCOME'),0),coalesce(sum(amount_minor) filter(where type='EXPENSE'),0) into v_income,v_expense from public.transactions where family_id=p_family_id and deleted_at is null and local_date>=p_start and local_date<=p_end;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'type',s.type,'total_minor',s.total::text,'percentage',coalesce(round(100*s.total/nullif(case when s.type='INCOME' then v_income else v_expense end,0),2),0)) order by s.type,s.total desc,s.name,s.id),'[]') into v_categories
    from (
      select c.id,c.name,c.type,coalesce(t.total,0) total
      from public.categories c
      left join lateral (select sum(x.amount_minor) total from public.transactions x where x.family_id=p_family_id and x.category_id=c.id and x.deleted_at is null and x.local_date>=p_start and x.local_date<=p_end) t on true
      where c.family_id=p_family_id and (c.archived_at is null or t.total is not null)
    ) s;
  return jsonb_build_object('start',p_start,'end',p_end,'income_minor',v_income::text,'expense_minor',v_expense::text,'net_minor',(v_income-v_expense)::text,'expense_to_income',round(100*v_expense/nullif(v_income,0),2),'savings_rate',round(100*(v_income-v_expense)/nullif(v_income,0),2),'categories',v_categories);
end; $$;

create or replace function public.list_accounts(p_family_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(
    to_jsonb(a)
      || jsonb_build_object(
        'beginning_balance_minor', a.beginning_balance_minor::text,
        'total_deposits_minor', coalesce((select sum(t.amount_minor) from public.transactions t where t.family_id=p_family_id and t.account_id=a.id and t.type='INCOME' and t.deleted_at is null),0)::text,
        'total_withdrawals_minor', coalesce((select sum(t.amount_minor) from public.transactions t where t.family_id=p_family_id and t.account_id=a.id and t.type='EXPENSE' and t.deleted_at is null),0)::text,
        'total_adjustments_minor', coalesce((select sum(t.amount_minor) from public.transactions t where t.family_id=p_family_id and t.account_id=a.id and t.type='ADJUSTMENT' and t.deleted_at is null),0)::text,
        'balance_minor', (a.beginning_balance_minor + coalesce((select sum(case when t.type='EXPENSE' then -t.amount_minor else t.amount_minor end) from public.transactions t where t.family_id=p_family_id and t.account_id=a.id and t.deleted_at is null),0))::text
      ) order by a.name) from public.accounts a where a.family_id=p_family_id and a.archived_at is null),'[]');
end; $$;

create or replace function public.list_accounts_for_management(p_family_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(
    to_jsonb(a)
      || jsonb_build_object(
        'beginning_balance_minor', a.beginning_balance_minor::text,
        'actual_balance_minor', case when a.actual_balance_minor is null then null else a.actual_balance_minor::text end,
        'total_deposits_minor', coalesce((select sum(t.amount_minor) from public.transactions t where t.family_id=p_family_id and t.account_id=a.id and t.type='INCOME' and t.deleted_at is null),0)::text,
        'total_withdrawals_minor', coalesce((select sum(t.amount_minor) from public.transactions t where t.family_id=p_family_id and t.account_id=a.id and t.type='EXPENSE' and t.deleted_at is null),0)::text,
        'total_adjustments_minor', coalesce((select sum(t.amount_minor) from public.transactions t where t.family_id=p_family_id and t.account_id=a.id and t.type='ADJUSTMENT' and t.deleted_at is null),0)::text,
        'balance_minor', (a.beginning_balance_minor + coalesce((select sum(case when t.type='EXPENSE' then -t.amount_minor else t.amount_minor end) from public.transactions t where t.family_id=p_family_id and t.account_id=a.id and t.deleted_at is null),0))::text
      ) order by (a.archived_at is not null),a.name
  ) from public.accounts a where a.family_id=p_family_id),'[]');
end; $$;

create or replace function public.list_deleted_transactions(p_family_id uuid, p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(
    public.ledger_json(t)
      || jsonb_build_object(
        'account_name', a.name,
        'category_name', c.name,
        'creator_name', p.display_name
      ) order by t.deleted_at desc, t.id desc)
    from (
      select * from public.transactions x
      where x.family_id=p_family_id and x.deleted_at is not null
      order by x.deleted_at desc, x.id desc
      limit greatest(1,least(coalesce(p_limit,100),200))
    ) t
    join public.accounts a on a.family_id=t.family_id and a.id=t.account_id
    join public.profiles p on p.user_id=t.created_by
    left join public.categories c on c.family_id=t.family_id and c.id=t.category_id
  ),'[]');
end; $$;

create index if not exists transactions_family_text_search
  on public.transactions using gin (to_tsvector('simple',coalesce(description,'')||' '||coalesce(remarks,'')));
create index if not exists transactions_family_amount_active
  on public.transactions(family_id,amount_minor desc,id) where deleted_at is null;

create or replace function public.search_transactions(
  p_family_id uuid,
  p_start date default null,
  p_end date default null,
  p_type text default null,
  p_account_id uuid default null,
  p_category_id uuid default null,
  p_member_id uuid default null,
  p_search text default null,
  p_sort text default 'NEWEST',
  p_offset integer default 0,
  p_limit integer default 30
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if coalesce(p_sort,'NEWEST') not in ('NEWEST','OLDEST','HIGHEST_AMOUNT','LOWEST_AMOUNT','CATEGORY','ACCOUNT') or coalesce(p_offset,0)<0 then raise exception 'VALIDATION_FAILED'; end if;
  return coalesce((select jsonb_agg(
    public.ledger_json(r.transaction_row)||jsonb_build_object('account_name',r.account_name,'category_name',r.category_name,'creator_name',r.creator_name)
    order by
      case when p_sort='OLDEST' then (r.transaction_row).local_date end asc,
      case when p_sort='HIGHEST_AMOUNT' then abs((r.transaction_row).amount_minor) end desc,
      case when p_sort='LOWEST_AMOUNT' then abs((r.transaction_row).amount_minor) end asc,
      case when p_sort='CATEGORY' then r.category_name end asc nulls last,
      case when p_sort='ACCOUNT' then r.account_name end asc,
      case when p_sort='NEWEST' then (r.transaction_row).local_date end desc,
      (r.transaction_row).id desc
  ) from (
    select x transaction_row,a.name account_name,c.name category_name,p.display_name creator_name
    from public.transactions x
    join public.accounts a on a.family_id=x.family_id and a.id=x.account_id
    join public.profiles p on p.user_id=x.created_by
    left join public.categories c on c.family_id=x.family_id and c.id=x.category_id
    where x.family_id=p_family_id and x.deleted_at is null
      and (p_start is null or x.local_date>=p_start) and (p_end is null or x.local_date<p_end)
      and (p_type is null or p_type='' or x.type::text=p_type)
      and (p_account_id is null or x.account_id=p_account_id)
      and (p_category_id is null or x.category_id=p_category_id)
      and (p_member_id is null or x.created_by=p_member_id)
      and (p_search is null or trim(p_search)='' or
        to_tsvector('simple',coalesce(x.description,'')||' '||coalesce(x.remarks,''))@@plainto_tsquery('simple',trim(p_search)) or
        strpos(lower(a.name),lower(trim(p_search)))>0 or strpos(lower(coalesce(c.name,'')),lower(trim(p_search)))>0)
    order by
      case when p_sort='OLDEST' then x.local_date end asc,
      case when p_sort='HIGHEST_AMOUNT' then abs(x.amount_minor) end desc,
      case when p_sort='LOWEST_AMOUNT' then abs(x.amount_minor) end asc,
      case when p_sort='CATEGORY' then c.name end asc nulls last,
      case when p_sort='ACCOUNT' then a.name end asc,
      case when p_sort='NEWEST' then x.local_date end desc,
      x.id desc
    offset coalesce(p_offset,0) limit greatest(1,least(coalesce(p_limit,30),100))
  ) r),'[]');
end; $$;

create or replace function public.change_member_role(
  p_family_id uuid,
  p_user_id uuid,
  p_role public.member_role,
  p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_saved jsonb; v_member public.family_members; v_before jsonb; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_user_id is null or p_role is null or p_role='OWNER' or p_user_id=auth.uid() then raise exception 'OWNER_ROLE_PROTECTED'; end if;
  v_saved := public.begin_idempotent('change_member_role',p_idempotency_key,jsonb_build_array(p_family_id,p_user_id,p_role));
  if v_saved is not null then return v_saved; end if;
  select * into v_member from public.family_members
    where family_id=p_family_id and user_id=p_user_id and status='ACTIVE'
    for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_member.role='OWNER' then raise exception 'OWNER_ROLE_PROTECTED'; end if;
  v_before := jsonb_build_object('user_id',v_member.user_id,'role',v_member.role,'status',v_member.status);
  update public.family_members set role=p_role,updated_at=now()
    where id=v_member.id returning * into v_member;
  v_result := jsonb_build_object('user_id',v_member.user_id,'role',v_member.role,'status',v_member.status);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
    values(p_family_id,auth.uid(),'MEMBER_ROLE_CHANGED','member',v_member.user_id,v_before,v_result,p_idempotency_key);
  perform public.finish_idempotent('change_member_role',p_idempotency_key,v_result);
  return v_result;
end; $$;

revoke all on function public.create_category(uuid,public.category_type,text,uuid) from public,anon,authenticated;
revoke all on function public.get_family_settings(uuid) from public,anon,authenticated;
revoke all on function public.update_family_settings(uuid,integer,text,text,text,smallint,smallint,uuid) from public,anon,authenticated;
revoke all on function public.update_category(uuid,uuid,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.archive_category(uuid,uuid,boolean,uuid) from public,anon,authenticated;
revoke all on function public.reorder_categories(uuid,public.category_type,uuid[],uuid) from public,anon,authenticated;
revoke all on function public.update_account(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.archive_account(uuid,uuid,boolean,uuid) from public,anon,authenticated;
revoke all on function public.reconcile_account(uuid,uuid,text,date,uuid) from public,anon,authenticated;
revoke all on function public.save_adjustment(uuid,uuid,integer,date,text,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.annual_report(uuid,integer) from public,anon,authenticated;
revoke all on function public.custom_report(uuid,date,date) from public,anon,authenticated;
revoke all on function public.list_accounts(uuid) from public,anon,authenticated;
revoke all on function public.list_accounts_for_management(uuid) from public,anon,authenticated;
revoke all on function public.list_deleted_transactions(uuid,integer) from public,anon,authenticated;
revoke all on function public.search_transactions(uuid,date,date,text,uuid,uuid,uuid,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.change_member_role(uuid,uuid,public.member_role,uuid) from public,anon,authenticated;
grant execute on function public.create_category(uuid,public.category_type,text,uuid) to authenticated;
grant execute on function public.get_family_settings(uuid) to authenticated;
grant execute on function public.update_family_settings(uuid,integer,text,text,text,smallint,smallint,uuid) to authenticated;
grant execute on function public.update_category(uuid,uuid,text,integer,uuid) to authenticated;
grant execute on function public.archive_category(uuid,uuid,boolean,uuid) to authenticated;
grant execute on function public.reorder_categories(uuid,public.category_type,uuid[],uuid) to authenticated;
grant execute on function public.update_account(uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.archive_account(uuid,uuid,boolean,uuid) to authenticated;
grant execute on function public.reconcile_account(uuid,uuid,text,date,uuid) to authenticated;
grant execute on function public.save_adjustment(uuid,uuid,integer,date,text,uuid,text,text,uuid) to authenticated;
grant execute on function public.annual_report(uuid,integer) to authenticated;
grant execute on function public.custom_report(uuid,date,date) to authenticated;
grant execute on function public.list_accounts(uuid) to authenticated;
grant execute on function public.list_accounts_for_management(uuid) to authenticated;
grant execute on function public.list_deleted_transactions(uuid,integer) to authenticated;
grant execute on function public.search_transactions(uuid,date,date,text,uuid,uuid,uuid,text,text,integer,integer) to authenticated;
grant execute on function public.change_member_role(uuid,uuid,public.member_role,uuid) to authenticated;
