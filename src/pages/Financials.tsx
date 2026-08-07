import { useEffect, useState } from 'react'
import {
  getFinancialSettings,
  updateInitialBalance,
  getExpenses,
  createExpense,
  deleteExpense,
  getFinancialsOrdersSummary,
  settleAllPendingOrders,
  settleSelectedOrders,
} from '@/lib/supabase'
import { formatRupiah } from '@/lib/constants'
import type { FinancialSettings, Expense, OrderWithProfile } from '@/types/database'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Wallet, TrendingUp, TrendingDown, Clock, Plus, Trash2, CheckCircle2, DollarSign, Calendar } from 'lucide-react'

export default function Financials() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<FinancialSettings | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settledOrdersTotal, setSettledOrdersTotal] = useState(0)
  const [unsettledOrdersTotal, setUnsettledOrdersTotal] = useState(0)
  const [unsettledOrders, setUnsettledOrders] = useState<OrderWithProfile[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  // Modals state
  const [showInitialBalanceDialog, setShowInitialBalanceDialog] = useState(false)
  const [initialBalanceInput, setInitialBalanceInput] = useState('')
  const [showExpenseDialog, setShowExpenseDialog] = useState(false)
  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('Netflix Account')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [expenseNotes, setExpenseNotes] = useState('')

  async function loadData() {
    setLoading(true)
    const [settingsRes, expensesRes, ordersSummaryRes] = await Promise.all([
      getFinancialSettings(),
      getExpenses(),
      getFinancialsOrdersSummary(),
    ])

    if (settingsRes.data) setSettings(settingsRes.data)
    if (expensesRes.data) setExpenses(expensesRes.data)
    
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

  const expenseShortfall = expensesTotal - unsettledOrdersTotal

  // FIFO Waterfall Payoff calculation for Expenses using pending order revenue pool
  const waterfallExpensesMap = new Map<string, { allocated: number; remainingNeeded: number; isCovered: boolean }>()
  {
    const sorted = [...expenses].sort((a, b) => {
      const d1 = new Date(a.expense_date).getTime()
      const d2 = new Date(b.expense_date).getTime()
      if (d1 !== d2) return d1 - d2
      return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
    })

    let currentPool = unsettledOrdersTotal

    for (const expense of sorted) {
      const needed = expense.amount
      const allocated = Math.max(0, Math.min(currentPool, needed))
      currentPool -= allocated
      const remainingNeeded = needed - allocated
      const isCovered = remainingNeeded <= 0

      waterfallExpensesMap.set(expense.id, {
        allocated,
        remainingNeeded,
        isCovered,
      })
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
    const { error } = await updateInitialBalance(val)
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

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Saldo Kas Utama */}
        <Card className="relative overflow-hidden border-primary/30 bg-primary/5 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Saldo Kas Nyata</CardTitle>
            <Wallet className="size-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold tracking-tight text-primary">
              {formatRupiah(actualRevenue)}
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Uang tunai/rekening bersih yang saat ini benar-benar ada di tangan Anda.
            </p>
            <div className="pt-1">
              {actualRevenue >= 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  🟢 Saldo Kas Aman / Untung
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  🔴 Defisit ({formatRupiah(Math.abs(actualRevenue))})
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Biaya & Modal Keluar */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Total Modal & Biaya</CardTitle>
            <TrendingDown className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {formatRupiah(expensesTotal)}
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Total semua uang yang sudah Anda keluarkan untuk beli modal / langganan.
            </p>
            <div className="pt-1">
              {expenseShortfall > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  🔴 Kurang {formatRupiah(expenseShortfall)} lagi untuk menutup pengeluaran
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  🟢 Plus {formatRupiah(Math.abs(expenseShortfall))}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Belum Disetor ke Kas */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Uang Belum Masuk Kas</CardTitle>
            <Clock className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {formatRupiah(unsettledOrdersTotal)}
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Pembayaran pelanggan yang masih tertahan / belum disetorkan ke kas.
            </p>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                📦 {unsettledOrders.length} transaksi siap disetorkan
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Estimasi Total Keuntungan */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Estimasi Total Laba</CardTitle>
            <TrendingUp className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatRupiah(expectedRevenue)}
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Perkiraan total uang bersih Anda setelah semua transaksi selesai disetor.
            </p>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                📈 Proyeksi Akhir Bersih
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

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
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="size-5 text-rose-500" />
              Menu Pengeluaran (Expenses)
            </CardTitle>
            <CardDescription>
              Catatan pengeluaran operasional (seperti perpanjangan akun Netflix, domain, server, dll.) yang memotong saldo Wallet Utama.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowExpenseDialog(true)}>
            <Plus className="mr-1.5 size-4" />
            Tambah Pengeluaran
          </Button>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm border border-dashed rounded-lg">
              Belum ada catatan pengeluaran.
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
                    <th className="px-4 py-3 text-center">Status Penutupan (Omset Pending)</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expenses.map((expense) => {
                    const status = waterfallExpensesMap.get(expense.id) || {
                      allocated: 0,
                      remainingNeeded: expense.amount,
                      isCovered: false,
                    }
                    return (
                      <tr key={expense.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                          <Calendar className="size-3.5 text-muted-foreground" />
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
                          {status.isCovered ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              🟢 Tertutupi (Lunas)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              🔴 Kurang {formatRupiah(status.remainingNeeded)} lagi
                            </span>
                          )}
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
              <p className="text-xs text-muted-foreground">
                Nilai ini digunakan sebagai modal awal/posisi saldo dasar wallet kamu.
              </p>
            </div>
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
