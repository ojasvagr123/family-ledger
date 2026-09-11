create or replace function public.begin_idempotent(p_operation text, p_key uuid, p_request jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_hash bytea := digest(p_request::text, 'sha256');
  v_saved public.idempotency_keys%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  insert into public.idempotency_keys(user_id, operation, key, request_hash)
  values (auth.uid(), p_operation, p_key, v_hash)
  on conflict (user_id, operation, key) do nothing;

  select * into v_saved from public.idempotency_keys
  where user_id = auth.uid() and operation = p_operation and key = p_key
  for update;

  if v_saved.request_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001'; end if;
  return v_saved.response;
end;
$$;

create or replace function public.finish_idempotent(p_operation text, p_key uuid, p_response jsonb)
returns void language sql security definer set search_path = public as $$
  update public.idempotency_keys set response = p_response
  where user_id = auth.uid() and operation = p_operation and key = p_key;
$$;

create or replace function public.list_my_families()
returns table(id uuid, name text, currency_code text, timezone text, fiscal_start_month smallint, role public.member_role, status public.member_status, version integer)
language sql stable security definer set search_path = public as $$
  select f.id, f.name, f.currency_code, f.timezone, f.fiscal_start_month, m.role, m.status, f.version
  from public.family_members m join public.families f on f.id = m.family_id
  where m.user_id = auth.uid() and m.status in ('PENDING', 'ACTIVE')
  order by (m.status = 'ACTIVE') desc, f.created_at;
$$;

create or replace function public.create_family(
  p_name text,
  p_currency_code text,
  p_timezone text,
  p_fiscal_start_month smallint,
  p_reporting_start_year smallint,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_family public.families%rowtype;
  v_saved jsonb;
  v_request jsonb := jsonb_build_object('name', trim(p_name), 'currency', p_currency_code, 'timezone', p_timezone, 'month', p_fiscal_start_month, 'year', p_reporting_start_year);
  v_response jsonb;
  v_names text[];
  v_name text;
  v_index integer;
begin
  v_saved := public.begin_idempotent('create_family', p_idempotency_key, v_request);
  if v_saved is not null then return v_saved; end if;
  if char_length(trim(p_name)) not between 1 and 100 then raise exception 'VALIDATION_FAILED: name' using errcode = 'P0001'; end if;
  if p_currency_code !~ '^[A-Z]{3}$' or p_fiscal_start_month not between 1 and 12 or p_reporting_start_year not between 1900 and 2200 then raise exception 'VALIDATION_FAILED: settings' using errcode = 'P0001'; end if;

  insert into public.families(name, currency_code, timezone, fiscal_start_month, reporting_start_year, owner_user_id)
  values (trim(p_name), p_currency_code, p_timezone, p_fiscal_start_month, p_reporting_start_year, auth.uid())
  returning * into v_family;
  insert into public.family_members(family_id, user_id, role, status, approved_by, approved_at, joined_at)
  values (v_family.id, auth.uid(), 'OWNER', 'ACTIVE', auth.uid(), now(), now());

  v_names := array['Salary','Business income','Interest','Reimbursement','Other income'];
  for v_index in 1..array_length(v_names, 1) loop
    v_name := v_names[v_index];
    insert into public.categories(family_id, type, name, sort_order, created_by) values (v_family.id, 'INCOME', v_name, v_index, auth.uid());
  end loop;
  v_names := array['Groceries','Housing','Utilities','Transport','Education','Healthcare','Dining','Shopping','Entertainment','Insurance','Other expense'];
  for v_index in 1..array_length(v_names, 1) loop
    v_name := v_names[v_index];
    insert into public.categories(family_id, type, name, sort_order, created_by) values (v_family.id, 'EXPENSE', v_name, v_index, auth.uid());
  end loop;

  insert into public.audit_events(family_id, actor_user_id, action, entity_type, entity_id, after_data, request_id)
  values (v_family.id, auth.uid(), 'FAMILY_CREATED', 'family', v_family.id, jsonb_build_object('name', v_family.name), p_idempotency_key);
  v_response := jsonb_build_object('id', v_family.id, 'name', v_family.name, 'currency_code', v_family.currency_code, 'timezone', v_family.timezone, 'fiscal_start_month', v_family.fiscal_start_month, 'role', 'OWNER', 'status', 'ACTIVE', 'version', v_family.version);
  perform public.finish_idempotent('create_family', p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.create_invitation(p_family_id uuid, p_expires_in_hours integer, p_max_uses integer, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_invite public.invitations%rowtype;
  v_saved jsonb;
  v_request jsonb := jsonb_build_object('familyId', p_family_id, 'hours', p_expires_in_hours, 'uses', p_max_uses);
  v_response jsonb;
begin
  v_saved := public.begin_idempotent('create_invitation', p_idempotency_key, v_request);
  if v_saved is not null then raise exception 'INVITATION_TOKEN_ALREADY_RETURNED' using errcode = 'P0001'; end if;
  if not public.has_family_role(p_family_id, array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_expires_in_hours not between 1 and 168 or p_max_uses not between 1 and 20 then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;
  v_token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  insert into public.invitations(family_id, token_hash, created_by, expires_at, max_uses)
  values (p_family_id, digest(v_token, 'sha256'), auth.uid(), now() + make_interval(hours => p_expires_in_hours), p_max_uses)
  returning * into v_invite;
  insert into public.audit_events(family_id, actor_user_id, action, entity_type, entity_id, after_data, request_id)
  values (p_family_id, auth.uid(), 'INVITATION_CREATED', 'invitation', v_invite.id, jsonb_build_object('expiresAt', v_invite.expires_at, 'maxUses', v_invite.max_uses), p_idempotency_key);
  v_response := jsonb_build_object('invitationId', v_invite.id, 'token', v_token, 'expiresAt', v_invite.expires_at);
  -- A repeated call must not reveal the raw token. Save only a redacted completion marker.
  perform public.finish_idempotent('create_invitation', p_idempotency_key, jsonb_build_object('invitationId', v_invite.id, 'returned', true));
  return v_response;
end;
$$;

create or replace function public.request_join(p_token text, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_invite public.invitations%rowtype;
  v_request_id uuid;
  v_saved jsonb;
  v_request jsonb := jsonb_build_object('tokenHash', encode(digest(p_token, 'sha256'), 'hex'));
  v_response jsonb;
begin
  v_saved := public.begin_idempotent('request_join', p_idempotency_key, v_request);
  if v_saved is not null then return v_saved; end if;
  select * into v_invite from public.invitations where token_hash = digest(p_token, 'sha256') for update;
  if not found then raise exception 'INVITE_INVALID' using errcode = 'P0001'; end if;
  if v_invite.revoked_at is not null then raise exception 'INVITE_REVOKED' using errcode = 'P0001'; end if;
  if v_invite.expires_at <= now() then raise exception 'INVITE_EXPIRED' using errcode = 'P0001'; end if;
  if v_invite.use_count >= v_invite.max_uses then raise exception 'INVITE_EXHAUSTED' using errcode = 'P0001'; end if;
  if exists(select 1 from public.family_members where family_id = v_invite.family_id and user_id = auth.uid() and status = 'ACTIVE') then raise exception 'ALREADY_MEMBER' using errcode = 'P0001'; end if;

  select id into v_request_id from public.join_requests
  where family_id = v_invite.family_id and user_id = auth.uid() and status = 'PENDING';
  if found then
    v_response := jsonb_build_object('joinRequestId', v_request_id, 'familyId', v_invite.family_id, 'status', 'PENDING');
    perform public.finish_idempotent('request_join', p_idempotency_key, v_response);
    return v_response;
  end if;

  insert into public.family_members(family_id, user_id, role, status)
  values (v_invite.family_id, auth.uid(), 'MEMBER', 'PENDING')
  on conflict (family_id, user_id) do update set status = 'PENDING', role = 'MEMBER', updated_at = now();
  insert into public.join_requests(family_id, user_id, invitation_id)
  values (v_invite.family_id, auth.uid(), v_invite.id)
  on conflict (family_id, user_id) where status = 'PENDING' do update set updated_at = now()
  returning id into v_request_id;
  update public.invitations set use_count = use_count + 1 where id = v_invite.id;
  insert into public.audit_events(family_id, actor_user_id, action, entity_type, entity_id, request_id)
  values (v_invite.family_id, auth.uid(), 'JOIN_REQUESTED', 'join_request', v_request_id, p_idempotency_key);
  v_response := jsonb_build_object('joinRequestId', v_request_id, 'familyId', v_invite.family_id, 'status', 'PENDING');
  perform public.finish_idempotent('request_join', p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.revoke_invitation(p_family_id uuid, p_invitation_id uuid, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_saved jsonb;
  v_response jsonb;
  v_request jsonb := jsonb_build_object('familyId', p_family_id, 'invitationId', p_invitation_id);
begin
  v_saved := public.begin_idempotent('revoke_invitation', p_idempotency_key, v_request);
  if v_saved is not null then return v_saved; end if;
  if not public.has_family_role(p_family_id, array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update public.invitations set revoked_at = coalesce(revoked_at, now())
  where id = p_invitation_id and family_id = p_family_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  insert into public.audit_events(family_id, actor_user_id, action, entity_type, entity_id, request_id)
  values (p_family_id, auth.uid(), 'INVITATION_REVOKED', 'invitation', p_invitation_id, p_idempotency_key);
  v_response := jsonb_build_object('invitationId', p_invitation_id, 'revoked', true);
  perform public.finish_idempotent('revoke_invitation', p_idempotency_key, v_response);
  return v_response;
end;
$$;

create or replace function public.list_pending_join_requests(p_family_id uuid)
returns table(id uuid, family_id uuid, requester_user_id uuid, requester_display_name text, status public.join_request_status, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_family_role(p_family_id, array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  return query select r.id, r.family_id, r.user_id, p.display_name, r.status, r.created_at
  from public.join_requests r join public.profiles p on p.user_id = r.user_id
  where r.family_id = p_family_id and r.status = 'PENDING' order by r.created_at;
end;
$$;

create or replace function public.decide_join_request(p_family_id uuid, p_join_request_id uuid, p_decision public.join_request_status, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_join public.join_requests%rowtype;
  v_saved jsonb;
  v_request jsonb := jsonb_build_object('familyId', p_family_id, 'joinRequestId', p_join_request_id, 'decision', p_decision);
  v_response jsonb;
begin
  v_saved := public.begin_idempotent('decide_join_request', p_idempotency_key, v_request);
  if v_saved is not null then return v_saved; end if;
  if p_decision not in ('APPROVED','REJECTED') then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;
  if not public.has_family_role(p_family_id, array['OWNER','ADMIN']::public.member_role[]) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into v_join from public.join_requests where id = p_join_request_id and family_id = p_family_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_join.status <> 'PENDING' then raise exception 'ALREADY_DECIDED' using errcode = 'P0001'; end if;
  update public.join_requests set status = p_decision, decided_by = auth.uid(), decided_at = now(), updated_at = now() where id = v_join.id;
  update public.family_members set status = case when p_decision = 'APPROVED' then 'ACTIVE'::public.member_status else 'REJECTED'::public.member_status end, approved_by = case when p_decision = 'APPROVED' then auth.uid() else null end, approved_at = case when p_decision = 'APPROVED' then now() else null end, joined_at = case when p_decision = 'APPROVED' then now() else null end, updated_at = now() where family_id = p_family_id and user_id = v_join.user_id;
  insert into public.audit_events(family_id, actor_user_id, action, entity_type, entity_id, after_data, request_id)
  values (p_family_id, auth.uid(), case when p_decision = 'APPROVED' then 'JOIN_APPROVED' else 'JOIN_REJECTED' end, 'join_request', v_join.id, jsonb_build_object('status', p_decision), p_idempotency_key);
  v_response := jsonb_build_object('joinRequestId', v_join.id, 'status', p_decision);
  perform public.finish_idempotent('decide_join_request', p_idempotency_key, v_response);
  return v_response;
end;
$$;

revoke all on function public.begin_idempotent(text, uuid, jsonb) from public;
revoke all on function public.finish_idempotent(text, uuid, jsonb) from public;
revoke all on function public.list_my_families() from public;
revoke all on function public.create_family(text, text, text, smallint, smallint, uuid) from public;
revoke all on function public.create_invitation(uuid, integer, integer, uuid) from public;
revoke all on function public.request_join(text, uuid) from public;
revoke all on function public.revoke_invitation(uuid, uuid, uuid) from public;
revoke all on function public.list_pending_join_requests(uuid) from public;
revoke all on function public.decide_join_request(uuid, uuid, public.join_request_status, uuid) from public;
grant execute on function public.list_my_families() to authenticated;
grant execute on function public.create_family(text, text, text, smallint, smallint, uuid) to authenticated;
grant execute on function public.create_invitation(uuid, integer, integer, uuid) to authenticated;
grant execute on function public.request_join(text, uuid) to authenticated;
grant execute on function public.revoke_invitation(uuid, uuid, uuid) to authenticated;
grant execute on function public.list_pending_join_requests(uuid) to authenticated;
grant execute on function public.decide_join_request(uuid, uuid, public.join_request_status, uuid) to authenticated;
