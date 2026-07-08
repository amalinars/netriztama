# Testimonials Admin Design

## Scope

Build a simple admin page for managing the public testimonials page data stored in Supabase:

- Text testimonials in `netflix.testimonials`.
- Transaction/chat gallery image URLs in `netflix.testimonial_gallery`.

This pass intentionally does not add moderation workflow, file upload, storage buckets, auth, or drag-and-drop reordering.

## Route and navigation

Add one dashboard/admin route:

- `/admin/testimonials`

Add one nav item in the existing `Layout` navigation:

- Label: `Testimonials`
- Icon: use an existing `lucide-react` icon such as `MessageSquareHeart` or `MessagesSquare`.

The page lives inside the dashboard layout, not the public `/testimonials` page.

## Page layout

Create `src/pages/AdminTestimonials.tsx`.

The page has two stacked cards/sections:

1. **Testimonials**
2. **Gallery transaksi**

Use the existing dashboard style from `Accounts`, `Orders`, and `Logs`: simple header, cards, buttons, dialogs, badges, and confirm dialogs.

## Testimonials management

Data source: `netflix.testimonials`.

List fields:

- Display name: `Anonymous` when `is_anonymous = true`, otherwise `name`.
- Rating: star count or numeric `rating`.
- Quote preview.
- Status badge: active/inactive.
- Actions: edit, toggle active, delete.

Create/edit form fields:

- `Tampilkan sebagai Anonymous` checkbox.
- `Nama` input, visible or useful only when anonymous is off.
- `Rating` numeric or select 1-5.
- `Quote` textarea.
- `Aktif` checkbox.

Rules:

- If anonymous is on, save `name = null`.
- If anonymous is off, require non-empty name.
- Require quote length at least 10 characters.
- Clamp rating to 1-5.

## Gallery management

Data source: `netflix.testimonial_gallery`.

List fields:

- Image preview with uncropped `object-contain` rendering.
- URL preview/truncated text.
- Alt text.
- Status badge: active/inactive.
- Actions: edit, toggle active, delete.

Create/edit form fields:

- `Image URL` input.
- `Alt text` input.
- `Aktif` checkbox.

Rules:

- Require non-empty URL.
- Require non-empty alt text.
- Do not upload files in this pass; URL can be `blob:`, public URL, or later storage URL.

## Data flow

Use the existing Supabase client in `src/lib/supabase.ts`.

Add small helpers for admin operations:

- `getAdminTestimonials()`
- `saveTestimonial(input, id?)`
- `deleteTestimonial(id)`
- `toggleTestimonialActive(id, isActive)`
- `getAdminTestimonialGallery()`
- `saveTestimonialGalleryItem(input, id?)`
- `deleteTestimonialGalleryItem(id)`
- `toggleTestimonialGalleryActive(id, isActive)`

Keep helpers small; no new service layer or dependency.

## Error handling

- Show loading state while fetching data.
- On Supabase error, show a `sonner` error toast.
- On successful create/update/delete/toggle, refresh that section's list.
- Confirm before delete using existing `ConfirmDialog`.

## Verification target

After implementation:

1. Open `/admin/testimonials`.
2. Confirm testimonials and gallery rows load.
3. Add a testimonial; confirm it appears in admin and public `/testimonials`.
4. Toggle testimonial inactive; confirm it disappears from public page after reload.
5. Add a gallery URL; confirm it appears in public gallery after reload.
6. Delete a gallery item; confirm it disappears from admin.

## Deliberate skips

- No approve queue.
- No drag/drop reorder.
- No storage bucket or file upload.
- No authentication changes.
- No separate admin layout.
