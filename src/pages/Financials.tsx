import { useEffect, useState, useMemo } from 'react'
import {
  getFinancialSettings,
  updateInitialBalance,
  getExpenses,
  createExpense,
  deleteExpense,
  getFinancialsOrdersSummary,
  settleAllPendingOrders,
  settleSelectedOrders,
  getAllOrdersForFinancials,
} from '@/lib/supabase'
import {
  formatRupiah,
  getMonthlyCycleRange,
  getAvailableMonthlyCycles,
  FINANCIAL_CUTOFF_DAY,
} from '@/lib/constants'
import type { FinancialSettings, Expense, OrderWithProfile } from '@/types/database'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ConfirmDialog'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  DollarSign,
  Calendar as CalendarIcon,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react'

export default function Financials() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<FinancialSettings | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [allOrders, setAllOrders] = useState<{ id: string; price: number; is_settled: boolean; created_at: string }[]>([])
  const [settledOrdersTotal, setSettledOrdersTotal] = useState(0)
  const [unsettledOrdersTotal, setUnsettledOrdersTotal] = useState(0)
  const [unsettledOrders, setUnsettledOrders] = useState<OrderWithProfile[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  // Monthly Cycle Selector & Filter State
  const availableCycles = useMemo(() => getAvailableMonthlyCycles(new Date(), FINANCIAL_CUTOFF_DAY, 8), [])
  const activeCycle = useMemo(() => getMonthlyCycleRange(new Date(), FINANCIAL_CUTOFF_DAY), [])
  const [selectedCycleKey, setSelectedCycleKey] = useState<string>(() => getMonthlyCycleRange(new Date(), FINANCIAL_CUTOFF_DAY).cycleKey)
  const [expenseCycleFilter, setExpenseCycleFilter] = useState<'all' | 'selected'>('all')

  // Modals state
  const [showInitialBalanceDialog, setShowInitialBalanceDialog] = useState(false)
  const [initialBalanceInput, setInitialBalanceInput] = useState('')
  const [cutoffDate, setCutoffDate] = useState('')
  const [cutoffTime, setCutoffTime] = useState('')
  const [showExpenseDialog, setShowExpenseDialog] = useState(false)
  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('Netflix Account')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [expenseNotes, setExpenseNotes] = useState('')

  async function loadData() {
    setLoading(true)

    const [settingsRes, expensesRes, allOrdersRes] = await Promise.all([
      getFinancialSettings(),
      getExpenses(),
      getAllOrdersForFinancials(),
    ])

    const currentSettings = settingsRes.data
    const ordersSummaryRes = await getFinancialsOrdersSummary(currentSettings?.cutoff_time)

    if (settingsRes.data) setSettings(settingsRes.data)
    if (expensesRes.data) setExpenses(expensesRes.data)
    if (allOrdersRes.data) setAllOrders(allOrdersRes.data)
    
    setSettledOrdersTotal(ordersSummaryRes.settledOrdersTotal)
    setUnsettledOrdersTotal(ordersSummaryRes.unsettledOrdersTotal)
    setUnsettledOrders(ordersSummaryRes.unsettledOrders)
    setSelectedOrderIds([])
    setLastSelectedIndex(null)

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const initialBalance = settings?.initial_balance ?? 0
  const expensesTotal = expenses.reduce((acc, curr) => acc + curr.amount, 0)
  const actualRevenue = initialBalance + settledOrdersTotal - expensesTotal
  const expectedRevenue = actualRevenue + unsettledOrdersTotal

  // Find currently selected cycle and its position
  const selectedCycle = availableCycles.find((c) => c.key === selectedCycleKey) || availableCycles[0]
  const selectedCycleIndex = availableCycles.findIndex((c) => c.key === selectedCycle.key)

  function handlePrevCycle() {
    if (selectedCycleIndex < availableCycles.length - 1) {
      setSelectedCycleKey(availableCycles[selectedCycleIndex + 1].key)
    }
  }

  function handleNextCycle() {
    if (selectedCycleIndex > 0) {
      setSelectedCycleKey(availableCycles[selectedCycleIndex - 1].key)
    }
  }

  function handleResetToActiveCycle() {
    setSelectedCycleKey(activeCycle.cycleKey)
  }

  // Calculate revenue pool for every monthly cutoff cycle from all orders
  const cycleRevenueMap = new Map<string, number>()
  for (const order of allOrders) {
    const oCycle = getMonthlyCycleRange(order.created_at, FINANCIAL_CUTOFF_DAY)
    cycleRevenueMap.set(oCycle.cycleKey, (cycleRevenueMap.get(oCycle.cycleKey) || 0) + order.price)
  }

  // Metrics specifically for the SELECTED cycle (could be current or past month)
  const selectedCycleOrders = allOrders.filter((o) => {
    const d = new Date(o.created_at)
    return d >= selectedCycle.start && d < selectedCycle.end
  })
  const selectedCycleRevenue = selectedCycleOrders.reduce((acc, o) => acc + o.price, 0)
  const selectedCycleSettledRevenue = selectedCycleOrders
    .filter((o) => o.is_settled)
    .reduce((acc, o) => acc + o.price, 0)
  const selectedCycleUnsettledRevenue = selectedCycleOrders
    .filter((o) => !o.is_settled)
    .reduce((acc, o) => acc + o.price, 0)
  const selectedCycleOrdersCount = selectedCycleOrders.length

  const selectedCycleExpenses = expenses.filter((e) => {
    const expCycle = getMonthlyCycleRange(e.expense_date, FINANCIAL_CUTOFF_DAY)
    return expCycle.cycleKey === selectedCycle.key
  })
  const selectedCycleExpensesTotal = selectedCycleExpenses.reduce((acc, curr) => acc + curr.amount, 0)
  const selectedCycleNetProfit = selectedCycleRevenue - selectedCycleExpensesTotal
  const selectedCycleCoveredPct =
    selectedCycleExpensesTotal > 0
      ? Math.min(100, Math.round((selectedCycleRevenue / selectedCycleExpensesTotal) * 100))
      : 100

  // Filtered expenses for the table
  const displayedExpenses = expenseCycleFilter === 'selected' ? selectedCycleExpenses : expenses

  // FIFO Waterfall Payoff calculation for Expenses strictly within each expense's own cycle
  const waterfallExpensesMap = new Map<
    string,
    { allocated: number; remainingNeeded: number; isCovered: boolean; cycleLabel: string }
  >()
  {
    // Group all expenses by their cycleKey
    const expensesByCycle = new Map<string, Expense[]>()
    for (const expense of expenses) {
      const expCycle = getMonthlyCycleRange(expense.expense_date, FINANCIAL_CUTOFF_DAY)
      if (!expensesByCycle.has(expCycle.cycleKey)) {
        expensesByCycle.set(expCycle.cycleKey, [])
      }
      expensesByCycle.get(expCycle.cycleKey)!.push(expense)
    }

    // For each cycle, evaluate payoff using THAT cycle's revenue pool
    for (const [cycleKey, cycleExpensesList] of expensesByCycle.entries()) {
      let pool = cycleRevenueMap.get(cycleKey) || 0

      // Sort expenses in this cycle chronologically
      const sorted = [...cycleExpensesList].sort((a, b) => {
        const d1 = new Date(a.expense_date).getTime()
        const d2 = new Date(b.expense_date).getTime()
        if (d1 !== d2) return d1 - d2
        return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
      })

      for (const expense of sorted) {
        const expCycle = getMonthlyCycleRange(expense.expense_date, FINANCIAL_CUTOFF_DAY)
        const needed = expense.amount
        const allocated = Math.max(0, Math.min(pool, needed))
        pool -= allocated
        const remainingNeeded = needed - allocated
        const isCovered = remainingNeeded <= 0

        waterfallExpensesMap.set(expense.id, {
          allocated,
          remainingNeeded,
          isCovered,
          cycleLabel: expCycle.cycleFullLabel,
        })
      }
    }
  }

  const isAllSelected = unsettledOrders.length > 0 && selectedOrderIds.length === unsettledOrders.length
  
  function handleSelectAll() {
    if (isAllSelected) {
      setSelectedOrderIds([])
      setLastSelectedIndex(null)
    } else {
      setSelectedOrderIds(unsettledOrders.map((o) => o.id))
    }
  }

  function handleToggleSelect(orderId: string, index: number, event?: React.MouseEvent) {
    const isShiftPressed = event?.shiftKey ?? false

    if (isShiftPressed && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)
      const rangeIds = unsettledOrders.slice(start, end + 1).map((o) => o.id)

      setSelectedOrderIds((prev) => {
        const newSet = new Set(prev)
        rangeIds.forEach((id) => newSet.add(id))
        return Array.from(newSet)
      })
    } else {
      setSelectedOrderIds((prev) =>
        prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
      )
      setLastSelectedIndex(index)
    }
  }

  const selectedOrdersTotal = unsettledOrders
    .filter((o) => selectedOrderIds.includes(o.id))
    .reduce((acc, curr) => acc + curr.price, 0)

  async function handleSaveInitialBalance(e: React.FormEvent) {
    e.preventDefault()
    const val = parseInt(initialBalanceInput.replace(/\D/g, ''), 10) || 0
    let finalCutoffTime: string | null = null
    if (cutoffDate) {
       const timePart = cutoffTime || '00:00'
       finalCutoffTime = new Date(`${cutoffDate}T${timePart}:00`).toISOString()
    }
    const { error } = await updateInitialBalance(val, finalCutoffTime)
    if (error) {
      toast.error('Gagal memperbarui saldo awal')
    } else {
      toast.success('Saldo awal berhasil diperbarui')
      setShowInitialBalanceDialog(false)
      loadData()
    }
  }

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!expenseTitle.trim()) {
      toast.error('Judul pengeluaran tidak boleh kosong')
      return
    }
    const amt = parseInt(expenseAmount.replace(/\D/g, ''), 10) || 0
    if (amt <= 0) {
      toast.error('Nominal pengeluaran harus lebih dari 0')
      return
    }

    const { error } = await createExpense({
      title: expenseTitle.trim(),
      amount: amt,
      category: expenseCategory.trim() || 'General',
      expense_date: expenseDate,
      notes: expenseNotes.trim() || undefined,
    })

    if (error) {
      toast.error('Gagal mencatat pengeluaran')
    } else {
      toast.success('Pengeluaran berhasil dicatat')
      setShowExpenseDialog(false)
      setExpenseTitle('')
      setExpenseAmount('')
      setExpenseNotes('')
      loadData()
    }
  }

  async function handleDeleteExpense(id: string) {
    const { error } = await deleteExpense(id)
    if (error) {
      toast.error('Gagal menghapus pengeluaran')
    } else {
      toast.success('Pengeluaran berhasil dihapus')
      loadData()
    }
  }

  async function handleSettle() {
    if (selectedOrderIds.length > 0) {
      const { error } = await settleSelectedOrders(selectedOrderIds)
      if (error) {
        toast.error('Gagal menyetorkan order terpilih')
      } else {
        toast.success(`${selectedOrderIds.length} order berhasil disetorkan ke Wallet Utama!`)
        loadData()
      }
    } else {
      const { error } = await settleAllPendingOrders()
      if (error) {
        toast.error('Gagal menyetorkan order ke wallet utama')
      } else {
        toast.success('Semua pembayaran order berhasil disetorkan ke Wallet Utama!')
        loadData()
      }
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Memuat data keuangan...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financials & Wallet</h1>
          <p className="text-sm text-muted-foreground">
            Kelola pendapatan wallet utama, estimasi omset, serta pencatatan pengeluaran operasional.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setInitialBalanceInput(initialBalance.toString())
              if (settings?.cutoff_time) {
                 const d = new Date(settings.cutoff_time)
                 setCutoffDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
                 setCutoffTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
              } else {
                 setCutoffDate('')
                 setCutoffTime('')
              }
              setShowInitialBalanceDialog(true)
            }}
          >
            <DollarSign className="mr-1.5 size-4" />
            Atur Saldo Awal
          </Button>
          <Button onClick={() => setShowExpenseDialog(true)}>
            <Plus className="mr-1.5 size-4" />
            Catat Pengeluaran
          </Button>
        </div>
      </div>

      {/* 1. Ringkasan Dompet & Saldo Kas Riil (All-time Wallet) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            Ringkasan Kas & Dompet Utama
          </h2>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Status riil uang tunai & rekening di tangan
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Card 1: Saldo Kas Utama Riil */}
          <Card className="relative overflow-hidden border-primary/30 bg-linear-to-br from-primary/10 via-primary/5 to-transparent shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Saldo Kas Riil (Di Tangan)</CardTitle>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wallet className="size-4" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-extrabold tracking-tight text-primary">
                {formatRupiah(actualRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                Uang tunai & rekening bersih saat ini setelah dipotong seluruh modal.
              </p>
              <div className="pt-1">
                {actualRevenue >= 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    🟢 Kas Sehat & Aman
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    🔴 Defisit ({formatRupiah(Math.abs(actualRevenue))})
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Pembayaran Belum Masuk Kas */}
          <Card className="relative overflow-hidden border-amber-500/30 bg-linear-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Uang Belum Masuk Kas</CardTitle>
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Clock className="size-4" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
                {formatRupiah(unsettledOrdersTotal)}
              </div>
              <p className="text-xs text-muted-foreground">
                {unsettledOrders.length} pembayaran transaksi masih tertahan / belum disetor.
              </p>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  ⏳ Siap Disetorkan ke Kas
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Proyeksi Total Laba Bersih */}
          <Card className="relative overflow-hidden border-emerald-500/30 bg-linear-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Estimasi Total Laba</CardTitle>
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <TrendingUp className="size-4" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatRupiah(expectedRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                Perkiraan saldo kas bersih akhir setelah semua transaksi disetor.
              </p>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  📈 Proyeksi Akhir Bersih
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 2. Laporan Perputaran Siklus Bulanan (Cutoff Tanggal 27) dengan Filter Siklus */}
      <Card className="border-sky-500/20 bg-linear-to-b from-sky-500/5 to-transparent shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-card/40 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-md bg-sky-500/10 text-sky-500">
                  <CalendarRange className="size-4" />
                </div>
                <CardTitle className="text-base font-bold">
                  Laporan Siklus Bulanan (Cutoff Tgl 27)
                </CardTitle>
                {selectedCycle.isCurrent ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    🟢 Siklus Berjalan
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border">
                    📁 Arsip Siklus Lalu
                  </span>
                )}
              </div>
              <CardDescription className="text-xs">
                Periode terpilih: <span className="font-semibold text-foreground">{selectedCycle.cycleFullLabel}</span> (Cutoff tgl 27).
              </CardDescription>
            </div>

            {/* Filter / Cycle Selector Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border bg-card shadow-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handlePrevCycle}
                  disabled={selectedCycleIndex >= availableCycles.length - 1}
                  title="Siklus Bulan Sebelumnya"
                  className="rounded-r-none border-r size-8"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <select
                  value={selectedCycle.key}
                  onChange={(e) => setSelectedCycleKey(e.target.value)}
                  className="h-8 bg-transparent px-3 text-xs font-semibold text-foreground outline-none cursor-pointer"
                >
                  {availableCycles.map((c) => (
                    <option key={c.key} value={c.key} className="bg-popover text-popover-foreground">
                      {c.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleNextCycle}
                  disabled={selectedCycleIndex <= 0}
                  title="Siklus Bulan Berikutnya"
                  className="rounded-l-none border-l size-8"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              {!selectedCycle.isCurrent && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetToActiveCycle}
                  className="h-8 text-xs border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
                >
                  <RotateCcw className="mr-1.5 size-3.5" />
                  Siklus Aktif
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Card A: Omset Siklus */}
            <div className="rounded-xl border bg-card p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Omset Penjualan</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">
                  📦 {selectedCycleOrdersCount} Order
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-sky-500 dark:text-sky-400">
                {formatRupiah(selectedCycleRevenue)}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground pt-1.5 border-t border-border/50">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ {formatRupiah(selectedCycleSettledRevenue)} disetor</span>
                {selectedCycleUnsettledRevenue > 0 && (
                  <span>• <span className="text-amber-600 dark:text-amber-400 font-medium">⏳ {formatRupiah(selectedCycleUnsettledRevenue)} pending</span></span>
                )}
              </div>
            </div>

            {/* Card B: Modal Operasional Siklus */}
            <div className="rounded-xl border bg-card p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Modal Operasional</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500">
                  📉 {selectedCycleExpenses.length} Pengeluaran
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {formatRupiah(selectedCycleExpensesTotal)}
              </div>
              <div className="text-xs text-muted-foreground pt-1.5 border-t border-border/50">
                Total modal usaha seluruh waktu: <span className="font-semibold text-foreground">{formatRupiah(expensesTotal)}</span>
              </div>
            </div>

            {/* Card C: Laba Bersih Siklus & Status Penutupan Modal */}
            <div className="rounded-xl border bg-card p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">Laba Bersih Siklus</span>
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  selectedCycleNetProfit >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                )}>
                  {selectedCycleCoveredPct}% Modal Tertutup
                </span>
              </div>
              <div className={cn(
                "text-2xl sm:text-3xl font-bold tracking-tight",
                selectedCycleNetProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}>
                {selectedCycleNetProfit >= 0 ? '+' : ''}{formatRupiah(selectedCycleNetProfit)}
              </div>
              {/* Progress bar & BEP status */}
              <div className="space-y-1.5 pt-1.5 border-t border-border/50">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      selectedCycleCoveredPct >= 100 ? "bg-emerald-500" : "bg-amber-500"
                    )}
                    style={{ width: `${selectedCycleCoveredPct}%` }}
                  />
                </div>
                <div className="text-[11px] font-medium leading-snug">
                  {selectedCycleExpensesTotal === 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">🟢 100% Laba Murni (Belum ada modal yang dicatat)</span>
                  ) : selectedCycleNetProfit >= 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">🟢 Modal Tertutupi Lunas (Surplus +{formatRupiah(selectedCycleNetProfit)})</span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400">🔴 Kurang {formatRupiah(Math.abs(selectedCycleNetProfit))} lagi untuk BEP</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unsettled Orders Breakdown Section */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="size-5 text-amber-500" />
              Breakdown Pembayaran Belum Disetor
            </CardTitle>
            <CardDescription>
              Daftar order yang pembayarannya belum dimasukkan/disetorkan ke Saldo Wallet Utama.
            </CardDescription>
          </div>
          {unsettledOrders.length > 0 && (
            <ConfirmDialog
              title={
                selectedOrderIds.length > 0
                  ? `Setorkan ${selectedOrderIds.length} Order Terpilih?`
                  : 'Setorkan Semua Pembayaran ke Wallet Utama?'
              }
              message={
                selectedOrderIds.length > 0
                  ? `${selectedOrderIds.length} order terpilih (total ${formatRupiah(selectedOrdersTotal)}) akan ditandai sudah disetor ke Wallet Utama (Actual Revenue).`
                  : `Semua ${unsettledOrders.length} order yang belum disetor (total ${formatRupiah(unsettledOrdersTotal)}) akan ditandai sudah disetor ke Wallet Utama (Actual Revenue).`
              }
              confirmLabel="Ya, Setorkan Sekarang"
              onConfirm={handleSettle}
              trigger={
                <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                  <CheckCircle2 className="mr-1.5 size-4" />
                  {selectedOrderIds.length > 0
                    ? `Setorkan Terpilih (${selectedOrderIds.length} - ${formatRupiah(selectedOrdersTotal)})`
                    : 'Setorkan Semua ke Wallet Utama'}
                </Button>
              }
            />
          )}
        </CardHeader>
        <CardContent>
          {unsettledOrders.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm border border-dashed rounded-lg">
              Semua pembayaran order telah disetorkan ke Wallet Utama! Actual Revenue & Expected Revenue saat ini sama.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase border-b bg-muted/30">
                  <tr>
                    <th className="w-10 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label="Pilih Semua Order"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="rounded border-muted-foreground/30 text-amber-600 focus:ring-amber-500 cursor-pointer size-4"
                      />
                    </th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Akun / Profile</th>
                    <th className="px-4 py-3">Paket</th>
                    <th className="px-4 py-3">Tanggal Order</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {unsettledOrders.map((order, index) => {
                    const isSelected = selectedOrderIds.includes(order.id)
                    return (
                      <tr
                        key={order.id}
                        onClick={(e) => handleToggleSelect(order.id, index, e)}
                        className={`hover:bg-muted/40 transition-colors cursor-pointer select-none ${
                          isSelected ? 'bg-amber-500/10 hover:bg-amber-500/15' : ''
                        }`}
                      >
                        <td
                          className="w-10 px-4 py-3 text-center"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleSelect(order.id, index, e)
                          }}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Pilih order ${order.customer_name}`}
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-muted-foreground/30 text-amber-600 focus:ring-amber-500 cursor-pointer size-4"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium">{order.customer_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {order.profiles?.accounts?.name ?? 'Akun'} - {order.profiles?.name ?? 'Profile'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted">
                            {order.package.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatRupiah(order.price)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses Management Section */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="size-5 text-rose-500" />
              Menu Pengeluaran (Expenses)
            </CardTitle>
            <CardDescription>
              Catatan pengeluaran operasional (seperti perpanjangan akun Netflix, domain, server, dll.) yang memotong saldo Wallet Utama.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setExpenseCycleFilter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-md transition-colors cursor-pointer",
                  expenseCycleFilter === 'all'
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Semua Siklus ({expenses.length})
              </button>
              <button
                type="button"
                onClick={() => setExpenseCycleFilter('selected')}
                className={cn(
                  "px-3 py-1.5 rounded-md transition-colors cursor-pointer",
                  expenseCycleFilter === 'selected'
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Siklus Terpilih ({selectedCycleExpenses.length})
              </button>
            </div>
            <Button size="sm" onClick={() => setShowExpenseDialog(true)}>
              <Plus className="mr-1.5 size-4" />
              Tambah Pengeluaran
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {displayedExpenses.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm border border-dashed rounded-lg flex flex-col items-center justify-center gap-2">
              <TrendingDown className="size-8 opacity-30 text-rose-500" />
              <p>Belum ada catatan pengeluaran {expenseCycleFilter === 'selected' ? `di siklus ${selectedCycle.cycleFullLabel}` : ''}.</p>
              {expenseCycleFilter === 'selected' && expenses.length > 0 && (
                <Button variant="link" size="sm" onClick={() => setExpenseCycleFilter('all')} className="text-xs">
                  Tampilkan Semua Siklus ({expenses.length})
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase border-b bg-muted/30">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Pengeluaran</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                    <th className="px-4 py-3 text-center">Status Penutupan Modal (Omset Siklus)</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayedExpenses.map((expense) => {
                    const status = waterfallExpensesMap.get(expense.id) || {
                      allocated: 0,
                      remainingNeeded: expense.amount,
                      isCovered: false,
                      cycleLabel: getMonthlyCycleRange(expense.expense_date).cycleFullLabel,
                    }
                    return (
                      <tr key={expense.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                          <CalendarIcon className="size-3.5 text-muted-foreground" />
                          {new Date(expense.expense_date).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 font-medium">{expense.title}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                          {formatRupiah(expense.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {status.isCovered ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                🟢 Tertutupi (Lunas)
                              </span>
                            ) : status.allocated > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                🟡 Kurang {formatRupiah(status.remainingNeeded)} lagi ({formatRupiah(status.allocated)} tercover)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                🔴 Kurang {formatRupiah(status.remainingNeeded)} lagi
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              Siklus: {status.cycleLabel || getMonthlyCycleRange(expense.expense_date).cycleFullLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ConfirmDialog
                            title="Hapus Catatan Pengeluaran?"
                            message="Catatan pengeluaran ini akan dihapus permanen. Saldo Wallet Utama akan bertambah kembali sebesar nominal pengeluaran ini."
                            confirmLabel="Hapus Pengeluaran"
                            destructive
                            onConfirm={() => handleDeleteExpense(expense.id)}
                            trigger={
                              <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="size-4" />
                              </Button>
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Initial Balance Dialog */}
      <Dialog open={showInitialBalanceDialog} onOpenChange={setShowInitialBalanceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atur Saldo Awal Wallet Utama</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveInitialBalance} className="space-y-4">
            <div className="space-y-2">
              <Label>Nominal Saldo Awal (Rp)</Label>
              <Input
                type="number"
                value={initialBalanceInput}
                onChange={(e) => setInitialBalanceInput(e.target.value)}
                placeholder="Contoh: 1000000"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 flex flex-col">
                <Label>Dihitung Sejak (Opsional)</Label>
                <Popover>
                  <PopoverTrigger
                    className={cn(
                      "flex h-9 w-full items-center justify-start rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-left font-normal",
                      !cutoffDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {cutoffDate ? format(new Date(cutoffDate), "PPP") : <span>Pilih tanggal</span>}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={cutoffDate ? new Date(cutoffDate) : undefined}
                      onSelect={(date: Date | undefined) => {
                        if (date) {
                          setCutoffDate(format(date, "yyyy-MM-dd"))
                        } else {
                          setCutoffDate('')
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2 flex flex-col">
                <Label>Jam</Label>
                <Input type="time" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nilai ini digunakan sebagai modal awal/posisi saldo dasar wallet kamu. <br />
              Order yang masuk <b>sebelum</b> tanggal & jam di atas tidak akan dihitung di breakdown dan dianggap sudah masuk ke saldo ini.
            </p>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="ghost" />}>Batal</DialogClose>
              <Button type="submit">Simpan Saldo Awal</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Pengeluaran Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateExpense} className="space-y-4">
            <div className="space-y-2">
              <Label>Judul Pengeluaran</Label>
              <Input
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                placeholder="Misal: Langganan Akun Netflix #1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Nominal (Rp)</Label>
              <Input
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="Contoh: 186000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Input
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                placeholder="Misal: Netflix Account, Server, Operasional"
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Catatan (Opsional)</Label>
              <Input
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                placeholder="Catatan tambahan"
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="ghost" />}>Batal</DialogClose>
              <Button type="submit">Simpan Pengeluaran</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
