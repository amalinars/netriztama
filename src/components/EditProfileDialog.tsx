import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'

export default function EditProfileDialog({ profile, onSaved, size = 'icon-sm' }: { profile: Profile; onSaved: () => void; size?: 'icon-xs' | 'icon-sm' }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(profile.name)
  const [pin, setPin] = useState(profile.pin ?? '')
  const [isRentable, setIsRentable] = useState(profile.is_rentable)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setName(profile.name)
      setPin(profile.pin ?? '')
      setIsRentable(profile.is_rentable)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !pin.trim()) return
    setBusy(true)
    
    const newPin = pin.trim()
    const currentNetflixPin = profile.pin_change_pending ? profile.old_pin : profile.pin
    const isDifferentFromNetflix = newPin !== (currentNetflixPin ?? '')

    const { error } = await supabase.from('profiles').update({
      name: name.trim(),
      pin: newPin,
      is_rentable: isRentable,
      old_pin: isDifferentFromNetflix ? currentNetflixPin : null,
      pin_change_pending: isDifferentFromNetflix,
    } as never).eq('id', profile.id)

    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(isDifferentFromNetflix ? 'Profil diupdate, PIN perlu diganti di Netflix' : 'Profil diupdate')
    setOpen(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size={size} title="Edit profil" />}>
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Profil</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nama Profil</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required />
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
