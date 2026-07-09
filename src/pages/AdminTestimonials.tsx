import { useEffect, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
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

function AdminPasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!ADMIN_PASSWORD) { setError('VITE_ADMIN_PASSWORD belum diisi di .env'); return }
    if (password !== ADMIN_PASSWORD) { setError('Password salah'); return }
    sessionStorage.setItem(ADMIN_UNLOCK_KEY, 'true')
    onUnlock()
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Masuk Admin</CardTitle>
          <p className="text-sm text-muted-foreground">Isi password admin dulu untuk kelola testimoni.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="Password admin"
                autoFocus
              />
              {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full">Masuk</Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            ponytail: ini cuma gate UI client-side; upgrade ke Supabase Auth + RLS kalau admin harus benar-benar privat.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

type CloudinaryUploadResponse = {
  secure_url?: string
  error?: { message?: string }
}

const ADMIN_UNLOCK_KEY = 'netriztama-admin-unlocked'
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

async function uploadToCloudinary(file: File) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary belum dikonfigurasi')

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', uploadPreset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body,
  })
  const data = await response.json().catch(() => ({})) as CloudinaryUploadResponse

  if (!response.ok) throw new Error(data.error?.message ?? 'Upload Cloudinary gagal')
  if (!data.secure_url) throw new Error('Cloudinary tidak mengembalikan URL gambar')
  return data.secure_url
}

export default function AdminTestimonials() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(ADMIN_UNLOCK_KEY) === 'true')
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [gallery, setGallery] = useState<TestimonialGalleryItem[]>([])
  const [loading, setLoading] = useState(unlocked)

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

  useEffect(() => { if (unlocked) loadAll() }, [unlocked])

  if (!unlocked) return <AdminPasswordGate onUnlock={() => { setLoading(true); setUnlocked(true) }} />
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
        </CardHeader>
        <CardContent className="space-y-4">
          <GalleryUploader onSaved={loadGallery} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.length === 0 ? (
              <p className="col-span-full rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">Belum ada gambar.</p>
            ) : gallery.map(item => (
              <GalleryCard key={item.id} item={item} onChanged={loadGallery} />
            ))}
          </div>
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

  async function submit(e: FormEvent) {
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

function GalleryUploader({ onSaved }: { onSaved: () => void }) {
  const [imageUrl, setImageUrl] = useState('')
  const [alt, setAlt] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function uploadFile(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('File harus gambar'); return }

    setUploading(true)
    try {
      setImageUrl(await uploadToCloudinary(file))
      if (!alt.trim()) setAlt(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
      toast.success('Upload selesai')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload gagal')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragging(false)
    void uploadFile(e.dataTransfer.files?.[0])
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (uploading) return
    if (!imageUrl.trim()) { toast.error('Upload gambar atau isi Image URL dulu'); return }
    if (!alt.trim()) { toast.error('Alt text wajib diisi'); return }

    setSaving(true)
    const { error } = await saveTestimonialGalleryItem({ image_url: imageUrl.trim(), alt: alt.trim(), is_active: true })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Gambar ditambahkan')
    setImageUrl('')
    setAlt('')
    onSaved()
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-dashed bg-muted/30 p-4">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging ? 'border-primary bg-primary/10' : 'border-border bg-background/70 hover:bg-background'
          }`}
        >
          <Input type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => uploadFile(e.target.files?.[0])} disabled={uploading || saving} className="sr-only" />
          {imageUrl ? (
            <img src={imageUrl} alt={alt || 'Preview upload'} className="max-h-44 max-w-full object-contain" />
          ) : (
            <>
              <ImageIcon className="mb-3 size-8 text-muted-foreground" />
              <span className="font-semibold">Drop gambar di sini</span>
              <span className="mt-1 text-sm text-muted-foreground">atau klik untuk upload ke Cloudinary</span>
            </>
          )}
        </label>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://res.cloudinary.com/..." disabled={uploading} />
          </div>
          <div className="space-y-2">
            <Label>Alt text</Label>
            <Input value={alt} onChange={e => setAlt(e.target.value)} placeholder="Screenshot bukti transaksi..." />
          </div>
          <Button type="submit" disabled={uploading || saving} className="w-full">
            {uploading ? 'Uploading...' : saving ? 'Menyimpan...' : 'Simpan gambar'}
          </Button>
        </div>
      </div>
    </form>
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


  async function submit(e: FormEvent) {
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
        <DialogHeader><DialogTitle>Edit gambar</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://res.cloudinary.com/..." />
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
