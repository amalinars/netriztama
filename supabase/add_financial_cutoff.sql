-- Netriztama Financials Migration: Add Cutoff Time
-- Target schema: netflix

alter table netflix.financial_settings 
add column if not exists cutoff_time timestamptz;
