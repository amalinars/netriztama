import { NavLink, Outlet } from 'react-router'
import { LayoutDashboard, ShoppingCart, Tv, ScrollText, Sun, Moon } from 'lucide-react'
import { Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/theme'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/accounts', label: 'Akun', icon: Tv },
  { to: '/logs', label: 'Logs', icon: ScrollText },
] as const

export default function Layout() {
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-screen bg-background transition-colors">
      <Toaster theme={theme} position="top-center" richColors closeButton />
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4">
          <NavLink to="/" className="mr-4 flex items-center gap-2.5 font-bold text-lg tracking-tight sm:mr-6">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-black shadow-sm">N</div>
            <span className="hidden sm:inline">Netriztama</span>
          </NavLink>
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
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
              end={to === '/'}
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
