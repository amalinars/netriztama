import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Receipt } from 'lucide-react'
import type { OrderWithProfile } from '@/types/database'

/**
 * Riwayat bukti transfer milik satu order.
 * Foto disimpan di server (Cloudinary) dan URL-nya ada di netflix.orders.receipt_urls,
 * jadi admin bisa melihat bukti transfer kapan pun & tetap ada walaupun order sudah selesai.
 */
export default function ReceiptDialog({ order }: { order: OrderWithProfile }) {
  const urls = order.receipt_urls?.length
    ? order.receipt_urls
    : order.receipt_url
      ? [order.receipt_url]
      : []

  // Kalau order belum punya bukti transfer (mis. order manual admin), tombol tidak dirender.
  if (!urls.length) return null

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="ghost" size="icon-xs" title={`Bukti transfer (${urls.length})`}>
          <Receipt className="size-3.5 text-emerald-600" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Bukti Transfer
            <Badge variant="secondary">{urls.length} foto</Badge>
          </DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-sm text-muted-foreground">
          Pembeli: <strong>{order.customer_name}</strong> · {order.profiles?.name}
        </p>
        <div className="mt-2 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {urls.map((url, i) => (
            <div key={url} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {urls.length > 1 ? `Bukti #${i + 1}` : 'Bukti transfer'}
                </span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Buka di tab baru
                </a>
              </div>
              <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={url}
                  alt={`Bukti transfer ${order.customer_name}`}
                  loading="lazy"
                  className="w-full rounded-xl border bg-muted/30 object-contain"
                />
              </a>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
