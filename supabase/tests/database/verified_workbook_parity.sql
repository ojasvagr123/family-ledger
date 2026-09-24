begin;
select no_plan();

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('77777777-7777-4777-8777-777777777777','authenticated','authenticated','workbook-owner@example.test','{}','{}',now(),now());

create temp table workbook_state(f uuid,a uuid,income uuid,expense uuid);
grant all on workbook_state to authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
set local role authenticated;

insert into workbook_state(f)
select (public.create_family('Workbook parity','INR','₹','Asia/Kolkata',4::smallint,2026::smallint,'77777777-0000-4000-8000-000000000001')->>'id')::uuid;

select is(public.get_family_settings(f)->>'currency_symbol','₹','family settings preserve the workbook currency symbol') from workbook_state;
select is((select currency_symbol from public.list_my_families() where id=f),'₹','family list exposes the selected currency symbol') from workbook_state;
select is((select count(*) from public.categories where family_id=f),16::bigint,'new family receives all default income and expense categories') from workbook_state;

update workbook_state set a=(public.create_account(f,'Cash','CASH','2026-04-01','10000',gen_random_uuid())->>'id')::uuid;
update workbook_state set income=(select id from public.categories where family_id=f and type='INCOME' order by sort_order limit 1), expense=(select id from public.categories where family_id=f and type='EXPENSE' order by sort_order limit 1);
select public.save_transaction(f,null,null,'INCOME','2026-04-01','100000',a,income,'Salary','',gen_random_uuid()) from workbook_state;
select public.save_transaction(f,null,null,'EXPENSE','2026-04-01','25000',a,expense,'Groceries','',gen_random_uuid()) from workbook_state;

select lives_ok(format('select public.custom_report(%L,''2026-04-01'',''2026-04-01'')',f),'a one-day custom report is valid') from workbook_state;
select is(public.custom_report(f,'2026-04-01','2026-04-01')->>'income_minor','100000','same-day report includes income on that day') from workbook_state;
select is(public.custom_report(f,'2026-04-01','2026-04-01')->>'expense_minor','25000','same-day report includes expenses on that day') from workbook_state;
select is(public.annual_report(f,2027)->>'start','2026-04-01','April fiscal year starts in the preceding calendar year') from workbook_state;
select is(jsonb_array_length(public.annual_report(f,2027)->'months'),12,'annual report always returns twelve monthly columns') from workbook_state;
select is(jsonb_array_length(public.annual_report(f,2027)->'income_categories'),5,'annual report includes zero-value active income categories') from workbook_state;
select is(jsonb_array_length(public.annual_report(f,2027)->'expense_categories'),11,'annual report includes zero-value active expense categories') from workbook_state;

select is(public.update_family_settings(f,1,'Workbook parity','USD','$','Asia/Kolkata',4::smallint,2026::smallint,'77777777-0000-4000-8000-000000000002')->>'currency_symbol','$','owners can update the display symbol') from workbook_state;
select is(public.get_family_settings(f)->>'currency_code','USD','currency code update is visible') from workbook_state;
select is((select currency_symbol from public.list_my_families() where id=f),'$','updated symbol reaches the active-family selector') from workbook_state;
select throws_ok(format('select public.custom_report(%L,''2026-04-02'',''2026-04-01'')',f),'P0001','VALIDATION_FAILED','backwards date ranges remain invalid') from workbook_state;

reset role;
set local role anon;
select throws_ok('select public.list_my_families()','42501',null,'anonymous users cannot list families');
select throws_ok('select public.create_family(''Anonymous'',''INR'',''₹'',''Asia/Kolkata'',4::smallint,2026::smallint,gen_random_uuid())','42501',null,'anonymous users cannot create families');
reset role;

select * from finish();
rollback;
