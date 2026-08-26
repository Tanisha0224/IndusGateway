import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useIndusGateStore } from './lib/store'
import Login from './pages/auth/Login'
import Dashboard from './pages/dashboard/Dashboard'
import Keys from './pages/keys/Keys'
import Providers from './pages/providers/Providers'
import Aliases from './pages/aliases/Aliases'
import Policies from './pages/policies/Policies'
import Routing from './pages/routing/Routing'
import Budgets from './pages/budgets/Budgets'
import Playground from './pages/playground/Playground'
import Traces from './pages/traces/Traces'
import Audit from './pages/audit/Audit'
import Health from './pages/health/Health'
import Cache from './pages/cache/Cache'
import Billing from './pages/billing/Billing'
import Org from './pages/org/Org'
import Alerts from './pages/alerts/Alerts'
import Docs from './pages/docs/Docs'
import Landing from './pages/landing/Landing'
import { RequireAuth, ModuleGuard } from './components/layout/Guards'
import { AppShell } from './components/layout/AppShell'

function Protected({ moduleKey, title, children }: { moduleKey: string; title: string; children: React.ReactNode }) {
  return (
    <RequireAuth>
      <ModuleGuard moduleKey={moduleKey} title={title}>
        <AppShell pageTitle={title}>{children}</AppShell>
      </ModuleGuard>
    </RequireAuth>
  )
}

export default function App() {
  const bootstrapAuth = useIndusGateStore((s) => s.bootstrapAuth)

  useEffect(() => {
    bootstrapAuth()
  }, [bootstrapAuth])

  useEffect(() => {
    function handleUnauthorized() {
      useIndusGateStore.setState({ currentUser: null, authStatus: 'unauthenticated' })
    }
    window.addEventListener('indusgate:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('indusgate:unauthorized', handleUnauthorized)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Protected moduleKey="dashboard" title="Executive Dashboard"><Dashboard /></Protected>} />
        <Route path="/keys" element={<Protected moduleKey="keys" title="Virtual Keys"><Keys /></Protected>} />
        <Route path="/providers" element={<Protected moduleKey="providers" title="Models & Providers"><Providers /></Protected>} />
        <Route path="/aliases" element={<Protected moduleKey="aliases" title="Model Aliases"><Aliases /></Protected>} />
        <Route path="/policies" element={<Protected moduleKey="policies" title="Privacy Policies"><Policies /></Protected>} />
        <Route path="/routing" element={<Protected moduleKey="routing" title="Routing Policies"><Routing /></Protected>} />
        <Route path="/budgets" element={<Protected moduleKey="budgets" title="Budgets & Rate Limits"><Budgets /></Protected>} />
        <Route path="/playground" element={<Protected moduleKey="playground" title="Request Playground"><Playground /></Protected>} />
        <Route path="/traces" element={<Protected moduleKey="traces" title="Request Traces"><Traces /></Protected>} />
        <Route path="/audit" element={<Protected moduleKey="audit" title="Audit Logs"><Audit /></Protected>} />
        <Route path="/health" element={<Protected moduleKey="health" title="Provider Health"><Health /></Protected>} />
        <Route path="/cache" element={<Protected moduleKey="cache" title="Semantic Cache"><Cache /></Protected>} />
        <Route path="/billing" element={<Protected moduleKey="billing" title="Usage & Billing"><Billing /></Protected>} />
        <Route path="/org" element={<Protected moduleKey="org" title="Organisation & Access"><Org /></Protected>} />
        <Route path="/alerts" element={<Protected moduleKey="alerts" title="Alerts & Notifications"><Alerts /></Protected>} />
        <Route path="/docs" element={<Protected moduleKey="docs" title="API Documentation"><Docs /></Protected>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
