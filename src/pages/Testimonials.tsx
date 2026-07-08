import { useState } from 'react'
import { Quote, Star, ArrowRight, ChevronLeft, ChevronRight, Heart, Sparkles, Send, X } from 'lucide-react'
import desktopBg from '@/assets/desktop.png'
import portraitBg from '@/assets/potrait.png'

type Testimonial = {
  quote: string
  stars: number
  name?: string
  anonymous?: boolean
}

const STATS = [
  { value: '4.9', label: 'Rating sewa profil', emoji: '⭐' },
  { value: '200+', label: 'Profil Netflix aktif', emoji: '📺' },
  { value: '98%', label: 'Repeat order', emoji: '💖' },
] as const

const FEATURED: Testimonial = {
  quote:
    'Sewa profil Netflix di sini paling aman sejauh ini. Dikasih profil sendiri, PIN dibantu set, terus kalau ada kendala adminnya gercep banget. Cocok buat yang mau nonton tanpa drama.',
  name: 'Naya',
  stars: 5,
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Aku sewa profil Netflix buat maraton drakor weekend. Prosesnya cepet, profilnya langsung ready, dan nggak rebutan history tontonan orang lain.',
    name: 'Acha',
    stars: 5,
  },
  {
    quote:
      'Awalnya takut akun sharing ribet, tapi ini dikasih arahan sampai login. PIN profil juga aman, jadi wishlist tontonan aku nggak kecampur.',
    anonymous: true,
    stars: 5,
  },
  {
    quote:
      'Bayar, konfirmasi, langsung dikirim detail profilnya. Literally sat set banget buat yang pengen nonton malam itu juga.',
    name: 'Lala',
    stars: 5,
  },
  {
    quote:
      'Suka karena adminnya nggak judes. Aku nanya soal pindah device juga dijelasin pelan-pelan sampai bisa masuk Netflix lagi.',
    name: 'Mira',
    stars: 5,
  },
  {
    quote:
      'Harga masuk akal buat profil Netflix private. Udah langganan beberapa kali dan sejauh ini aman terus.',
    anonymous: true,
    stars: 5,
  },
  {
    quote:
      'Yang paling penting: responnya cepat pas profilku minta refresh. Nggak ditinggal setelah transfer, jadi tenang.',
    name: 'Vely',
    stars: 5,
  },
]

const PROOF_IMAGES = [
  {
    src: 'blob:https://web.whatsapp.com/eddbdb4f-ad93-4567-b8f6-8d96928dc4df',
    alt: 'Screenshot bukti transaksi sewa profil Netflix 1',
  },
  {
    src: 'blob:https://web.whatsapp.com/1e45569f-69b8-4799-87ba-88b05ed8ebad',
    alt: 'Screenshot chat pelanggan sewa profil Netflix 2',
  },
  {
    src: 'blob:https://web.whatsapp.com/9718291c-e191-4417-b413-e1758b9b6b10',
    alt: 'Screenshot bukti transaksi sewa profil Netflix 3',
  },
  {
    src: 'blob:https://web.whatsapp.com/f106ada4-e470-4a17-b767-24a4aed3c1d0',
    alt: 'Screenshot chat pelanggan sewa profil Netflix 4',
  },
] as const

// ── tiny helpers ──────────────────────────────────────────────

function getIdentity({ name, anonymous }: Pick<Testimonial, 'name' | 'anonymous'>) {
  return anonymous || !name?.trim() ? 'Anonymous' : name
}

function IdentityAvatar({ label, size = 'md' }: { label: string; size?: 'sm' | 'md' }) {
  const dims = { sm: 'size-9 text-sm', md: 'size-12 text-base' }
  const initials = label === 'Anonymous'
    ? '♡'
    : label
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

  return (
    <div
      className={`${dims[size]} flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-red-400 via-pink-400 to-fuchsia-300 font-black text-white shadow-sm shadow-pink-300/50 ring-4 ring-white/80`}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

function StarRating({ stars }: { stars: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${stars} dari 5 bintang`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < stars ? 'fill-amber-300 text-amber-300' : 'text-rose-200'}`}
        />
      ))}
    </div>
  )
}

const CARD_TAPES = [
  'left-8 -top-3 rotate-[-7deg] bg-pink-200/80',
  'right-8 -top-3 rotate-[6deg] bg-red-200/80',
  'left-1/2 -top-3 -translate-x-1/2 rotate-[3deg] bg-fuchsia-200/80',
] as const

function TestimonialCard({ quote, stars, index, ...author }: Testimonial & { index: number }) {
  const identity = getIdentity(author)

  return (
    <article className="group relative isolate flex min-h-64 flex-col overflow-visible rounded-[1.75rem] border border-pink-100/80 bg-[#fffafc] p-6 shadow-[0_18px_45px_rgba(244,114,182,0.18)] transition-all duration-300 hover:-translate-y-1 hover:rotate-[-0.6deg] hover:shadow-[0_24px_65px_rgba(229,9,20,0.16)] motion-reduce:transform-none">
      <div className={`absolute h-8 w-28 rounded-[0.55rem] shadow-sm shadow-pink-200/40 ${CARD_TAPES[index % CARD_TAPES.length]}`} />
      <div
        className="absolute inset-3 -z-10 rounded-[1.4rem] opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(244,114,182,.24) 1px, transparent 1.4px)',
          backgroundSize: '15px 15px',
        }}
      />
      <div className="absolute -right-3 top-9 flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="size-4 rounded-full bg-[#fef6f9] shadow-inner shadow-pink-200/50" />
        ))}
      </div>
      <div className="relative mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IdentityAvatar label={identity} size="sm" />
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-black tracking-tight text-stone-700">{identity}</div>
          </div>
        </div>
        <span className="text-2xl leading-none text-red-300" aria-hidden="true">♡</span>
      </div>
      <p className="relative flex-1 text-[0.95rem] leading-7 text-stone-600">“{quote}”</p>
      <div className="relative mt-6 flex items-center justify-between border-t border-pink-100/80 pt-4">
        <StarRating stars={stars} />
        <span className="font-serif text-3xl leading-none text-red-200" aria-hidden="true">N</span>
      </div>
    </article>
  )
}

function ProofImageCard({ image, index }: { image: (typeof PROOF_IMAGES)[number]; index: number }) {
  const tilt = ['-rotate-1', 'rotate-[1.25deg]', 'rotate-[-0.5deg]', 'rotate-[0.75deg]'][index % 4]

  return (
    <figure className={`relative mb-6 break-inside-avoid rounded-[2rem] bg-white/85 p-3 shadow-xl shadow-pink-200/35 backdrop-blur-sm ${tilt} motion-reduce:rotate-0`}>
      <div className={`absolute left-1/2 top-0 h-7 w-24 -translate-x-1/2 -translate-y-1/2 rounded-[0.55rem] ${CARD_TAPES[index % CARD_TAPES.length]} shadow-sm shadow-pink-200/40`} />
      <img
        src={image.src}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full rounded-[1.45rem] border border-pink-100/70 object-contain"
      />
    </figure>
  )
}

function SubmitTestimonial() {
  const [open, setOpen] = useState(false)
  const [anonymous, setAnonymous] = useState(true)
  const [name, setName] = useState('')
  const [quote, setQuote] = useState('')
  const [stars, setStars] = useState(5)
  const [sent, setSent] = useState(false)

  const reset = () => {
    setAnonymous(true)
    setName('')
    setQuote('')
    setStars(5)
    setSent(false)
  }

  const hasIdentity = anonymous || name.trim()
  const canSubmit = hasIdentity && quote.trim().length >= 10

  const submit = (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!canSubmit) return
    // ponytail: no backend yet — just show success inline
    setSent(true)
  }

  if (!open) {
    return (
      <div className="text-center">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl border-2 border-dashed border-pink-300/70 bg-white/70 px-6 py-4 text-sm font-semibold text-pink-500 backdrop-blur-sm transition-all hover:border-pink-400 hover:bg-white/90 hover:shadow-md hover:shadow-pink-200/30"
        >
          <Heart className="size-4 fill-red-400 text-red-400" />
          Mau kasih testimoni sewa profil? Bisa anonim kok ✨
        </button>
      </div>
    )
  }

  if (sent) {
    return (
      <div className="rounded-[2rem] border-2 border-white/80 bg-white/85 p-8 text-center shadow-lg shadow-pink-200/30 backdrop-blur-sm">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-pink-100 text-3xl">
          💖
        </div>
        <p className="text-lg font-bold text-stone-700">Makasih banget ya!</p>
        <p className="mt-1 text-sm text-stone-400">Testimoni sewa profil kamu udah masuk ✨</p>
        <button
          onClick={() => { setOpen(false); reset() }}
          className="mt-5 text-sm font-medium text-pink-500 underline underline-offset-2 hover:text-pink-600"
        >
          Tulis lagi?
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[2rem] border-2 border-white/80 bg-white/85 p-6 shadow-lg shadow-pink-200/30 backdrop-blur-sm sm:p-8"
    >
      <div className="mb-5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-pink-500">
          <Sparkles className="size-4" />
          Tulis Testimoni
        </h3>
        <button
          type="button"
          onClick={() => { setOpen(false); reset() }}
          className="rounded-lg p-1 text-stone-300 transition-colors hover:bg-pink-100 hover:text-pink-400"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-pink-100 bg-pink-50/50 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-stone-600">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="size-4 accent-red-400"
            />
            Tampilkan sebagai Anonymous
          </label>
          {!anonymous && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-stone-500">Nama</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama kamu"
                className="w-full rounded-xl border border-pink-200 bg-white/70 px-3.5 py-2.5 text-sm text-stone-700 placeholder:text-stone-300 outline-none transition-colors focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20"
              />
            </label>
          )}
        </div>

        <div>
          <span className="mb-1 block text-xs font-semibold text-stone-500">Rating</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStars(i + 1)}
                className="rounded p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  className={`size-6 ${i < stars ? 'fill-amber-300 text-amber-300' : 'text-rose-200'}`}
                />
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-stone-500">Testimoni kamu *</span>
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            rows={4}
            placeholder="Ceritain pengalaman kamu sewa profil Netflix di Netriz..."
            className="w-full resize-none rounded-2xl border border-pink-200 bg-white/70 px-3.5 py-2.5 text-sm text-stone-700 placeholder:text-stone-300 outline-none transition-colors focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20"
          />
          {quote.length > 0 && quote.length < 10 && (
            <p className="mt-1 text-xs text-stone-300">Minimal 10 karakter ya ✍️</p>
          )}
          {!anonymous && !name.trim() && (
            <p className="mt-1 text-xs text-stone-300">Isi nama, atau aktifkan Anonymous.</p>
          )}
        </label>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-red-500 via-pink-500 to-fuchsia-400 py-3 text-sm font-bold text-white shadow-md shadow-pink-300/40 transition-all hover:from-red-600 hover:via-pink-600 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
      >
        <Send className="size-4" />
        Kirim Testimoni 💌
      </button>
    </form>
  )
}

function ProofWall() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <p className="text-sm font-black tracking-widest text-red-400 uppercase">Gallery transaksi</p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-stone-800 sm:text-3xl">
          Bukti chat & transaksi penyewa profil Netflix.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-stone-500">
          Layout Pinterest-style, gambar tampil utuh tanpa crop. Source sekarang pakai blob WhatsApp sesuai request.
        </p>
      </div>
      <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
        {PROOF_IMAGES.map((image, index) => (
          <ProofImageCard key={image.src} image={image} index={index} />
        ))}
      </div>
    </section>
  )
}

// ── page ──────────────────────────────────────────────────────

export default function Testimonials() {
  const [page, setPage] = useState(0)
  const perPage = 3
  const totalPages = Math.ceil(TESTIMONIALS.length / perPage)
  const visible = TESTIMONIALS.slice(page * perPage, (page + 1) * perPage)
  const featuredIdentity = getIdentity(FEATURED)

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fef6f9] text-stone-700">
      {/* ── full-viewport background images ──────────────────── */}
      <div className="pointer-events-none fixed inset-0 hidden lg:block">
        <img
          src={desktopBg}
          alt=""
          className="h-full w-full object-cover"
          aria-hidden
        />
      </div>
      <div className="pointer-events-none fixed inset-0 lg:hidden">
        <img
          src={portraitBg}
          alt=""
          className="h-full w-full object-cover"
          aria-hidden
        />
      </div>

      {/* floating cute decorations */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {[
          { icon: '✦', x: '5%', y: '15%', size: 'text-xl', delay: '0s', color: 'text-pink-300/40' },
          { icon: '✧', x: '92%', y: '22%', size: 'text-lg', delay: '1.5s', color: 'text-red-300/30' },
          { icon: '♥', x: '88%', y: '75%', size: 'text-2xl', delay: '0.8s', color: 'text-pink-400/25' },
          { icon: '✿', x: '8%', y: '65%', size: 'text-xl', delay: '2s', color: 'text-red-300/35' },
          { icon: '☆', x: '48%', y: '8%', size: 'text-lg', delay: '1.2s', color: 'text-pink-300/30' },
          { icon: '♪', x: '15%', y: '85%', size: 'text-lg', delay: '0.4s', color: 'text-pink-400/25' },
        ].map((d) => (
          <span
            key={d.x + d.y}
            className={`fixed animate-bounce motion-reduce:animate-none ${d.size} ${d.color}`}
            style={{
              left: d.x,
              top: d.y,
              animationDelay: d.delay,
              animationDuration: '3s',
            }}
          >
            {d.icon}
          </span>
        ))}
      </div>

      {/* ── hero ─────────────────────────────────────────────── */}
      <header className="relative px-4 pb-12 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* pill badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white/70 px-5 py-2 text-sm font-medium text-pink-500 backdrop-blur-sm">
            <Heart className="size-4 fill-red-400 text-red-400" />
            Testimoni Sewa Profil Netflix
          </div>

          {/* featured quote card */}
          <div className="relative mx-auto max-w-2xl overflow-hidden rounded-[2.25rem] border-2 border-white/80 bg-white/85 p-8 shadow-xl shadow-pink-200/35 backdrop-blur-sm sm:p-10">
            <div className="absolute left-8 top-0 h-4 w-32 rounded-b-full bg-linear-to-r from-red-200 via-pink-200 to-fuchsia-200" />
            <Quote className="mx-auto mb-4 size-10 rotate-[-8deg] text-red-300/80" />
            <blockquote className="text-pretty text-lg leading-relaxed text-stone-600 sm:text-xl">
              &ldquo;{FEATURED.quote}&rdquo;
            </blockquote>
            <div className="mt-6 flex items-center justify-center gap-3">
              <IdentityAvatar label={featuredIdentity} />
              <div className="text-left">
                <div className="font-semibold text-stone-700">{featuredIdentity}</div>
              </div>
            </div>
            <div className="mt-3 flex justify-center">
              <StarRating stars={FEATURED.stars} />
            </div>
          </div>

          {/* stats */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="mb-1 text-3xl font-extrabold tracking-tight text-stone-800 sm:text-4xl">
                  {s.value}
                </div>
                <div className="flex items-center justify-center gap-1.5 text-sm text-stone-400">
                  <span>{s.emoji}</span>
                  <span>{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── testimonial grid ─────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-pink-400 uppercase">
            <Sparkles className="size-4" />
            Pengalaman penyewa
          </h2>
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-stone-400 backdrop-blur-sm">
            {page + 1} / {totalPages}
          </span>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t, index) => (
            <TestimonialCard key={`${page}-${t.quote}`} {...t} index={index} />
          ))}
        </div>

        {totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination testimoni">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-2xl bg-white/75 p-3 text-stone-400 shadow-sm shadow-pink-100 transition-colors hover:bg-pink-50 hover:text-pink-500 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-current={page === i ? 'page' : undefined}
                className={`h-11 min-w-11 rounded-2xl px-4 text-sm font-black shadow-sm transition-all ${page === i
                  ? 'bg-red-400 text-white shadow-red-200'
                  : 'bg-white/75 text-pink-300 shadow-pink-100 hover:bg-pink-50 hover:text-pink-500'
                  }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-2xl bg-white/75 p-3 text-stone-400 shadow-sm shadow-pink-100 transition-colors hover:bg-pink-50 hover:text-pink-500 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="size-4" />
            </button>
          </nav>
        )}
      </section>

      <section className="relative mx-auto max-w-2xl px-4 pb-16 sm:px-6 lg:px-8">
        <SubmitTestimonial />
      </section>

      <ProofWall />

      {/* ── cta ──────────────────────────────────────────────── */}
      <footer className="relative border-t border-pink-200/50 px-4 py-24 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md">
          <p className="text-sm font-bold tracking-widest text-red-400 uppercase">
            💖 Siap nonton?
          </p>
          <p className="mt-4 text-2xl font-extrabold tracking-tight text-stone-800 sm:text-3xl">
            Pilih profil Netflix, bayar, lalu lanjut maraton tanpa ribet.
          </p>
          <a
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-red-500 via-pink-500 to-fuchsia-400 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-pink-300/40 transition-all hover:from-red-600 hover:via-pink-600 hover:to-fuchsia-500 hover:shadow-xl hover:shadow-pink-300/50 active:scale-[0.98]"
          >
            Pilih profil sekarang
            <ArrowRight className="size-4" />
          </a>
        </div>
      </footer>
    </div>
  )
}
