create or replace function public.inspect_invitation(p_token text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_invite public.invitations; v_status text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_invite from public.invitations where token_hash=extensions.digest(p_token,'sha256');
  if not found then return jsonb_build_object('status','INVALID'); end if;
  v_status := case when public.is_active_member(v_invite.family_id) then 'ALREADY_MEMBER'
    when exists(select 1 from public.join_requests where family_id=v_invite.family_id and user_id=auth.uid() and status='PENDING') then 'PENDING'
    when v_invite.revoked_at is not null then 'REVOKED' when v_invite.expires_at<=now() then 'EXPIRED'
    when v_invite.use_count>=v_invite.max_uses then 'EXHAUSTED' else 'VALID' end;
  return jsonb_build_object('status',v_status,'expiresAt',v_invite.expires_at);
end; $$;

create or replace function public.list_family_members(p_family_id uuid)
returns table(user_id uuid,display_name text,role public.member_role,status public.member_status)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_active_member(p_family_id) then raise exception 'FORBIDDEN'; end if;
  return query select m.user_id,p.display_name,m.role,m.status from public.family_members m join public.profiles p on p.user_id=m.user_id where m.family_id=p_family_id and m.status='ACTIVE' order by p.display_name;
end; $$;

create or replace function public.remove_family_member(p_family_id uuid,p_user_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_saved jsonb; v_result jsonb;
begin
  if not public.has_family_role(p_family_id,array['OWNER']::public.member_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_user_id=auth.uid() then raise exception 'CANNOT_REMOVE_OWNER'; end if;
  v_saved:=public.begin_idempotent('remove_member',p_idempotency_key,jsonb_build_array(p_family_id,p_user_id));
  if v_saved is not null then return v_saved; end if;
  update public.family_members set status='REMOVED',updated_at=now() where family_id=p_family_id and user_id=p_user_id and role<>'OWNER';
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into public.audit_events(family_id,actor_user_id,action,entity_type,entity_id,request_id) values(p_family_id,auth.uid(),'MEMBER_REMOVED','member',p_user_id,p_idempotency_key);
  v_result:=jsonb_build_object('removed',true); perform public.finish_idempotent('remove_member',p_idempotency_key,v_result); return v_result;
end; $$;
revoke all on function public.inspect_invitation(text) from public,anon,authenticated;
revoke all on function public.list_family_members(uuid) from public,anon,authenticated;
revoke all on function public.remove_family_member(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.inspect_invitation(text) to authenticated;
grant execute on function public.list_family_members(uuid) to authenticated;
grant execute on function public.remove_family_member(uuid,uuid,uuid) to authenticated;
