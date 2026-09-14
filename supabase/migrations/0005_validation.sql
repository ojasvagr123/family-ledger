create or replace function public.validate_family_timezone()
returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'INVALID_TIMEZONE'; end if;
  return new;
end; $$;
create trigger family_timezone_check before insert or update of timezone on public.families for each row execute function public.validate_family_timezone();
revoke all on function public.validate_family_timezone() from public,anon,authenticated;
alter table public.accounts add constraint accounts_opening_date_supported check(opening_date >= date '1900-01-01' and opening_date < date '2201-01-01');
alter table public.transactions add constraint transactions_date_supported check(local_date >= date '1900-01-01' and local_date < date '2201-01-01');
