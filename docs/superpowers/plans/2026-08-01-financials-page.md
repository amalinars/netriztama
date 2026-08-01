# Financials & Wallet Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Financials page (`/admin/financials`) to track initial manual revenue, actual wallet balance, expected revenue, unsettled order breakdown, bulk settlement into actual wallet, and operational expenses.

**Architecture:** Create database tables and RPC function in Supabase `netflix` schema (`financial_settings`, `expenses`, `is_settled` flag on `orders`, `settle_all_pending_orders`). Add TypeScript types and helper functions in `src/lib/supabase.ts` and `src/types/database.ts`. Build the Financials page UI using Tailwind & Shadcn UI components, and connect navigation in `App.tsx` and `Layout.tsx`.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS v4, Lucide React, Supabase JS Client.

## Global Constraints
- Target schema in Supabase: `netflix`
- All UI components should use Lucide React icons, Tailwind CSS classes, and existing Shadcn UI components (`Card`, `Button`, `Input`, `Dialog`, `Table`, etc.)
- Use Sonner toast for user action feedback.

---

### Task 1: Database Migration & TypeScript Models Update

**Files:**
- Create: `supabase/add_financials.sql`
- Modify: `src/types/database.ts`

**Interfaces:**
- Consumes: Existing `Order` type definition in `src/types/database.ts`.
- Produces: `FinancialSettings`, `Expense`, updated `Order` type with `is_settled?: boolean`, input types `SaveExpenseInput`.

- [ ] **Step 1: Create SQL Migration Script `supabase/add_financials.sql`**

```sql
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
```

- [ ] **Step 2: Update TypeScript types in `src/types/database.ts`**

Add the following types to `src/types/database.ts`:
```ts
export type FinancialSettings = {
  id: string
  initial_balance: number
  updated_at: string
}

export type Expense = {
  id: string
  title: string
  amount: number
  category: string
  expense_date: string
  notes: string | null
  created_at: string
}

export type SaveExpenseInput = {
  title: string
  amount: number
  category: string
  expense_date: string
  notes?: string
}
```
And update `Order` type to include `is_settled: boolean`.

- [ ] **Step 3: Verify TypeScript Compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit Task 1**

```bash
git add supabase/add_financials.sql src/types/database.ts
git commit -m "feat(db): add financial settings, expenses, and order settlement types & SQL script"
```

---

### Task 2: Supabase API Helpers for Financials

**Files:**
- Modify: `src/lib/supabase.ts`

**Interfaces:**
- Consumes: Types from `src/types/database.ts`
- Produces: API methods `getFinancialSettings`, `updateInitialBalance`, `getExpenses`, `createExpense`, `deleteExpense`, `getPendingOrders`, `settleAllPendingOrders`.

- [ ] **Step 1: Implement API helpers in `src/lib/supabase.ts`**

Add helper functions to `src/lib/supabase.ts`:
```ts
export async function getFinancialSettings(): Promise<{ data: FinancialSettings | null; error: Error | null }> {
  const { data, error } = await supabase.from('financial_settings').select('*').limit(1).maybeSingle()
  return { data: data as FinancialSettings | null, error: error as Error | null }
}

export async function updateInitialBalance(initialBalance: number): Promise<{ error: Error | null }> {
  const existing = await getFinancialSettings()
  if (existing.data?.id) {
    return (await supabase.from('financial_settings').update({ initial_balance: initialBalance, updated_at: new Date().toISOString() }).eq('id', existing.data.id)) as unknown as Promise<{ error: Error | null }>
  } else {
    return (await supabase.from('financial_settings').insert({ initial_balance: initialBalance })) as unknown as Promise<{ error: Error | null }>
  }
}

export async function getExpenses(): Promise<{ data: Expense[] | null; error: Error | null }> {
  return supabase.from('expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false }) as unknown as Promise<{ data: Expense[] | null; error: Error | null }>
}

export async function createExpense(input: SaveExpenseInput): Promise<{ error: Error | null }> {
  return supabase.from('expenses').insert({
    title: input.title,
    amount: input.amount,
    category: input.category || 'General',
    expense_date: input.expense_date,
    notes: input.notes || null,
  }) as unknown as Promise<{ error: Error | null }>
}

export async function deleteExpense(id: string): Promise<{ error: Error | null }> {
  return supabase.from('expenses').delete().eq('id', id) as unknown as Promise<{ error: Error | null }>
}

export async function getFinancialsOrdersSummary(): Promise<{
  settledOrdersTotal: number
  unsettledOrdersTotal: number
  unsettledOrders: OrderWithProfile[]
  error: Error | null
}> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, profiles(*, accounts(*))')
    .order('created_at', { ascending: false }) as unknown as { data: OrderWithProfile[] | null; error: Error | null }

  if (error || !data) {
    return { settledOrdersTotal: 0, unsettledOrdersTotal: 0, unsettledOrders: [], error }
  }

  let settledOrdersTotal = 0
  let unsettledOrdersTotal = 0
  const unsettledOrders: OrderWithProfile[] = []

  for (const order of data) {
    if (order.is_settled) {
      settledOrdersTotal += order.price
    } else {
      unsettledOrdersTotal += order.price
      unsettledOrders.push(order)
    }
  }

  return { settledOrdersTotal, unsettledOrdersTotal, unsettledOrders, error: null }
}

export async function settleAllPendingOrders(): Promise<{ error: Error | null }> {
  return (supabase as never as { rpc: (name: string) => Promise<{ error: Error | null }> }).rpc('settle_all_pending_orders')
}
```

- [ ] **Step 2: Verify TypeScript Compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit Task 2**

```bash
git add src/lib/supabase.ts
git commit -m "feat(api): add supabase helper functions for financials, expenses, and bulk order settlement"
```

---

### Task 3: Financials Page Component (`src/pages/Financials.tsx`)

**Files:**
- Create: `src/pages/Financials.tsx`

**Interfaces:**
- Consumes: API helpers from `src/lib/supabase.ts` and types from `src/types/database.ts`
- Produces: React page component rendering financial metrics, edit initial balance modal, pending breakdown list with bulk settle button, and expenses list with add/delete modals.

- [ ] **Step 1: Create `src/pages/Financials.tsx`**

Build the Financials UI with cards for:
- Wallet Utama (Actual Revenue) = `initial_balance + settledOrdersTotal - expensesTotal`
- Expected Revenue = `actualRevenue + unsettledOrdersTotal`
- Total Pengeluaran = `expensesTotal`
- Total Pending = `unsettledOrdersTotal`

Include:
- Button & Dialog for "Atur Saldo Awal"
- Section "Breakdown Pembayaran Belum Disetor" listing unsettled orders + button "⚡ Setorkan Semua ke Wallet Utama" with confirmation dialog
- Section "Menu Pengeluaran (Expenses)" with "+ Catat Pengeluaran" modal and table of recorded expenses.

- [ ] **Step 2: Verify TypeScript Compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit Task 3**

```bash
git add src/pages/Financials.tsx
git commit -m "feat(ui): implement Financials page with metrics, pending breakdown, and expenses management"
```

---

### Task 4: Navigation & Route Registration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Consumes: `Financials` page component from `src/pages/Financials.tsx`
- Produces: Updated layout with `Financials` nav link (using `Wallet` icon) and `/admin/financials` route.

- [ ] **Step 1: Register Route in `src/App.tsx`**

Add imports and route for `Financials`:
```tsx
import Financials from '@/pages/Financials'
// ...
<Route path="financials" element={<Financials />} />
```

- [ ] **Step 2: Add Navigation Link in `src/components/Layout.tsx`**

Import `Wallet` icon from `lucide-react` and add `{ to: '/admin/financials', label: 'Financials', icon: Wallet }` to `NAV` array.

- [ ] **Step 3: Verify Build & Type Check**

Run: `npm run build`
Expected: Build succeeds with production output in `dist/`.

- [ ] **Step 4: Commit Task 4**

```bash
git add src/App.tsx src/components/Layout.tsx
git commit -m "feat(nav): add Financials route and layout navigation link"
```
