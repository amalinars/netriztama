import { useEffect, useState } from 'react'
import { supabase, autoCompleteOrders } from '@/lib/supabase'
import { PACKAGES, formatRupiah, calculateEndDate } from '@/lib/constants'
import type { Account, Profile, OrderWithProfile, PackageType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, CheckCircle2, AlertTriangle, List, LayoutGrid, Calendar, User, Tag } from 'lucide-react'

type ViewMode = 'list' | 'card'

export default function Orders() {
  const [orders, setOrders] = useState<OrderWithProfile[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'booked' | 'done'>('booked')
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('orders-view') as ViewMode) || 'list')
  const [loading, setLoading] = useState(true)

  async function fetchOrders() {
    const [{ data: ordData }, { data: accData }] = await Promise.all([
      supabase.from('orders').select('*, profiles(*, accounts(id, name))').order('created_at', { ascending: false }),
      supabase.from('accounts').select('id, name').order('created_at'),
    ])
    setOrders(ordData ?? [])
    setAccounts(accData ?? [])
    setLoading(false)
  }

  useEffect(() => { autoCompleteOrders().then(fetchOrders) }, [])

  function toggleView(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem('orders-view', mode)
  }

  const filtered = orders.filter(o => {
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

  async function markDone(id: string) {
    await supabase.from('orders').update({ status: 'done' }).eq('id', id)
    fetchOrders()
  }

  const today = new Date().toISOString().split('T')[0]

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Memuat...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">{filtered.length} dari {orders.length} order</p>
        </div>
        <AddOrderDialog onAdded={fetchOrders} />
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
            {(['all', 'booked', 'done'] as const).map(s => (
              <Button key={s} variant={filterStatus === s ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(s)}>
                {s === 'all' ? 'Semua' : s === 'booked' ? 'Booked' : 'Selesai'}
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

      {filtered.length === 0 ? (
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
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o, i) => (
                <TableRow key={o.id} className={o.status === 'booked' ? 'bg-primary/5' : ''}>
                  <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{o.profiles.name}</div>
                    <div className="text-sm text-muted-foreground">{o.profiles.accounts.name.split('@')[0]}</div>
                  </TableCell>
                  <TableCell className="font-medium">{o.customer_name}</TableCell>
                  <TableCell>{PACKAGES[o.package]?.label ?? o.package}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah(o.price)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(o.start_date)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(o.end_date)}</TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} endDate={o.end_date} today={today} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{o.notes}</TableCell>
                  <TableCell>
                    {o.status === 'booked' && (
                      <Button variant="ghost" size="icon-xs" onClick={() => markDone(o.id)} title="Tandai selesai">
                        <CheckCircle2 className="size-4 text-green-500" />
                      </Button>
                    )}
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
                    <p className="text-sm text-muted-foreground">{o.profiles.name} · {o.profiles.accounts.name.split('@')[0]}</p>
                  </div>
                  <StatusBadge status={o.status} endDate={o.end_date} today={today} />
                </div>

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
                    s/d {formatDate(o.end_date)}
                  </div>
                </div>

                {(o.notes || o.status === 'booked') && (
                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    {o.notes ? <p className="text-sm text-muted-foreground truncate">{o.notes}</p> : <span />}
                    {o.status === 'booked' && (
                      <Button variant="ghost" size="xs" onClick={() => markDone(o.id)} className="text-green-500 shrink-0">
                        <CheckCircle2 className="size-3.5" /> Selesai
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
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

function AddOrderDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<(Account & { profiles: Profile[] })[]>([])
  const [accountId, setAccountId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [pkg, setPkg] = useState<PackageType | ''>('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    supabase.from('accounts').select('*, profiles(*)').order('name').then(({ data }: { data: (Account & { profiles: Profile[] })[] | null }) => {
      setAccounts(data ?? [])
    })
  }, [open])

  const availableProfiles = accounts
    .find((a: Account & { profiles: Profile[] }) => a.id === accountId)
    ?.profiles.filter((p: Profile) => p.is_rentable) ?? []

  const endDate = pkg && startDate ? calculateEndDate(startDate, pkg as PackageType) : ''
  const price = pkg ? PACKAGES[pkg as PackageType].price : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profileId || !pkg || !customerName.trim()) return
    await supabase.from('orders').insert({
      profile_id: profileId,
      customer_name: customerName.trim(),
      package: pkg,
      price,
      start_date: startDate,
      end_date: endDate,
      notes: notes || null,
    })
    setAccountId(''); setProfileId(''); setCustomerName(''); setPkg(''); setNotes('')
    setStartDate(new Date().toISOString().split('T')[0])
    setOpen(false)
    onAdded()
  }

  function handleAccountChange(v: string | null) {
    setAccountId(v ?? '')
    setProfileId('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Tambah Order
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Tambah Order Baru</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Akun Netflix</Label>
            <Select value={accountId} onValueChange={handleAccountChange}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih akun">
                  {(v: string | null) => accounts.find(a => a.id === v)?.name ?? 'Pilih akun'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {accountId && (
            <div className="space-y-2">
              <Label>Profil</Label>
              <Select value={profileId} onValueChange={(v: string | null) => setProfileId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih profil">
                    {(v: string | null) => { const p = availableProfiles.find((p: Profile) => p.id === v); return p ? `${p.name}${p.pin ? ` (${p.pin})` : ''}` : 'Pilih profil' }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableProfiles.map((p: Profile) => <SelectItem key={p.id} value={p.id}>{p.name} {p.pin ? `(${p.pin})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nama Pembeli</Label>
            <Input value={customerName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerName(e.target.value)} placeholder="Nama pembeli" required />
          </div>

          <div className="space-y-2">
            <Label>Paket Sewa</Label>
            <Select value={pkg} onValueChange={(v: string | null) => setPkg((v ?? '') as PackageType | '')}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih paket">
                  {(v: string | null) => { const p = v ? PACKAGES[v as PackageType] : null; return p ? `${p.label} — ${formatRupiah(p.price)}` : 'Pilih paket' }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PACKAGES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label} — {formatRupiah(v.price)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <Input type="date" value={startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Beres</Label>
              <Input type="date" value={endDate} readOnly className="bg-muted" />
            </div>
          </div>

          {pkg && (
            <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium">
              Harga: {formatRupiah(price)}
            </div>
          )}

          <div className="space-y-2">
            <Label>Catatan (opsional)</Label>
            <Textarea value={notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)} placeholder="e.g. log out 13.35" rows={2} />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit">Simpan Order</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
