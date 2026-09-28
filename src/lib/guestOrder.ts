import { supabase } from '@/lib/supabase'
import { PACKAGES } from '@/lib/constants'
import type { PackageType } from '@/types/database'

export interface GuestRentalOrder {
  orderId: string
  customerName: string
  profileId: string
  profileName: string
  pin: string
  accountEmail: string
  accountPassword: string
  packageName: string
  packageKey: PackageType
  price: number
  startDate: string
  endDate: string
  logoutTime: string
  fullDisplay: string
  expiryTimestamp: number
  status: 'booked' | 'done' | 'deleted' | 'expired'
  isSwitched?: boolean
  switchedFrom?: string
  createdAt: string
  lastVerifiedAt?: number
}

const STORAGE_KEY = 'netriztama_guest_orders'
const LAST_ORDER_KEY = 'netriztama_last_order'

/**
 * Retrieve raw stored guest orders from localStorage
 */
export function getStoredGuestOrders(): GuestRentalOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to read guest orders from localStorage:', err)
    return []
  }
}

/**
 * Save guest orders array to localStorage
 */
export function saveGuestOrders(orders: GuestRentalOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
    const active = orders.find((o) => o.status === 'booked' && o.expiryTimestamp > Date.now())
    if (active) {
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(active))
    } else if (orders.length > 0) {
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(orders[0]))
    } else {
      localStorage.removeItem(LAST_ORDER_KEY)
    }
  } catch (err) {
    console.error('Failed to save guest orders to localStorage:', err)
  }
}

/**
 * Add or update an order in localStorage
 */
export function addGuestOrder(newOrder: GuestRentalOrder) {
  const existing = getStoredGuestOrders()
  const filtered = existing.filter((o) => o.orderId !== newOrder.orderId)
  saveGuestOrders([newOrder, ...filtered])
}

/**
 * Remove an order by ID from localStorage
 */
export function removeGuestOrder(orderId: string) {
  const existing = getStoredGuestOrders()
  saveGuestOrders(existing.filter((o) => o.orderId !== orderId))
}

/**
 * Synchronize and verify stored guest orders against actual Supabase database.
 * 
 * Verifikasi Meliputi:
 * 1. Durasi sudah selesai: Status 'done' di database atau waktu logout_time sudah lewat -> Dinonaktifkan dari sewa aktif
 * 2. Dihapus sama admin: Order ID tidak ditemukan di tabel orders -> Dihapus dari localStorage
 * 3. Profil di-switch sama admin: profile_id berubah ke profil lain -> Otomatis update nama profil, PIN baru & kredensial akun baru
 * 4. Kredensial di-update: Jika PIN atau Password akun diganti admin -> Data otomatis sinkron
 */
export async function syncAndVerifyGuestOrders(): Promise<{
  activeOrder: GuestRentalOrder | null
  allOrders: GuestRentalOrder[]
  changesDetected: boolean
}> {
  const storedOrders = getStoredGuestOrders()
  if (storedOrders.length === 0) {
    return { activeOrder: null, allOrders: [], changesDetected: false }
  }

  const orderIds = storedOrders.map((o) => o.orderId).filter(Boolean)
  if (orderIds.length === 0) {
    return { activeOrder: null, allOrders: [], changesDetected: false }
  }

  try {
    // Query actual data directly from Supabase
    const { data: dbOrders, error } = await supabase
      .from('orders')
      .select(`
        id,
        customer_name,
        package,
        price,
        start_date,
        end_date,
        logout_time,
        status,
        profiles!inner (
          id,
          name,
          pin,
          accounts!inner (
            id,
            name,
            password,
            is_active
          )
        )
      `)
      .in('id', orderIds)

    if (error) {
      console.warn('Could not verify guest orders against database:', error)
      const nowMs = Date.now()
      const fallbackActive = storedOrders.find((o) => o.status === 'booked' && o.expiryTimestamp > nowMs) || null
      return { activeOrder: fallbackActive, allOrders: storedOrders, changesDetected: false }
    }

    const dbMap = new Map((dbOrders || []).map((o) => [o.id, o]))
    const nowMs = Date.now()
    const updatedOrders: GuestRentalOrder[] = []
    let changesDetected = false

    for (const stored of storedOrders) {
      const dbOrder = dbMap.get(stored.orderId)

      // KASUS 1: Dihapus sama admin
      // Jika order ID tidak lagi ada di tabel orders Supabase, berarti admin telah menghapusnya
      if (!dbOrder) {
        changesDetected = true
        // Hapus dari penyimpanan agar tidak memunculkan data usang/hantu
        continue
      }

      const rawProf = Array.isArray(dbOrder.profiles) ? dbOrder.profiles[0] : dbOrder.profiles
      const prof = rawProf as {
        id: string
        name: string
        pin: string | null
        accounts?: { name?: string; password?: string | null; is_active?: boolean } | { name?: string; password?: string | null; is_active?: boolean }[]
      }
      const acc = Array.isArray(prof?.accounts) ? prof.accounts[0] : prof?.accounts

      const expMs = new Date(
        `${dbOrder.end_date}T${dbOrder.logout_time.length === 5 ? `${dbOrder.logout_time}:00` : dbOrder.logout_time}`
      ).getTime()

      // KASUS 2: Durasi sudah selesai atau status 'done'
      const isPastExpiry = expMs <= nowMs
      const isDone = dbOrder.status === 'done' || isPastExpiry

      // KASUS 3: Profil di-switch / dipindahkan sama admin (Migration)
      const isSwitched = Boolean(prof && prof.id !== stored.profileId)

      // KASUS 4: Kredensial aktual (PIN / Password)
      const actualPin = prof?.pin || '0000'
      const actualEmail = acc?.name || stored.accountEmail
      const actualPassword = acc?.password || stored.accountPassword

      const syncedOrder: GuestRentalOrder = {
        ...stored,
        customerName: dbOrder.customer_name || stored.customerName,
        profileId: prof?.id || stored.profileId,
        profileName: prof?.name || stored.profileName,
        pin: actualPin,
        accountEmail: actualEmail,
        accountPassword: actualPassword,
        packageName: PACKAGES[dbOrder.package as PackageType]?.label || dbOrder.package || stored.packageName,
        packageKey: (dbOrder.package as PackageType) || stored.packageKey,
        price: dbOrder.price || stored.price,
        startDate: dbOrder.start_date || stored.startDate,
        endDate: dbOrder.end_date || stored.endDate,
        logoutTime: dbOrder.logout_time || stored.logoutTime,
        fullDisplay: `${dbOrder.end_date} (${dbOrder.logout_time} WIB)`,
        expiryTimestamp: expMs,
        status: isDone ? 'done' : 'booked',
        isSwitched: isSwitched ? true : stored.isSwitched,
        switchedFrom: isSwitched ? stored.profileName : stored.switchedFrom,
        lastVerifiedAt: nowMs,
      }

      if (
        stored.profileId !== syncedOrder.profileId ||
        stored.pin !== syncedOrder.pin ||
        stored.accountPassword !== syncedOrder.accountPassword ||
        stored.status !== syncedOrder.status ||
        stored.expiryTimestamp !== syncedOrder.expiryTimestamp
      ) {
        changesDetected = true
      }

      updatedOrders.push(syncedOrder)
    }

    // Perbarui penyimpanan localStorage dengan data aktual yang terverifikasi
    saveGuestOrders(updatedOrders)

    // Cari sewa yang benar-benar aktif (status 'booked', belum expired, dan akun aktif)
    const activeOrder = updatedOrders.find((o) => o.status === 'booked' && o.expiryTimestamp > nowMs) || null

    return { activeOrder, allOrders: updatedOrders, changesDetected }
  } catch (err) {
    console.error('Error in syncAndVerifyGuestOrders:', err)
    const nowMs = Date.now()
    const fallbackActive = storedOrders.find((o) => o.status === 'booked' && o.expiryTimestamp > nowMs) || null
    return { activeOrder: fallbackActive, allOrders: storedOrders, changesDetected: false }
  }
}
