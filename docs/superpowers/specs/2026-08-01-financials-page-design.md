# Financials & Wallet Feature Design

## Overview
The Financials feature provides a clear financial dashboard and management system for Netriztama. It tracks the primary wallet (Actual Revenue), potential incoming revenue from orders (Expected Revenue), unsettled order breakdowns, and operational expenses.

## User Goals & Requirements
- **Initial Revenue / Baseline**: Admin can manually set an initial balance for the primary wallet (`initial_balance`).
- **Actual Revenue (Wallet Utama)**: Calculated as `initial_balance + sum(settled_orders) - sum(expenses)`.
- **Expected Revenue**: Calculated as `Actual Revenue + sum(unsettled_orders)`.
- **Pending Orders Breakdown**: Displays orders whose payment has not yet been deposited/settled into the primary wallet (`is_settled = false`).
- **Bulk Settlement Action**: A single action button ("Setorkan Semua ke Wallet Utama") updates all pending orders to `is_settled = true`, clearing the pending breakdown list and bringing Actual Revenue in sync with Expected Revenue.
- **Expenses Management**: Allows logging of operational expenses (e.g. Netflix subscription renewals, server costs), which directly deduct from the primary wallet balance.

## Data Model & Schema Changes

### Schema: `netflix`

#### 1. Table `netflix.financial_settings`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | uuid | primary key, default `gen_random_uuid()` | Unique identifier |
| `initial_balance` | integer | not null, default 0 | Baseline wallet balance entered manually |
| `updated_at` | timestamptz | not null, default `now()` | Timestamp of last balance adjustment |

#### 2. Alter Table `netflix.orders`
| Column | Type | Default | Description |
|---|---|---|---|
| `is_settled` | boolean | `false` | Indicates whether order revenue has been deposited into Actual Wallet |

#### 3. Table `netflix.expenses`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | uuid | primary key, default `gen_random_uuid()` | Unique identifier |
| `title` | text | not null | Description of expense (e.g. "Langganan Akun Netflix #1") |
| `amount` | integer | not null | Expense amount in IDR |
| `category` | text | not null, default `'General'` | Category tag (e.g. `Netflix Account`, `Operational`, `Other`) |
| `expense_date` | date | not null, default `current_date` | Date of expense |
| `notes` | text | nullable | Additional notes |
| `created_at` | timestamptz | not null, default `now()` | Record creation timestamp |

#### 4. Stored Procedure: `netflix.settle_all_pending_orders()`
```sql
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
```

## User Interface & Components

### Page: `/admin/financials` (`src/pages/Financials.tsx`)
1. **Header Section**:
   - Title: "Financials & Wallet"
   - Button: "Edit Saldo Awal" (triggers modal/dialog to change `initial_balance`).

2. **Metrics Overview Cards**:
   - **Wallet Utama (Actual Revenue)**: Highlights current settled cash balance (`initial_balance + settled_orders - expenses`).
   - **Expected Revenue**: Highlights total potential cash (`Actual Revenue + pending_orders`).
   - **Total Pengeluaran**: Total expenses spent.
   - **Order Belum Disetor**: Accumulated IDR of pending orders.

3. **Pending Orders Breakdown Panel**:
   - Displays list/table of orders where `is_settled == false`.
   - Header button: **"⚡ Setorkan Semua ke Wallet Utama"**.
   - Confirmation dialog before bulk setting `is_settled = true`.

4. **Expenses Management Panel**:
   - Button: **"+ Catat Pengeluaran Baru"**.
   - Dialog with inputs: Title, Nominal (Rp), Category dropdown/input, Date, Notes.
   - Data table of expenses with deletion capability.

### Navigation Update (`src/components/Layout.tsx` & `src/App.tsx`)
- Add route `/admin/financials` in `App.tsx`.
- Add nav item `{ to: '/admin/financials', label: 'Financials', icon: Wallet }` in `Layout.tsx`.

## Data Flow & Calculations
1. **Fetch**: Loads initial settings, orders (`is_settled`), and expenses on page mount using Supabase JS client.
2. **Calculations**:
   - `settledOrdersTotal = sum(order.price where is_settled == true)`
   - `unsettledOrdersTotal = sum(order.price where is_settled == false)`
   - `expensesTotal = sum(expense.amount)`
   - `actualRevenue = initial_balance + settledOrdersTotal - expensesTotal`
   - `expectedRevenue = actualRevenue + unsettledOrdersTotal`
3. **Settlement Flow**:
   - Trigger `settle_all_pending_orders()` RPC or Supabase query update.
   - Re-fetch orders and settings. UI updates instantly with 0 pending orders and Actual Revenue = Expected Revenue.

## Verification Plan
1. **Database Script Verification**: Run `supabase/add_financials.sql` in Supabase SQL editor or local migration script.
2. **TypeScript & Build Verification**: Run `npm run build` to verify type safety and component imports.
3. **UI Verification**: Validate editing initial balance, adding expenses, viewing breakdown, and executing bulk settlement.
