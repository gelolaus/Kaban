import type { LucideIcon } from 'lucide-react'
import { ChartPie, Home, LayoutGrid, Receipt, Settings, Building2 } from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  phoneLabel?: string
  icon: LucideIcon
  laptop: boolean
  phone: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/home', label: 'Home', icon: Home, laptop: false, phone: true },
  { path: '/plan', label: 'Plan', icon: LayoutGrid, laptop: true, phone: true },
  { path: '/spending', label: 'Spending', icon: Receipt, laptop: true, phone: true },
  {
    path: '/accounts',
    label: 'All accounts',
    phoneLabel: 'Accounts',
    icon: Building2,
    laptop: true,
    phone: true,
  },
  { path: '/reflect', label: 'Reflect', icon: ChartPie, laptop: true, phone: true },
  { path: '/settings', label: 'Settings', icon: Settings, laptop: true, phone: false },
]

export function titleFor(pathname: string): string {
  if (pathname === '/') return 'Kaban'
  const item = NAV_ITEMS.find((n) => n.path === pathname)
  if (item) return `${item.phoneLabel ?? item.label} | Kaban`
  if (pathname === '/dev/gallery') return 'Gallery | Kaban'
  return 'Not found | Kaban'
}
