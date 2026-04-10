import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_HOME = { admin: '/admin', mentor: '/mentor', student: '/dashboard' }

export default function ProtectedRoute({ children, allowedRole }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user || !user.role) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={ROLE_HOME[user.role] ?? '/dashboard'} replace />
  }

  return children
}
