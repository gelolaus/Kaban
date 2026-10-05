import { showToast } from '../ui/components/toast.ts'

export function registerPwa(): void {
  if (!('serviceWorker' in navigator)) return
  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        onNeedRefresh() {
          showToast('A new version is ready.', {
            action: {
              label: 'Reload',
              onAction: () => updateSW(true),
            },
          })
        },
        onOfflineReady() {
          showToast('Kaban works offline now.')
        },
      })
    })
    .catch(() => {
      // PWA plugin may be absent in unit tests
    })
}
