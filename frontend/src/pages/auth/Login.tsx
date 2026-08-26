import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIndusGateStore } from '../../lib/store'
import { Button } from '../../components/ui/Button'
import { Field, TextInput } from '../../components/ui/Form'
import { AlertBanner } from '../../components/ui/Misc'
import { Icon } from '../../components/ui/Icons'
import { LogoMark } from '../../components/ui/Logo'

const demoAccounts = [
  { email: 'platform.admin@indusgate.example', label: 'Platform Admin', initials: 'PA' },
  { email: 'developer@indusgate.example', label: 'Developer', initials: 'DV' },
]

const assuranceSignals = ['Policy aware', 'Audit ready', 'Budget guarded']

export default function Login() {
  const login = useIndusGateStore((s) => s.login)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(email, password)
    setLoading(false)
    if (!result.ok) setError(result.error ?? 'Sign-in failed.')
    else navigate('/dashboard')
  }

  async function quickLogin(demoEmail: string) {
    setLoading(true)
    setError('')
    const result = await login(demoEmail, 'demo123')
    setLoading(false)
    if (!result.ok) setError(result.error ?? 'Sign-in failed.')
    else navigate('/dashboard')
  }

  return (
    <div className="login-canvas antigravity-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="data-grid data-grid-light" />
      <div className="color-rail color-rail-one" />
      <div className="color-rail color-rail-two" />

      <div className="motion-reveal is-visible grid w-full max-w-6xl overflow-hidden rounded-lg border border-white/70 bg-white/80 shadow-[0_24px_70px_rgba(60,64,67,0.16)] backdrop-blur-xl md:grid-cols-2">
        <div className="login-brand-panel relative hidden min-h-[560px] flex-col justify-between overflow-hidden bg-navy-ink p-10 text-white md:flex">
          <div className="hero-mesh" />
          <div className="data-grid" />
          <div className="color-rail color-rail-card" />

          <div className="relative">
            <LogoMark className="h-11 w-11 drop-shadow-[0_10px_24px_rgba(66,133,244,0.32)]" />
            <div className="mt-10 inline-flex items-center gap-3 rounded-md border border-white/18 bg-white/10 px-3 py-2 text-caption font-bold uppercase tracking-wide text-white/78 backdrop-blur">
              <span className="relative h-2 w-8 overflow-hidden rounded-sm bg-white/18">
                <span className="absolute inset-y-0 left-0 w-1/2 rounded-sm bg-gradient-to-r from-[#4285F4] via-[#FBBC05] to-[#34A853] motion-scan" />
              </span>
              Secure access layer
            </div>
            <h1 className="mt-8 font-heading text-[42px] font-bold leading-tight text-white">IndusGate AI</h1>
            <p className="mt-2 font-heading text-body-lg text-white/72">India-hosted AI Gateway</p>
            <p className="mt-5 max-w-sm text-body text-white/72">
              A policy-governed control plane for enterprise LLM access - detecting sensitive data,
              masking it before it leaves the gateway, and auditing every decision.
            </p>

            <div className="mt-8 grid max-w-sm grid-cols-2 gap-3">
              {[
                ['PII', 'masked first'],
                ['Route', 'policy chosen'],
                ['Audit', 'trace written'],
                ['Spend', 'limits active'],
              ].map(([value, label], index) => (
                <div key={label} className="glass-stat floating-chip border border-white/16" style={{ animationDelay: `${index * 120}ms` }}>
                  <div className="font-heading text-h3 font-bold text-white">{value}</div>
                  <div className="mt-1 text-caption font-medium text-white/54">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-2 rounded-md border border-white/14 bg-white/8 px-3 py-2 text-caption text-white/58 backdrop-blur">
            <Icon.Shield className="h-4 w-4 shrink-0 text-[#34A853]" />
            <p>Signed in against the real IndusGate AI backend and PostgreSQL database - not seeded data.</p>
          </div>
        </div>

        <div className="relative p-8 md:p-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4285F4] via-[#FBBC05] to-[#34A853]" />
          <div className="mb-6 md:hidden">
            <LogoMark className="h-9 w-9 drop-shadow-[0_10px_24px_rgba(66,133,244,0.24)]" />
          </div>

          <div className="inline-flex items-center gap-2 rounded-md border border-[#4285F4]/20 bg-[#E8F0FE] px-3 py-1.5 text-caption font-bold uppercase tracking-wide text-[#1967D2]">
            <Icon.Lock className="h-4 w-4" />
            Gateway console
          </div>
          <h2 className="mt-5 font-heading text-h1 font-bold text-navy-ink">Sign in to IndusGate AI</h2>
          <p className="mt-1 text-table text-navy/60">Use a demo account to explore the gateway with role-appropriate access.</p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            {error && <AlertBanner kind="error" title="Sign-in failed">{error}</AlertBanner>}
            <Field label="Email address" required htmlFor="email">
              <TextInput
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="platform.admin@indusgate.example"
                className="border-navy/15 bg-white/78 shadow-sm backdrop-blur focus:border-[#4285F4] focus:ring-[#4285F4]/20"
              />
            </Field>
            <Field label="Password" required htmlFor="password" helper="Demo password: demo123">
              <TextInput
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="........"
                className="border-navy/15 bg-white/78 shadow-sm backdrop-blur focus:border-[#4285F4] focus:ring-[#4285F4]/20"
              />
            </Field>
            <Button type="submit" loading={loading} className="google-button mt-1 w-full transition-all">
              Sign in
            </Button>
          </form>

          <div className="mt-7">
            <div className="mb-2 text-caption font-semibold uppercase tracking-wide text-navy/45">Or continue with a demo account</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {demoAccounts.map((u) => (
                <button
                  key={u.email}
                  onClick={() => quickLogin(u.email)}
                  className="group flex items-start gap-3 rounded-md border border-navy/12 bg-white/70 px-3 py-3 text-left shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-[#4285F4]/45 hover:bg-white hover:shadow-[0_14px_34px_rgba(66,133,244,0.13)]"
                >
                  <span className="google-mark mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-caption font-bold text-white">
                    {u.initials}
                  </span>
                  <span>
                    <span className="block text-table font-semibold text-navy-ink group-hover:text-[#1967D2]">{u.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7 grid gap-2 text-caption text-navy/56 sm:grid-cols-3">
            {assuranceSignals.map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-md border border-navy/10 bg-[#F8FAFF]/80 px-3 py-2">
                <span className="h-2 w-2 rounded-sm bg-[#34A853]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
