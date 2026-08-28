import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { History } from 'lucide-react'
import type { OrderWithProfile } from '@/types/database'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(t: string) {
  return t.slice(11, 16) // extract HH:mm from ISO string
}

export default function HistoryDialog({ order }: { order: OrderWithProfile }) {
  if (!order.migration_history || order.migration_history.length === 0) return null

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="ghost" size="icon-xs" title="Riwayat Pindah Akun">
          <History className="size-3.5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Riwayat Perpindahan Akun</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {order.migration_history.map((m, i) => (
            <div key={i} className="flex flex-col gap-1 text-sm border-l-2 border-muted pl-3">
              <span className="text-muted-foreground text-xs">{formatDate(m.moved_at)} {formatTime(m.moved_at)} WIB</span>
              <span>Dipindah dari <strong>{m.from_profile_name}</strong> ({m.from_account_name.split('@')[0]})</span>
            </div>
          ))}
          <div className="flex flex-col gap-1 text-sm border-l-2 border-primary pl-3">
            <span className="text-primary font-medium text-xs">Sekarang</span>
            <span>Berada di <strong>{order.profiles.name}</strong> ({order.profiles.accounts.name.split('@')[0]})</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
