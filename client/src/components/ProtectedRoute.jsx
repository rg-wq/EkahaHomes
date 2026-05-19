import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingScreen } from './LoadingScreen'

export function ProtectedRoute({ children, allow }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-800">Account not provisioned</h1>
        <p className="mt-2 text-slate-500">
          Your login worked, but no profile is set up yet. Ask the owner to assign your role.
        </p>
      </div>
    )
  }

  if (allow && !allow.includes(profile.role)) {
    return <Navigate to={homeForRole(profile.role)} replace />
  }

  return children
}

export function homeForRole(role) {
  if (role === 'owner') return '/owner'
  if (role === 'manager') return '/manager'
  if (role === 'staff') return '/staff'
  return '/login'
}
