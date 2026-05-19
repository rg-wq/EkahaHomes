import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut } from 'lucide-react'

export function AppShell({ nav }) {
  const { profile, signOut } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-semibold text-slate-900">StayOps</h1>
            <p className="text-xs text-slate-500">
              {profile?.full_name} · <span className="capitalize">{profile?.role}</span>
            </p>
          </div>
          <button onClick={signOut} className="btn-secondary !px-3 !py-1.5 text-sm" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 pb-24 sm:pb-4">
        <Outlet />
      </main>

      {nav?.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white sm:static sm:border-t-0">
          <div className="mx-auto flex max-w-5xl items-stretch justify-around">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition ${
                    isActive ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'
                  }`
                }
              >
                {item.icon && <item.icon className="h-5 w-5" />}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
