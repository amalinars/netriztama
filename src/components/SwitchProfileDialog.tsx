import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowRightLeft } from 'lucide-react'
import type { OrderWithProfile, Profile, Account } from '@/types/database'

export default function SwitchProfileDialog({ order, availableProfiles, onSaved }: { 
  order: OrderWithProfile, 
  availableProfiles: (Profile & { account: Pick<Account, 'name' | 'id'> })[], 
  onSaved: () => void 
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newProfileId, setNewProfileId] = useState('')

  async function handleSwitch(e: React.FormEvent) {
    e.preventDefault()
    if (!newProfileId) return
    setLoading(true)

    const migrationRecord = {
      moved_at: new Date().toISOString(),
      from_profile_id: order.profiles.id,
      from_profile_name: order.profiles.name,
      from_account_name: order.profiles.accounts.name,
    }
    const newHistory = [...(order.migration_history || []), migrationRecord]

    const { error } = await supabase.from('orders').update({
      profile_id: newProfileId,
      migration_history: newHistory,
    }).eq('id', order.id)

    setLoading(false)
    if (error) {
      alert(error.message)
    } else {
      setOpen(false)
      onSaved()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="ghost" size="icon-xs" title="Pindah Profil / Akun">
          <ArrowRightLeft className="size-3.5 text-orange-500" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pindah Profil / Akun</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSwitch} className="space-y-4">
          <div className="space-y-2">
            <Label>Profil Tujuan</Label>
            <Select value={newProfileId} onValueChange={(val) => val && setNewProfileId(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih profil yang tersedia..." />
              </SelectTrigger>
              <SelectContent>
                {availableProfiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.account.name.split('@')[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading || !newProfileId}>
              {loading ? 'Menyimpan...' : 'Pindahkan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
