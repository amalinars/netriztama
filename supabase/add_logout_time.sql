alter table netflix.orders
  add column if not exists logout_time time not null default '23:59';

update netflix.orders
set logout_time = (
  lpad((regexp_match(notes, '([0-9]{1,2})[.:]([0-9]{2})'))[1], 2, '0')
  || ':' ||
  (regexp_match(notes, '([0-9]{1,2})[.:]([0-9]{2})'))[2]
)::time
where notes ~ '([0-9]{1,2})[.:]([0-9]{2})';
