import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { LayoutDashboard, ShoppingCart, Tv, ScrollText, Sun, Moon, MessageSquareHeart } from 'lucide-react'
import { Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/lib/theme'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/accounts', label: 'Akun', icon: Tv },
  { to: '/admin/logs', label: 'Logs', icon: ScrollText },
  { to: '/admin/testimonials', label: 'Testimonials', icon: MessageSquareHeart },
] as const

const ADMIN_UNLOCK_KEY = 'netriztama-admin-unlocked'
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

function AdminPasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function submit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!ADMIN_PASSWORD) { setError('VITE_ADMIN_PASSWORD belum diisi di .env'); return }
    if (password !== ADMIN_PASSWORD) { setError('Password salah'); return }
    sessionStorage.setItem(ADMIN_UNLOCK_KEY, 'true')
    onUnlock()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Masuk Admin</CardTitle>
          <p className="text-sm text-muted-foreground">Isi password admin dulu untuk buka dashboard.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="Password admin"
                autoFocus
              />
              {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full">Masuk</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

export default function Layout() {
  const { theme, toggle } = useTheme()
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(ADMIN_UNLOCK_KEY) === 'true')

  if (!unlocked) return <AdminPasswordGate onUnlock={() => setUnlocked(true)} />

  return (
    <div className="min-h-screen bg-background transition-colors">
      <Toaster theme={theme} position="top-center" richColors closeButton />
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
          <NavLink to="/admin" className="mr-4 flex items-center gap-2.5 font-bold text-lg tracking-tight sm:mr-6">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-black shadow-sm">N</div>
            <span className="hidden sm:inline">Netriztama</span>
          </NavLink>
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/admin'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary/15 text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`
                }
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <Button variant="ghost" size="icon-sm" onClick={toggle} className="rounded-xl">
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-xl md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around h-18">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
            >
              <Icon className="size-6" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
