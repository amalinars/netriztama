# Testimonials Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store public testimonial cards and transaction/gallery image URLs in Supabase, then render and submit them from the existing testimonials page.

**Architecture:** Add two focused tables in the existing `netflix` schema, seed them with the current UI data, and expose tiny Supabase helper functions through the existing client. The page keeps local fallback constants so the public UI still works if Supabase is empty or unavailable.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Supabase JS, PostgreSQL SQL files in `supabase/`.

## Global Constraints

- Use the existing Supabase client in `src/lib/supabase.ts`, already configured with `{ db: { schema: 'netflix' } }`.
- Add only testimonials and gallery image URL backend; no admin moderation, auth, file upload, storage bucket, or stats table.
- Keep `Testimonials.tsx` form behavior: name or Anonymous, no username, no company.
- Keep image gallery uncropped with `h-auto w-full object-contain`.
- Keep fallback constants so the page never renders blank if Supabase returns empty/error.
- Follow existing RLS pattern: allow-all policies in schema `netflix`.
- Do not add new npm dependencies.

---

## File Structure

- Create `supabase/add_testimonials.sql` — migration for `netflix.testimonials` and `netflix.testimonial_gallery`.
- Create `supabase/seed_testimonials.sql` — seed text testimonials and current blob gallery URLs.
- Modify `src/types/database.ts` — add TypeScript row/input types for testimonials and gallery rows.
- Modify `src/lib/supabase.ts` — add three tiny helpers: `getTestimonials`, `getTestimonialGallery`, `createTestimonial`.
- Modify `src/pages/Testimonials.tsx` — fetch active rows, submit form to Supabase, preserve fallback UI.

---

### Task 1: Add Supabase tables and seed data

**Files:**
- Create: `supabase/add_testimonials.sql`
- Create: `supabase/seed_testimonials.sql`

**Interfaces:**
- Produces table `netflix.testimonials` with columns `id`, `name`, `is_anonymous`, `quote`, `rating`, `sort_order`, `is_active`, `created_at`.
- Produces table `netflix.testimonial_gallery` with columns `id`, `image_url`, `alt`, `sort_order`, `is_active`, `created_at`.
- Later tasks query these tables by `is_active` and `sort_order`.

- [ ] **Step 1: Create migration SQL**

Create `supabase/add_testimonials.sql` with exactly:

```sql
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
```

- [ ] **Step 2: Create seed SQL**

Create `supabase/seed_testimonials.sql` with exactly:

```sql
-- Seed public testimonials and transaction proof gallery.
-- Run after supabase/add_testimonials.sql.

delete from netflix.testimonial_gallery;
delete from netflix.testimonials;

insert into netflix.testimonials (name, is_anonymous, quote, rating, sort_order, is_active) values
  (
    'Acha',
    false,
    'Aku sewa profil Netflix buat maraton drakor weekend. Prosesnya cepet, profilnya langsung ready, dan nggak rebutan history tontonan orang lain.',
    5,
    1,
    true
  ),
  (
    null,
    true,
    'Awalnya takut akun sharing ribet, tapi ini dikasih arahan sampai login. PIN profil juga aman, jadi wishlist tontonan aku nggak kecampur.',
    5,
    2,
    true
  ),
  (
    'Lala',
    false,
    'Bayar, konfirmasi, langsung dikirim detail profilnya. Literally sat set banget buat yang pengen nonton malam itu juga.',
    5,
    3,
    true
  ),
  (
    'Mira',
    false,
    'Suka karena adminnya nggak judes. Aku nanya soal pindah device juga dijelasin pelan-pelan sampai bisa masuk Netflix lagi.',
    5,
    4,
    true
  ),
  (
    null,
    true,
    'Harga masuk akal buat profil Netflix private. Udah langganan beberapa kali dan sejauh ini aman terus.',
    5,
    5,
    true
  ),
  (
    'Vely',
    false,
    'Yang paling penting: responnya cepat pas profilku minta refresh. Nggak ditinggal setelah transfer, jadi tenang.',
    5,
    6,
    true
  );

insert into netflix.testimonial_gallery (image_url, alt, sort_order, is_active) values
  (
    'blob:https://web.whatsapp.com/eddbdb4f-ad93-4567-b8f6-8d96928dc4df',
    'Screenshot bukti transaksi sewa profil Netflix 1',
    1,
    true
  ),
  (
    'blob:https://web.whatsapp.com/1e45569f-69b8-4799-87ba-88b05ed8ebad',
    'Screenshot chat pelanggan sewa profil Netflix 2',
    2,
    true
  ),
  (
    'blob:https://web.whatsapp.com/9718291c-e191-4417-b413-e1758b9b6b10',
    'Screenshot bukti transaksi sewa profil Netflix 3',
    3,
    true
  ),
  (
    'blob:https://web.whatsapp.com/f106ada4-e470-4a17-b767-24a4aed3c1d0',
    'Screenshot chat pelanggan sewa profil Netflix 4',
    4,
    true
  );
```

- [ ] **Step 3: Apply SQL in Supabase**

Run in Supabase SQL Editor, in this order:

1. `supabase/add_testimonials.sql`
2. `supabase/seed_testimonials.sql`

Expected: both scripts finish with no SQL errors. Query check:

```sql
select count(*) from netflix.testimonials;
select count(*) from netflix.testimonial_gallery;
```

Expected result: `6` testimonials and `4` gallery rows.

- [ ] **Step 4: Commit SQL files**

```bash
git add supabase/add_testimonials.sql supabase/seed_testimonials.sql
git commit -m "feat: add testimonial backend tables"
```

---

### Task 2: Add TypeScript types and Supabase helpers

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/supabase.ts`

**Interfaces:**
- Produces type `Testimonial`.
- Produces type `TestimonialGalleryItem`.
- Produces type `CreateTestimonialInput`.
- Produces function `getTestimonials(): Promise<{ data: Testimonial[] | null; error: Error | null }>`.
- Produces function `getTestimonialGallery(): Promise<{ data: TestimonialGalleryItem[] | null; error: Error | null }>`.
- Produces function `createTestimonial(input: CreateTestimonialInput): Promise<{ error: Error | null }>`.

- [ ] **Step 1: Add database types**

Append this to `src/types/database.ts`:

```ts
export type Testimonial = {
  id: string
  name: string | null
  is_anonymous: boolean
  quote: string
  rating: number
  sort_order: number
  is_active: boolean
  created_at: string
}

export type TestimonialGalleryItem = {
  id: string
  image_url: string
  alt: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export type CreateTestimonialInput = {
  name: string | null
  is_anonymous: boolean
  quote: string
  rating: number
}
```

- [ ] **Step 2: Add helper imports**

At the top of `src/lib/supabase.ts`, change:

```ts
import { createClient } from '@supabase/supabase-js'
```

to:

```ts
import { createClient } from '@supabase/supabase-js'
import type { CreateTestimonialInput, Testimonial, TestimonialGalleryItem } from '@/types/database'
```

- [ ] **Step 3: Add testimonials helpers**

Append this to `src/lib/supabase.ts`:

```ts
export function getTestimonials() {
  return supabase
    .from('testimonials')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at') as unknown as Promise<{ data: Testimonial[] | null; error: Error | null }>
}

export function getTestimonialGallery() {
  return supabase
    .from('testimonial_gallery')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at') as unknown as Promise<{ data: TestimonialGalleryItem[] | null; error: Error | null }>
}

export function createTestimonial(input: CreateTestimonialInput) {
  return supabase
    .from('testimonials')
    .insert({
      name: input.is_anonymous ? null : input.name,
      is_anonymous: input.is_anonymous,
      quote: input.quote,
      rating: input.rating,
      sort_order: 0,
      is_active: true,
    }) as unknown as Promise<{ error: Error | null }>
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd /home/jovan/project/netriz/netriztama
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Commit helper changes**

```bash
git add src/types/database.ts src/lib/supabase.ts
git commit -m "feat: add testimonial supabase helpers"
```

---

### Task 3: Connect testimonials page to Supabase data

**Files:**
- Modify: `src/pages/Testimonials.tsx`

**Interfaces:**
- Consumes `getTestimonials`, `getTestimonialGallery`, `createTestimonial` from `@/lib/supabase`.
- Consumes `Testimonial as DbTestimonial`, `TestimonialGalleryItem` from `@/types/database`.
- Produces page behavior: DB rows render when available, fallback constants render otherwise, form inserts into Supabase.

- [ ] **Step 1: Update imports**

At the top of `src/pages/Testimonials.tsx`, change:

```ts
import { useState } from 'react'
```

to:

```ts
import { useEffect, useState } from 'react'
```

Add these imports after the asset imports:

```ts
import { createTestimonial, getTestimonialGallery, getTestimonials } from '@/lib/supabase'
import type { Testimonial as DbTestimonial, TestimonialGalleryItem } from '@/types/database'
```

- [ ] **Step 2: Rename local fallback constants**

Rename the existing local arrays:

```ts
const TESTIMONIALS: Testimonial[] = [
```

to:

```ts
const FALLBACK_TESTIMONIALS: Testimonial[] = [
```

and:

```ts
const PROOF_IMAGES = [
```

to:

```ts
const FALLBACK_PROOF_IMAGES = [
```

- [ ] **Step 3: Add mappers**

After `getIdentity`, add:

```ts
function mapDbTestimonial(row: DbTestimonial): Testimonial {
  return {
    quote: row.quote,
    stars: row.rating,
    name: row.name ?? undefined,
    anonymous: row.is_anonymous,
  }
}

function mapDbGalleryItem(row: TestimonialGalleryItem) {
  return {
    src: row.image_url,
    alt: row.alt,
  }
}
```

- [ ] **Step 4: Update type references in components**

Change this type reference:

```ts
function ProofImageCard({ image, index }: { image: (typeof PROOF_IMAGES)[number]; index: number }) {
```

to:

```ts
function ProofImageCard({ image, index }: { image: (typeof FALLBACK_PROOF_IMAGES)[number]; index: number }) {
```

Change `ProofWall` signature from:

```ts
function ProofWall() {
```

to:

```ts
function ProofWall({ images }: { images: typeof FALLBACK_PROOF_IMAGES }) {
```

Inside `ProofWall`, change:

```tsx
{PROOF_IMAGES.map((image, index) => (
```

to:

```tsx
{images.map((image, index) => (
```

- [ ] **Step 5: Add page state and fetch effect**

Inside `export default function Testimonials()`, before `const [page, setPage] = useState(0)`, add:

```ts
  const [testimonials, setTestimonials] = useState<Testimonial[]>(FALLBACK_TESTIMONIALS)
  const [galleryImages, setGalleryImages] = useState<typeof FALLBACK_PROOF_IMAGES>(FALLBACK_PROOF_IMAGES)
```

After these state lines, add:

```ts
  useEffect(() => {
    let cancelled = false

    Promise.all([getTestimonials(), getTestimonialGallery()]).then(([testimonialRes, galleryRes]) => {
      if (cancelled) return
      if (!testimonialRes.error && testimonialRes.data?.length) {
        setTestimonials(testimonialRes.data.map(mapDbTestimonial))
      }
      if (!galleryRes.error && galleryRes.data?.length) {
        setGalleryImages(galleryRes.data.map(mapDbGalleryItem))
      }
    })

    return () => { cancelled = true }
  }, [])
```

- [ ] **Step 6: Use state instead of fallback constants**

Change:

```ts
const totalPages = Math.ceil(TESTIMONIALS.length / perPage)
const visible = TESTIMONIALS.slice(page * perPage, (page + 1) * perPage)
```

to:

```ts
const totalPages = Math.ceil(testimonials.length / perPage)
const visible = testimonials.slice(page * perPage, (page + 1) * perPage)
```

Change:

```tsx
<ProofWall />
```

to:

```tsx
<ProofWall images={galleryImages} />
```

- [ ] **Step 7: Make the submit form insert into Supabase**

Inside `SubmitTestimonial`, add state after `const [sent, setSent] = useState(false)`:

```ts
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
```

In `reset`, add:

```ts
    setBusy(false)
    setError('')
```

Replace the whole `submit` function with:

```ts
  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    setError('')
    const { error } = await createTestimonial({
      name: anonymous ? null : name.trim(),
      is_anonymous: anonymous,
      quote: quote.trim(),
      rating: stars,
    })
    setBusy(false)
    if (error) {
      setError('Gagal kirim testimoni. Coba lagi ya.')
      return
    }
    setSent(true)
  }
```

After the existing validation messages under the textarea, add:

```tsx
          {error && (
            <p className="mt-1 text-xs font-semibold text-red-400">{error}</p>
          )}
```

Change the submit button disabled prop from:

```tsx
disabled={!canSubmit}
```

to:

```tsx
disabled={!canSubmit || busy}
```

Change the submit button label from:

```tsx
Kirim Testimoni 💌
```

to:

```tsx
{busy ? 'Mengirim...' : 'Kirim Testimoni 💌'}
```

- [ ] **Step 8: Run TypeScript check**

```bash
cd /home/jovan/project/netriz/netriztama
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 9: Commit page integration**

```bash
git add src/pages/Testimonials.tsx
git commit -m "feat: load testimonials from supabase"
```

---

### Task 4: Runtime verification

**Files:**
- No code changes expected.

**Interfaces:**
- Verifies the behavior produced by Tasks 1-3.

- [ ] **Step 1: Apply SQL seed if not already applied**

Run in Supabase SQL Editor:

1. `supabase/add_testimonials.sql`
2. `supabase/seed_testimonials.sql`

Expected: `netflix.testimonials` has 6 rows and `netflix.testimonial_gallery` has 4 rows.

- [ ] **Step 2: Run the app**

```bash
cd /home/jovan/project/netriz/netriztama
npm run dev -- --host 127.0.0.1 --port 4173
```

Expected: Vite starts and prints a local URL.

- [ ] **Step 3: Verify testimonials render**

Open:

```text
http://127.0.0.1:4173/testimonials
```

Expected:

- Featured quote renders.
- Testimonial cards render sewa profil Netflix copy.
- Pagination still shows page controls.

- [ ] **Step 4: Verify gallery renders without cropping**

On the same page, scroll to `Gallery transaksi`.

Expected:

- Four image cards render in Pinterest-style columns.
- Each image is full-width and natural-height.
- No fixed-height crop container is used.

- [ ] **Step 5: Verify form submit**

In the form:

1. Keep `Tampilkan sebagai Anonymous` checked.
2. Select 5 stars.
3. Enter `Mantap, profil Netflix langsung bisa dipakai.`
4. Click `Kirim Testimoni`.

Expected:

- Button briefly shows `Mengirim...`.
- Success panel shows `Makasih banget ya!`.
- Supabase table `netflix.testimonials` has one new row with `is_anonymous = true`.

- [ ] **Step 6: Commit no-op verification note only if code changed**

If verification required no code changes, do not commit. If verification fixes were needed, commit them:

```bash
git add src/pages/Testimonials.tsx src/lib/supabase.ts src/types/database.ts supabase/add_testimonials.sql supabase/seed_testimonials.sql
git commit -m "fix: verify testimonial backend integration"
```

---

## Self-Review

- Spec coverage: Task 1 covers DB and seed files; Task 2 covers client helpers and types; Task 3 covers fetch, fallback, submit, and gallery URL rendering; Task 4 covers runtime verification.
- Placeholder scan: no TBD/TODO/implement-later placeholders remain.
- Type consistency: `Testimonial`, `TestimonialGalleryItem`, `CreateTestimonialInput`, `getTestimonials`, `getTestimonialGallery`, and `createTestimonial` are defined before use and referenced consistently.
