import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy, CheckCircle2, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  profile: Pick<Profile, 'id' | 'pin' | 'old_pin' | 'pin_change_pending'>
  onChanged?: () => void | Promise<void>
  compact?: boolean
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success('PIN disalin') }
  catch { toast.error('Gagal menyalin') }
}

export default function ProfilePinStatus({ profile, onChanged, compact }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile.pin ?? '')

  useEffect(() => setDraft(profile.pin ?? ''), [profile.pin])

  async function savePendingPin() {
    if (!/^\d{4}$/.test(draft)) return
    const { error } = await supabase.from('profiles').update({ pin: draft } as never).eq('id', profile.id)
    if (error) { toast.error(error.message); return }
    toast.success('PIN baru diupdate')
    setEditing(false)
    onChanged?.()
  }

  async function confirmChanged() {
    const { error } = await supabase.from('profiles').update({ old_pin: null, pin_change_pending: false } as never).eq('id', profile.id)
    if (error) { toast.error(error.message); return }
    toast.success('PIN Netflix sudah valid')
    onChanged?.()
  }

  if (!profile.pin) return <span className="text-sm text-amber-600 dark:text-amber-400">PIN: belum di-set</span>

  if (profile.pin_change_pending) {
    return (
      <div className={compact ? 'flex flex-wrap items-center gap-1.5 text-xs' : 'flex flex-wrap items-center gap-2'}>
        <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300">Belum diganti di Netflix</Badge>
        <span className="tabular-nums text-muted-foreground">{profile.old_pin ?? '----'} → </span>
        {editing ? (
          <span className="inline-flex items-center gap-1">
            <Input value={draft} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} inputMode="numeric" pattern="[0-9]{4}" className="h-7 w-16 px-2 text-xs font-semibold tabular-nums" />
            <Button variant="ghost" size="icon-xs" onClick={savePendingPin} title="Simpan PIN baru"><CheckCircle2 className="size-3" /></Button>
          </span>
        ) : (
          <b className="text-foreground tabular-nums">{profile.pin}</b>
        )}
        <Button variant="ghost" size="icon-xs" onClick={() => setEditing(!editing)} title="Edit PIN baru"><Pencil className="size-3" /></Button>
        <Button variant="ghost" size="icon-xs" onClick={() => copyText(profile.pin!)} title="Copy PIN baru"><Copy className="size-3" /></Button>
        <Button variant="outline" size="sm" onClick={confirmChanged} className="h-7 gap-1 text-xs"><CheckCircle2 className="size-3" /> Sudah diganti</Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5">
      <span className="text-sm text-muted-foreground tabular-nums">PIN: {profile.pin}</span>
      <Button variant="ghost" size="icon-xs" onClick={() => copyText(profile.pin!)} title="Copy PIN"><Copy className="size-3" /></Button>
    </div>
  )
}
