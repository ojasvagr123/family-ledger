begin;
select plan(6);

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('77777777-7777-4777-8777-777777777777','authenticated','authenticated','demo-owner@example.test','{}','{}',now(),now());

select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
set local role authenticated;

create temp table demo_state(f uuid);
grant all on demo_state to authenticated;
insert into demo_state(f)
select (public.create_demo_family('77777777-0000-4000-8000-000000000001')->>'id')::uuid;

select is((select name from public.families where id=f),'Sample family','demo workflow creates an isolated sample family') from demo_state;
select is((select role::text from public.family_members where family_id=f and user_id='77777777-7777-4777-8777-777777777777'),'OWNER','caller owns the sample family') from demo_state;
select is((select count(*) from public.accounts where family_id=f),2::bigint,'sample family includes two accounts') from demo_state;
select is((select count(*) from public.transactions where family_id=f),7::bigint,'sample family includes seven transactions') from demo_state;
select is((select sum(case when type='EXPENSE' then -amount_minor else amount_minor end) from public.transactions where family_id=f),7425000::numeric,'sample transactions produce a deterministic net') from demo_state;
select is((public.create_demo_family('77777777-0000-4000-8000-000000000001')->>'id')::uuid,(select f from demo_state),'demo creation is idempotent');

reset role;
select * from finish();
rollback;

