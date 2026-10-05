import { Navigate } from 'react-router'

export function RootRedirect() {
  const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
  return <Navigate to={phone ? '/home' : '/plan'} replace />
}
