import { useEffect, useState } from 'react'
import { supabase, autoCompleteOrders, completeOrder } from '@/lib/supabase'
import { PACKAGES, formatRupiah } from '@/lib/constants'
import type { Account, Profile, OrderWithProfile, Order } from '@/types/database'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import AddOrderDialog from '@/components/AddOrderDialog'
import ConfirmDialog from '@/components/ConfirmDialog'
import LogoutTimeField from '@/components/LogoutTimeField'
import ProfilePinStatus from '@/components/ProfilePinStatus'
import EditProfileDialog from '@/components/EditProfileDialog'
import { Search, CheckCircle2, AlertTriangle, List, LayoutGrid, Calendar, Tag, RefreshCw, Pencil, Trash2 } from 'lucide-react'

type ViewMode = 'list' | 'card'
type AccountWithProfiles = Account & { profiles: Profile[] }
type OrderFilter = 'available' | 'all' | 'booked' | 'done'

export default function Orders() {
  const [orders, setOrders] = useState<OrderWithProfile[]>([])
  const [accounts, setAccounts] = useState<AccountWithProfiles[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<OrderFilter>('booked')
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('orders-view') as ViewMode) || 'list')
  const [loading, setLoading] = useState(true)
  const [extending, setExtending] = useState<Order | null>(null)
  const [renting, setRenting] = useState<{ accountId: string; profileId: string } | null>(null)

  async function fetchOrders() {
    const [{ data: ordData }, { data: accData }] = await Promise.all([
      supabase.from('orders').select('*, profiles(*, accounts(id, name))').order('created_at', { ascending: false }),
      supabase.from('accounts').select('*, profiles(*)').order('created_at'),
    ])
    setOrders(ordData ?? [])
    setAccounts((accData ?? []) as unknown as AccountWithProfiles[])
    setLoading(false)
  }

  useEffect(() => { autoCompleteOrders().then(fetchOrders) }, [])

  function toggleView(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem('orders-view', mode)
  }

  const bookedProfileIds = new Set(orders.filter(o => o.status === 'booked').map(o => o.profile_id))
  const availableProfiles = accounts.flatMap(acc => acc.profiles
    .filter(p => p.is_rentable && !bookedProfileIds.has(p.id) && (selectedAccount === 'all' || acc.id === selectedAccount))
    .map(p => ({ ...p, account: acc })))

  const filtered = orders.filter(o => {
    if (filterStatus === 'available') return false
    if (selectedAccount !== 'all' && o.profiles.accounts.id !== selectedAccount) return false
    if (filterStatus !== 'all' && o.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return o.customer_name.toLowerCase().includes(q) ||
        o.profiles.name.toLowerCase().includes(q) ||
        o.profiles.accounts.name.toLowerCase().includes(q)
    }
    return true
  })

  const visibleAvailable = availableProfiles.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.account.name.toLowerCase().includes(q) || p.pin?.includes(q)
  })

  async function markDone(id: string) {
    const { error } = await completeOrder(id)
    if (error) { toast.error(error.message); return }
    toast.success('Order selesai, PIN baru dibuat')
    fetchOrders()
  }

  async function deleteOrder(id: string) {
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Order dihapus')
    fetchOrders()
  }

  const today = new Date().toISOString().split('T')[0]

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Memuat...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">{filterStatus === 'available' ? `${visibleAvailable.length} profil tersedia` : `${filtered.length} dari ${orders.length} order`}</p>
        </div>
        <AddOrderDialog onSaved={fetchOrders} />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <Button variant={selectedAccount === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedAccount('all')}>
          Semua Akun
        </Button>
        {accounts.map(acc => (
          <Button key={acc.id} variant={selectedAccount === acc.id ? 'default' : 'outline'} size="sm" onClick={() => setSelectedAccount(acc.id)} className="truncate max-w-48">
            {acc.name.split('@')[0]}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Cari nama pembeli, profil, akun..." className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(['available', 'booked', 'done', 'all'] as const).map(s => (
              <Button key={s} variant={filterStatus === s ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(s)}>
                {s === 'available' ? 'Tersedia' : s === 'all' ? 'Semua' : s === 'booked' ? 'Booked' : 'Selesai'}
              </Button>
            ))}
          </div>
          <div className="flex gap-0.5 border rounded-lg p-0.5">
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon-xs" onClick={() => toggleView('list')} title="List view">
              <List className="size-3.5" />
            </Button>
            <Button variant={viewMode === 'card' ? 'secondary' : 'ghost'} size="icon-xs" onClick={() => toggleView('card')} title="Card view">
              <LayoutGrid className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {filterStatus === 'available' ? (
        visibleAvailable.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">Tidak ada profil tersedia.</div>
        ) : viewMode === 'list' ? (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Profil</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead className="w-32 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAvailable.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.account.name.split('@')[0]}</TableCell>
                    <TableCell><ProfilePinStatus profile={p} onChanged={fetchOrders} compact /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <EditProfileDialog profile={p} onSaved={fetchOrders} size="icon-xs" />
                        <Button size="sm" onClick={() => setRenting({ accountId: p.account.id, profileId: p.id })}>Sewakan</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleAvailable.map(p => (
              <Card key={p.id} className="border-emerald-500/20 bg-emerald-500/8 dark:bg-emerald-500/10">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{p.account.name.split('@')[0]}</p>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Tersedia</Badge>
                  </div>
                  <ProfilePinStatus profile={p} onChanged={fetchOrders} />
                  <div className="flex justify-end gap-1 border-t pt-2">
                    <EditProfileDialog profile={p} onSaved={fetchOrders} size="icon-xs" />
                    <Button size="sm" onClick={() => setRenting({ accountId: p.account.id, profileId: p.id })}>Sewakan</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          {orders.length === 0 ? 'Belum ada order.' : 'Tidak ada hasil.'}
        </div>
      ) : viewMode === 'list' ? (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Profil</TableHead>
                <TableHead>Pembeli</TableHead>
                <TableHead>Paket</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead>Mulai</TableHead>
                <TableHead>Beres</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="w-32 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o, i) => (
                <TableRow key={o.id} className={o.status === 'booked' ? 'bg-primary/5' : ''}>
                  <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{o.profiles.name}</span>
                      <ProfilePinStatus profile={o.profiles} onChanged={fetchOrders} compact />
                    </div>
                    <div className="text-sm text-muted-foreground">{o.profiles.accounts.name.split('@')[0]}</div>
                  </TableCell>
                  <TableCell className="font-medium">{o.customer_name}</TableCell>
                  <TableCell>{PACKAGES[o.package]?.label ?? o.package}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah(o.price)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(o.start_date)}</TableCell>
                  <TableCell className="tabular-nums">
                    <div>{formatDate(o.end_date)}</div>
                    <div className="text-xs text-muted-foreground">Logout {formatTime(o.logout_time)} WIB</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} endDate={o.end_date} today={today} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{o.notes}</TableCell>
                  <TableCell>
                    <OrderActions
                      order={o}
                      onExtend={() => setExtending(o)}
                      onMarkDone={() => markDone(o.id)}
                      onDelete={() => deleteOrder(o.id)}
                      onEdited={fetchOrders}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(o => (
            <Card key={o.id} className={`overflow-hidden ${o.status === 'booked' ? 'border-primary/20' : ''}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-semibold truncate">{o.customer_name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {o.profiles.name}
                      {' · '}{o.profiles.accounts.name.split('@')[0]}
                    </p>
                  </div>
                  <StatusBadge status={o.status} endDate={o.end_date} today={today} />
                </div>

                <ProfilePinStatus profile={o.profiles} onChanged={fetchOrders} />

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Tag className="size-3.5" />
                    <span>{PACKAGES[o.package]?.label ?? o.package}</span>
                  </div>
                  <div className="text-right font-semibold tabular-nums">
                    {formatRupiah(o.price)}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="size-3.5" />
                    <span>{formatDate(o.start_date)}</span>
                  </div>
                  <div className="text-right text-muted-foreground tabular-nums">
                    s/d {formatDate(o.end_date)} · {formatTime(o.logout_time)} WIB
                  </div>
                </div>

                {o.notes && (
                  <p className="text-sm text-muted-foreground truncate pt-1 border-t border-border/50">{o.notes}</p>
                )}

                <div className="flex items-center justify-end gap-0.5 pt-1 border-t border-border/50">
                  <OrderActions
                    order={o}
                    onExtend={() => setExtending(o)}
                    onMarkDone={() => markDone(o.id)}
                    onDelete={() => deleteOrder(o.id)}
                    onEdited={fetchOrders}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddOrderDialog
        open={!!extending}
        onOpenChange={(v: boolean) => { if (!v) setExtending(null) }}
        extend={extending ?? undefined}
        onSaved={fetchOrders}
      />
      <AddOrderDialog
        open={!!renting}
        onOpenChange={(v: boolean) => { if (!v) setRenting(null) }}
        initial={renting ?? undefined}
        onSaved={fetchOrders}
      />
    </div>
  )
}

function OrderActions({
  order, onExtend, onMarkDone, onDelete, onEdited,
}: {
  order: OrderWithProfile
  onExtend: () => void
  onMarkDone: () => void
  onDelete: () => void
  onEdited: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <EditOrderDialog order={order} onSaved={onEdited} />
      {order.status === 'booked' && (
        <>
          <Button variant="ghost" size="icon-xs" onClick={onExtend} title="Perpanjang">
            <RefreshCw className="size-3.5 text-primary" />
          </Button>
          <ConfirmDialog
            title="Tandai selesai?"
            message={`Order untuk ${order.customer_name} akan ditandai selesai.`}
            confirmLabel="Selesai"
            onConfirm={onMarkDone}
            trigger={<Button variant="ghost" size="icon-xs" title="Tandai selesai" />}
          >
            <CheckCircle2 className="size-3.5 text-green-500" />
          </ConfirmDialog>
        </>
      )}
      <ConfirmDialog
        title="Hapus order?"
        message={`Order ${order.customer_name} (${PACKAGES[order.package]?.label}) akan dihapus permanen.`}
        confirmLabel="Hapus"
        destructive
        onConfirm={onDelete}
        trigger={<Button variant="ghost" size="icon-xs" title="Hapus" />}
      >
        <Trash2 className="size-3.5 text-destructive" />
      </ConfirmDialog>
    </div>
  )
}

function EditOrderDialog({ order, onSaved }: { order: OrderWithProfile; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [customerName, setCustomerName] = useState(order.customer_name)
  const [logoutTime, setLogoutTime] = useState(order.logout_time?.slice(0, 5) ?? '23:59')
  const [notes, setNotes] = useState(order.notes ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setCustomerName(order.customer_name)
      setLogoutTime(order.logout_time?.slice(0, 5) ?? '23:59')
      setNotes(order.notes ?? '')
    }
  }, [open, order])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerName.trim()) return
    setBusy(true)
    const { error } = await supabase.from('orders').update({
      customer_name: customerName.trim(),
      logout_time: logoutTime,
      notes: notes || null,
    }).eq('id', order.id)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Order diupdate')
    setOpen(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-xs" title="Edit" />}>
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Order</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nama Pembeli</Label>
            <Input value={customerName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerName(e.target.value)} required />
          </div>
          <LogoutTimeField value={logoutTime} onChange={setLogoutTime} />
          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea value={notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)} rows={2} />
          </div>
          <p className="text-xs text-muted-foreground">Paket/tanggal/profil tidak bisa diubah. Hapus dan buat order baru kalau perlu.</p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={busy}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StatusBadge({ status, endDate, today }: { status: string; endDate: string; today: string }) {
  if (status === 'booked' && endDate < today) {
    return (
      <Badge variant="destructive" className="gap-1 shrink-0">
        <AlertTriangle className="size-3" /> Expired
      </Badge>
    )
  }
  return (
    <Badge variant={status === 'booked' ? 'default' : 'secondary'} className="shrink-0">
      {status === 'booked' ? 'Booked' : 'Selesai'}
    </Badge>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(t?: string | null) {
  return (t ?? '23:59').slice(0, 5)
}
