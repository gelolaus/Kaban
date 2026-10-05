import { createRoot } from 'react-dom/client'

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')
createRoot(root).render(<h1>Kaban</h1>)
