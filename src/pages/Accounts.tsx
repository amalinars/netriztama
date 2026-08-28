import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/constants'
import type { Account, Profile } from '@/types/database'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import ConfirmDialog from '@/components/ConfirmDialog'
import ProfilePinStatus from '@/components/ProfilePinStatus'
import EditProfileDialog from '@/components/EditProfileDialog'
import { Plus, Trash2, Eye, EyeOff, Pencil, Copy, Power, PowerOff, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type AccountWithProfiles = Account & { profiles: Profile[] }

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} disalin`)
  } catch {
    toast.error('Gagal menyalin')
  }
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<AccountWithProfiles[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  async function fetchAccounts() {
    const [accRes, ordRes] = await Promise.all([
      supabase.from('accounts').select('*, profiles(*)').order('created_at'),
      supabase.from('orders').select('status, end_date, logout_time, profile_id').order('created_at', { ascending: false }),
    ])
    
    const accs = accRes.data ?? []
    const ords = ordRes.data ?? []
    
    const now = Date.now()
    function deadlineMs(endDate: string, logoutTime?: string | null) {
      const t = (logoutTime ?? '23:59').slice(0, 5)
      return new Date(`${endDate}T${t}:00`).getTime()
    }
    
    const bookedProfileIds = new Set<string>()
    for (const o of ords) {
      if (o.status === 'booked' && deadlineMs(o.end_date, o.logout_time) > now) {
        bookedProfileIds.add(o.profile_id)
      }
    }

    for (const acc of accs) {
      for (const p of acc.profiles) {
        (p as Profile & { isBooked?: boolean }).isBooked = bookedProfileIds.has(p.id)
      }
    }

    setAccounts(accs)
    setLoading(false)
  }

  useEffect(() => { fetchAccounts() }, [])

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Memuat...</div>

  const activeCount = accounts.filter(a => a.is_active).length

  const filteredAndSortedAccounts = accounts
    .filter(acc => {
      // Hide inactive accounts if NONE of their profiles are booked
      if (!acc.is_active) {
        const hasBooked = acc.profiles.some(p => (p as Profile & { isBooked?: boolean }).isBooked)
        if (!hasBooked) return false
      }
      return acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
             acc.profiles.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    })
    .sort((a, b) => {
      // Aktif di atas, nonaktif di bawah
      if (a.is_active !== b.is_active) {
        return a.is_active ? -1 : 1
      }
      // Kalau sama-sama aktif/nonaktif, urutkan abjad
      return a.name.localeCompare(b.name)
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Akun Netflix</h1>
          <p className="text-muted-foreground">{accounts.length} total akun ({activeCount} aktif)</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari email / nama profil..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <AddAccountDialog onAdded={fetchAccounts} />
        </div>
      </div>
      {accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">Belum ada akun Netflix.</p>
            <p className="text-sm text-muted-foreground">Tambah akun pertama untuk mulai.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredAndSortedAccounts.map(acc => (
            <AccountCard key={acc.id} account={acc} onChanged={fetchAccounts} />
          ))}
          {filteredAndSortedAccounts.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              Pencarian tidak ditemukan.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AccountCard({ account, onChanged }: { account: AccountWithProfiles; onChanged: () => void }) {
  const [showPw, setShowPw] = useState(false)

  async function deleteAccount() {
    const { error } = await supabase.from('accounts').delete().eq('id', account.id)
    if (error) { toast.error(error.message); return }
    toast.success('Akun dihapus')
    onChanged()
  }

  async function toggleActive() {
    const { error } = await supabase.from('accounts').update({ is_active: !account.is_active }).eq('id', account.id)
    if (error) { toast.error(error.message); return }
    toast.success(`Akun ${account.is_active ? 'dinonaktifkan' : 'diaktifkan'}`)
    onChanged()
  }

  return (
    <Card className={cn("overflow-hidden transition-all duration-300", !account.is_active && "opacity-80 border-dashed bg-muted/20")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="truncate text-base">
                {account.name}
              </CardTitle>
              {!account.is_active && <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Nonaktif</Badge>}
              <Button variant="ghost" size="icon-xs" onClick={() => copyText(account.name, 'Email')} title="Copy email">
                <Copy className="size-3.5" />
              </Button>
            </div>
            {account.password && (
              <div className="mt-1.5 flex items-center gap-1">
                <button onClick={() => setShowPw(!showPw)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  {showPw ? account.password : '••••••••'}
                </button>
                <Button variant="ghost" size="icon-xs" onClick={() => copyText(account.password!, 'Password')} title="Copy password">
                  <Copy className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={toggleActive} title={account.is_active ? "Nonaktifkan Akun" : "Aktifkan Akun"}>
              {account.is_active ? <Power className="size-3.5 text-green-500" /> : <PowerOff className="size-3.5 text-muted-foreground" />}
            </Button>
            <EditAccountDialog account={account} onSaved={onChanged} />
            <ConfirmDialog
              title="Hapus akun?"
              message={`Akun "${account.name}" dan semua profil + order terkait akan dihapus permanen.`}
              confirmLabel="Hapus"
              destructive
              onConfirm={deleteAccount}
              trigger={<Button variant="ghost" size="icon-sm" title="Hapus akun" />}
            >
              <Trash2 className="size-4 text-destructive" />
            </ConfirmDialog>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Langganan: {formatRupiah(account.subscription_cost)}/bulan</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">Profil ({account.profiles.length})</span>
          <AddProfileDialog accountId={account.id} onAdded={onChanged} />
        </div>
        <div className="space-y-2">
          {account.profiles.map(p => (
            <ProfileRow key={p.id} profile={p} account={account} onChanged={onChanged} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ProfileRow({ profile, account, onChanged }: { profile: Profile; account: Account; onChanged: () => void }) {
  async function deleteProfile() {
    const { error } = await supabase.from('profiles').delete().eq('id', profile.id)
    if (error) { toast.error(error.message); return }
    toast.success('Profil dihapus')
    onChanged()
  }

  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base">{profile.name}</span>
        <ProfilePinStatus profile={profile} account={account} onChanged={onChanged} />
        <Badge variant={profile.is_rentable ? 'default' : 'secondary'} className="text-xs">
          {profile.is_rentable ? 'Disewakan' : 'Utama'}
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <EditProfileDialog profile={profile} onSaved={onChanged} />
        <ConfirmDialog
          title="Hapus profil?"
          message={`Profil "${profile.name}" akan dihapus.`}
          confirmLabel="Hapus"
          destructive
          onConfirm={deleteProfile}
          trigger={<Button variant="ghost" size="icon-sm" title="Hapus profil" />}
        >
          <Trash2 className="size-3.5 text-destructive" />
        </ConfirmDialog>
      </div>
    </div>
  )
}

function AddAccountDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [cost, setCost] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const { error } = await supabase.from('accounts').insert({ name: name.trim(), password: password || null, subscription_cost: Number(cost) || 0, is_active: true })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Akun ditambahkan')
    setName(''); setPassword(''); setCost('')
    setOpen(false)
    onAdded()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Tambah Akun
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Tambah Akun Netflix</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Email / Nama Akun</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="email@example.com" required />
          </div>
          <div className="space-y-2">
            <Label>Password (opsional)</Label>
            <Input value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} placeholder="Password akun" />
          </div>
          <div className="space-y-2">
            <Label>Biaya Langganan / Bulan</Label>
            <Input type="number" value={cost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCost(e.target.value)} placeholder="186000" />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={busy}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditAccountDialog({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(account.name)
  const [password, setPassword] = useState(account.password ?? '')
  const [cost, setCost] = useState(String(account.subscription_cost))
  const [isActive, setIsActive] = useState(account.is_active ?? true)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.from('accounts').update({
      name: name.trim(),
      password: password || null,
      subscription_cost: Number(cost) || 0,
      is_active: isActive,
    }).eq('id', account.id)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Akun diupdate')
    setOpen(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Akun</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Email / Nama Akun</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Biaya Langganan / Bulan</Label>
            <Input type="number" value={cost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCost(e.target.value)} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-primary size-4" />
            <span>Akun Aktif (centang jika langganan masih jalan)</span>
          </label>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={busy}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddProfileDialog({ accountId, onAdded }: { accountId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [isRentable, setIsRentable] = useState(true)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !pin.trim()) return
    setBusy(true)
    const { error } = await supabase.from('profiles').insert({ account_id: accountId, name: name.trim(), pin: pin.trim(), is_rentable: isRentable })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Profil ditambahkan')
    setName(''); setPin(''); setIsRentable(true)
    setOpen(false)
    onAdded()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Plus className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Tambah Profil</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nama Profil</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="e.g. kulkas, sendal" required />
          </div>
          <div className="space-y-2">
            <Label>PIN</Label>
            <Input value={pin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPin(e.target.value)} placeholder="1234" maxLength={4} required inputMode="numeric" pattern="[0-9]{4}" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isRentable} onChange={e => setIsRentable(e.target.checked)} className="accent-primary size-4" />
            <span>Disewakan (uncheck kalau profil utama)</span>
          </label>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={busy}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
