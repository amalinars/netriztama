import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Heart, MonitorPlay, Sparkles } from 'lucide-react'
import desktopBg from '@/assets/desktop.png'
import portraitBg from '@/assets/potrait.png'
import { getPublicProfileAvailability } from '@/lib/supabase'
import type { PublicProfileAvailability } from '@/types/database'

function formatTime(t?: string | null) {
  return (t ?? '23:59').slice(0, 5)
}

function deadlineMs(endDate: string, logoutTime?: string | null) {
  return new Date(`${endDate}T${formatTime(logoutTime)}:00`).getTime()
}

function formatCountdown(endDate: string, logoutTime?: string | null, now = Date.now()) {
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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function FloatingDecorations() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {[
        { icon: '✦', x: '5%', y: '15%', size: 'text-xl', delay: '0s', color: 'text-pink-300/40' },
        { icon: '✧', x: '92%', y: '22%', size: 'text-lg', delay: '1.5s', color: 'text-red-300/30' },
        { icon: '♥', x: '88%', y: '75%', size: 'text-2xl', delay: '0.8s', color: 'text-pink-400/25' },
        { icon: '✿', x: '8%', y: '65%', size: 'text-xl', delay: '2s', color: 'text-red-300/35' },
        { icon: '☆', x: '48%', y: '8%', size: 'text-lg', delay: '1.2s', color: 'text-pink-300/30' },
      ].map((d) => (
        <span
          key={d.x + d.y}
          className={`fixed animate-bounce motion-reduce:animate-none ${d.size} ${d.color}`}
          style={{ left: d.x, top: d.y, animationDelay: d.delay, animationDuration: '3s' }}
        >
          {d.icon}
        </span>
      ))}
    </div>
  )
}

function ProfileCard({ profile, now }: { profile: PublicProfileAvailability; now: number }) {
  const booked = profile.status === 'booked' && profile.currentOrder

  return (
    <article className="group relative overflow-visible rounded-[1.75rem] border border-pink-100/80 bg-[#fffafc] p-5 shadow-[0_18px_45px_rgba(244,114,182,0.18)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_65px_rgba(229,9,20,0.16)] motion-reduce:transform-none">
      <div className={`absolute left-8 -top-3 h-8 w-28 rounded-[0.55rem] ${booked ? 'rotate-[6deg] bg-red-200/80' : 'rotate-[-7deg] bg-pink-200/80'} shadow-sm shadow-pink-200/40`} />
      <div
        className="absolute inset-3 -z-10 rounded-[1.4rem] opacity-60"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(244,114,182,.24) 1px, transparent 1.4px)', backgroundSize: '15px 15px' }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex size-12 shrink-0 items-center justify-center rounded-full font-black text-white shadow-sm ring-4 ring-white/80 ${booked ? 'bg-linear-to-br from-stone-400 via-rose-300 to-pink-300' : 'bg-linear-to-br from-red-400 via-pink-400 to-fuchsia-300'}`}>
            {profile.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black tracking-tight text-stone-800">{profile.name}</h3>
            <p className="text-xs font-semibold text-stone-400">Profil Netflix private</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${booked ? 'bg-stone-100 text-stone-500' : 'bg-pink-100 text-pink-500'}`}>
          {booked ? 'Booked' : 'Available'}
        </span>
      </div>

      {booked ? (
        <div className="mt-6 rounded-2xl border border-stone-100 bg-white/70 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-600">
            <Clock3 className="size-4 text-red-300" />
            Sisa durasi
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-stone-800">
            {formatCountdown(booked.end_date, booked.logout_time, now)}
          </p>
          <p className="mt-1 text-xs font-semibold text-stone-400">
            Sampai {formatDate(booked.end_date)}, {formatTime(booked.logout_time)} WIB
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-pink-100 bg-pink-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-pink-500">
            <CheckCircle2 className="size-4" />
            Siap disewa sekarang
          </div>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            Profil ini lagi kosong, jadi customer bisa request admin buat pakai profile ini duluan.
          </p>
        </div>
      )}
    </article>
  )
}

export default function SelfService() {
  const [profiles, setProfiles] = useState<PublicProfileAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    getPublicProfileAvailability().then(({ data, error }) => {
      if (cancelled) return
      if (error) setError('List profile belum bisa dimuat. Coba refresh sebentar lagi ya.')
      setProfiles(data ?? [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const available = profiles.filter((profile) => profile.status === 'available')
  const booked = profiles.filter((profile) => profile.status === 'booked')

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fef6f9] text-stone-700">
      <div className="pointer-events-none fixed inset-0 hidden lg:block">
        <img src={desktopBg} alt="" className="h-full w-full object-cover" aria-hidden />
      </div>
      <div className="pointer-events-none fixed inset-0 lg:hidden">
        <img src={portraitBg} alt="" className="h-full w-full object-cover" aria-hidden />
      </div>
      <FloatingDecorations />

      <header className="relative px-4 pb-10 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white/70 px-5 py-2 text-sm font-medium text-pink-500 backdrop-blur-sm">
            <Heart className="size-4 fill-red-400 text-red-400" />
            Self Service Profil Netflix
          </div>
          <div className="relative mx-auto overflow-hidden rounded-[2.25rem] border-2 border-white/80 bg-white/85 p-8 shadow-xl shadow-pink-200/35 backdrop-blur-sm sm:p-10">
            <div className="absolute left-8 top-0 h-4 w-32 rounded-b-full bg-linear-to-r from-red-200 via-pink-200 to-fuchsia-200" />
            <MonitorPlay className="mx-auto mb-4 size-11 rotate-[-6deg] text-red-300/80" />
            <h1 className="text-pretty text-3xl font-black tracking-tight text-stone-800 sm:text-5xl">
              Cek profile yang ready sebelum order.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-stone-500 sm:text-base">
              Lihat profile yang masih available dan yang lagi terbooked lengkap dengan countdown selesai sewanya.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            <div className="text-center">
              <div className="mb-1 text-3xl font-extrabold tracking-tight text-stone-800 sm:text-4xl">{available.length}</div>
              <div className="text-sm text-stone-400">Available ✨</div>
            </div>
            <div className="text-center">
              <div className="mb-1 text-3xl font-extrabold tracking-tight text-stone-800 sm:text-4xl">{booked.length}</div>
              <div className="text-sm text-stone-400">Booked ⏳</div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl space-y-12 px-4 pb-16 sm:px-6 lg:px-8">
        {error && <p className="rounded-2xl border border-red-100 bg-white/80 p-4 text-center text-sm font-semibold text-red-400 backdrop-blur-sm">{error}</p>}
        {loading ? (
          <p className="rounded-[2rem] border-2 border-white/80 bg-white/85 p-8 text-center font-bold text-stone-400 shadow-lg shadow-pink-200/30 backdrop-blur-sm">Memuat profile...</p>
        ) : (
          <>
            <section>
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-pink-400 uppercase">
                  <Sparkles className="size-4" />
                  Available profile
                </h2>
                <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-stone-400 backdrop-blur-sm">{available.length} ready</span>
              </div>
              {available.length ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {available.map((profile) => <ProfileCard key={profile.id} profile={profile} now={now} />)}
                </div>
              ) : (
                <p className="rounded-[2rem] border-2 border-white/80 bg-white/85 p-8 text-center text-sm font-semibold text-stone-400 shadow-lg shadow-pink-200/30 backdrop-blur-sm">Belum ada profile kosong sekarang.</p>
              )}
            </section>

            <section>
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-pink-400 uppercase">
                  <Clock3 className="size-4" />
                  Booked profile
                </h2>
                <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-stone-400 backdrop-blur-sm">{booked.length} dipakai</span>
              </div>
              {booked.length ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {booked.map((profile) => <ProfileCard key={profile.id} profile={profile} now={now} />)}
                </div>
              ) : (
                <p className="rounded-[2rem] border-2 border-white/80 bg-white/85 p-8 text-center text-sm font-semibold text-stone-400 shadow-lg shadow-pink-200/30 backdrop-blur-sm">Belum ada profile yang lagi terbooked.</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
