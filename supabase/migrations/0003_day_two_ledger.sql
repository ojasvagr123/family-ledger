-- All client financial writes go through these authorized, atomic RPCs.
create or replace function public.ledger_json(p_row public.transactions)
returns jsonb language sql immutable set search_path = public as $$
  select to_jsonb(p_row) || jsonb_build_object('amount_minor', p_row.amount_minor::text);
$$;
revoke all on function public.ledger_json(public.transactions) from public, anon, authenticated;

create or replace function public.create_account(p_family_id uuid, p_name text, p_account_type text, p_opening_date date, p_balance_minor text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_saved jsonb; v_row public.accounts; v_result jsonb;
begin
  if not public.has_family_role(p_family_id, array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 80 or p_opening_date is null or p_balance_minor is null or p_balance_minor !~ '^-?[0-9]{1,15}$' then raise exception 'VALIDATION_FAILED'; end if;
  v_saved := public.begin_idempotent('create_account',p_idempotency_key,jsonb_build_array(p_family_id,trim(p_name),p_account_type,p_opening_date,p_balance_minor));
  if v_saved is not null then return v_saved; end if;
  insert into public.accounts(family_id,name,account_type,opening_date,beginning_balance_minor,created_by)
  values(p_family_id,trim(p_name),p_account_type,p_opening_date,p_balance_minor::bigint,auth.uid()) returning * into v_row;
  v_result := to_jsonb(v_row) || jsonb_build_object('beginning_balance_minor',v_row.beginning_balance_minor::text);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,request_id) values(p_family_id,auth.uid(),'ACCOUNT_CREATED','account',v_row.id,p_idempotency_key);
  perform public.finish_idempotent('create_account',p_idempotency_key,v_result);
  return v_result;
end; $$;

create or replace function public.save_transaction(p_family_id uuid, p_transaction_id uuid, p_expected_version integer, p_type public.transaction_type, p_local_date date, p_amount_minor text, p_account_id uuid, p_category_id uuid, p_description text, p_remarks text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_saved jsonb; v_row public.transactions; v_before jsonb; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN','MEMBER']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_type is null or p_type not in ('INCOME','EXPENSE') or p_local_date is null or p_amount_minor is null or p_amount_minor !~ '^[0-9]{1,15}$' or p_amount_minor::bigint <= 0 or p_description is null or length(p_description)>240 or p_remarks is null or length(p_remarks)>2000 then raise exception 'VALIDATION_FAILED'; end if;
  v_saved := public.begin_idempotent('save_transaction',p_idempotency_key,jsonb_build_array(p_family_id,p_transaction_id,p_expected_version,p_type,p_local_date,p_amount_minor,p_account_id,p_category_id,p_description,p_remarks));
  if v_saved is not null then return v_saved; end if;
  perform 1 from public.accounts where family_id=p_family_id and id=p_account_id and archived_at is null and opening_date<=p_local_date for share;
  if not found then raise exception 'ACCOUNT_INVALID_OR_DATE_BEFORE_OPENING'; end if;
  perform 1 from public.categories where family_id=p_family_id and id=p_category_id and archived_at is null and type::text=p_type::text for share;
  if not found then raise exception 'CATEGORY_INVALID'; end if;
  if p_transaction_id is null then
    insert into public.transactions(family_id,type,local_date,amount_minor,account_id,category_id,description,remarks,created_by,updated_by)
    values(p_family_id,p_type,p_local_date,p_amount_minor::bigint,p_account_id,p_category_id,trim(p_description),trim(p_remarks),auth.uid(),auth.uid()) returning * into v_row;
  else
    select * into v_row from public.transactions where family_id=p_family_id and id=p_transaction_id for update;
    if not found or v_row.deleted_at is not null then raise exception 'NOT_FOUND'; end if;
    if v_row.created_by<>auth.uid() and not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
    if p_expected_version is distinct from v_row.version then raise exception 'VERSION_CONFLICT' using detail=public.ledger_json(v_row)::text; end if;
    v_before := public.ledger_json(v_row);
    update public.transactions set type=p_type,local_date=p_local_date,amount_minor=p_amount_minor::bigint,account_id=p_account_id,category_id=p_category_id,description=trim(p_description),remarks=trim(p_remarks),version=version+1,updated_by=auth.uid(),updated_at=now() where id=p_transaction_id returning * into v_row;
  end if;
  v_result := public.ledger_json(v_row);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
  values(p_family_id,auth.uid(),case when p_transaction_id is null then 'TRANSACTION_CREATED' else 'TRANSACTION_UPDATED' end,'transaction',v_row.id,v_before,v_result,p_idempotency_key);
  perform public.finish_idempotent('save_transaction',p_idempotency_key,v_result);
  return v_result;
end; $$;

create or replace function public.set_transaction_deleted(p_family_id uuid,p_transaction_id uuid,p_expected_version integer,p_deleted boolean,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_saved jsonb; v_row public.transactions; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER','ADMIN','MEMBER']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_deleted is null then raise exception 'VALIDATION_FAILED'; end if;
  v_saved := public.begin_idempotent('set_transaction_deleted',p_idempotency_key,jsonb_build_array(p_family_id,p_transaction_id,p_expected_version,p_deleted));
  if v_saved is not null then return v_saved; end if;
  select * into v_row from public.transactions where id=p_transaction_id and family_id=p_family_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_row.created_by<>auth.uid() and not public.has_family_role(p_family_id,array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_expected_version is distinct from v_row.version then raise exception 'VERSION_CONFLICT' using detail=public.ledger_json(v_row)::text; end if;
  update public.transactions set deleted_at=case when p_deleted then now() else null end,version=version+1,updated_by=auth.uid(),updated_at=now() where id=p_transaction_id returning * into v_row;
  v_result := public.ledger_json(v_row);
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,request_id) values(p_family_id,auth.uid(),case when p_deleted then 'TRANSACTION_DELETED' else 'TRANSACTION_RESTORED' end,'transaction',v_row.id,p_idempotency_key);
  perform public.finish_idempotent('set_transaction_deleted',p_idempotency_key,v_result);
  return v_result;
end; $$;

create or replace function public.list_accounts(p_family_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('beginning_balance_minor',a.beginning_balance_minor::text,'balance_minor',(a.beginning_balance_minor+coalesce((select sum(case when t.type='EXPENSE' then -t.amount_minor else t.amount_minor end) from public.transactions t where t.family_id=p_family_id and t.account_id=a.id and t.deleted_at is null),0))::text) order by a.name) from public.accounts a where a.family_id=p_family_id and a.archived_at is null),'[]');
end; $$;

create or replace function public.list_transactions(p_family_id uuid,p_start date default null,p_end date default null,p_type text default null,p_account_id uuid default null,p_category_id uuid default null,p_member_id uuid default null,p_cursor_date date default null,p_cursor_id uuid default null,p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(public.ledger_json(t)||jsonb_build_object('account_name',a.name,'category_name',c.name) order by t.local_date desc,t.id desc)
  from (select * from public.transactions x where x.family_id=p_family_id and x.deleted_at is null
    and (p_start is null or x.local_date>=p_start) and (p_end is null or x.local_date<p_end)
    and (p_type is null or x.type::text=p_type) and (p_account_id is null or x.account_id=p_account_id)
    and (p_category_id is null or x.category_id=p_category_id) and (p_member_id is null or x.created_by=p_member_id)
    and (p_cursor_date is null or (x.local_date,x.id)<(p_cursor_date,p_cursor_id))
    order by x.local_date desc,x.id desc limit greatest(1,least(coalesce(p_limit,30),100))) t
    join public.accounts a on a.family_id=t.family_id and a.id=t.account_id
    left join public.categories c on c.family_id=t.family_id and c.id=t.category_id),'[]');
end; $$;
create index transactions_keyset_active on public.transactions(family_id,local_date desc,id desc) where deleted_at is null;

create or replace function public.monthly_report(p_family_id uuid,p_year integer,p_month integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_start date; v_end date; v_income numeric; v_expense numeric; v_categories jsonb;
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  if p_year is null or p_year not between 1900 and 2200 or p_month is null or p_month not between 1 and 12 then raise exception 'VALIDATION_FAILED'; end if;
  v_start:=make_date(p_year,p_month,1); v_end:=(v_start+interval '1 month')::date;
  select coalesce(sum(amount_minor) filter(where type='INCOME'),0),coalesce(sum(amount_minor) filter(where type='EXPENSE'),0) into v_income,v_expense
  from public.transactions where family_id=p_family_id and deleted_at is null and local_date>=v_start and local_date<v_end;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'type',s.type,'total_minor',s.total::text,'percentage',case when s.type='INCOME' then round(100*s.total/nullif(v_income,0),2) else round(100*s.total/nullif(v_expense,0),2) end) order by s.total desc,s.name,s.id),'[]') into v_categories
  from (select c.id,c.name,c.type,sum(t.amount_minor) total from public.transactions t join public.categories c on c.family_id=t.family_id and c.id=t.category_id where t.family_id=p_family_id and t.deleted_at is null and t.local_date>=v_start and t.local_date<v_end and t.type in ('INCOME','EXPENSE') group by c.id,c.name,c.type) s;
  return jsonb_build_object('start',v_start,'end',v_end,'income_minor',v_income::text,'expense_minor',v_expense::text,'net_minor',(v_income-v_expense)::text,'expense_to_income',round(100*v_expense/nullif(v_income,0),2),'savings_rate',round(100*(v_income-v_expense)/nullif(v_income,0),2),'categories',v_categories);
end; $$;

revoke all on function public.create_account(uuid,text,text,date,text,uuid) from public,anon,authenticated;
revoke all on function public.save_transaction(uuid,uuid,integer,public.transaction_type,date,text,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.set_transaction_deleted(uuid,uuid,integer,boolean,uuid) from public,anon,authenticated;
revoke all on function public.list_accounts(uuid) from public,anon,authenticated;
revoke all on function public.list_transactions(uuid,date,date,text,uuid,uuid,uuid,date,uuid,integer) from public,anon,authenticated;
revoke all on function public.monthly_report(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.create_account(uuid,text,text,date,text,uuid) to authenticated;
grant execute on function public.save_transaction(uuid,uuid,integer,public.transaction_type,date,text,uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.set_transaction_deleted(uuid,uuid,integer,boolean,uuid) to authenticated;
grant execute on function public.list_accounts(uuid) to authenticated;
grant execute on function public.list_transactions(uuid,date,date,text,uuid,uuid,uuid,date,uuid,integer) to authenticated;
grant execute on function public.monthly_report(uuid,integer,integer) to authenticated;
