# Testimonials Backend Design

## Scope

Build the minimal Supabase backend for the public testimonials page:

- Store text testimonials for sewa profil Netflix.
- Store gallery image URLs for chat/transaction proof screenshots.
- Keep the existing frontend layout: testimonial form, testimonial pagination, and Pinterest-style gallery.
- Do not add admin moderation, auth, file upload, or stats-from-database in this pass.

## Database

Add two tables in the existing `netflix` schema.

### `netflix.testimonials`

Purpose: public testimonial cards and submitted testimonial data.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `name text null`
- `is_anonymous boolean not null default true`
- `quote text not null`
- `rating integer not null default 5 check (rating between 1 and 5)`
- `sort_order integer not null default 0`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`

Rules:

- If `is_anonymous = true`, UI displays `Anonymous` and ignores `name`.
- If `is_anonymous = false`, `name` should be present before frontend submit.
- `is_active` controls whether a row appears on the public page.

### `netflix.testimonial_gallery`

Purpose: public transaction/chat proof image gallery.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `image_url text not null`
- `alt text not null`
- `sort_order integer not null default 0`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`

Rules:

- `image_url` may be a permanent URL or a temporary `blob:` URL.
- The UI renders images uncropped with `h-auto w-full object-contain`.
- `is_active` controls whether a row appears in the public gallery.

## SQL files

Add a new migration file instead of editing the existing base migration:

- `supabase/add_testimonials.sql`

Add seed rows to the existing seeder or a focused companion seed file. To keep this change easy to run separately, create:

- `supabase/seed_testimonials.sql`

The seed file should:

- Delete existing testimonial/gallery seed rows.
- Insert the current testimonial copy from `Testimonials.tsx`.
- Insert the 4 WhatsApp `blob:` URLs currently used in the gallery.

## Supabase client usage

Use the existing client in `src/lib/supabase.ts`, already configured for schema `netflix`.

Add small helpers in the same file:

- `getTestimonials()` — fetch active testimonials ordered by `sort_order`, then `created_at`.
- `getTestimonialGallery()` — fetch active gallery rows ordered by `sort_order`, then `created_at`.
- `createTestimonial(input)` — insert a submitted testimonial from the public form.

Keep helpers small; no service layer unless repeated logic appears elsewhere.

## Frontend data flow

In `src/pages/Testimonials.tsx`:

1. Keep the existing local arrays as fallback constants.
2. On mount, fetch testimonials and gallery from Supabase.
3. If fetch returns rows, render database data.
4. If fetch errors or returns empty, render fallback constants so the page never goes blank.
5. Submit form inserts into `netflix.testimonials` with:
   - `name`: trimmed name or `null`
   - `is_anonymous`: checkbox value
   - `quote`: trimmed quote
   - `rating`: selected rating
   - `is_active`: `true`

No live re-fetch is required after submit; showing the current success message is enough.

## Error handling

- Fetch errors: keep fallback data and do not block page render.
- Submit errors: show a short failure message in the existing form area.
- Client-side validation stays as-is: quote length >= 10; name required only when anonymous is off.

## Testing / verification target

After implementation, verify by running the app and checking:

1. Testimonials render from Supabase seed rows.
2. Gallery renders the 4 image URLs in Pinterest-style layout without cropping.
3. Form submit inserts a row into `netflix.testimonials` and shows success.
4. If Supabase data is empty or unavailable, fallback UI still renders.

## Deliberate skips

- No admin moderation UI.
- No image upload/storage bucket.
- No stats table.
- No authentication changes.
- No RLS tightening beyond the project's existing allow-all pattern.
