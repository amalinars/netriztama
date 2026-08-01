-- Netriztama Financials Migration
-- Target schema: netflix

-- 1. Financial settings table
create table if not exists netflix.financial_settings (
  id uuid primary key default gen_random_uuid(),
  initial_balance integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 2. Add is_settled column to orders table if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'netflix' 
    and table_name = 'orders' 
    and column_name = 'is_settled'
  ) then
    alter table netflix.orders add column is_settled boolean not null default false;
  end if;
end $$;

-- 3. Expenses table
create table if not exists netflix.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount integer not null check (amount >= 0),
  category text not null default 'General',
  expense_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- 4. Stored function to settle all pending orders
create or replace function netflix.settle_all_pending_orders()
returns void
language plpgsql
security definer
set search_path = netflix, public
as $$
begin
  update netflix.orders
  set is_settled = true
  where is_settled = false;
end;
$$;

-- RLS & Grants
alter table netflix.financial_settings enable row level security;
alter table netflix.expenses enable row level security;

create policy "Allow all on financial_settings" on netflix.financial_settings for all using (true) with check (true);
create policy "Allow all on expenses" on netflix.expenses for all using (true) with check (true);

grant all on netflix.financial_settings to anon, authenticated;
grant all on netflix.expenses to anon, authenticated;
