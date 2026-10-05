import { createRoot } from 'react-dom/client'
import { initTemporal } from './domain/dates.ts'
import { applyDensity, readDensity } from './ui/density.ts'
import './ui/layers.css'
import './ui/tokens.css'
import './ui/base.css'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/newsreader/opsz.css'

async function boot() {
  if (!('popover' in HTMLElement.prototype)) {
    await import('@oddbird/popover-polyfill')
  }
  await initTemporal()
  applyDensity(readDensity(localStorage), document, localStorage)

  const root = document.getElementById('root')
  if (!root) throw new Error('Root element missing')

  if (import.meta.env.DEV && location.pathname === '/dev/gallery') {
    const { Gallery } = await import('./features/gallery/Gallery.tsx')
    createRoot(root).render(<Gallery />)
    return
  }

  createRoot(root).render(<h1>Kaban</h1>)
}

void boot()
