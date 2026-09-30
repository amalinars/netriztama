import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  Tv,
  CheckCircle2,
  AlertCircle,
  Upload,
  Trash2,
  Copy,
  ArrowLeft,
  ArrowRight,
  User,
  CreditCard,
  ExternalLink,
  Calendar,
  Zap,
  RefreshCw,
  QrCode,
  Check,
  Download,
  Eye,
  EyeOff,
  Clock3,
  Sparkles,
  Lock,
} from 'lucide-react'
import qrisImg from '@/assets/qris.jpg'
import { toast, Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { PACKAGES, formatRupiah, calculateDynamicExpiry, calculateExtensionExpiry } from '@/lib/constants'
import { analyzeImageWith9Router } from '@/lib/ninerouter'
import { uploadReceiptImage, appendReceiptUrl } from '@/lib/receiptUpload'
import { useCheckoutLocks } from '@/lib/checkoutLock'
import type { PackageType } from '@/types/database'

export interface ReceiptVerificationData {
  approved: boolean
  status: string
  amount: number
  amount_formatted?: string
  amount_matches: boolean
  receiver_name: string
  sender_name?: string
  payment_method?: string
  transaction_date?: string
  reference_id?: string
  summary: string
  raw_text?: string
}

import {
  type GuestRentalOrder,
  syncAndVerifyGuestOrders,
  addGuestOrder,
} from '@/lib/guestOrder'
export type { GuestRentalOrder }

interface ProfileData {
  id: string
  name: string
  pin: string | null
  accountEmail?: string
  accountPassword?: string | null
  isRentable: boolean
}

const PACKAGE_METADATA: Record<
  PackageType,
  {
    badge?: string
    badgeColor?: string
    description: string
    perDay: string
  }
> = {
  '1_hari': {
    description: 'Akses 24 Jam',
    perDay: 'Rp 5.000/hari',
  },
  '2_hari': {
    badge: 'Populer',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    description: 'Pas Nonton Weekend',
    perDay: 'Rp 3.500/hari',
  },
  '3_hari': {
    description: 'Maraton Series',
    perDay: 'Rp 3.333/hari',
  },
  '1_minggu': {
    badge: 'Hemat',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    description: '7 Hari Full Akses',
    perDay: 'Rp 2.857/hari',
  },
  '1_bulan': {
    badge: 'Paling Irit',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    description: '30 Hari Non-Stop',
    perDay: 'Rp 1.667/hari',
  },
}

export default function Checkout() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const profileId = searchParams.get('profileId')
  const initialPkg = (searchParams.get('pkg') as PackageType) || '2_hari'

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [selectedPackage, setSelectedPackage] = useState<PackageType>(
    initialPkg in PACKAGES ? initialPkg : '2_hari'
  )

  // Customer Input
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')

  // QRIS Payment state
  const [copiedAmount, setCopiedAmount] = useState(false)

  // Receipt image & verification
  const [receiptImage, setReceiptImage] = useState<string>('')
  const [dragActive, setDragActive] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<ReceiptVerificationData | null>(null)

  // Bukti transfer yang sudah tersimpan permanen di server (Cloudinary).
  // receiptImage = preview lokal (dataURL), receiptUrl = URL penyimpanan.
  const [receiptUrl, setReceiptUrl] = useState<string>('')
  const [receiptUploading, setReceiptUploading] = useState(false)
  const [receiptUploadError, setReceiptUploadError] = useState<string>('')

  // Submitting order
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState<GuestRentalOrder | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if viewing an existing order via orderId query param
  const orderIdParam = searchParams.get('orderId')
  // Check if extending an existing order via extendOrderId query param
  const extendOrderIdParam = searchParams.get('extendOrderId')
  const [extendOrder, setExtendOrder] = useState<GuestRentalOrder | null>(null)

  useEffect(() => {
    if (!orderIdParam) return

    async function verifyAndLoadOrder() {
      setLoadingProfile(true)
      try {
        // Run database synchronization to get actual, up-to-date data
        const { allOrders } = await syncAndVerifyGuestOrders()
        const matched = allOrders.find((o) => o.orderId === orderIdParam)

        if (matched) {
          if (matched.status === 'done') {
            toast.info('Perhatian: Masa sewa untuk pesanan ini telah selesai.')
          }
          if (matched.isSwitched) {
            toast.info(`Profil sewa Anda telah dipindahkan oleh Admin ke "${matched.profileName}". Data telah diperbarui.`)
          }
          setOrderSuccess(matched)
        } else {
          // If not in localStorage, query Supabase directly
          const { data, error } = await supabase
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
            .eq('id', orderIdParam)
            .single()

          if (error || !data) {
            toast.error('Pesanan tidak ditemukan atau telah dihapus oleh Admin')
            setOrderSuccess(null)
            return
          }

          const rawProf = (Array.isArray(data.profiles) ? data.profiles[0] : data.profiles) as any
          const acc = (Array.isArray(rawProf?.accounts) ? rawProf.accounts[0] : rawProf?.accounts) as any
          const expMs = new Date(
            `${data.end_date}T${data.logout_time.length === 5 ? `${data.logout_time}:00` : data.logout_time}`
          ).getTime()

          const guestOrder: GuestRentalOrder = {
            orderId: data.id,
            customerName: data.customer_name,
            profileId: rawProf?.id || '',
            profileName: rawProf?.name || '',
            pin: rawProf?.pin || '0000',
            accountEmail: acc?.name || '',
            accountPassword: acc?.password || '',
            packageName: PACKAGES[data.package as PackageType]?.label || data.package,
            packageKey: data.package as PackageType,
            price: data.price,
            startDate: data.start_date,
            endDate: data.end_date,
            logoutTime: data.logout_time,
            fullDisplay: `${data.end_date} (${data.logout_time} WIB)`,
            expiryTimestamp: expMs,
            status: data.status === 'done' || expMs <= Date.now() ? 'done' : 'booked',
            createdAt: new Date().toISOString(),
          }

          addGuestOrder(guestOrder)
          setOrderSuccess(guestOrder)
        }
      } catch (err) {
        console.error('Failed to load order:', err)
        toast.error('Gagal memverifikasi data pesanan')
      } finally {
        setLoadingProfile(false)
      }
    }

    verifyAndLoadOrder()
  }, [orderIdParam])

  // Load extend order if extendOrderId query param is present
  useEffect(() => {
    if (!extendOrderIdParam) return

    async function loadExtendOrder() {
      setLoadingProfile(true)
      try {
        const { allOrders } = await syncAndVerifyGuestOrders()
        let matched = allOrders.find((o) => o.orderId === extendOrderIdParam)

        if (!matched) {
          const { data, error } = await supabase
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
            .eq('id', extendOrderIdParam)
            .single()

          if (data && !error) {
            const rawProf = (Array.isArray(data.profiles) ? data.profiles[0] : data.profiles) as any
            const acc = (Array.isArray(rawProf?.accounts) ? rawProf.accounts[0] : rawProf?.accounts) as any
            const expMs = new Date(
              `${data.end_date}T${data.logout_time.length === 5 ? `${data.logout_time}:00` : data.logout_time}`
            ).getTime()

            matched = {
              orderId: data.id,
              customerName: data.customer_name,
              profileId: rawProf?.id || '',
              profileName: rawProf?.name || '',
              pin: rawProf?.pin || '0000',
              accountEmail: acc?.name || '',
              accountPassword: acc?.password || '',
              packageName: PACKAGES[data.package as PackageType]?.label || data.package,
              packageKey: data.package as PackageType,
              price: data.price,
              startDate: data.start_date,
              endDate: data.end_date,
              logoutTime: data.logout_time,
              fullDisplay: `${data.end_date} (${data.logout_time} WIB)`,
              expiryTimestamp: expMs,
              status: 'booked',
              createdAt: new Date().toISOString(),
            }
          }
        }

        if (matched) {
          setExtendOrder(matched)
          setCustomerName(matched.customerName)
          setProfile({
            id: matched.profileId,
            name: matched.profileName,
            pin: matched.pin,
            accountEmail: matched.accountEmail,
            accountPassword: matched.accountPassword,
            isRentable: true,
          })
          toast.info(`Mode perpanjangan aktif untuk profil ${matched.profileName}.`)
        } else {
          toast.error('Data sewa yang ingin diperpanjang tidak ditemukan')
        }
      } catch (err) {
        console.error('Failed to load extend order:', err)
        toast.error('Gagal memuat data sewa perpanjangan')
      } finally {
        setLoadingProfile(false)
      }
    }

    loadExtendOrder()
  }, [extendOrderIdParam])

  // Fetch profile details (for normal new rental)
  useEffect(() => {
    if (extendOrderIdParam) return // Handled by loadExtendOrder
    if (!profileId) {
      setLoadingProfile(false)
      return
    }

    async function loadProfile() {
      setLoadingProfile(true)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, pin, is_rentable, accounts!inner(id, name, password, is_active)')
          .eq('id', profileId)
          .single()

        if (error || !data) {
          toast.error('Profil tidak ditemukan atau sedang tidak aktif')
          setProfile(null)
        } else {
          const acc = data.accounts as { name?: string; password?: string | null }
          setProfile({
            id: data.id,
            name: data.name,
            pin: data.pin ?? '',
            accountEmail: acc?.name ?? '',
            accountPassword: acc?.password ?? '',
            isRentable: data.is_rentable,
          })
        }
      } catch (err) {
        console.error(err)
        toast.error('Gagal mengambil detail profil')
      } finally {
        setLoadingProfile(false)
      }
    }

    loadProfile()
  }, [profileId, extendOrderIdParam])

  // Dynamic expiry based on current second/minute (or cumulative from existing order)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const todayStr = useMemo(() => new Date(now).toISOString().split('T')[0], [now])
  const dynamicExpiry = useMemo(() => {
    if (extendOrder) {
      return calculateExtensionExpiry(extendOrder.expiryTimestamp, selectedPackage)
    }
    return calculateDynamicExpiry(selectedPackage, new Date(now))
  }, [selectedPackage, now, extendOrder])
  const packagePrice = useMemo(() => PACKAGES[selectedPackage].price, [selectedPackage])

  // Real-time checkout presence lock
  const shouldLockProfile =
    !extendOrderIdParam && !orderIdParam && profile ? { id: profile.id, name: profile.name } : null
  const {
    isLockedByOther,
    isLockedByMe,
    getLock,
    releaseLock,
    broadcastOrderCompleted,
  } = useCheckoutLocks(shouldLockProfile)

  // Countdown timer for our current reservation lock
  const myLock = profile ? getLock(profile.id) : undefined
  const remainingLockMs = myLock && profile && isLockedByMe(profile.id) ? Math.max(0, myLock.expiresAt - now) : 0
  const reservationMinutes = Math.floor(remainingLockMs / 60000)
  const reservationSeconds = Math.floor((remainingLockMs % 60000) / 1000)
  const reservationCountdownStr = `${reservationMinutes}:${reservationSeconds < 10 ? `0${reservationSeconds}` : reservationSeconds}`

  // Automatic AI verification with structured JSON response
  const handleVerifyReceipt = useCallback(
    async (imageToVerify: string = receiptImage, targetPkg?: PackageType) => {
      if (!imageToVerify) {
        toast.error('Harap upload foto bukti transfer terlebih dahulu')
        return
      }

      const activePkg = targetPkg || selectedPackage
      const targetPrice = PACKAGES[activePkg].price
      const targetLabel = PACKAGES[activePkg].label

      setVerifying(true)
      const verificationPrompt = `Kamu adalah sistem AI verifikasi pembayaran QRIS otomatis untuk platform Netriztama.
Analisis gambar bukti transfer ini secara teliti dan akurat.
Ketentuan pembayaran pesanan saat ini:
- Tagihan harus dibayar: ${targetPrice} (${targetLabel})
- Nama merchant tujuan sah: TOKO RISMA AMALINA (pada bukti transfer sering ditulis TOKO RISMA AMALINA atau disensor seperti T*** R**** A****** / TOKO R****)

Tugas Anda:
1. Periksa status pembayaran (apakah Berhasil / Sukses / Lunas, bukan Gagal / Menunggu).
2. Periksa nominal transfer apakah sesuai dengan tagihan (${targetPrice}).
3. Periksa apakah nama penerima mengarah ke TOKO RISMA AMALINA atau variasinya.

KEMBALIKAN HANYA JSON MURNI TANPA MARKDOWN BACKTICKS (NO \`\`\`json) DENGAN STRUKTUR OBJECT BERIKUT:
{
  "approved": boolean,
  "status": string,
  "amount": number,
  "amount_matches": boolean,
  "receiver_name": string,
  "sender_name": string,
  "payment_method": string,
  "transaction_date": string,
  "reference_id": string,
  "summary": string
}`

      try {
        const res = await analyzeImageWith9Router(imageToVerify, verificationPrompt)
        const text = res.content || ''

        let parsed: ReceiptVerificationData
        try {
          let cleaned = text.trim()
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim()
          }
          const firstBrace = cleaned.indexOf('{')
          const lastBrace = cleaned.lastIndexOf('}')
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1)
          }
          const json = JSON.parse(cleaned)

          const parsedAmount =
            typeof json.amount === 'number'
              ? json.amount
              : parseInt(String(json.amount || '0').replace(/[^0-9]/g, ''), 10) || targetPrice

          const amountMatches =
            json.amount_matches !== undefined ? Boolean(json.amount_matches) : parsedAmount >= targetPrice

          const isApproved =
            json.approved !== undefined
              ? Boolean(json.approved)
              : amountMatches && String(json.status || '').toLowerCase().includes('berhasil')

          parsed = {
            approved: isApproved,
            status: json.status || (isApproved ? 'Berhasil' : 'Menunggu'),
            amount: parsedAmount,
            amount_matches: amountMatches,
            receiver_name: json.receiver_name || 'TOKO RISMA AMALINA',
            sender_name: json.sender_name || '-',
            payment_method: json.payment_method || 'QRIS',
            transaction_date: json.transaction_date || '-',
            reference_id: json.reference_id || '-',
            summary:
              json.summary ||
              (isApproved
                ? 'Pembayaran berhasil diverifikasi otomatis oleh AI.'
                : 'Bukti pembayaran perlu diverifikasi kembali.'),
            raw_text: text,
          }
        } catch {
          const isApproved =
            text.toLowerCase().includes('berhasil') ||
            text.toLowerCase().includes('lunas') ||
            text.toLowerCase().includes('valid')

          parsed = {
            approved: isApproved,
            status: isApproved ? 'Berhasil' : 'Perlu Diperiksa',
            amount: targetPrice,
            amount_matches: true,
            receiver_name: 'TOKO RISMA AMALINA',
            sender_name: '-',
            payment_method: 'QRIS',
            transaction_date: '-',
            reference_id: '-',
            summary: text.slice(0, 160),
            raw_text: text,
          }
        }

        setVerificationResult(parsed)

        if (parsed.approved) {
          toast.success(`Bukti transfer valid! Nominal ${formatRupiah(parsed.amount)} diterima.`)
        } else {
          toast.warning('Bukti pembayaran selesai dianalisis. Mohon periksa kembali rincian.')
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error(`Gagal verifikasi bukti: ${msg}`)
      } finally {
        setVerifying(false)
      }
    },
    [receiptImage, selectedPackage]
  )

  // Handle receipt image upload & auto-trigger verification
  // === Simpan bukti transfer ke server (Cloudinary) ===
  // Dijalankan otomatis begitu user pilih file, PARALEL dengan verifikasi AI,
  // supaya tombol order tidak ikut menunggu upload.
  const persistReceiptToServer = useCallback(async (dataUrl: string) => {
    setReceiptUploading(true)
    setReceiptUploadError('')
    try {
      const url = await uploadReceiptImage(dataUrl)
      setReceiptUrl(url)
      return url
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setReceiptUploadError(msg)
      toast.error(`Bukti transfer gagal disimpan ke server: ${msg}`)
      return ''
    } finally {
      setReceiptUploading(false)
    }
  }, [])

  useEffect(() => {
    if (!receiptImage) {
      setReceiptUrl('')
      setReceiptUploadError('')
      return
    }
    // Kalau sudah tersimpan (atau memang sudah berupa URL http), tidak perlu upload lagi.
    if (receiptUrl && (receiptUrl.startsWith('http') || receiptUrl === receiptImage)) return
    void persistReceiptToServer(receiptImage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptImage])

  const handleProcessReceipt = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('File harus berupa gambar bukti pembayaran (PNG, JPG, WEBP)')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        setReceiptImage(dataUrl)
        setVerificationResult(null)
        toast.info('Bukti transfer dimuat. Otomasi verifikasi sedang berjalan...')
        // Auto-run verification instantly!
        handleVerifyReceipt(dataUrl)
      }
      reader.readAsDataURL(file)
    },
    [handleVerifyReceipt]
  )

  // Copy nominal amount helper
  const handleCopyAmount = () => {
    navigator.clipboard.writeText(String(packagePrice))
    setCopiedAmount(true)
    toast.success('Nominal transfer disalin ke clipboard!')
    setTimeout(() => setCopiedAmount(false), 2000)
  }

  // Handle final order submission
  const handleSubmitOrder = async () => {
    if (!profile) {
      toast.error('Profil Netflix belum dipilih')
      return
    }
    if (!customerName.trim()) {
      toast.error('Harap isi Nama Lengkap Pemesan')
      return
    }
    if (!receiptImage) {
      toast.error('Harap unggah bukti transfer pembayaran terlebih dahulu')
      return
    }
    if (verifying) {
      toast.error('Bukti transfer sedang dalam proses verifikasi AI...')
      return
    }
    if (!verificationResult?.approved) {
      toast.error('Bukti pembayaran belum terverifikasi atau tidak sesuai')
      return
    }

    setSubmittingOrder(true)
    try {
      // Bukti transfer wajib sudah tersimpan di server sebelum order dicatat.
      // Kalau upload otomatis belum selesai/gagal, coba simpan sekali lagi di sini.
      const storedReceiptUrl = receiptUrl || (await persistReceiptToServer(receiptImage))

      if (extendOrder) {
        // Mode Perpanjangan: Akumulasi masa aktif dan perbarui order di Supabase
        const { endDate, logoutTime, fullDisplay } = calculateExtensionExpiry(
          extendOrder.expiryTimestamp,
          selectedPackage
        )
        const newPrice = (extendOrder.price || 0) + packagePrice
        const extensionLog = `[Perpanjangan +${PACKAGES[selectedPackage].label} (${formatRupiah(packagePrice)}) pada ${new Date().toLocaleString('id-ID')} | Ref: ${verificationResult?.reference_id || '-'}]`

        // Ambil daftar bukti lama supaya riwayat transfer tidak hilang saat diperpanjang.
        const { data: existingRow } = await supabase
          .from('orders')
          .select('receipt_url, receipt_urls')
          .eq('id', extendOrder.orderId)
          .single()

        const { error } = await supabase
          .from('orders')
          .update({
            end_date: endDate,
            logout_time: logoutTime,
            price: newPrice,
            status: 'booked',
            receipt_url: storedReceiptUrl || existingRow?.receipt_url || null,
            receipt_urls: storedReceiptUrl
              ? appendReceiptUrl(existingRow?.receipt_urls, storedReceiptUrl)
              : (existingRow?.receipt_urls ?? []),
            notes: `${customerName.trim()} | ${notes.trim() ? `${notes.trim()} | ` : ''}${extensionLog}`,
          })
          .eq('id', extendOrder.orderId)

        if (error) throw error

        const expMs = new Date(`${endDate}T${logoutTime.length === 5 ? `${logoutTime}:00` : logoutTime}`).getTime()
        const updatedOrder: GuestRentalOrder = {
          ...extendOrder,
          customerName: customerName.trim(),
          packageName: `${extendOrder.packageName} + ${PACKAGES[selectedPackage].label}`,
          price: newPrice,
          endDate: endDate,
          logoutTime: logoutTime,
          fullDisplay: fullDisplay,
          expiryTimestamp: expMs,
          status: 'booked',
        }

        // Save to localStorage using guestOrder utility
        addGuestOrder(updatedOrder)

        setOrderSuccess(updatedOrder)
        toast.success(`Sewa berhasil diperpanjang hingga ${fullDisplay}!`)
        return
      }

      // Normal New Rental Order
      // Concurrency check: Ensure profile is not already booked in database
      const { data: existingActiveOrders } = await supabase
        .from('orders')
        .select('id, end_date, logout_time, status')
        .eq('profile_id', profile.id)
        .eq('status', 'booked')

      const currentMs = Date.now()
      const hasConflict = (existingActiveOrders ?? []).some((ord) => {
        const time = ord.logout_time ? (ord.logout_time.length === 5 ? `${ord.logout_time}:00` : ord.logout_time) : '23:59:59'
        const deadMs = new Date(`${ord.end_date}T${time}`).getTime()
        return deadMs > currentMs
      })

      if (hasConflict) {
        toast.error('Maaf, profil ini baru saja disewa oleh pengguna lain. Silakan pilih profil lain.')
        setSubmittingOrder(false)
        return
      }

      const { endDate, logoutTime, fullDisplay } = calculateDynamicExpiry(selectedPackage, new Date(now))

      const orderPayload = {
        profile_id: profile.id,
        customer_name: customerName.trim(),
        package: selectedPackage,
        price: packagePrice,
        start_date: todayStr,
        end_date: endDate,
        logout_time: logoutTime,
        status: 'booked' as const,
        is_settled: true,
        // Bukti transfer disimpan permanen di server (URL Cloudinary), bukan base64.
        receipt_url: storedReceiptUrl || null,
        receipt_urls: storedReceiptUrl ? [storedReceiptUrl] : [],
        notes: `Order Checkout Portal (QRIS). Pemesan: ${customerName.trim()} | AI Verified: ${verificationResult?.approved ? 'YA (LUNAS)' : 'MANUAL'} | Ref: ${verificationResult?.reference_id || '-'} | Ket: ${notes.trim() || '-'}`,
      }

      const { data, error } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select('id')
        .single()

      if (error) throw error

      const expMs = new Date(`${endDate}T${logoutTime.length === 5 ? `${logoutTime}:00` : logoutTime}`).getTime()
      const newOrder: GuestRentalOrder = {
        orderId: data.id,
        customerName: customerName.trim(),
        profileId: profile.id,
        profileName: profile.name,
        pin: profile.pin || '0000',
        accountEmail: profile.accountEmail || '',
        accountPassword: profile.accountPassword || '',
        packageName: PACKAGES[selectedPackage].label,
        packageKey: selectedPackage,
        price: packagePrice,
        startDate: todayStr,
        endDate: endDate,
        logoutTime: logoutTime,
        fullDisplay: fullDisplay,
        expiryTimestamp: expMs,
        status: 'booked',
        createdAt: new Date().toISOString(),
      }

      // Save to localStorage using guestOrder utility
      addGuestOrder(newOrder)

      // Broadcast real-time order completion so all clients update their views
      await broadcastOrderCompleted(profile.id)

      setOrderSuccess(newOrder)
      toast.success('Pesanan berhasil! Kredensial akun siap digunakan.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Gagal memproses pesanan: ${msg}`)
    } finally {
      setSubmittingOrder(false)
    }
  }

  // If order is completed successfully, render Instant Credentials Card View (No WA needed!)
  if (orderSuccess) {
    const diffMs = orderSuccess.expiryTimestamp - now
    const isExpired = diffMs <= 0
    const hoursLeft = Math.floor(Math.max(0, diffMs) / 3600000)
    const minsLeft = Math.floor((Math.max(0, diffMs) % 3600000) / 60000)
    const secsLeft = Math.floor((Math.max(0, diffMs) % 60000) / 1000)
    const countdownFormatted = isExpired
      ? 'Masa Sewa Berakhir'
      : `${hoursLeft > 0 ? `${hoursLeft}j ` : ''}${minsLeft}m ${secsLeft}d`

    const handleCopyText = (text: string, field: string, label: string) => {
      navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success(`${label} disalin ke clipboard!`)
      setTimeout(() => setCopiedField(null), 2000)
    }

    const handleCopyAll = () => {
      const text = `=== AKSES AKUN NETFLIX (NETRIZTAMA) ===
Pemesan: ${orderSuccess.customerName}
ID Pesanan: ${orderSuccess.orderId}
Paket Sewa: ${orderSuccess.packageName}
Masa Aktif: ${orderSuccess.fullDisplay}

[KREDENSIAL LOGIN]
Email: ${orderSuccess.accountEmail}
Password: ${orderSuccess.accountPassword}
Profil: ${orderSuccess.profileName}
PIN Profil: ${orderSuccess.pin}

Link Login: https://www.netflix.com/login
*Simpan data ini. Dilarang mengubah email/password atau mengganggu profil lain.
========================================`

      navigator.clipboard.writeText(text)
      setCopiedField('all')
      toast.success('Semua rincian akun berhasil disalin ke clipboard!')
      setTimeout(() => setCopiedField(null), 2000)
    }

    const handleDownloadTicket = () => {
      const ticketContent = `=====================================================
          NETRIZTAMA - TIKET AKSES NETFLIX
=====================================================

Terima kasih atas pesanan Anda, ${orderSuccess.customerName}!
Berikut rincian akun Netflix sewa Anda:

DATA PESANAN:
- ID Pesanan   : ${orderSuccess.orderId}
- Paket Sewa   : ${orderSuccess.packageName}
- Nominal      : ${formatRupiah(orderSuccess.price)}
- Masa Aktif   : ${orderSuccess.fullDisplay}

KREDENSIAL LOGIN:
- Email Akun   : ${orderSuccess.accountEmail}
- Password     : ${orderSuccess.accountPassword}
- Nama Profil  : ${orderSuccess.profileName}
- PIN Profil   : ${orderSuccess.pin}

CARA LOGIN NETFLIX:
1. Buka https://www.netflix.com/login atau buka aplikasi Netflix di HP/TV/Laptop.
2. Masukkan Email dan Password di atas.
3. Klik profil "${orderSuccess.profileName}", lalu ketik PIN "${orderSuccess.pin}".
4. Nikmati tayangan Netflix 4K Ultra HD favorit Anda!

ATURAN PENGGUNAAN:
- Gunakan HANYA profil "${orderSuccess.profileName}".
- DILARANG mengubah password, email, atau mengotak-atik profil lain.
- Garansi aktif penuh selama masa durasi sewa.

=====================================================
Tersimpan otomatis di browser perangkat Anda.
Waktu Cetak: ${new Date().toLocaleString('id-ID')}
=====================================================`

      const blob = new Blob([ticketContent], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tiket-netflix-${orderSuccess.profileName.toLowerCase().replace(/\s+/g, '-')}-${orderSuccess.orderId.slice(0, 8)}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('File tiket berhasil didownload!')
    }

    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6 py-12">
        <Toaster position="top-center" richColors closeButton />
        <div className="w-full max-w-xl space-y-5 animate-in zoom-in-95 duration-200">

          {/* Main Credentials Card */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-7 shadow-xl space-y-5">
            {/* Header Status */}
            <div className="text-center space-y-2">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto shadow-inner">
                <CheckCircle2 className="size-8" />
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-3 py-1 text-xs font-semibold">
                ✓ Pembayaran Terverifikasi (Lunas)
              </Badge>
              <h1 className="text-2xl font-black tracking-tight">Akun Netflix Anda Siap!</h1>
              <p className="text-xs text-muted-foreground">
                Halo <b className="text-foreground">{orderSuccess.customerName}</b>, berikut akun sewa Anda. Data ini otomatis tersimpan di perangkat ini.
              </p>
            </div>

            {/* Countdown Banner */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 sm:p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
                <Clock3 className="size-4 animate-pulse" />
                <span>Sisa Durasi Sewa:</span>
              </div>
              <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                {countdownFormatted}
              </span>
            </div>

            {/* Notice if Switched by Admin */}
            {orderSuccess.isSwitched && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-3.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5 shadow-xs text-left">
                <span className="text-base shrink-0">🔄</span>
                <div>
                  <b className="block">Profil Telah Dipindahkan oleh Admin:</b>
                  <span>
                    Sewa Anda sebelumnya di profil <b>{orderSuccess.switchedFrom || 'lama'}</b> telah dipindahkan ke profil <b>{orderSuccess.profileName}</b>. Silakan gunakan nama profil dan PIN baru yang tertera di bawah.
                  </span>
                </div>
              </div>
            )}

            {/* Notice if Expired / Completed */}
            {(isExpired || orderSuccess.status === 'done') && (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2 text-left">
                <span>⚠️</span>
                <span><b>Masa Sewa Selesai:</b> Durasi sewa akun ini telah berakhir atau dirotasi otomatis.</span>
              </div>
            )}

            {/* Credentials Detail Box */}
            <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 sm:p-5 text-left space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-red-600 text-white font-black text-xs shadow-xs">
                    N
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground">Kredensial Akses Akun Netflix</h3>
                    <p className="text-[10px] text-muted-foreground">Private Profile • 4K UHD Ultra Streaming</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                  {orderSuccess.packageName}
                </Badge>
              </div>

              {/* Email Row */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px] font-semibold text-muted-foreground">
                  <span>Email Akun:</span>
                  <span className="text-[10px] text-muted-foreground/80">Login di netflix.com</span>
                </div>
                <div className="flex items-center gap-2 bg-background border border-border/70 rounded-xl p-2.5">
                  <span className="font-mono text-xs sm:text-sm font-bold text-foreground truncate select-all flex-1">
                    {orderSuccess.accountEmail || 'Email sedang disiapkan'}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyText(orderSuccess.accountEmail, 'email', 'Email')}
                    className="h-7 px-2.5 text-xs gap-1 rounded-lg hover:bg-muted font-medium shrink-0 cursor-pointer"
                  >
                    {copiedField === 'email' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{copiedField === 'email' ? 'Disalin' : 'Salin'}</span>
                  </Button>
                </div>
              </div>

              {/* Password Row */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px] font-semibold text-muted-foreground">
                  <span>Password Akun:</span>
                  <span className="text-[10px] text-muted-foreground/80">Klik mata untuk intip</span>
                </div>
                <div className="flex items-center gap-2 bg-background border border-border/70 rounded-xl p-2.5">
                  <span className="font-mono text-xs sm:text-sm font-bold text-foreground truncate select-all flex-1 tracking-wider">
                    {showPassword ? orderSuccess.accountPassword : '••••••••••••'}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPassword(!showPassword)}
                    className="h-7 px-2 text-xs rounded-lg hover:bg-muted text-muted-foreground shrink-0 cursor-pointer"
                    title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyText(orderSuccess.accountPassword, 'password', 'Password')}
                    className="h-7 px-2.5 text-xs gap-1 rounded-lg hover:bg-muted font-medium shrink-0 cursor-pointer"
                  >
                    {copiedField === 'password' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{copiedField === 'password' ? 'Disalin' : 'Salin'}</span>
                  </Button>
                </div>
              </div>

              {/* Profile & PIN (2 Columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Profile Name */}
                <div className="space-y-1 bg-background border border-border/70 rounded-xl p-3">
                  <span className="text-[10px] font-semibold text-muted-foreground block">Profil Anda:</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-sm text-foreground truncate">{orderSuccess.profileName}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyText(orderSuccess.profileName, 'profile', 'Nama profil')}
                      className="h-6 px-2 text-[11px] gap-1 rounded-md hover:bg-muted font-medium cursor-pointer"
                    >
                      {copiedField === 'profile' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      <span>{copiedField === 'profile' ? 'Disalin' : 'Salin'}</span>
                    </Button>
                  </div>
                </div>

                {/* Profile PIN */}
                <div className="space-y-1 bg-background border border-border/70 rounded-xl p-3">
                  <span className="text-[10px] font-semibold text-muted-foreground block">PIN Profil:</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-base font-black tracking-widest text-primary">
                      {orderSuccess.pin || '0000'}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyText(orderSuccess.pin, 'pin', 'PIN Profil')}
                      className="h-6 px-2 text-[11px] gap-1 rounded-md hover:bg-muted font-medium cursor-pointer"
                    >
                      {copiedField === 'pin' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      <span>{copiedField === 'pin' ? 'Disalin' : 'Salin'}</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Order Meta details */}
              <div className="pt-2 border-t border-border/50 text-[11px] space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Masa Aktif Hingga:</span>
                  <span className="font-semibold text-foreground font-mono">{orderSuccess.fullDisplay}</span>
                </div>
                <div className="flex justify-between">
                  <span>ID Pesanan:</span>
                  <span className="font-mono text-[10px] text-foreground">{orderSuccess.orderId}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <Button
                onClick={() => window.open('https://www.netflix.com/login', '_blank')}
                className="w-full h-12 rounded-xl text-sm font-bold gap-2 shadow-lg bg-red-600 hover:bg-red-500 text-white cursor-pointer"
              >
                <span>Buka Netflix Sekarang</span>
                <ExternalLink className="size-4" />
              </Button>

              <Button
                type="button"
                onClick={() => navigate(`/checkout?extendOrderId=${orderSuccess.orderId}`)}
                className="w-full h-11 rounded-xl text-xs font-bold gap-2 border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer shadow-xs transition-colors"
              >
                <Zap className="size-4 text-amber-500 fill-amber-500" />
                <span>Perpanjang Durasi Sewa Profil Ini</span>
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyAll}
                  className="h-10 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  {copiedField === 'all' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  <span>{copiedField === 'all' ? 'Tersalin!' : 'Salin Semua'}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadTicket}
                  className="h-10 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  <Download className="size-3.5 text-primary" />
                  <span>Download Tiket (.txt)</span>
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={() => navigate('/orders')}
                className="w-full h-10 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ← Kembali ke Beranda Profil
              </Button>
            </div>
          </div>

          {/* Quick 3-Step Guide Card */}
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm space-y-3 text-xs text-left">
            <h4 className="font-bold flex items-center gap-1.5 text-foreground">
              <Sparkles className="size-4 text-amber-500" />
              Panduan Login Netflix (3 Langkah Mudah):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="rounded-xl bg-muted/40 p-3 border border-border/50 space-y-1">
                <span className="font-bold text-primary block">1. Buka Netflix</span>
                <p className="text-[11px] text-muted-foreground">Kunjungi netflix.com atau buka aplikasi di HP/Smart TV Anda.</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3 border border-border/50 space-y-1">
                <span className="font-bold text-primary block">2. Masukkan Akun</span>
                <p className="text-[11px] text-muted-foreground">Ketik Email & Password yang tertera pada kotak di atas.</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3 border border-border/50 space-y-1">
                <span className="font-bold text-primary block">3. Pilih Profil & PIN</span>
                <p className="text-[11px] text-muted-foreground">Pilih profil <b className="text-foreground">{orderSuccess.profileName}</b> lalu masukkan PIN <b className="text-foreground">{orderSuccess.pin}</b>.</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 text-center">
              💾 <b>Otomatis Tersimpan:</b> Anda adalah tamu (guest). Data ini tersimpan di memori browser ini sehingga jika halaman ditutup, Anda tetap bisa membukanya kembali di web ini.
            </p>
          </div>

        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors selection:bg-primary/20 pb-24">
      <Toaster position="top-center" richColors closeButton />

      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-3.5 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/orders"
              onClick={() => releaseLock(profile?.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer shrink-0"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden xs:inline">Daftar Profil</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl bg-linear-to-br from-red-600 via-rose-600 to-pink-600 text-white font-black shadow-md shadow-red-500/20 shrink-0">
                <Tv className="size-4 sm:size-4.5" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold tracking-tight">
                  {extendOrder ? 'Perpanjang Sewa' : 'Checkout'}
                </h1>
                <p className="text-[11px] sm:text-xs text-muted-foreground hidden sm:block">
                  {extendOrder
                    ? `Tambah durasi masa aktif profil ${extendOrder.profileName}`
                    : 'Selesaikan pembayaran untuk akses profil'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!extendOrder && remainingLockMs > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-primary/25 bg-primary/10 text-primary text-xs font-semibold shadow-2xs">
                <Lock className="size-3 text-primary animate-pulse" />
                <span>Slot Direservasi: <strong className="font-mono">{reservationCountdownStr}</strong></span>
              </div>
            )}
            <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1">
              {extendOrder ? 'Perpanjangan' : 'Langkah 2: Bayar'}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Checkout Container */}
      <main className="mx-auto max-w-7xl px-3.5 py-6 sm:px-6 sm:py-8">
        {loadingProfile ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
            <div className="size-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
            <p className="text-xs font-medium text-muted-foreground">Memuat detail pesanan...</p>
          </div>
        ) : !profile ? (
          <div className="max-w-md mx-auto rounded-3xl border border-dashed border-border/80 p-10 text-center space-y-4">
            <Tv className="size-12 text-muted-foreground mx-auto stroke-1" />
            <div className="space-y-1">
              <h3 className="text-base font-bold">Belum Ada Profil yang Dipilih</h3>
              <p className="text-xs text-muted-foreground">
                Silakan pilih salah satu profil Netflix yang tersedia terlebih dahulu.
              </p>
            </div>
            <Button onClick={() => navigate('/orders')} className="rounded-xl text-xs gap-1.5 font-semibold">
              <ArrowLeft className="size-3.5" />
              <span>Pilih Profil Sekarang</span>
            </Button>
          </div>
        ) : !extendOrder && !orderIdParam && isLockedByOther(profile.id) ? (
          <div className="max-w-md mx-auto rounded-3xl border border-amber-500/40 bg-card p-6 sm:p-8 text-center space-y-5 shadow-lg animate-in fade-in-50">
            <div className="size-16 rounded-3xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
              <Lock className="size-8" />
            </div>
            <div className="space-y-1.5">
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold px-2.5 py-0.5 text-[10px]">
                Real-Time Checkout Lock
              </Badge>
              <h3 className="text-lg font-bold tracking-tight">Profil Sedang Dipesan</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Profil <strong className="text-foreground">{profile.name}</strong> saat ini sedang dalam proses checkout dan pembayaran oleh pengguna lain.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">Sisa Waktu Reservasi Pengguna Lain:</div>
              <div className="font-mono text-2xl font-black text-amber-600 dark:text-amber-400">
                {(() => {
                  const otherLock = getLock(profile.id)
                  const remMs = otherLock ? Math.max(0, otherLock.expiresAt - now) : 0
                  const m = Math.floor(remMs / 60000)
                  const s = Math.floor((remMs % 60000) / 1000)
                  return `${m}:${s < 10 ? `0${s}` : s}`
                })()}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Profil akan otomatis terbuka kembali jika pengguna tersebut membatalkan atau waktu reservasi habis.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                onClick={() => navigate('/orders')}
                className="w-full h-11 rounded-2xl text-xs font-bold gap-2 bg-primary text-primary-foreground cursor-pointer shadow-sm"
              >
                <ArrowLeft className="size-4" />
                <span>Pilih Profil Lain yang Tersedia</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => window.location.reload()}
                className="w-full h-10 rounded-2xl text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <RefreshCw className="size-3.5 mr-1.5" />
                Cek Ulang Ketersediaan
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Customer Form & Payment Details (8 cols) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              {/* Stepper Indicator */}
              <div className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm p-3.5 shadow-2xs">
                <div className="flex items-center justify-between gap-1 sm:gap-2">
                  {[
                    { step: 1, label: 'Data Diri', active: true, done: Boolean(customerName.trim()) },
                    { step: 2, label: 'Durasi', active: true, done: true },
                    { step: 3, label: 'Bayar QRIS', active: true, done: Boolean(receiptImage) },
                    { step: 4, label: 'Verifikasi', active: Boolean(receiptImage), done: Boolean(verificationResult?.approved) },
                  ].map((s, idx) => (
                    <div key={s.step} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <div
                        className={`flex size-6 sm:size-7 items-center justify-center rounded-xl text-[11px] font-bold shrink-0 transition-all ${
                          s.done
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : s.active
                            ? 'bg-primary/15 text-primary border border-primary/30'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {s.done ? <Check className="size-3.5 stroke-3" /> : s.step}
                      </div>
                      <span
                        className={`text-[11px] sm:text-xs font-semibold truncate ${
                          s.done ? 'text-foreground' : s.active ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {s.label}
                      </span>
                      {idx < 3 && (
                        <div className="w-3 sm:w-8 h-0.5 bg-border/80 mx-1 rounded-full shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Reservation Lock Banner for Current User */}
              {!extendOrder && remainingLockMs > 0 && (
                <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-center gap-2 text-foreground min-w-0">
                    <div className="size-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                    <span className="truncate">
                      Profil <b>{profile.name}</b> sedang <b>dikunci khusus untuk Anda</b> selama checkout.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-primary shrink-0 bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                    <Clock3 className="size-3.5" />
                    <span>{reservationCountdownStr}</span>
                  </div>
                </div>
              )}

              {/* Mode Perpanjangan Sewa Banner */}
              {extendOrder && (
                <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Zap className="size-5 text-amber-500 fill-amber-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Mode Perpanjangan Sewa Aktif</h3>
                        <p className="text-xs text-muted-foreground">
                          Memperpanjang sewa profil <strong className="text-foreground">{extendOrder.profileName}</strong> tanpa ganti akun & PIN
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 text-xs font-bold px-2.5 py-1">
                      Profil #{extendOrder.profileName}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
                    <div className="rounded-2xl bg-card/80 border border-border/60 p-3 space-y-1">
                      <span className="text-[11px] text-muted-foreground block font-medium">Masa Aktif Saat Ini:</span>
                      <span className="font-mono text-xs font-bold text-foreground block">
                        {extendOrder.fullDisplay}
                      </span>
                    </div>
                    <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/30 p-3 space-y-1">
                      <span className="text-[11px] text-emerald-800 dark:text-emerald-200 block font-medium">Masa Aktif Baru Nanti (+{PACKAGES[selectedPackage].days} Hari):</span>
                      <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-300 block">
                        {dynamicExpiry.fullDisplayWithSeconds}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground border-t border-emerald-500/20 pt-2 flex items-center gap-1.5">
                    <span>💡</span>
                    <span><b>Akumulasi Otomatis:</b> Sisa jam sewa yang masih berjalan tidak hangus, melainkan langsung ditambahkan paket baru.</span>
                  </p>
                </div>
              )}

              {/* Step 1: Customer Form */}
              <div className="rounded-3xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                      1
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Data Diri Pemesan</h3>
                    </div>
                  </div>
                  {customerName.trim() ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold gap-1">
                      <Check className="size-2.5 stroke-3" />
                      <span>Terisi</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/70">
                      Wajib Diisi
                    </Badge>
                  )}
                </div>

                <div className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5 font-semibold text-foreground">
                      <User className="size-3.5 text-primary" />
                      Nama Lengkap Pemesan *
                    </Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Masukkan nama lengkap Anda (contoh: Jovan Pratama)"
                      className="h-10 text-xs rounded-xl bg-background/60 focus-visible:ring-primary/30"
                    />
                  </div>

                  <div className="space-y-1.5 pt-0.5">
                    <Label className="text-xs text-muted-foreground font-medium">Catatan Tambahan (Opsional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Contoh: Request nama profil atau instruksi lainnya..."
                      rows={2}
                      className="text-xs rounded-xl font-sans bg-background/60 resize-none focus-visible:ring-primary/30"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-muted-foreground font-medium">Rekomendasi cepat:</span>
                      {[
                        'Request nama profil',
                        'Tanpa PIN profil',
                        'Kirim kredensial via WA',
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            setNotes((prev) => (prev ? `${prev}, ${chip}` : chip))
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Selection of Duration / Package */}
              <div id="step-duration" className="rounded-3xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                      2
                    </div>
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                        <Clock3 className="size-4 text-primary" />
                        Pilihan Paket Durasi
                      </h3>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] bg-primary/10 text-primary border-primary/20 font-semibold">
                    5 Pilihan Durasi
                  </Badge>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Pilih durasi sewa akun Netflix yang sesuai dengan rencana menonton Anda:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {(Object.keys(PACKAGES) as PackageType[]).map((pkgKey) => {
                      const item = PACKAGES[pkgKey]
                      const active = selectedPackage === pkgKey
                      const meta = PACKAGE_METADATA[pkgKey]

                      return (
                        <button
                          key={pkgKey}
                          type="button"
                          onClick={() => {
                            setSelectedPackage(pkgKey)
                            if (receiptImage && !verifying) {
                              toast.info(`Paket diubah ke ${item.label}. Memverifikasi ulang bukti transfer...`)
                              handleVerifyReceipt(receiptImage, pkgKey)
                            }
                          }}
                          className={`rounded-2xl p-3.5 sm:p-4 text-left border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between group select-none ${
                            active
                              ? 'border-primary bg-primary/8 shadow-md shadow-primary/10 ring-2 ring-primary/20 -translate-y-0.5'
                              : 'border-border/70 hover:border-primary/40 bg-card hover:bg-muted/30 hover:-translate-y-0.5'
                          }`}
                        >
                          {/* Card Header: Duration & Badge */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                                {item.label}
                              </span>
                              {meta.badge ? (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shadow-2xs ${meta.badgeColor}`}
                                >
                                  {meta.badge}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {item.days}h
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 leading-tight">
                              {meta.description}
                            </p>
                          </div>

                          {/* Card Footer: Price & Check Icon */}
                          <div className="mt-3 pt-2.5 border-t border-border/50 flex items-baseline justify-between">
                            <div>
                              <span className="font-mono text-base font-black text-primary block leading-none">
                                {formatRupiah(item.price)}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono mt-1 block">
                                {meta.perDay}
                              </span>
                            </div>
                            <div
                              className={`size-5 rounded-full border flex items-center justify-center transition-all ${
                                active
                                  ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                                  : 'border-border/80 group-hover:border-primary/40'
                              }`}
                            >
                              {active && <Check className="size-3 stroke-3" />}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-muted/30 border border-border/60 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <Calendar className="size-3.5" />
                      </div>
                      <span>
                        {extendOrder ? 'Masa aktif baru menjadi: ' : 'Masa aktif berlaku s/d '}
                        <strong className="text-foreground font-semibold">
                          {dynamicExpiry.fullDisplayWithSeconds}
                        </strong>
                        {extendOrder && (
                          <span className="ml-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            (+{PACKAGES[selectedPackage].days} Hari)
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      {extendOrder ? '✓ Sisa Jam Tidak Hangus' : '✓ Garansi Penuh Anti On-Hold'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3: QRIS Payment */}
              <div className="rounded-3xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                      3
                    </div>
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                        <QrCode className="size-4 text-primary" />
                        Pembayaran via QRIS
                      </h3>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold">
                    Semua Bank & E-Wallet
                  </Badge>
                </div>

                <div className="space-y-5">
                  {/* Top Info Grid: Unified Payment Details Card */}
                  <div className="rounded-2xl border border-border/80 bg-linear-to-br from-card via-card to-muted/20 p-4 sm:p-5 shadow-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
                      {/* Nominal */}
                      <div className="space-y-1.5 sm:pr-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                            Nominal Transfer Persis
                          </span>
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                            Wajib Sesuai
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="font-mono text-2xl sm:text-3xl font-black text-primary">
                            {formatRupiah(packagePrice)}
                          </span>
                          <span className="text-xs text-muted-foreground font-semibold">
                            ({PACKAGES[selectedPackage].label})
                          </span>
                        </div>
                        <div className="pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCopyAmount}
                            className="rounded-xl text-xs gap-1.5 h-8 font-semibold cursor-pointer shadow-xs bg-card hover:bg-muted"
                          >
                            {copiedAmount ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                            <span>{copiedAmount ? 'Tersalin' : 'Salin Nominal'}</span>
                          </Button>
                        </div>
                      </div>

                      {/* Merchant / Atas Nama */}
                      <div className="space-y-1.5 pt-3 sm:pt-0 sm:pl-6">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                            Merchant Penerima
                          </span>
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold">
                            ✓ QRIS Sah
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          <span className="font-mono text-base font-black text-foreground bg-muted/80 px-3 py-1 rounded-xl border border-border/70 shadow-2xs">
                            T*** R**** A******
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            (TOKO R**** A******)
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground pt-0.5 leading-relaxed">
                          *Nama merchant resmi (TOKO RISMA AMALINA) otomatis terverifikasi di aplikasi bank / e-wallet Anda.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Middle Section: Big Centered QRIS Image */}
                  <div className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-muted/20 border border-border/60 text-center space-y-4">
                    <div className="relative group max-w-[360px] w-full">
                      <div className="overflow-hidden rounded-3xl border-2 border-primary/25 bg-white p-3.5 shadow-xl transition-transform duration-200 hover:scale-[1.01]">
                        <img
                          src={qrisImg}
                          alt="QRIS Netriztama - Toko Risma Amalina"
                          className="w-full h-auto aspect-square object-contain rounded-2xl mx-auto"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-[360px]">
                      <a
                        href={qrisImg}
                        download="QRIS-Netriztama-Toko-Risma-Amalina.jpg"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-primary hover:text-primary/90 transition-colors bg-primary/10 hover:bg-primary/20 px-5 py-3 rounded-2xl border border-primary/20 shadow-xs"
                      >
                        <Download className="size-4" />
                        <span>Simpan / Unduh Gambar QRIS</span>
                      </a>
                    </div>
                  </div>

                  {/* Bottom Section: Langkah Pembayaran */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Zap className="size-3.5 text-primary" />
                      <span className="font-bold text-foreground text-xs">
                        Panduan Pembayaran QRIS:
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                      <div className="rounded-xl p-3 bg-card/70 border border-border/50 space-y-1 shadow-2xs">
                        <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-[10px]">1</span>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Buka <b>M-Banking / E-Wallet</b> Anda & pilih menu <b>Scan QRIS</b>.
                        </p>
                      </div>
                      <div className="rounded-xl p-3 bg-card/70 border border-border/50 space-y-1 shadow-2xs">
                        <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-[10px]">2</span>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Scan QR & pastikan nominal persis <b>{formatRupiah(packagePrice)}</b>.
                        </p>
                      </div>
                      <div className="rounded-xl p-3 bg-card/70 border border-border/50 space-y-1 shadow-2xs">
                        <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-[10px]">3</span>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Screenshot bukti transfer & upload di <b>Langkah 4</b> di bawah.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4: Upload Proof & Auto Verification */}
              <div className="rounded-3xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                      4
                    </div>
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                        <CreditCard className="size-4 text-primary" />
                        Unggah Bukti Pembayaran
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold gap-1">
                      <Sparkles className="size-3" />
                      <span>Verifikasi AI Otomatis</span>
                    </Badge>
                    {receiptImage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReceiptImage('')
                          setVerificationResult(null)
                        }}
                        className="text-xs h-7 text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        Hapus
                      </Button>
                    )}
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleProcessReceipt(e.target.files[0])
                    }
                  }}
                />

                {!receiptImage ? (
                  <div
                    onDragEnter={(e) => {
                      e.preventDefault()
                      setDragActive(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setDragActive(false)
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragActive(false)
                      if (e.dataTransfer.files?.[0]) handleProcessReceipt(e.dataTransfer.files[0])
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition ${
                      dragActive ? 'border-primary bg-primary/10' : 'border-border/70 hover:border-primary/60 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3 shadow-inner">
                      <Upload className="size-6" />
                    </div>
                    <p className="text-sm font-semibold">Tarik & Lepas Foto Bukti Pembayaran di Sini</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      atau klik untuk memilih file gambar dari perangkat
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
                      <span>💡 Tips: Tekan</span>
                      <kbd className="rounded bg-background px-1.5 py-0.5 border shadow-xs text-foreground font-semibold">
                        Ctrl + V
                      </kbd>
                      <span>untuk paste screenshot</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative group overflow-hidden rounded-2xl border border-border/80 bg-black/5 dark:bg-black/40">
                      <img
                        src={receiptImage}
                        alt="Bukti Transfer"
                        className="w-full max-h-72 object-contain rounded-xl mx-auto"
                      />
                    </div>

                    {/* Status penyimpanan bukti transfer ke server */}
                    {receiptUploading && (
                      <p className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
                        <span className="size-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        Menyimpan foto bukti transfer ke server...
                      </p>
                    )}
                    {!receiptUploading && receiptUrl && (
                      <p className="text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        ✓ Bukti transfer tersimpan di server
                      </p>
                    )}
                    {!receiptUploading && receiptUploadError && (
                      <p className="text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
                        ⚠️ {receiptUploadError}. Coba unggah ulang foto bukti transfer.
                      </p>
                    )}

                    {/* Verifying Loader */}
                    {verifying && (
                      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 sm:p-5 text-center space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-center gap-2">
                          <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          <span className="text-xs sm:text-sm font-bold text-foreground">
                            Memverifikasi Bukti Transfer Otomatis dengan AI...
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                          Sistem sedang mengekstrak status transfer, nominal uang, nomor referensi, serta nama pengirim dan penerima dari gambar.
                        </p>
                        <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full animate-pulse w-3/4 mx-auto" />
                        </div>
                      </div>
                    )}

                    {/* Verification Result Structured JSON Card */}
                    {!verifying && verificationResult && (
                      <div
                        className={`rounded-3xl border p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200 shadow-sm ${
                          verificationResult.approved
                            ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20'
                            : 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20'
                        }`}
                      >
                        {/* Header Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                          <div className="flex items-center gap-3">
                            {verificationResult.approved ? (
                              <div className="flex size-9 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
                                <CheckCircle2 className="size-5" />
                              </div>
                            ) : (
                              <div className="flex size-9 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                                <AlertCircle className="size-5" />
                              </div>
                            )}
                            <div>
                              <h4 className="text-sm font-bold text-foreground">
                                {verificationResult.approved
                                  ? 'Bukti Pembayaran Valid & Terverifikasi ✓'
                                  : 'Bukti Pembayaran Perlu Diperiksa ⚠️'}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {verificationResult.approved
                                  ? 'Data transfer sesuai tagihan sewa dan transaksi berstatus berhasil.'
                                  : 'Status transaksi atau nominal transfer belum sepenuhnya sesuai ketentuan.'}
                              </p>
                            </div>
                          </div>

                          <Badge
                            className={`text-xs px-3 py-1 font-bold self-start sm:self-auto ${
                              verificationResult.approved
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-amber-600 text-white border-amber-600'
                            }`}
                          >
                            {verificationResult.status || (verificationResult.approved ? 'BERHASIL' : 'MENUNGGU')}
                          </Badge>
                        </div>

                        {/* JSON Mapped Fields Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                          {/* Nominal */}
                          <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-1 shadow-2xs">
                            <span className="text-[10px] text-muted-foreground block font-medium">Nominal Transfer:</span>
                            <span className="font-mono text-base font-bold text-foreground block">
                              {formatRupiah(verificationResult.amount)}
                            </span>
                            <div>
                              {verificationResult.amount_matches ? (
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  ✓ Sesuai Tagihan
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                  ⚠️ Tagihan: {formatRupiah(packagePrice)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Penerima */}
                          <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-1 shadow-2xs">
                            <span className="text-[10px] text-muted-foreground block font-medium">Penerima (Merchant):</span>
                            <span className="font-bold text-xs text-foreground truncate block">
                              {verificationResult.receiver_name}
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                              ✓ Merchant Sah
                            </span>
                          </div>

                          {/* Pengirim */}
                          <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-1 shadow-2xs">
                            <span className="text-[10px] text-muted-foreground block font-medium">Pengirim:</span>
                            <span className="font-bold text-xs text-foreground truncate block">
                              {verificationResult.sender_name || '-'}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">Akun Sumber</span>
                          </div>

                          {/* Metode / E-Wallet */}
                          <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-1 shadow-2xs">
                            <span className="text-[10px] text-muted-foreground block font-medium">Metode Pembayaran:</span>
                            <span className="font-bold text-xs text-foreground block">
                              {verificationResult.payment_method || 'QRIS'}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">Kanal Transfer</span>
                          </div>

                          {/* Tanggal & Waktu */}
                          <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-1 shadow-2xs">
                            <span className="text-[10px] text-muted-foreground block font-medium">Waktu Transaksi:</span>
                            <span className="font-mono text-xs font-semibold text-foreground truncate block">
                              {verificationResult.transaction_date || '-'}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">Tercatat di Bukti</span>
                          </div>

                          {/* Referensi */}
                          <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-1 shadow-2xs">
                            <span className="text-[10px] text-muted-foreground block font-medium">No. Referensi / ID:</span>
                            <span className="font-mono text-xs text-foreground truncate block">
                              {verificationResult.reference_id || '-'}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">ID Transaksi</span>
                          </div>
                        </div>

                        {/* AI Summary note */}
                        {verificationResult.summary && (
                          <div className="rounded-2xl border border-border/60 bg-card p-3.5 text-xs space-y-1 shadow-2xs">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                              Catatan Analisis AI:
                            </span>
                            <p className="text-xs text-foreground leading-relaxed">
                              {verificationResult.summary}
                            </p>
                          </div>
                        )}

                        {/* Actions footer */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-muted-foreground">
                            Otomasi verifikasi AI selesai
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={verifying}
                            onClick={() => handleVerifyReceipt()}
                            className="text-xs h-8 gap-1.5 font-semibold hover:bg-muted text-primary cursor-pointer"
                          >
                            <RefreshCw className={`size-3.5 ${verifying ? 'animate-spin' : ''}`} />
                            <span>Verifikasi Ulang</span>
                          </Button>
                        </div>
                      </div>
                    )}

                    {!verifying && !verificationResult && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleVerifyReceipt()}
                        className="w-full h-10 rounded-xl text-xs font-semibold gap-1.5 border-primary/40 text-primary hover:bg-primary/10 cursor-pointer"
                      >
                        <Zap className="size-3.5" />
                        <span>Jalankan Verifikasi Otomatis</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Sticky Order Summary (4 cols) */}
            <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 space-y-4">
              <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <h3 className="text-sm font-bold">
                    {extendOrder ? 'Ringkasan Perpanjangan' : 'Ringkasan Pesanan'}
                  </h3>
                  <Badge variant="outline" className={`text-[10px] font-semibold ${
                    extendOrder
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  }`}>
                    {extendOrder ? 'Perpanjangan' : 'Ready'}
                  </Badge>
                </div>

                {/* Profile Card Header */}
                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-red-600 to-rose-600 text-white font-black text-base shadow-sm">
                    {profile.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold truncate text-foreground">{profile.name}</h4>
                      <span className="text-[10px] bg-red-600/10 text-red-600 dark:text-red-400 font-bold px-1.5 py-0.5 rounded">4K UHD</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Profil Netflix Private</p>
                  </div>
                </div>

                {/* Unified Receipt Breakdown */}
                <div className="space-y-3 pt-1 text-xs">
                  {/* Paket Durasi Item */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/60">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Clock3 className="size-3.5 text-primary" />
                        <span className="font-bold text-foreground">
                          {extendOrder ? `Perpanjang ${PACKAGES[selectedPackage].label}` : PACKAGES[selectedPackage].label}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground block">
                        {extendOrder
                          ? `Tambah durasi +${PACKAGES[selectedPackage].days} hari profil ${profile.name}`
                          : `${PACKAGE_METADATA[selectedPackage].description} (${PACKAGES[selectedPackage].days} Hari)`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-foreground block">
                        {formatRupiah(packagePrice)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          document.getElementById('step-duration')?.scrollIntoView({ behavior: 'smooth' })
                        }}
                        className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                      >
                        Ubah Paket
                      </button>
                    </div>
                  </div>

                  {/* Masa Aktif */}
                  <div className="flex items-center justify-between px-1 text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-primary" />
                      {extendOrder ? 'Masa Aktif Baru' : 'Masa Aktif'}
                    </span>
                    <span className="font-semibold text-foreground font-mono text-[11px]">
                      {dynamicExpiry.fullDisplayWithSeconds}
                    </span>
                  </div>

                  {/* Biaya Layanan */}
                  <div className="flex items-center justify-between px-1 text-muted-foreground">
                    <span>Biaya Layanan Admin</span>
                    <span className="text-emerald-600 font-semibold">Gratis (Rp 0)</span>
                  </div>

                  {/* Total Tagihan */}
                  <div className="flex items-baseline justify-between pt-3 border-t border-border/60 px-1">
                    <span className="text-sm font-bold text-foreground">
                      {extendOrder ? 'Total Biaya Perpanjangan' : 'Total Tagihan'}
                    </span>
                    <span className="font-mono text-2xl font-black text-primary">
                      {formatRupiah(packagePrice)}
                    </span>
                  </div>
                </div>

                {/* Submit Action Button */}
                <div className="pt-2">
                  {(() => {
                    const isApproved = Boolean(verificationResult?.approved)
                    const isCanProceed =
                      !submittingOrder &&
                      !verifying &&
                      !receiptUploading &&
                      Boolean(receiptImage) &&
                      isApproved &&
                      Boolean(customerName.trim())
                    const isButtonDisabled = !isCanProceed

                    return (
                      <>
                        <Button
                          type="button"
                          onClick={handleSubmitOrder}
                          disabled={isButtonDisabled}
                          className={`w-full h-12 rounded-2xl text-sm font-bold shadow-md gap-2 transition-all ${
                            !isButtonDisabled
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25 ring-2 ring-emerald-400/30 cursor-pointer'
                              : 'cursor-not-allowed opacity-50 bg-muted text-muted-foreground border border-border/60 hover:bg-muted'
                          }`}
                        >
                          {submittingOrder ? (
                            <>
                              <RefreshCw className="size-4 animate-spin" />
                              <span>{extendOrder ? 'Menyimpan Perpanjangan...' : 'Memproses Pesanan...'}</span>
                            </>
                          ) : verifying || receiptUploading ? (
                            <>
                              <RefreshCw className="size-4 animate-spin" />
                              <span>{verifying ? 'Verifikasi Bukti Transfer...' : 'Menyimpan Bukti...'}</span>
                            </>
                          ) : (
                            <>
                              <span>{extendOrder ? 'Konfirmasi Perpanjangan Sewa' : 'Lanjut'}</span>
                              <ArrowRight className="size-4" />
                            </>
                          )}
                        </Button>

                        <div className="mt-2.5 space-y-1.5 text-center">
                          {verifying && (
                            <p className="text-[11px] text-amber-500 dark:text-amber-400 font-medium flex items-center justify-center gap-1.5 animate-pulse">
                              <RefreshCw className="size-3 animate-spin" />
                              <span>Sedang memverifikasi bukti transfer... Tombol dinonaktifkan sementara.</span>
                            </p>
                          )}

                          {!verifying && receiptUploading && (
                            <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                              <RefreshCw className="size-3 animate-spin" />
                              <span>Menyimpan foto bukti transfer ke server...</span>
                            </p>
                          )}

                          {!verifying && !receiptUploading && receiptImage && verificationResult?.approved && receiptUploadError && (
                            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2 text-center text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              ⚠️ Bukti transfer belum tersimpan di server ({receiptUploadError}). Unggah ulang fotonya supaya admin bisa melihatnya.
                            </div>
                          )}

                          {!verifying && receiptImage && verificationResult && !verificationResult.approved && (
                            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2 text-center text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              ⚠️ Bukti pembayaran tidak sesuai ({verificationResult.summary || 'nominal atau penerima tidak cocok'}). Tombol dinonaktifkan sampai bukti valid.
                            </div>
                          )}

                          {!verifying && !receiptImage && (
                            <p className="text-[11px] text-muted-foreground">
                              Unggah bukti pembayaran pada Langkah 4 untuk melanjutkan.
                            </p>
                          )}

                          {!verifying && receiptImage && verificationResult?.approved && !customerName.trim() && (
                            <p className="text-[11px] text-amber-500 dark:text-amber-400 font-medium">
                              Harap isi Nama Lengkap Pemesan pada Langkah 1 untuk melanjutkan.
                            </p>
                          )}

                          {!verifying && receiptImage && verificationResult?.approved && customerName.trim() && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                              <CheckCircle2 className="size-3.5" />
                              <span>Bukti transfer valid! Klik Lanjut untuk menyelesaikan pesanan.</span>
                            </p>
                          )}

                          <p className="text-[10px] text-muted-foreground">
                            🔒 Akses akun resmi & garansi full durasi anti on-hold
                          </p>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
