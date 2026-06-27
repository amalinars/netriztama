import { useEffect, useState } from 'react'
import { supabase, autoCompleteOrders } from '@/lib/supabase'
import { formatRupiah } from '@/lib/constants'
import type { Account, Profile, Order } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import AddOrderDialog from '@/components/AddOrderDialog'
import ProfilePinStatus from '@/components/ProfilePinStatus'
import { DollarSign, TrendingUp, ShoppingCart, Tv, Clock, Plus } from 'lucide-react'

type AccountWithProfiles = Account & { profiles: (Profile & { currentOrder?: Order })[] }
type OrderWithAccount = Order & { profiles: { account_id: string } }
type Period = 'this_month' | 'last_month' | 'all'

function deadlineMs(endDate: string, logoutTime?: string | null) {
  return new Date(`${endDate}T${formatTime(logoutTime)}:00`).getTime()
}

function useCountdown() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return (endDate: string, logoutTime?: string | null) => {
    const diff = deadlineMs(endDate, logoutTime) - now
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

function formatTime(t?: string | null) {
  return (t ?? '23:59').slice(0, 5)
}

function monthRange(period: Period): [Date, Date] | null {
  if (period === 'all') return null
  const now = new Date()
  const offset = period === 'last_month' ? -1 : 0
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1)
  return [start, end]
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<AccountWithProfiles[]>([])
  const [orders, setOrders] = useState<OrderWithAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [period, setPeriod] = useState<Period>('this_month')
  const [prefill, setPrefill] = useState<{ accountId: string; profileId: string } | null>(null)

  function load() {
    return Promise.all([
      supabase.from('accounts').select('*, profiles(*)').order('created_at'),
      supabase.from('orders').select('*, profiles(account_id)').order('created_at', { ascending: false }),
    ]).then(([accRes, ordRes]) => {
      const accs = accRes.data ?? []
      const ords = ordRes.data ?? []
      const now = Date.now()

      const bookedMap = new Map<string, OrderWithAccount>()
      for (const o of ords) {
        if (o.status === 'booked' && deadlineMs(o.end_date, o.logout_time) > now && !bookedMap.has(o.profile_id)) {
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
  }

  useEffect(() => { autoCompleteOrders().then(load) }, [])

  const profileIdsByAccount = new Set(
    selectedAccount === 'all'
      ? accounts.flatMap(a => a.profiles.map(p => p.id))
      : accounts.find(a => a.id === selectedAccount)?.profiles.map(p => p.id) ?? []
  )

  const range = monthRange(period)
  const scopedOrders = orders.filter(o => {
    if (selectedAccount !== 'all' && !profileIdsByAccount.has(o.profile_id)) return false
    if (range) {
      const t = new Date(o.created_at).getTime()
      if (t < range[0].getTime() || t >= range[1].getTime()) return false
    }
    return true
  })

  const totalIncome = scopedOrders.reduce((s, o) => s + o.price, 0)
  // ponytail: cost diasumsikan flat tiap bulan, gak track historical. Tambah field history kalau langganan harga berubah.
  const monthlyCost = selectedAccount === 'all'
    ? accounts.reduce((s, a) => s + a.subscription_cost, 0)
    : accounts.find(a => a.id === selectedAccount)?.subscription_cost ?? 0
  const totalCost = monthlyCost
  const laba = totalIncome - totalCost
  const activeOrders = scopedOrders.filter(o => o.status === 'booked').length

  const filteredAccounts = selectedAccount === 'all'
    ? accounts
    : accounts.filter(a => a.id === selectedAccount)

  const countdown = useCountdown()

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Memuat...</div>

  const periodLabel = period === 'this_month' ? 'Bulan ini' : period === 'last_month' ? 'Bulan lalu' : 'Semua waktu'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Ringkasan {periodLabel.toLowerCase()}</p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(['this_month', 'last_month', 'all'] as const).map(p => (
          <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" onClick={() => setPeriod(p)}>
            {p === 'this_month' ? 'Bulan ini' : p === 'last_month' ? 'Bulan lalu' : 'Semua'}
          </Button>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <Button variant={selectedAccount === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedAccount('all')}>
          Semua Akun
        </Button>
        {accounts.map(acc => (
          <Button key={acc.id} variant={selectedAccount === acc.id ? 'default' : 'outline'} size="sm" onClick={() => setSelectedAccount(acc.id)} className="truncate max-w-48">
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
                    if (booked && order) {
                      return (
                        <div key={p.id} className="rounded-xl px-4 py-3 bg-primary/8">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="size-2.5 rounded-full bg-primary shrink-0" />
                              <span className="text-base font-medium truncate">{p.name}</span>
                              <ProfilePinStatus profile={p} onChanged={load} compact />
                            </div>
                            <span className="text-sm text-muted-foreground truncate">{order.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 ml-5 text-sm text-primary/70 font-medium tabular-nums">
                            <Clock className="size-3.5 text-primary/60" />
                            <span>{countdown(order.end_date, order.logout_time)}</span>
                            <span className="text-muted-foreground">· Logout {formatTime(order.logout_time)} WIB</span>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div key={p.id} className="rounded-xl px-4 py-3 bg-emerald-500/8 dark:bg-emerald-500/10">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                            <div className="size-2.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="text-base font-medium truncate">{p.name}</span>
                            <ProfilePinStatus profile={p} onChanged={load} compact />
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setPrefill({ accountId: acc.id, profileId: p.id })}>
                            <Plus className="size-4" /> Sewakan
                          </Button>
                        </div>
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

      <AddOrderDialog
        open={!!prefill}
        onOpenChange={(v: boolean) => { if (!v) setPrefill(null) }}
        initial={prefill ?? undefined}
        onSaved={load}
      />
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
