import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const RequireAdmin = () => {
  const { session, profile, loading, profileLoading } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  // profile is fetched in a separate effect keyed off the session, so on a
  // fresh page load `loading` can already be false while it's still in
  // flight - wait for it (via the dedicated profileLoading flag, not just
  // `!profile`) rather than reading that gap as "not an admin". Once it's
  // done, a still-null profile (fetch failed, row missing) is treated as
  // "not an admin" too, rather than leaving this stuck on a blank page.
  if (profileLoading) return null
  if (profile?.role !== 'admin') return <Navigate to="/" replace />

  return <Outlet />
}

export default RequireAdmin
