import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import {
  Tv,
  Clock3,
  CheckCircle2,
  ArrowRight,
  Search,
  RefreshCw,
  Zap,
  Lock,
} from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { supabase, autoCompleteOrders } from '@/lib/supabase'
import { PACKAGES, formatRupiah, calculateDynamicExpiry } from '@/lib/constants'
import type { PackageType } from '@/types/database'
import { syncAndVerifyGuestOrders, type GuestRentalOrder } from '@/lib/guestOrder'
import { useCheckoutLocks } from '@/lib/checkoutLock'

interface ProfileItem {
  id: string
  name: string
  status: 'available' | 'booked'
  accountName?: string
  currentOrder?: {
    customer_name: string
    end_date: string
    logout_time: string
  }
}

function formatTime(t?: string | null) {
  return (t ?? '23:59').slice(0, 5)
}

function deadlineMs(endDate: string, logoutTime?: string | null) {
  const time = logoutTime ? (logoutTime.length === 5 ? `${logoutTime}:00` : logoutTime) : '23:59:59'
  return new Date(`${endDate}T${time}`).getTime()
}

function formatCountdown(endDate: string, logoutTime?: string | null, now = Date.now()) {
  const diff = deadlineMs(endDate, logoutTime) - now
  if (diff <= 0) return 'Selesai'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (d > 0) return `${d}h ${h}j ${m}m ${s}d`
  if (h > 0) return `${h}j ${m}m ${s}d`
  return `${m}m ${s}d`
}

function formatDateIndo(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatLockRemaining(expiresAt: number, now = Date.now()) {
  const diff = Math.max(0, expiresAt - now)
  const m = Math.floor(diff / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${m}:${s < 10 ? `0${s}` : s}`
}

export default function OrdersAnalyzer() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState<ProfileItem[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'booked'>('available')
  const [now, setNow] = useState(Date.now())

  // Selected package duration (defaults to 1 Hari)
  const [selectedPackage, setSelectedPackage] = useState<PackageType>('1_hari')

  // Countdown timer ticker
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Check active rental order in localStorage verified against Supabase database
  const [activeGuestOrder, setActiveGuestOrder] = useState<GuestRentalOrder | null>(null)

  const verifyGuestOrderData = useCallback(async () => {
    const { activeOrder } = await syncAndVerifyGuestOrders()
    setActiveGuestOrder(activeOrder)
  }, [])

  useEffect(() => {
    verifyGuestOrderData()
    const timer = setInterval(verifyGuestOrderData, 15000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        verifyGuestOrderData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [verifyGuestOrderData])

  // If live countdown ticks past expiry, trigger immediate re-verification
  useEffect(() => {
    if (activeGuestOrder && activeGuestOrder.expiryTimestamp <= now) {
      verifyGuestOrderData()
    }
  }, [now, activeGuestOrder, verifyGuestOrderData])

  // Fetch profiles and active orders from Supabase (Strictly filtered to active accounts)
  const fetchProfilesData = useCallback(async () => {
    setLoadingProfiles(true)
    try {
      await autoCompleteOrders()
      // Synchronize guest orders in background with every profile refresh
      verifyGuestOrderData()

      const [profilesRes, ordersRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, is_rentable, accounts!inner(id, name, is_active)')
          .eq('is_rentable', true)
          .eq('accounts.is_active', true)
          .order('name'),
        supabase
          .from('orders')
          .select('profile_id, customer_name, end_date, logout_time, status')
          .eq('status', 'booked'),
      ])

      const rawProfiles = profilesRes.data ?? []
      const activeOrders = ordersRes.data ?? []

      const bookedMap = new Map<string, { customer_name: string; end_date: string; logout_time: string }>()
      const currentMs = Date.now()

      for (const ord of activeOrders) {
        if (deadlineMs(ord.end_date, ord.logout_time) <= currentMs) continue
        const existing = bookedMap.get(ord.profile_id)
        if (!existing || deadlineMs(ord.end_date, ord.logout_time) < deadlineMs(existing.end_date, existing.logout_time)) {
          bookedMap.set(ord.profile_id, ord)
        }
      }

      const mapped: ProfileItem[] = rawProfiles.map((p) => {
        const booked = bookedMap.get(p.id)
        return {
          id: p.id,
          name: p.name,
          status: booked ? 'booked' : 'available',
          accountName: (p.accounts as { name?: string })?.name,
          currentOrder: booked,
        }
      })

      setProfiles(mapped)
    } catch (err) {
      console.error(err)
      toast.error('Gagal memuat profil Netflix')
    } finally {
      setLoadingProfiles(false)
    }
  }, [])

  useEffect(() => {
    fetchProfilesData()
  }, [fetchProfilesData])

  // Real-time checkout presence locks
  const { isLockedByOther, isLockedByMe, getLock } = useCheckoutLocks(null, fetchProfilesData)

  // Filter and search profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'available'
          ? p.status === 'available'
          : p.status === 'booked'
      return matchSearch && matchStatus
    })
  }, [profiles, search, statusFilter])

  const availableCount = useMemo(
    () => profiles.filter((p) => p.status === 'available' && !isLockedByOther(p.id)).length,
    [profiles, isLockedByOther]
  )
  const lockedCount = useMemo(
    () => profiles.filter((p) => p.status === 'available' && isLockedByOther(p.id)).length,
    [profiles, isLockedByOther]
  )
  const bookedCount = useMemo(
    () => profiles.filter((p) => p.status === 'booked').length,
    [profiles]
  )

  // Dynamic expiry based on now
  const dynamicExpiry = useMemo(() => {
    return calculateDynamicExpiry(selectedPackage, new Date(now))
  }, [selectedPackage, now])
  const packagePrice = useMemo(() => PACKAGES[selectedPackage].price, [selectedPackage])

  // Navigate to dedicated Checkout page directly
  const handleGoToCheckout = (profileToRent: ProfileItem) => {
    if (!profileToRent) {
      toast.error('Pilih profil Netflix terlebih dahulu')
      return
    }
    if (isLockedByOther(profileToRent.id)) {
      toast.warning(`Profil ${profileToRent.name} sedang dalam proses checkout oleh pengguna lain. Silakan pilih profil lain.`)
      return
    }
    navigate(`/checkout?profileId=${profileToRent.id}&pkg=${selectedPackage}`)
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors selection:bg-primary/20 pb-24">
      <Toaster position="top-center" richColors closeButton />

      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl bg-linear-to-br from-red-600 via-rose-600 to-pink-600 text-white font-black shadow-md shadow-red-500/20 shrink-0">
              <Tv className="size-4 sm:size-4.5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight">Netriztama Order</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground hidden sm:block">
                Sewa Profil Netflix Premium Private 4K Ultra HD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchProfilesData}
              disabled={loadingProfiles}
              className="rounded-xl text-xs gap-1.5 h-8 sm:h-8.5 px-2.5 sm:px-3 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${loadingProfiles ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Banner / Summary */}
      <div className="border-b border-border/40 bg-muted/20">
        <div className="mx-auto max-w-7xl px-3.5 py-5 sm:px-6 sm:py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
            <div className="space-y-1.5 max-w-xl">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] sm:text-xs font-semibold px-2 py-0.5">
                ✦ Profil Private & Anti On-Hold
              </Badge>
              <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">
                Pilih Profil & Durasi Netflix
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Pilih profil yang tersedia di bawah, tentukan paket durasi yang diinginkan, dan lanjutkan langsung ke checkout.
              </p>
            </div>

            {/* Quick Status Stats (Mobile: 2 cols responsive grid, Desktop: flex row) */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 w-full sm:w-auto pt-1 sm:pt-0">
              {/* Available */}
              <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 sm:px-4 sm:py-3 shadow-xs">
                <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl bg-emerald-500 text-white font-bold shrink-0">
                  <CheckCircle2 className="size-4 sm:size-5" />
                </div>
                <div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                    {availableCount} Profil
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-medium text-emerald-700/80 dark:text-emerald-300/80">
                    Siap Disewa
                  </div>
                </div>
              </div>

              {/* Booked */}
              <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-2.5 sm:px-4 sm:py-3 shadow-xs">
                <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl bg-rose-500 text-white font-bold shrink-0">
                  <Clock3 className="size-4 sm:size-5" />
                </div>
                <div>
                  <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 leading-tight">
                    {bookedCount} Profil
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-medium text-rose-700/80 dark:text-rose-300/80">
                    Sedang Tersewa
                  </div>
                </div>
              </div>

              {/* In-Checkout Lock if any */}
              {lockedCount > 0 && (
                <div className="col-span-2 sm:col-span-1 flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/15 p-2.5 sm:px-4 sm:py-3 shadow-xs animate-in fade-in-50">
                  <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl bg-amber-500 text-white font-bold shrink-0">
                    <Lock className="size-4 sm:size-5" />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 leading-tight">
                      {lockedCount} Profil
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-medium text-amber-700/80 dark:text-amber-300/80">
                      Sedang Dipesan
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-3.5 py-6 sm:px-6 sm:py-8">
        {/* Active Guest Rental Banner (Persisted in localStorage) */}
        {activeGuestOrder && (
          <div className="mb-6 sm:mb-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 shadow-sm animate-in slide-in-from-top-2">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex size-9 sm:size-11 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-lg sm:text-xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
                🎟️
              </div>
              <div className="text-left space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    Sewa Aktif Anda:
                  </span>
                  <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] sm:text-[11px] font-bold py-0.5 px-2">
                    Profil {activeGuestOrder.profileName}
                  </Badge>
                  {activeGuestOrder.isSwitched && (
                    <Badge variant="outline" className="text-[9px] sm:text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold py-0.5">
                      Dipindahkan Admin
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate sm:text-wrap">
                  Masa aktif: <span className="font-mono text-foreground font-semibold">{activeGuestOrder.fullDisplay}</span> ({formatCountdown(activeGuestOrder.endDate, activeGuestOrder.logoutTime, now)})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0 pt-1 sm:pt-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/checkout?extendOrderId=${activeGuestOrder.orderId}`)}
                className="h-9 rounded-xl text-xs font-bold gap-1.5 px-3 border-emerald-600/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 cursor-pointer shadow-xs bg-card/80 justify-center"
              >
                <Zap className="size-3.5 text-amber-500 fill-amber-500" />
                <span className="truncate">Perpanjang</span>
              </Button>
              <Button
                size="sm"
                onClick={() => navigate(`/checkout?orderId=${activeGuestOrder.orderId}`)}
                className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-1.5 px-3.5 shadow-md cursor-pointer justify-center"
              >
                <span className="truncate">Buka Akun</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Controls Bar: Search & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 no-scrollbar">
            <button
              onClick={() => setStatusFilter('available')}
              className={`rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-semibold transition border shrink-0 cursor-pointer ${
                statusFilter === 'available'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-muted/40 text-muted-foreground border-border/70 hover:bg-muted'
              }`}
            >
              Tersedia ({availableCount})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-semibold transition border shrink-0 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-muted/40 text-muted-foreground border-border/70 hover:bg-muted'
              }`}
            >
              Semua Profil ({profiles.length})
            </button>
            <button
              onClick={() => setStatusFilter('booked')}
              className={`rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-semibold transition border shrink-0 cursor-pointer ${
                statusFilter === 'booked'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-muted/40 text-muted-foreground border-border/70 hover:bg-muted'
              }`}
            >
              Sedang Tersewa ({bookedCount})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama profil..."
              className="pl-9 h-9 sm:h-10 text-xs rounded-xl"
            />
          </div>
        </div>

        {/* Global Package Duration Selector */}
        <div className="mb-6 sm:mb-8 rounded-2xl sm:rounded-3xl border border-border/70 bg-card p-3.5 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Pilih Durasi Sewa
                </span>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  Semua Profil
                </Badge>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Pilih durasi paket di bawah, lalu klik profil yang tersedia untuk langsung menuju ke checkout.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/50 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs text-muted-foreground self-stretch sm:self-auto font-medium flex items-center justify-between sm:justify-start gap-1.5">
              <span>Estimasi Aktif:</span>
              <span className="font-mono font-semibold text-foreground">{dynamicExpiry.fullDisplayWithSeconds}</span>
              <span className="font-bold text-primary">(+{PACKAGES[selectedPackage].days * 24} Jam)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5 pt-1 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
            {(Object.keys(PACKAGES) as PackageType[]).map((pkgKey) => {
              const item = PACKAGES[pkgKey]
              const active = selectedPackage === pkgKey
              return (
                <button
                  key={pkgKey}
                  type="button"
                  onClick={() => setSelectedPackage(pkgKey)}
                  className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 text-left border transition-all text-xs flex flex-row sm:flex-col items-center sm:items-start justify-between cursor-pointer active:scale-98 ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground font-bold shadow-md'
                      : 'border-border/60 hover:bg-muted/80 bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="text-xs font-semibold">{item.label}</span>
                  <span
                    className={`font-mono text-xs sm:text-sm font-bold sm:mt-1.5 ${
                      active ? 'text-primary-foreground' : 'text-primary'
                    }`}
                  >
                    {formatRupiah(item.price)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Profiles Grid */}
        {loadingProfiles ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
            <div className="size-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
            <p className="text-xs font-medium text-muted-foreground">Memuat ketersediaan profil Netflix...</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center space-y-2">
            <Tv className="size-10 text-muted-foreground mx-auto stroke-1" />
            <p className="text-sm font-semibold">Tidak ada profil yang cocok</p>
            <p className="text-xs text-muted-foreground">Coba ubah kata kunci pencarian atau ganti filter status.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredProfiles.map((p) => {
              const isBooked = p.status === 'booked'
              const isLockedOther = !isBooked && isLockedByOther(p.id)
              const isLockedMine = !isBooked && isLockedByMe(p.id)
              const isAvailable = !isBooked && !isLockedOther
              const otherLock = isLockedOther ? getLock(p.id) : undefined

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (isAvailable || isLockedMine) {
                      handleGoToCheckout(p)
                    } else if (isLockedOther) {
                      toast.warning(`Profil ${p.name} sedang dalam proses checkout oleh pengguna lain. Silakan pilih profil lain.`)
                    }
                  }}
                  className={`group relative flex flex-col justify-between rounded-2xl sm:rounded-3xl border p-4 sm:p-5 transition-all duration-200 ${
                    isAvailable
                      ? 'border-border/70 bg-card hover:border-primary hover:shadow-xl hover:-translate-y-0.5 cursor-pointer active:scale-[0.99]'
                      : isLockedMine
                      ? 'border-blue-500/60 bg-blue-500/5 hover:border-blue-500 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer ring-1 ring-blue-500/30'
                      : isLockedOther
                      ? 'border-amber-500/40 bg-amber-500/5 cursor-not-allowed opacity-90'
                      : 'border-border/40 bg-muted/30 opacity-75 cursor-not-allowed'
                  }`}
                >
                  <div>
                    {/* Top Row: Avatar & Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`flex size-11 sm:size-12 items-center justify-center rounded-xl sm:rounded-2xl font-black text-sm sm:text-base shadow-sm shrink-0 ${
                          isAvailable
                            ? 'bg-linear-to-br from-red-500 to-rose-600 text-white group-hover:scale-105 transition-transform'
                            : isLockedMine
                            ? 'bg-blue-600 text-white shadow-blue-500/20'
                            : isLockedOther
                            ? 'bg-amber-500 text-white shadow-amber-500/20'
                            : 'bg-stone-300 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        {isLockedOther ? <Lock className="size-4.5 sm:size-5" /> : p.name.slice(0, 2).toUpperCase()}
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[10px] sm:text-[11px] font-semibold ${
                          isAvailable
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : isLockedMine
                            ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : isLockedOther
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 gap-1'
                            : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isAvailable ? (
                          'Tersedia'
                        ) : isLockedMine ? (
                          'Sesi Anda'
                        ) : isLockedOther ? (
                          <>
                            <Lock className="size-3" />
                            <span>Sedang Dipesan</span>
                          </>
                        ) : (
                          'Tersewa'
                        )}
                      </Badge>
                    </div>

                    {/* Profile Title */}
                    <div className="mt-3 sm:mt-3.5">
                      <h4 className="text-sm sm:text-base font-bold tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground">Profil Private 4K Ultra HD</p>
                    </div>

                    {/* Middle Info Block */}
                    <div className="mt-3 sm:mt-3.5">
                      {isAvailable ? (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2 sm:p-2.5 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                          <CheckCircle2 className="size-3.5 sm:size-4 shrink-0 text-emerald-500" />
                          <span className="truncate">Siap disewa & langsung aktif</span>
                        </div>
                      ) : isLockedMine ? (
                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-2 sm:p-2.5 text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-2">
                          <Clock3 className="size-3.5 sm:size-4 shrink-0 text-blue-500 animate-spin" />
                          <span className="truncate">Sedang dalam sesi checkout Anda</span>
                        </div>
                      ) : isLockedOther ? (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 sm:p-2.5 text-xs space-y-1">
                          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 text-[10px] sm:text-[11px]">
                            <span className="flex items-center gap-1 font-semibold truncate">
                              <Lock className="size-3 text-amber-500 shrink-0" />
                              Sedang Di-checkout
                            </span>
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                              {otherLock ? formatLockRemaining(otherLock.expiresAt, now) : '10:00'}
                            </span>
                          </div>
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                            Terkunci sementara oleh pembeli lain
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border/60 bg-muted/60 p-2 sm:p-2.5 text-xs space-y-0.5 sm:space-y-1">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-[11px]">
                            <span className="flex items-center gap-1 font-medium">
                              <Clock3 className="size-3 text-rose-500 shrink-0" />
                              Sisa Durasi
                            </span>
                            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                              {p.currentOrder ? formatCountdown(p.currentOrder.end_date, p.currentOrder.logout_time, now) : '-'}
                            </span>
                          </div>
                          {p.currentOrder && (
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
                              Hingga {formatDateIndo(p.currentOrder.end_date)}, {formatTime(p.currentOrder.logout_time)} WIB
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Area */}
                  <div className="mt-4 sm:mt-5 pt-2.5 sm:pt-3 border-t border-border/50 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
                        {PACKAGES[selectedPackage].label}
                      </span>
                      <span className="font-mono text-xs sm:text-sm font-bold text-primary">
                        {formatRupiah(packagePrice)}
                      </span>
                    </div>

                    {isAvailable ? (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGoToCheckout(p)
                        }}
                        className="text-xs h-8 sm:h-8.5 rounded-xl px-3 sm:px-3.5 font-bold gap-1 sm:gap-1.5 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground group-hover:scale-105 transition-transform cursor-pointer"
                      >
                        <span>Checkout</span>
                        <ArrowRight className="size-3 sm:size-3.5" />
                      </Button>
                    ) : isLockedMine ? (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGoToCheckout(p)
                        }}
                        className="text-xs h-8 sm:h-8.5 rounded-xl px-3 font-bold gap-1 sm:gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-sm cursor-pointer"
                      >
                        <span>Lanjut</span>
                        <ArrowRight className="size-3 sm:size-3.5" />
                      </Button>
                    ) : isLockedOther ? (
                      <Button
                        size="sm"
                        disabled
                        className="text-xs h-8 sm:h-8.5 rounded-xl px-2.5 sm:px-3 font-semibold gap-1 sm:gap-1.5 bg-muted text-muted-foreground border border-border/60 cursor-not-allowed opacity-70"
                      >
                        <Lock className="size-3" />
                        <span>Dipesan</span>
                      </Button>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Sedang Tersewa</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
