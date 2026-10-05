import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { titleFor } from './nav.ts'

export function useRouteAnnouncer() {
  const location = useLocation()

  useEffect(() => {
    document.title = titleFor(location.pathname)
    const main = document.getElementById('content')
    const heading = main?.querySelector('h1')
    if (heading) {
      heading.setAttribute('tabindex', '-1')
      heading.focus()
    }
  }, [location.pathname])
}
