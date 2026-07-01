-- Auto-complete expired orders every minute via pg_cron
create extension if not exists pg_cron with schema pg_catalog;

-- Function: complete all expired booked orders
create or replace function netflix.auto_complete_expired_orders()
returns void
language plpgsql
security definer
set search_path = netflix, public
as $$
declare
  r record;
begin
  for r in
    select id from netflix.orders
    where status = 'booked'
      and (
        end_date < current_date
        or (end_date = current_date and logout_time <= now()::time)
      )
  loop
    perform netflix.complete_order_and_rotate_pin(r.id);
  end loop;
end;
$$;

-- Schedule: every minute
select cron.schedule(
  'auto-complete-expired-orders',
  '* * * * *',
  $$select netflix.auto_complete_expired_orders()$$
);

-- Expose pg_cron's built-in run logs to the frontend via RPC
create or replace function netflix.get_cron_logs(p_limit int default 100)
returns table (
  runid bigint,
  status text,
  return_message text,
  start_time timestamptz, 
  end_time timestamptz
)
language sql
security definer
as $$
  select runid, status, return_message, start_time, end_time
  from cron.job_run_details
  where jobid = (select jobid from cron.job where jobname = 'auto-complete-expired-orders')
  order by start_time desc
  limit p_limit;
$$;
