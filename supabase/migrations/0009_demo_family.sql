-- Optional, isolated sample data for a newly signed-in user.
-- The workflow creates a normal family owned by the caller, so every existing
-- permission, report, edit, archive and delete path works exactly as it does for
-- a real household. No global seed records or service-role access are required.

create or replace function public.create_demo_family(p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saved jsonb;
  v_family jsonb;
  v_family_id uuid;
  v_bank_id uuid;
  v_cash_id uuid;
  v_salary_id uuid;
  v_groceries_id uuid;
  v_housing_id uuid;
  v_utilities_id uuid;
  v_transport_id uuid;
  v_dining_id uuid;
  v_healthcare_id uuid;
  v_result jsonb;
begin
  v_saved := public.begin_idempotent(
    'create_demo_family',
    p_idempotency_key,
    jsonb_build_object('template', 'household-v1')
  );
  if v_saved is not null then return v_saved; end if;

  v_family := public.create_family(
    'Sample family',
    'INR',
    '₹',
    'Asia/Kolkata',
    1::smallint,
    extract(year from current_date)::smallint,
    p_idempotency_key
  );
  v_family_id := (v_family->>'id')::uuid;

  select id into v_salary_id from public.categories where family_id=v_family_id and type='INCOME' and name='Salary';
  select id into v_groceries_id from public.categories where family_id=v_family_id and type='EXPENSE' and name='Groceries';
  select id into v_housing_id from public.categories where family_id=v_family_id and type='EXPENSE' and name='Housing';
  select id into v_utilities_id from public.categories where family_id=v_family_id and type='EXPENSE' and name='Utilities';
  select id into v_transport_id from public.categories where family_id=v_family_id and type='EXPENSE' and name='Transport';
  select id into v_dining_id from public.categories where family_id=v_family_id and type='EXPENSE' and name='Dining';
  select id into v_healthcare_id from public.categories where family_id=v_family_id and type='EXPENSE' and name='Healthcare';

  insert into public.accounts(
    family_id,name,account_type,opening_date,beginning_balance_minor,
    institution,sort_order,created_by
  ) values (
    v_family_id,'Everyday bank','BANK',current_date-365,2500000,
    'Sample Bank',1,auth.uid()
  ) returning id into v_bank_id;

  insert into public.accounts(
    family_id,name,account_type,opening_date,beginning_balance_minor,
    sort_order,created_by
  ) values (
    v_family_id,'Household cash','CASH',current_date-365,300000,
    2,auth.uid()
  ) returning id into v_cash_id;

  insert into public.transactions(
    family_id,type,local_date,amount_minor,account_id,category_id,
    description,remarks,created_by,updated_by
  ) values
    (v_family_id,'INCOME',current_date-14,12000000,v_bank_id,v_salary_id,'Monthly salary','Sample transaction',auth.uid(),auth.uid()),
    (v_family_id,'EXPENSE',current_date-12,2500000,v_bank_id,v_housing_id,'Home rent','Sample transaction',auth.uid(),auth.uid()),
    (v_family_id,'EXPENSE',current_date-10,820000,v_bank_id,v_groceries_id,'Monthly groceries','Sample transaction',auth.uid(),auth.uid()),
    (v_family_id,'EXPENSE',current_date-8,420000,v_bank_id,v_utilities_id,'Electricity and internet','Sample transaction',auth.uid(),auth.uid()),
    (v_family_id,'EXPENSE',current_date-6,360000,v_cash_id,v_transport_id,'Local travel','Sample transaction',auth.uid(),auth.uid()),
    (v_family_id,'EXPENSE',current_date-4,285000,v_cash_id,v_dining_id,'Family dinner','Sample transaction',auth.uid(),auth.uid()),
    (v_family_id,'EXPENSE',current_date-2,190000,v_bank_id,v_healthcare_id,'Pharmacy','Sample transaction',auth.uid(),auth.uid());

  update public.families
  set notes='This is sample data. Explore reports, edit transactions, invite a member, or leave this family when you are ready to use your own ledger.',
      notes_updated_by=auth.uid(), notes_updated_at=now(), updated_at=now()
  where id=v_family_id;

  insert into public.audit_events(
    family_id,actor_user_id,action,entity_type,entity_id,after_data,request_id
  ) values (
    v_family_id,auth.uid(),'DEMO_FAMILY_SEEDED','family',v_family_id,
    jsonb_build_object('template','household-v1','accounts',2,'transactions',7),
    p_idempotency_key
  );

  v_result := v_family || jsonb_build_object(
    'sample', true,
    'account_count', 2,
    'transaction_count', 7
  );
  perform public.finish_idempotent('create_demo_family',p_idempotency_key,v_result);
  return v_result;
end;
$$;

revoke all on function public.create_demo_family(uuid) from public,anon,authenticated;
grant execute on function public.create_demo_family(uuid) to authenticated;

