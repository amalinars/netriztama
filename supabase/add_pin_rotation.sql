alter table netflix.profiles
  add column if not exists old_pin text,
  add column if not exists pin_change_pending boolean not null default false;

create or replace function netflix.complete_order_and_rotate_pin(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = netflix, public
as $$
declare
  v_profile_id uuid;
  v_old_pin text;
  v_new_pin text;
begin
  select o.profile_id, p.pin
    into v_profile_id, v_old_pin
  from netflix.orders o
  join netflix.profiles p on p.id = o.profile_id
  where o.id = p_order_id and o.status = 'booked'
  for update of o, p;

  if v_profile_id is null then
    return;
  end if;

  loop
    v_new_pin := lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when v_new_pin is distinct from v_old_pin;
  end loop;

  update netflix.profiles
  set old_pin = v_old_pin,
      pin = v_new_pin,
      pin_change_pending = true
  where id = v_profile_id;

  update netflix.orders
  set status = 'done'
  where id = p_order_id;
end;
$$;
