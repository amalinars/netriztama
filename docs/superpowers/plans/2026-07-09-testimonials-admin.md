# Testimonials Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dashboard page for CRUD management of public testimonials and transaction/gallery image URL rows.

**Architecture:** Reuse the existing dashboard layout and Supabase client. Add small admin helper functions for the two testimonial tables, then build one `AdminTestimonials` page with two independent sections: text testimonials and gallery URLs.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Supabase JS, existing shadcn/base-ui components, sonner toasts.

## Global Constraints

- Add one dashboard/admin route: `/admin/testimonials`.
- Add one nav item in the existing `Layout` navigation with label `Testimonials`.
- Page lives inside the dashboard layout, not the public `/testimonials` page.
- Manage only `netflix.testimonials` and `netflix.testimonial_gallery`.
- No moderation workflow, file upload, storage bucket, auth, drag-and-drop reordering, or separate admin layout.
- Testimonials form keeps name or Anonymous, no username, no company.
- Gallery URL can be `blob:`, public URL, or later storage URL.
- Image previews render uncropped with `object-contain`.
- Confirm before delete using existing `ConfirmDialog`.
- Do not add new npm dependencies.
- Do not commit unless the human explicitly asks.

---

## File Structure

- Modify `src/types/database.ts` — add admin input types for saving testimonial/gallery rows.
- Modify `src/lib/supabase.ts` — add CRUD helpers for both tables.
- Create `src/pages/AdminTestimonials.tsx` — one page with two cards/sections and dialogs.
- Modify `src/App.tsx` — route `/admin/testimonials` inside the dashboard `Layout`.
- Modify `src/components/Layout.tsx` — add nav item `Testimonials`.

---

### Task 1: Add admin Supabase helper types and functions

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/supabase.ts`

**Interfaces:**
- Produces type `SaveTestimonialInput`.
- Produces type `SaveTestimonialGalleryItemInput`.
- Produces functions:
  - `getAdminTestimonials(): Promise<{ data: Testimonial[] | null; error: Error | null }>`
  - `saveTestimonial(input: SaveTestimonialInput, id?: string): Promise<{ error: Error | null }>`
  - `deleteTestimonial(id: string): Promise<{ error: Error | null }>`
  - `toggleTestimonialActive(id: string, isActive: boolean): Promise<{ error: Error | null }>`
  - `getAdminTestimonialGallery(): Promise<{ data: TestimonialGalleryItem[] | null; error: Error | null }>`
  - `saveTestimonialGalleryItem(input: SaveTestimonialGalleryItemInput, id?: string): Promise<{ error: Error | null }>`
  - `deleteTestimonialGalleryItem(id: string): Promise<{ error: Error | null }>`
  - `toggleTestimonialGalleryActive(id: string, isActive: boolean): Promise<{ error: Error | null }>`

- [ ] **Step 1: Add admin input types**

Append this to `src/types/database.ts` after `CreateTestimonialInput`:

```ts
export type SaveTestimonialInput = {
  name: string | null
  is_anonymous: boolean
  quote: string
  rating: number
  is_active: boolean
}

export type SaveTestimonialGalleryItemInput = {
  image_url: string
  alt: string
  is_active: boolean
}
```

- [ ] **Step 2: Update Supabase type import**

In `src/lib/supabase.ts`, change the type import to include the new types:

```ts
import type {
  CreateTestimonialInput,
  SaveTestimonialGalleryItemInput,
  SaveTestimonialInput,
  Testimonial,
  TestimonialGalleryItem,
} from '@/types/database'
```

- [ ] **Step 3: Add admin helpers**

Append this to `src/lib/supabase.ts`:

```ts
export function getAdminTestimonials() {
  return supabase
    .from('testimonials')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false }) as unknown as Promise<{ data: Testimonial[] | null; error: Error | null }>
}

export function saveTestimonial(input: SaveTestimonialInput, id?: string) {
  const payload = {
    name: input.is_anonymous ? null : input.name,
    is_anonymous: input.is_anonymous,
    quote: input.quote,
    rating: input.rating,
    is_active: input.is_active,
  }

  return (id
    ? supabase.from('testimonials').update(payload).eq('id', id)
    : supabase.from('testimonials').insert({ ...payload, sort_order: 0 })
  ) as unknown as Promise<{ error: Error | null }>
}

export function deleteTestimonial(id: string) {
  return supabase
    .from('testimonials')
    .delete()
    .eq('id', id) as unknown as Promise<{ error: Error | null }>
}

export function toggleTestimonialActive(id: string, isActive: boolean) {
  return supabase
    .from('testimonials')
    .update({ is_active: isActive })
    .eq('id', id) as unknown as Promise<{ error: Error | null }>
}

export function getAdminTestimonialGallery() {
  return supabase
    .from('testimonial_gallery')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false }) as unknown as Promise<{ data: TestimonialGalleryItem[] | null; error: Error | null }>
}

export function saveTestimonialGalleryItem(input: SaveTestimonialGalleryItemInput, id?: string) {
  const payload = {
    image_url: input.image_url,
    alt: input.alt,
    is_active: input.is_active,
  }

  return (id
    ? supabase.from('testimonial_gallery').update(payload).eq('id', id)
    : supabase.from('testimonial_gallery').insert({ ...payload, sort_order: 0 })
  ) as unknown as Promise<{ error: Error | null }>
}

export function deleteTestimonialGalleryItem(id: string) {
  return supabase
    .from('testimonial_gallery')
    .delete()
    .eq('id', id) as unknown as Promise<{ error: Error | null }>
}

export function toggleTestimonialGalleryActive(id: string, isActive: boolean) {
  return supabase
    .from('testimonial_gallery')
    .update({ is_active: isActive })
    .eq('id', id) as unknown as Promise<{ error: Error | null }>
}
```

- [ ] **Step 4: Run check**

Run:

```bash
cd /home/jovan/project/netriz/netriztama
npm run build
```

Expected: build succeeds. If Bash is unavailable, note it and continue only if IDE diagnostics show no TypeScript errors.

---

### Task 2: Create admin testimonials page

**Files:**
- Create: `src/pages/AdminTestimonials.tsx`

**Interfaces:**
- Consumes all admin helpers from `@/lib/supabase`.
- Consumes `Testimonial`, `TestimonialGalleryItem`, `SaveTestimonialInput`, `SaveTestimonialGalleryItemInput` from `@/types/database`.
- Produces default React component `AdminTestimonials` for router.

- [ ] **Step 1: Create page file**

Create `src/pages/AdminTestimonials.tsx` with this implementation:

```tsx
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MessageSquareHeart, Plus, Pencil, Trash2, Eye, EyeOff, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import ConfirmDialog from '@/components/ConfirmDialog'
import {
  deleteTestimonial,
  deleteTestimonialGalleryItem,
  getAdminTestimonialGallery,
  getAdminTestimonials,
  saveTestimonial,
  saveTestimonialGalleryItem,
  toggleTestimonialActive,
  toggleTestimonialGalleryActive,
} from '@/lib/supabase'
import type {
  SaveTestimonialGalleryItemInput,
  SaveTestimonialInput,
  Testimonial,
  TestimonialGalleryItem,
} from '@/types/database'

function clampRating(value: string) {
  return Math.min(5, Math.max(1, Number(value) || 5))
}

export default function AdminTestimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [gallery, setGallery] = useState<TestimonialGalleryItem[]>([])
  const [loading, setLoading] = useState(true)

  async function loadTestimonials() {
    const { data, error } = await getAdminTestimonials()
    if (error) { toast.error(error.message); return }
    setTestimonials(data ?? [])
  }

  async function loadGallery() {
    const { data, error } = await getAdminTestimonialGallery()
    if (error) { toast.error(error.message); return }
    setGallery(data ?? [])
  }

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadTestimonials(), loadGallery()])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Memuat...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Testimonials</h1>
          <p className="text-muted-foreground">Kelola testimoni dan gallery transaksi yang tampil di halaman public.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquareHeart className="size-5 text-primary" /> Testimonials
            </CardTitle>
            <p className="text-sm text-muted-foreground">{testimonials.length} testimoni</p>
          </div>
          <TestimonialDialog onSaved={loadTestimonials} />
        </CardHeader>
        <CardContent className="space-y-3">
          {testimonials.length === 0 ? (
            <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">Belum ada testimoni.</p>
          ) : testimonials.map(item => (
            <TestimonialRow key={item.id} item={item} onChanged={loadTestimonials} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="size-5 text-primary" /> Gallery transaksi
            </CardTitle>
            <p className="text-sm text-muted-foreground">{gallery.length} gambar</p>
          </div>
          <GalleryDialog onSaved={loadGallery} />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.length === 0 ? (
            <p className="col-span-full rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">Belum ada gambar.</p>
          ) : gallery.map(item => (
            <GalleryCard key={item.id} item={item} onChanged={loadGallery} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function TestimonialRow({ item, onChanged }: { item: Testimonial; onChanged: () => void }) {
  async function toggleActive() {
    const { error } = await toggleTestimonialActive(item.id, !item.is_active)
    if (error) { toast.error(error.message); return }
    toast.success(item.is_active ? 'Testimoni disembunyikan' : 'Testimoni ditampilkan')
    onChanged()
  }

  async function remove() {
    const { error } = await deleteTestimonial(item.id)
    if (error) { toast.error(error.message); return }
    toast.success('Testimoni dihapus')
    onChanged()
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{item.is_anonymous ? 'Anonymous' : item.name}</span>
            <Badge variant={item.is_active ? 'default' : 'secondary'}>{item.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
            <span className="text-sm text-muted-foreground">⭐ {item.rating}/5</span>
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.quote}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={toggleActive} title={item.is_active ? 'Sembunyikan' : 'Tampilkan'}>
            {item.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <TestimonialDialog item={item} onSaved={onChanged} />
          <ConfirmDialog
            title="Hapus testimoni?"
            message="Testimoni ini akan dihapus permanen."
            confirmLabel="Hapus"
            destructive
            onConfirm={remove}
            trigger={<Button variant="ghost" size="icon-sm" title="Hapus" />}
          >
            <Trash2 className="size-4 text-destructive" />
          </ConfirmDialog>
        </div>
      </div>
    </div>
  )
}

function TestimonialDialog({ item, onSaved }: { item?: Testimonial; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [anonymous, setAnonymous] = useState(item?.is_anonymous ?? true)
  const [name, setName] = useState(item?.name ?? '')
  const [rating, setRating] = useState(String(item?.rating ?? 5))
  const [quote, setQuote] = useState(item?.quote ?? '')
  const [active, setActive] = useState(item?.is_active ?? true)
  const [busy, setBusy] = useState(false)

  function reset() {
    setAnonymous(item?.is_anonymous ?? true)
    setName(item?.name ?? '')
    setRating(String(item?.rating ?? 5))
    setQuote(item?.quote ?? '')
    setActive(item?.is_active ?? true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!anonymous && !name.trim()) { toast.error('Nama wajib diisi kalau bukan Anonymous'); return }
    if (quote.trim().length < 10) { toast.error('Quote minimal 10 karakter'); return }

    const payload: SaveTestimonialInput = {
      name: anonymous ? null : name.trim(),
      is_anonymous: anonymous,
      quote: quote.trim(),
      rating: clampRating(rating),
      is_active: active,
    }

    setBusy(true)
    const { error } = await saveTestimonial(payload, item?.id)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(item ? 'Testimoni diupdate' : 'Testimoni ditambahkan')
    setOpen(false)
    reset()
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) reset() }}>
      <DialogTrigger render={<Button variant={item ? 'ghost' : 'default'} size={item ? 'icon-sm' : 'sm'} />}>
        {item ? <Pencil className="size-4" /> : <><Plus className="size-4" /> Tambah</>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? 'Edit testimoni' : 'Tambah testimoni'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} className="size-4 accent-primary" />
            Tampilkan sebagai Anonymous
          </label>
          {!anonymous && (
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nama customer" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Rating</Label>
            <Input type="number" min={1} max={5} value={rating} onChange={e => setRating(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Quote</Label>
            <Textarea value={quote} onChange={e => setQuote(e.target.value)} rows={4} placeholder="Tulis testimoni..." />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="size-4 accent-primary" />
            Aktif
          </label>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function GalleryCard({ item, onChanged }: { item: TestimonialGalleryItem; onChanged: () => void }) {
  async function toggleActive() {
    const { error } = await toggleTestimonialGalleryActive(item.id, !item.is_active)
    if (error) { toast.error(error.message); return }
    toast.success(item.is_active ? 'Gambar disembunyikan' : 'Gambar ditampilkan')
    onChanged()
  }

  async function remove() {
    const { error } = await deleteTestimonialGalleryItem(item.id)
    if (error) { toast.error(error.message); return }
    toast.success('Gambar dihapus')
    onChanged()
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex h-48 items-center justify-center bg-muted/40 p-3">
        <img src={item.image_url} alt={item.alt} className="max-h-full max-w-full object-contain" />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{item.alt}</p>
            <p className="truncate text-xs text-muted-foreground">{item.image_url}</p>
          </div>
          <Badge variant={item.is_active ? 'default' : 'secondary'}>{item.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
        </div>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={toggleActive} title={item.is_active ? 'Sembunyikan' : 'Tampilkan'}>
            {item.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <GalleryDialog item={item} onSaved={onChanged} />
          <ConfirmDialog
            title="Hapus gambar?"
            message="Gambar gallery ini akan dihapus permanen."
            confirmLabel="Hapus"
            destructive
            onConfirm={remove}
            trigger={<Button variant="ghost" size="icon-sm" title="Hapus" />}
          >
            <Trash2 className="size-4 text-destructive" />
          </ConfirmDialog>
        </div>
      </div>
    </div>
  )
}

function GalleryDialog({ item, onSaved }: { item?: TestimonialGalleryItem; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '')
  const [alt, setAlt] = useState(item?.alt ?? '')
  const [active, setActive] = useState(item?.is_active ?? true)
  const [busy, setBusy] = useState(false)

  function reset() {
    setImageUrl(item?.image_url ?? '')
    setAlt(item?.alt ?? '')
    setActive(item?.is_active ?? true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!imageUrl.trim()) { toast.error('Image URL wajib diisi'); return }
    if (!alt.trim()) { toast.error('Alt text wajib diisi'); return }

    const payload: SaveTestimonialGalleryItemInput = {
      image_url: imageUrl.trim(),
      alt: alt.trim(),
      is_active: active,
    }

    setBusy(true)
    const { error } = await saveTestimonialGalleryItem(payload, item?.id)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(item ? 'Gambar diupdate' : 'Gambar ditambahkan')
    setOpen(false)
    reset()
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) reset() }}>
      <DialogTrigger render={<Button variant={item ? 'ghost' : 'default'} size={item ? 'icon-sm' : 'sm'} />}>
        {item ? <Pencil className="size-4" /> : <><Plus className="size-4" /> Tambah</>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? 'Edit gambar' : 'Tambah gambar'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://... atau blob:..." />
          </div>
          <div className="space-y-2">
            <Label>Alt text</Label>
            <Input value={alt} onChange={e => setAlt(e.target.value)} placeholder="Screenshot bukti transaksi..." />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="size-4 accent-primary" />
            Aktif
          </label>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Run check**

Run:

```bash
cd /home/jovan/project/netriz/netriztama
npm run build
```

Expected: build succeeds. If Bash is unavailable, note it and continue only if IDE diagnostics show no TypeScript errors.

---

### Task 3: Wire route and navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Consumes default export `AdminTestimonials` from `@/pages/AdminTestimonials`.
- Produces route `/admin/testimonials` inside the dashboard `Layout`.
- Produces nav item label `Testimonials`.

- [ ] **Step 1: Add route import**

In `src/App.tsx`, add:

```ts
import AdminTestimonials from '@/pages/AdminTestimonials'
```

- [ ] **Step 2: Add route under layout**

Inside the `<Route element={<Layout />}>` group in `src/App.tsx`, add:

```tsx
<Route path="/admin/testimonials" element={<AdminTestimonials />} />
```

- [ ] **Step 3: Add nav icon import**

In `src/components/Layout.tsx`, change:

```ts
import { LayoutDashboard, ShoppingCart, Tv, ScrollText, Sun, Moon } from 'lucide-react'
```

to:

```ts
import { LayoutDashboard, ShoppingCart, Tv, ScrollText, Sun, Moon, MessageSquareHeart } from 'lucide-react'
```

- [ ] **Step 4: Add nav item**

In `src/components/Layout.tsx`, add this item to `NAV` after `Logs`:

```ts
  { to: '/admin/testimonials', label: 'Testimonials', icon: MessageSquareHeart },
```

- [ ] **Step 5: Run check**

Run:

```bash
cd /home/jovan/project/netriz/netriztama
npm run build
```

Expected: build succeeds. If Bash is unavailable, note it and continue only if IDE diagnostics show no TypeScript errors.

---

### Task 4: Runtime verification

**Files:**
- No code changes expected.

**Interfaces:**
- Verifies admin route and CRUD behavior.

- [ ] **Step 1: Ensure SQL exists**

Confirm these SQL files were already applied in Supabase SQL Editor:

- `supabase/add_testimonials.sql`
- `supabase/seed_testimonials.sql`

Expected: tables exist and contain seed rows.

- [ ] **Step 2: Run the app**

```bash
cd /home/jovan/project/netriz/netriztama
npm run dev -- --host 127.0.0.1 --port 4173
```

Expected: Vite starts and prints a local URL.

- [ ] **Step 3: Open admin page**

Open:

```text
http://127.0.0.1:4173/admin/testimonials
```

Expected:

- Page loads inside dashboard layout.
- Nav item `Testimonials` appears.
- Testimonials card shows rows.
- Gallery transaksi card shows image URL rows.

- [ ] **Step 4: Verify testimonial create/toggle/delete**

On `/admin/testimonials`:

1. Click `Tambah` in Testimonials.
2. Keep Anonymous checked.
3. Set rating `5`.
4. Enter quote `Admin test: profil Netflix langsung ready.`
5. Save.
6. Toggle the new row inactive.
7. Delete the new row.

Expected:

- Row appears after save.
- Badge changes after toggle.
- Row disappears after delete.
- Success toasts appear for each operation.

- [ ] **Step 5: Verify gallery create/toggle/delete**

On `/admin/testimonials`:

1. Click `Tambah` in Gallery transaksi.
2. Enter image URL `blob:https://web.whatsapp.com/admin-test`.
3. Enter alt text `Admin test gallery image`.
4. Save.
5. Toggle inactive.
6. Delete the new row.

Expected:

- Row/card appears after save.
- Badge changes after toggle.
- Row/card disappears after delete.
- Image preview area does not crop the image.

---

## Self-Review

- Spec coverage: Task 1 covers helpers/types; Task 2 covers the admin page and CRUD UI; Task 3 covers route/nav; Task 4 covers runtime verification.
- Placeholder scan: no TBD/TODO/implement-later placeholders remain.
- Type consistency: helper names, input types, row types, route path, and nav label match the spec.
