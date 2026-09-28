import type { PackageType } from '@/types/database'

export const PACKAGES: Record<PackageType, { label: string; price: number; days: number }> = {
  '1_hari': { label: '1 Hari', price: 5000, days: 1 },
  '2_hari': { label: '2 Hari', price: 7000, days: 2 },
  '3_hari': { label: '3 Hari', price: 10000, days: 3 },
  '1_minggu': { label: '1 Minggu', price: 20000, days: 7 },
  '1_bulan': { label: '1 Bulan', price: 50000, days: 30 },
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

export function calculateEndDate(startDate: string, pkg: PackageType): string {
  const date = new Date(startDate)
  date.setDate(date.getDate() + PACKAGES[pkg].days)
  return date.toISOString().split('T')[0]
}

export function calculateDynamicExpiry(pkg: PackageType, fromDate = new Date()) {
  const days = PACKAGES[pkg]?.days ?? 1
  const expiryDate = new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000)

  const year = expiryDate.getFullYear()
  const month = String(expiryDate.getMonth() + 1).padStart(2, '0')
  const day = String(expiryDate.getDate()).padStart(2, '0')
  const endDate = `${year}-${month}-${day}`

  const hours = String(expiryDate.getHours()).padStart(2, '0')
  const minutes = String(expiryDate.getMinutes()).padStart(2, '0')
  const seconds = String(expiryDate.getSeconds()).padStart(2, '0')
  const logoutTime = `${hours}:${minutes}:${seconds}`
  const displayTime = `${hours}:${minutes}`
  const displayTimeWithSeconds = `${hours}:${minutes}:${seconds}`

  const formattedDate = expiryDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return {
    endDate,
    logoutTime,
    displayTime,
    displayTimeWithSeconds,
    formattedDate,
    fullDisplay: `${formattedDate} (${displayTime} WIB)`,
    fullDisplayWithSeconds: `${formattedDate} (${displayTimeWithSeconds} WIB)`,
    expiryDate,
  }
}

export function calculateExtensionExpiry(currentExpiry: Date | string | number, pkg: PackageType) {
  const expiryMs = typeof currentExpiry === 'number'
    ? currentExpiry
    : new Date(currentExpiry).getTime()
  const nowMs = Date.now()
  const baseTime = !isNaN(expiryMs) && expiryMs > nowMs ? new Date(expiryMs) : new Date(nowMs)
  return calculateDynamicExpiry(pkg, baseTime)
}

export const FINANCIAL_CUTOFF_DAY = 27

export function getMonthlyCycleRange(target: Date | string = new Date(), cutoffDay = FINANCIAL_CUTOFF_DAY) {
  let dateObj: Date
  if (typeof target === 'string') {
    const cleanStr = target.split('T')[0]
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      const parts = cleanStr.split('-').map(Number)
      dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
    } else {
      dateObj = new Date(target)
    }
  } else {
    dateObj = target
  }

  const currentYear = dateObj.getFullYear()
  const currentMonth = dateObj.getMonth()
  const currentDate = dateObj.getDate()

  let startYear = currentYear
  let startMonth = currentMonth
  let endYear = currentYear
  let endMonth = currentMonth

  if (currentDate >= cutoffDay) {
    startMonth = currentMonth
    endMonth = currentMonth + 1
  } else {
    startMonth = currentMonth - 1
    endMonth = currentMonth
  }

  const start = new Date(startYear, startMonth, cutoffDay, 0, 0, 0, 0)
  const end = new Date(endYear, endMonth, cutoffDay, 0, 0, 0, 0)

  const startFormatted = start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  const endFormatted = end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  const cycleKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(cutoffDay).padStart(2, '0')}`

  return {
    start,
    end,
    cycleKey,
    label: `${startFormatted} - Sekarang`,
    cycleFullLabel: `${startFormatted} - ${endFormatted}`,
  }
}

