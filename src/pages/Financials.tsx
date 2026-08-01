import { useEffect, useState } from 'react'
import {
  getFinancialSettings,
  updateInitialBalance,
  getExpenses,
  createExpense,
  deleteExpense,
  getFinancialsOrdersSummary,
  settleAllPendingOrders,
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

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const initialBalance = settings?.initial_balance ?? 0
  const expensesTotal = expenses.reduce((acc, curr) => acc + curr.amount, 0)
  const actualRevenue = initialBalance + settledOrdersTotal - expensesTotal
  const expectedRevenue = actualRevenue + unsettledOrdersTotal

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

  async function handleSettleAll() {
    const { error } = await settleAllPendingOrders()
    if (error) {
      toast.error('Gagal menyetorkan order ke wallet utama')
    } else {
      toast.success('Semua pembayaran order berhasil disetorkan ke Wallet Utama!')
      loadData()
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
        <Card className="relative overflow-hidden border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet Utama (Actual)</CardTitle>
            <Wallet className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatRupiah(actualRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Saldo bersih fisik di wallet utama (Modal Awal + Disetor - Pengeluaran)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expected Revenue</CardTitle>
            <TrendingUp className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatRupiah(expectedRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total potensi pendapatan (Actual + Order Belum Disetor)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
            <TrendingDown className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {formatRupiah(expensesTotal)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total biaya langganan & operasional
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Belum Disetor (Pending)</CardTitle>
            <Clock className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatRupiah(unsettledOrdersTotal)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {unsettledOrders.length} order belum masuk wallet utama
            </p>
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
              title="Setorkan Pembayaran ke Wallet Utama?"
              message={`Semua ${unsettledOrders.length} order yang belum disetor (total ${formatRupiah(unsettledOrdersTotal)}) akan ditandai sudah disetor ke Wallet Utama (Actual Revenue).`}
              confirmLabel="Ya, Setorkan Sekarang"
              onConfirm={handleSettleAll}
              trigger={
                <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                  <CheckCircle2 className="mr-1.5 size-4" />
                  Setorkan Semua ke Wallet Utama
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
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Akun / Profile</th>
                    <th className="px-4 py-3">Paket</th>
                    <th className="px-4 py-3">Tanggal Order</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {unsettledOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/40 transition-colors">
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
                  ))}
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
                    <th className="px-4 py-3">Catatan</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expenses.map((expense) => (
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
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {expense.notes || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                        {formatRupiah(expense.amount)}
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
                  ))}
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
