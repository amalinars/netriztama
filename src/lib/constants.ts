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

export const FINANCIAL_CUTOFF_DAY = 27

export function getMonthlyCycleRange(now = new Date(), cutoffDay = FINANCIAL_CUTOFF_DAY) {
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentDate = now.getDate()

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

  return {
    start,
    end,
    label: `${startFormatted} - Sekarang`,
    cycleFullLabel: `${startFormatted} - ${endFormatted}`,
  }
}

