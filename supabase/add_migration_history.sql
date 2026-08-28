alter table netflix.orders add column migration_history jsonb default '[]'::jsonb;
