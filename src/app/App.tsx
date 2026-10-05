import { BrowserRouter, Route, Routes } from 'react-router'
import { RootRedirect } from './RootRedirect.tsx'
import { NotFoundScreen, Shell } from './Shell.tsx'
import { HomeScreen } from '../features/home/HomeScreen.tsx'
import { PlanScreen } from '../features/plan/PlanScreen.tsx'
import { SpendingScreen } from '../features/spending/SpendingScreen.tsx'
import { AccountsScreen } from '../features/accounts/AccountsScreen.tsx'
import { ReflectScreen } from '../features/reflect/ReflectScreen.tsx'
import { SettingsScreen } from '../features/settings/SettingsScreen.tsx'
import { Gallery } from '../features/gallery/Gallery.tsx'
import { BudgetProvider } from '../state/BudgetContext.tsx'

function BudgetShell() {
  return (
    <BudgetProvider>
      <Shell />
    </BudgetProvider>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route element={<BudgetShell />}>
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/plan" element={<PlanScreen />} />
          <Route path="/spending" element={<SpendingScreen />} />
          <Route path="/accounts" element={<AccountsScreen />} />
          <Route path="/reflect" element={<ReflectScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
        {import.meta.env.DEV ? <Route path="/dev/gallery" element={<Gallery />} /> : null}
        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </BrowserRouter>
  )
}
