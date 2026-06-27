import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PACKAGES, formatRupiah, calculateEndDate } from '@/lib/constants'
import type { Account, Profile, Order, PackageType } from '@/types/database'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import LogoutTimeField from '@/components/LogoutTimeField'
import { Plus } from 'lucide-react'

type AccountFull = Account & { profiles: Profile[] }

type Props = {
  onSaved: () => void
  initial?: { accountId?: string; profileId?: string }
  extend?: Order
  open?: boolean
  onOpenChange?: (v: boolean) => void
  showTrigger?: boolean
}

function nextDay(date: string) {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function AddOrderDialog({ onSaved, initial, extend, open: controlledOpen, onOpenChange, showTrigger = controlledOpen === undefined }: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const [accounts, setAccounts] = useState<AccountFull[]>([])
  const [accountId, setAccountId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [pkg, setPkg] = useState<PackageType | ''>('')
  const [price, setPrice] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [logoutTime, setLogoutTime] = useState('23:59')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.from('accounts').select('*, profiles(*)').order('name').then(({ data }: { data: AccountFull[] | null }) => {
      const list = data ?? []
      setAccounts(list)

      if (extend) {
        const acc = list.find(a => a.profiles.some(p => p.id === extend.profile_id))
        setAccountId(acc?.id ?? '')
        setProfileId(extend.profile_id)
        setCustomerName(extend.customer_name)
        const nextStart = nextDay(extend.end_date)
        setPkg(extend.package)
        setPrice(String(extend.price))
        setStartDate(nextStart)
        setEndDate(calculateEndDate(nextStart, extend.package))
        setLogoutTime(extend.logout_time?.slice(0, 5) ?? '23:59')
        setNotes(extend.notes ?? '')
      } else if (initial) {
        setAccountId(initial.accountId ?? '')
        setProfileId(initial.profileId ?? '')
      }
    })
  }, [open, extend, initial])

  const availableProfiles = accounts.find(a => a.id === accountId)?.profiles.filter(p => p.is_rentable) ?? []
  const finalPrice = pkg ? Number(price) || PACKAGES[pkg as PackageType].price : 0

  function reset() {
    setAccountId(''); setProfileId(''); setCustomerName(''); setPkg(''); setPrice(''); setNotes('')
    setStartDate(new Date().toISOString().split('T')[0])
    setEndDate('')
    setLogoutTime('23:59')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profileId || !pkg || !customerName.trim() || !endDate) return
    setBusy(true)
    const { error } = await supabase.from('orders').insert({
      profile_id: profileId,
      customer_name: customerName.trim(),
      package: pkg,
      price: finalPrice,
      start_date: startDate,
      end_date: endDate,
      logout_time: logoutTime,
      notes: notes || null,
    })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(extend ? 'Order diperpanjang' : 'Order disimpan')
    reset()
    setOpen(false)
    onSaved()
  }

  function handleAccountChange(v: string | null) {
    setAccountId(v ?? '')
    setProfileId('')
  }

  function handlePackageChange(v: string | null) {
    const next = (v ?? '') as PackageType | ''
    setPkg(next)
    setPrice(next ? String(PACKAGES[next].price) : '')
    setEndDate(next ? calculateEndDate(startDate, next) : '')
  }

  function handleStartDateChange(v: string) {
    setStartDate(v)
    if (pkg) setEndDate(calculateEndDate(v, pkg))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger render={<Button size="sm" />}>
          <Plus className="size-4" /> Tambah Order
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader><DialogTitle>{extend ? 'Perpanjang Order' : 'Tambah Order Baru'}</DialogTitle></DialogHeader>
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
                    {(v: string | null) => { const p = availableProfiles.find(p => p.id === v); return p ? `${p.name}${p.pin ? ` (${p.pin})` : ''}` : 'Pilih profil' }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name} {p.pin ? `(${p.pin})` : ''}</SelectItem>)}
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
            <Select value={pkg} onValueChange={handlePackageChange}>
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
              <Input type="date" value={startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleStartDateChange(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Beres</Label>
              <Input type="date" value={endDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <LogoutTimeField value={logoutTime} onChange={setLogoutTime} />

          {pkg && (
            <div className="space-y-2">
              <Label>Harga</Label>
              <Input type="number" value={price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)} placeholder={String(PACKAGES[pkg].price)} required />
              <p className="text-xs text-muted-foreground">Default paket: {formatRupiah(PACKAGES[pkg].price)}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Catatan (opsional)</Label>
            <Textarea value={notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)} placeholder="Catatan tambahan" rows={2} />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={busy}>{extend ? 'Simpan Perpanjangan' : 'Simpan Order'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
