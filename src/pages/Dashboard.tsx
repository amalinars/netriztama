import { useEffect, useState, useMemo } from 'react'
import { supabase, autoCompleteOrders } from '@/lib/supabase'
import { formatRupiah } from '@/lib/constants'
import type { Account, Profile, Order } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DollarSign, TrendingUp, ShoppingCart, Tv, Clock } from 'lucide-react'

type AccountWithProfiles = Account & { profiles: (Profile & { currentOrder?: Order })[] }
type OrderWithAccount = Order & { profiles: { account_id: string } }

function useCountdown(endDates: string[]) {
  const targets = useMemo(() => endDates.map(d => new Date(d + 'T23:59:59').getTime()), [endDates.join()])
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return (endDate: string) => {
    const end = new Date(endDate + 'T23:59:59').getTime()
    const diff = end - now
    if (diff <= 0) return 'Sudah berakhir'
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    if (d > 0) return `${d}h ${h}j ${m}m ${s}d`
    if (h > 0) return `${h}j ${m}m ${s}d`
    return `${m}m ${s}d`
  }
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<AccountWithProfiles[]>([])
  const [orders, setOrders] = useState<OrderWithAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<string>('all')

  useEffect(() => {
    autoCompleteOrders().then(() =>
      Promise.all([
        supabase.from('accounts').select('*, profiles(*)').order('created_at'),
        supabase.from('orders').select('*, profiles(account_id)').order('created_at', { ascending: false }),
      ]).then(([accRes, ordRes]) => {
        const accs = accRes.data ?? []
        const ords = ordRes.data ?? []
        const today = new Date().toISOString().split('T')[0]

        const bookedMap = new Map<string, OrderWithAccount>()
        for (const o of ords) {
          if (o.status === 'booked' && o.end_date >= today && !bookedMap.has(o.profile_id)) {
            bookedMap.set(o.profile_id, o)
          }
        }

        for (const acc of accs) {
          for (const p of acc.profiles) {
            (p as Profile & { currentOrder?: Order }).currentOrder = bookedMap.get(p.id)
          }
        }

        setAccounts(accs)
        setOrders(ords)
        setLoading(false)
      })
    )
  }, [])

  const profileIdsByAccount = new Set(
    selectedAccount === 'all'
      ? accounts.flatMap(a => a.profiles.map(p => p.id))
      : accounts.find(a => a.id === selectedAccount)?.profiles.map(p => p.id) ?? []
  )

  const scopedOrders = selectedAccount === 'all'
    ? orders
    : orders.filter(o => profileIdsByAccount.has(o.profile_id))

  const totalIncome = scopedOrders.reduce((s, o) => s + o.price, 0)
  const totalCost = selectedAccount === 'all'
    ? accounts.reduce((s, a) => s + a.subscription_cost, 0)
    : accounts.find(a => a.id === selectedAccount)?.subscription_cost ?? 0
  const laba = totalIncome - totalCost
  const activeOrders = scopedOrders.filter(o => o.status === 'booked').length

  const filteredAccounts = selectedAccount === 'all'
    ? accounts
    : accounts.filter(a => a.id === selectedAccount)

  const activeEndDates = filteredAccounts
    .flatMap(a => a.profiles.filter(p => p.is_rentable).map(p => (p as Profile & { currentOrder?: Order }).currentOrder?.end_date))
    .filter(Boolean) as string[]
  const countdown = useCountdown(activeEndDates)

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Memuat...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Ringkasan keseluruhan</p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <Button
          variant={selectedAccount === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedAccount('all')}
        >
          Semua Akun
        </Button>
        {accounts.map(acc => (
          <Button
            key={acc.id}
            variant={selectedAccount === acc.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedAccount(acc.id)}
            className="truncate max-w-48"
          >
            {acc.name.split('@')[0]}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Total Income" value={formatRupiah(totalIncome)} />
        <StatCard icon={TrendingUp} label="Laba Bersih" value={formatRupiah(laba)} accent={laba >= 0} />
        <StatCard icon={ShoppingCart} label="Order Aktif" value={String(activeOrders)} />
        <StatCard icon={Tv} label="Biaya Langganan" value={formatRupiah(totalCost)} />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Status Profil</h2>
        {filteredAccounts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              Belum ada akun. Tambah akun di halaman Akun.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredAccounts.map(acc => (
              <Card key={acc.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium truncate">{acc.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {acc.profiles.filter(p => p.is_rentable).map(p => {
                    const order = (p as Profile & { currentOrder?: Order }).currentOrder
                    const booked = !!order
                    return (
                      <div key={p.id} className={`rounded-xl px-4 py-3 transition-colors ${booked ? 'bg-primary/8' : 'bg-emerald-500/8 dark:bg-emerald-500/10'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`size-2.5 rounded-full ${booked ? 'bg-primary' : 'bg-emerald-400'}`} />
                            <span className="text-base font-medium">{p.name}</span>
                          </div>
                          {booked && order ? (
                            <span className="text-sm text-muted-foreground">{order.customer_name}</span>
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Tersedia</Badge>
                          )}
                        </div>
                        {booked && order && (
                          <div className="flex items-center gap-1.5 mt-1.5 ml-5">
                            <Clock className="size-3.5 text-primary/60" />
                            <span className="text-sm text-primary/70 font-medium tabular-nums">{countdown(order.end_date)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {acc.profiles.filter(p => !p.is_rentable).map(p => (
                    <div key={p.id} className="flex items-center gap-2.5 rounded-xl bg-muted/30 px-4 py-3 opacity-50">
                      <div className="size-2.5 rounded-full bg-muted-foreground" />
                      <span className="text-sm">{p.name}</span>
                      <Badge variant="secondary" className="text-xs">Utama</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4 py-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold tabular-nums truncate ${accent === false ? 'text-red-400' : accent === true ? 'text-emerald-500 dark:text-emerald-400' : ''}`}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
