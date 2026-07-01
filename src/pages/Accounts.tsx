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
import { Plus, Trash2, Eye, EyeOff, Pencil, Copy } from 'lucide-react'

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
    const { error } = await supabase.from('accounts').delete().eq('id', account.id)
    if (error) { toast.error(error.message); return }
    toast.success('Akun dihapus')
    onChanged()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <CardTitle className="truncate text-base">{account.name}</CardTitle>
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
    const { error } = await supabase.from('accounts').insert({ name: name.trim(), password: password || null, subscription_cost: Number(cost) || 0 })
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
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.from('accounts').update({
      name: name.trim(),
      password: password || null,
      subscription_cost: Number(cost) || 0,
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
