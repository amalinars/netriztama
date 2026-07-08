-- Add public testimonials and transaction proof gallery.
-- Run after supabase/migration.sql.

create table if not exists netflix.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text,
  is_anonymous boolean not null default true,
  quote text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists netflix.testimonial_gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  alt text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_testimonials_active_sort
  on netflix.testimonials (is_active, sort_order, created_at);

create index if not exists idx_testimonial_gallery_active_sort
  on netflix.testimonial_gallery (is_active, sort_order, created_at);

alter table netflix.testimonials enable row level security;
alter table netflix.testimonial_gallery enable row level security;

drop policy if exists "Allow all on testimonials" on netflix.testimonials;
drop policy if exists "Allow all on testimonial_gallery" on netflix.testimonial_gallery;

create policy "Allow all on testimonials"
  on netflix.testimonials
  for all
  using (true)
  with check (true);

create policy "Allow all on testimonial_gallery"
  on netflix.testimonial_gallery
  for all
  using (true)
  with check (true);

grant usage on schema netflix to anon, authenticated;
grant all on netflix.testimonials to anon, authenticated;
grant all on netflix.testimonial_gallery to anon, authenticated;
