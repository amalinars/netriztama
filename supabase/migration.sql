-- Netriztama: Netflix Rental Tracker
-- Run this in Supabase SQL Editor
-- Target schema: netflix

-- Drop tables in public if accidentally created there
drop table if exists public.orders;
drop table if exists public.profiles;
drop table if exists public.accounts;

-- Create tables in netflix schema
create table netflix.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  password text,
  subscription_cost integer not null default 0,
  created_at timestamptz not null default now()
);

create table netflix.profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references netflix.accounts(id) on delete cascade,
  name text not null,
  pin text,
  old_pin text,
  pin_change_pending boolean not null default false,
  is_rentable boolean not null default true,
  created_at timestamptz not null default now()
);

create table netflix.orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references netflix.profiles(id) on delete cascade,
  customer_name text not null,
  package text not null check (package in ('1_hari', '2_hari', '3_hari', '1_minggu', '1_bulan')),
  price integer not null,
  start_date date not null,
  end_date date not null,
  logout_time time not null default '23:59',
  status text not null default 'booked' check (status in ('booked', 'done')),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_orders_profile on netflix.orders(profile_id);
create index idx_orders_status on netflix.orders(status);
create index idx_profiles_account on netflix.profiles(account_id);

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

-- RLS
alter table netflix.accounts enable row level security;
alter table netflix.profiles enable row level security;
alter table netflix.orders enable row level security;

create policy "Allow all on accounts" on netflix.accounts for all using (true) with check (true);
create policy "Allow all on profiles" on netflix.profiles for all using (true) with check (true);
create policy "Allow all on orders" on netflix.orders for all using (true) with check (true);

-- Expose netflix schema to PostgREST (required for supabase-js to access it)
grant usage on schema netflix to anon, authenticated;
grant all on all tables in schema netflix to anon, authenticated;
alter default privileges in schema netflix grant all on tables to anon, authenticated;
