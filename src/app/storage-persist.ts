export async function requestPersistence(
  storage?: Pick<StorageManager, 'persist' | 'persisted'> | undefined,
): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!storage || typeof storage.persist !== 'function') return 'unsupported'
  try {
    if (await storage.persisted()) return 'granted'
    return (await storage.persist()) ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}
