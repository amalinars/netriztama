import { toast } from 'sonner'
import { Copy, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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
        <span className="tabular-nums text-muted-foreground">{profile.old_pin ?? '----'} → <b className="text-foreground">{profile.pin}</b></span>
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
