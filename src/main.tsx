import { createRoot } from 'react-dom/client'
import { initTemporal } from './domain/dates.ts'
import { applyDensity, readDensity } from './ui/density.ts'
import { registerPwa } from './app/pwa.ts'
import { requestPersistence } from './app/storage-persist.ts'
import { App } from './app/App.tsx'
import './ui/layers.css'
import './ui/tokens.css'
import './ui/base.css'

async function boot() {
  if (!('popover' in HTMLElement.prototype)) {
    await import('@oddbird/popover-polyfill')
  }
  await initTemporal()
  applyDensity(readDensity(localStorage), document, localStorage)

  const root = document.getElementById('root')
  if (!root) throw new Error('Root element missing')
  createRoot(root).render(<App />)
  registerPwa()
  void requestPersistence(navigator.storage)
}

void boot()
