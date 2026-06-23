import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatRupiah } from '@/lib/constants'
import type { Account, Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Plus, Trash2, Eye, EyeOff, Pencil } from 'lucide-react'

type AccountWithProfiles = Account & { profiles: Profile[] }

export default function Accounts() {
  const [accounts, setAccounts] = useState<AccountWithProfiles[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchAccounts() {
    const { data } = await supabase
      .from('accounts')
      .select('*, profiles(*)')
      .order('created_at')
    setAccounts(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAccounts() }, [])

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Memuat...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Akun Netflix</h1>
          <p className="text-muted-foreground">{accounts.length} akun terdaftar</p>
        </div>
        <AddAccountDialog onAdded={fetchAccounts} />
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
          {accounts.map(acc => (
            <AccountCard key={acc.id} account={acc} onChanged={fetchAccounts} />
          ))}
        </div>
      )}
    </div>
  )
}

function AccountCard({ account, onChanged }: { account: AccountWithProfiles; onChanged: () => void }) {
  const [showPw, setShowPw] = useState(false)

  async function deleteAccount() {
    if (!confirm(`Hapus akun "${account.name}" dan semua data terkait?`)) return
    await supabase.from('accounts').delete().eq('id', account.id)
    onChanged()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{account.name}</CardTitle>
            {account.password && (
              <button onClick={() => setShowPw(!showPw)} className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {showPw ? account.password : '••••••••'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <EditAccountDialog account={account} onSaved={onChanged} />
            <Button variant="ghost" size="icon-sm" onClick={deleteAccount}><Trash2 className="size-4 text-destructive" /></Button>
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
            <ProfileRow key={p.id} profile={p} onChanged={onChanged} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ProfileRow({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  async function deleteProfile() {
    if (!confirm(`Hapus profil "${profile.name}"?`)) return
    await supabase.from('profiles').delete().eq('id', profile.id)
    onChanged()
  }

  async function toggleRentable() {
    await supabase.from('profiles').update({ is_rentable: !profile.is_rentable }).eq('id', profile.id)
    onChanged()
  }

  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="text-base">{profile.name}</span>
        {profile.pin && <span className="text-sm text-muted-foreground">PIN: {profile.pin}</span>}
        <Badge variant={profile.is_rentable ? 'default' : 'secondary'} className="text-xs">
          {profile.is_rentable ? 'Disewakan' : 'Utama'}
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={toggleRentable} title={profile.is_rentable ? 'Set sebagai utama' : 'Set untuk disewakan'}>
          <Pencil className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={deleteProfile}><Trash2 className="size-3.5 text-destructive" /></Button>
      </div>
    </div>
  )
}

function AddAccountDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [cost, setCost] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await supabase.from('accounts').insert({ name: name.trim(), password: password || null, subscription_cost: Number(cost) || 0 })
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
            <Button type="submit">Simpan</Button>
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('accounts').update({
      name: name.trim(),
      password: password || null,
      subscription_cost: Number(cost) || 0,
    }).eq('id', account.id)
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
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit">Simpan</Button>
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await supabase.from('profiles').insert({ account_id: accountId, name: name.trim(), pin: pin || null, is_rentable: isRentable })
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
            <Label>PIN (opsional)</Label>
            <Input value={pin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPin(e.target.value)} placeholder="1234" maxLength={4} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isRentable} onChange={e => setIsRentable(e.target.checked)} className="accent-primary size-4" />
            <span>Disewakan (uncheck kalau profil utama)</span>
          </label>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
