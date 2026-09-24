begin;
select no_plan();

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('88888888-8888-4888-8888-888888888888','authenticated','authenticated','completion-owner@example.test','{}','{}',now(),now()),
('99999999-9999-4999-8999-999999999999','authenticated','authenticated','completion-member@example.test','{}','{}',now(),now());

create temp table completion_state(f uuid,a1 uuid,a2 uuid,expense uuid,batch uuid,imported uuid);
grant all on completion_state to authenticated;
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',true);
set local role authenticated;

insert into completion_state(f) select (public.create_family('Completion family','INR','₹','Asia/Kolkata',4::smallint,2026::smallint,gen_random_uuid())->>'id')::uuid;
update completion_state set a1=(public.create_account_extended(f,'Everyday bank','BANK','2026-04-01','100000','Example Bank',1,false,gen_random_uuid())->>'id')::uuid;
update completion_state set a2=(public.create_account_extended(f,'Savings','INVESTMENT','2026-04-01','0','Example Bank',2,false,gen_random_uuid())->>'id')::uuid;
update completion_state set expense=(select id from public.categories where family_id=f and type='EXPENSE' order by sort_order limit 1);

select is(public.get_my_profile()->>'display_name','completion-owner','new users receive a profile');
select is(public.update_my_profile('Family Owner',null,'en-IN','Asia/Kolkata',gen_random_uuid())->>'display_name','Family Owner','profile can be updated');
select is(public.update_family_notes(f,'Pay school fees on the tenth.',1,gen_random_uuid())->>'notes','Pay school fees on the tenth.','owners can save household notes') from completion_state;
select is(public.get_family_notes(f)->>'notes','Pay school fees on the tenth.','active members can read household notes') from completion_state;

select is(public.create_account_transfer(f,a1,a2,'2026-04-02','25000','Move to savings','',gen_random_uuid())->>'transfer_group_id' is not null,true,'atomic transfer returns a group id') from completion_state;
select is((select count(*) from public.transactions where family_id=f and transfer_group_id is not null),2::bigint,'atomic transfer creates two linked adjustments') from completion_state;
select is((select sum(amount_minor) from public.transactions where family_id=f and transfer_group_id is not null),0::numeric,'linked transfer has zero household net effect') from completion_state;

select is(public.create_category_extended(f,'EXPENSE','Temporary','#123ABC',gen_random_uuid())->>'color','#123ABC','categories store a display color') from completion_state;
select is(public.delete_unused_category(f,(select id from public.categories where family_id=f and name='Temporary'),gen_random_uuid())->>'deleted','true','unused categories can be deleted') from completion_state;

update completion_state set batch=(public.begin_import_batch(f,'sample.csv','abc123','{}'::jsonb,2,gen_random_uuid())->>'id')::uuid;
update completion_state set imported=(public.import_batch_transaction(f,batch,1,'fingerprint-0000000000000001','EXPENSE','2026-04-03','1000',a1,expense,'Imported row','',gen_random_uuid())->>'transaction_id')::uuid;
select is(public.import_batch_transaction(f,batch,2,'fingerprint-0000000000000001','EXPENSE','2026-04-03','1000',a1,expense,'Imported row','',gen_random_uuid())->>'status','EXACT_DUPLICATE','duplicate import fingerprint is skipped') from completion_state;
select is(public.finish_import_batch(f,batch,false)->>'imported_rows','1','import batch records imported rows') from completion_state;
select is((public.preview_import_duplicates(f,array['fingerprint-0000000000000001']))[1],'fingerprint-0000000000000001','duplicate preview finds an existing fingerprint') from completion_state;
select is(jsonb_array_length(public.search_transactions_v2(f,p_min_amount_minor=>'20000')),2,'amount-range search filters smaller transactions') from completion_state;
select is(public.rollback_import_batch(f,batch,gen_random_uuid())->>'transactions_removed','1','owner can roll back an import batch') from completion_state;
select ok((select deleted_at is not null from public.transactions where id=imported),'rollback soft-deletes imported transactions') from completion_state;

reset role;
insert into public.family_members(family_id,user_id,role,status,approved_by,approved_at,joined_at) select f,'99999999-9999-4999-8999-999999999999','MEMBER','ACTIVE','88888888-8888-4888-8888-888888888888',now(),now() from completion_state;
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',true);
set local role authenticated;
select is(public.set_family_member_status(f,'99999999-9999-4999-8999-999999999999','SUSPENDED',gen_random_uuid())->>'status','SUSPENDED','owner can suspend a member') from completion_state;
select is(public.set_family_member_status(f,'99999999-9999-4999-8999-999999999999','ACTIVE',gen_random_uuid())->>'status','ACTIVE','owner can restore a member') from completion_state;
select is(public.transfer_family_ownership(f,'99999999-9999-4999-8999-999999999999',gen_random_uuid())->>'owner_user_id','99999999-9999-4999-8999-999999999999','ownership can be transferred atomically') from completion_state;
select is((select role::text from public.family_members where family_id=f and user_id='88888888-8888-4888-8888-888888888888'),'ADMIN','previous owner remains an admin') from completion_state;
select is(public.leave_family(f,gen_random_uuid())->>'left','true','non-owner can leave the family') from completion_state;

reset role;
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
set local role authenticated;
select is((select role::text from public.list_family_members(f) where user_id='99999999-9999-4999-8999-999999999999'),'OWNER','new owner is visible in the member list') from completion_state;
select ok((select count(*) from public.list_my_notifications())>0,'ownership transfer creates an in-app notification');
select throws_ok(format('select public.leave_family(%L,gen_random_uuid())',f),'P0001','TRANSFER_OWNERSHIP_FIRST','owner cannot leave before another transfer') from completion_state;

reset role;
select * from finish();
rollback;
