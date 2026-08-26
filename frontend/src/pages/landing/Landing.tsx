import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import heroImage from '../../assets/hero.png'
import { ProductLogo } from '../../components/ui/Logo'

const journey = [
  {
    step: '01',
    title: 'Teams connect once',
    body: 'Applications keep using an OpenAI-compatible API while IndusGate AI becomes the policy layer in the middle.',
  },
  {
    step: '02',
    title: 'Every request is checked',
    body: 'PII, budgets, project rules, provider health, and data residency policies are evaluated before routing.',
  },
  {
    step: '03',
    title: 'The safest route is chosen',
    body: 'Traffic can stay on India-hosted models, fail over to approved providers, or stop when risk is too high.',
  },
  {
    step: '04',
    title: 'Leaders get evidence',
    body: 'Security, finance, and audit teams see exactly what happened, why it happened, and what it cost.',
  },
]

const capabilities = [
  ['Sovereign routing', 'Prefer India-hosted AI paths when policy or workload sensitivity demands local control.', 'India-hosted model selected', '0 external egress'],
  ['Prompt protection', 'Mask sensitive values, block unsafe requests, and record the gateway decision.', 'PII masked before routing', '3 fields protected'],
  ['Virtual keys', 'Issue scoped keys by project, model, provider, team, expiry, and monthly budget.', 'Scoped production key', '4 allowed aliases'],
  ['Spend governance', 'Set soft warnings, hard limits, and rate limits before AI spend surprises finance.', 'Budget guard active', '84% utilised'],
  ['Model failover', 'Automatically route around provider outages with visible fallback evidence.', 'Fallback chain ready', '2 healthy backups'],
  ['Trace observability', 'Review request timelines across authentication, policy, routing, provider, and response stages.', 'Audit evidence written', '12 stages captured'],
]

const commercialModels = [
  {
    title: 'Pilot',
    price: '30-day fixed engagement',
    line: 'Best for one team proving control, latency, and audit value before a wider rollout.',
    includes: ['Policy workshop', 'Sandbox gateway setup', 'Executive value report'],
  },
  {
    title: 'Enterprise',
    price: 'Annual platform license',
    line: 'For organisations standardising AI access across departments and internal products.',
    includes: ['Role-based admin', 'Custom policy packs', 'Usage and billing dashboards'],
    featured: true,
  },
  {
    title: 'Sovereign Cloud',
    price: 'Dedicated deployment model',
    line: 'For regulated workloads that need private networking, residency assurance, and deeper controls.',
    includes: ['Private deployment', 'Security review support', 'Custom provider integrations'],
  },
]

const outcomes = [
  { value: '100%', label: 'Traceable AI traffic' },
  { value: '<80 ms', label: 'Policy check target' },
  { value: '24x7', label: 'Enterprise operations path' },
  { value: 'VPC', label: 'Private deployment option' },
]

const decisionFrames = [
  {
    label: 'Prompt inspection',
    status: 'Sensitive values detected',
    route: 'Policy evaluation',
    detail: 'Customer email and PAN-like values are identified before provider selection.',
    metrics: ['PII scan: complete', 'Classification: personal data', 'Action: mask'],
  },
  {
    label: 'Policy decision',
    status: 'India-hosted route required',
    route: 'Sovereign provider',
    detail: 'The active policy prevents external processing for regulated customer data.',
    metrics: ['Budget: available', 'Provider health: healthy', 'Egress: blocked'],
  },
  {
    label: 'Audit evidence',
    status: 'Trace written',
    route: 'Compliance timeline',
    detail: 'Security, finance and audit teams receive the same request-level evidence.',
    metrics: ['Latency: 612 ms', 'Cost: Rs 0.18', 'Trace: immutable'],
  },
]

const demoEvents = [
  'Virtual key validated for Compliance Portal',
  'PII masked before model routing',
  'Policy selected India-hosted provider',
  'Usage and audit records committed',
]

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-caption font-bold uppercase tracking-wide text-saffron-deep">
      {children}
    </p>
  )
}

export default function Landing() {
  const [activeDecision, setActiveDecision] = useState(0)
  const [activeCapability, setActiveCapability] = useState(0)

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('.motion-reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible')
        })
      },
      { threshold: 0.18, rootMargin: '0px 0px -80px 0px' },
    )

    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveDecision((current) => (current + 1) % decisionFrames.length)
    }, 2600)
    return () => window.clearInterval(timer)
  }, [])

  const decision = decisionFrames[activeDecision]
  const capability = capabilities[activeCapability]

  return (
    <main className="antigravity-page min-h-screen text-navy-ink">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/78 shadow-[0_10px_35px_rgba(60,64,67,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="IndusGate AI home">
            <ProductLogo />
          </Link>
          <nav className="hidden items-center gap-6 text-table font-semibold text-navy/68 md:flex">
            <a href="#story" className="hover:text-saffron-deep">How it works</a>
            <a href="#platform" className="hover:text-saffron-deep">Platform</a>
            <a href="#demo" className="hover:text-saffron-deep">Demo</a>
            <a href="#business" className="hover:text-saffron-deep">Business</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden h-10 items-center rounded-md border border-navy/15 bg-white/60 px-4 text-table font-semibold text-navy shadow-sm transition hover:-translate-y-0.5 hover:bg-white sm:inline-flex">
              Sign in
            </Link>
            <Link to="/login" className="google-button inline-flex h-10 items-center rounded-md px-4 text-table font-semibold text-white shadow-subtle">
              Request demo
            </Link>
          </div>
        </div>
      </header>

      <section className="antigravity-hero relative overflow-hidden text-white">
        <div className="hero-mesh" />
        <div className="data-grid" />
        <div className="color-rail color-rail-one" />
        <div className="color-rail color-rail-two" />
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.14] mix-blend-luminosity" />
        <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(10,15,35,0.95)_0%,rgba(24,36,67,0.88)_44%,rgba(239,246,255,0.18)_100%)]" />

        <div className="relative mx-auto grid min-h-[calc(100vh-65px)] max-w-content items-center gap-10 px-5 py-14 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
          <div className="motion-reveal max-w-3xl">
            <div className="inline-flex items-center gap-3 rounded-md border border-white/22 bg-white/12 px-3 py-2 text-caption font-bold uppercase tracking-wide text-white/82 shadow-raised backdrop-blur-md">
              <span className="relative h-2 w-8 overflow-hidden rounded-sm bg-white/20">
                <span className="absolute inset-y-0 left-0 w-1/2 rounded-sm bg-gradient-to-r from-[#4285F4] via-[#FBBC05] to-[#34A853] motion-scan" />
              </span>
              Antigravity control plane for Indian enterprise AI
            </div>
            <h1 className="mt-7 font-heading text-[42px] font-bold leading-tight text-white md:text-[64px]">
              Govern AI access before it reaches any model.
            </h1>
            <p className="mt-6 max-w-2xl text-body-lg text-white/76">
              IndusGate AI is an enterprise AI gateway that protects prompts, routes requests through approved
              providers, controls spend, and gives leadership an audit trail for every AI decision.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/login" className="google-button inline-flex h-12 items-center justify-center rounded-md px-6 font-semibold text-white shadow-raised">
                Explore working prototype
              </Link>
              <a href="#story" className="inline-flex h-12 items-center justify-center rounded-md border border-white/28 bg-white/8 px-6 font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/14">
                Understand the product
              </a>
            </div>
            <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
              {outcomes.map((item, index) => (
                <div key={item.label} className="glass-stat group border-l border-white/22 pl-4 transition duration-300 hover:border-[#FBBC05]">
                  <div className="font-heading text-h2 font-bold text-white">{item.value}</div>
                  <div className="mt-1 text-caption font-medium text-white/55 transition group-hover:text-white/80">{item.label}</div>
                  <div className="mt-3 h-1 overflow-hidden rounded-sm bg-white/10">
                    <div className="h-full rounded-sm bg-gradient-to-r from-[#4285F4] via-[#FBBC05] to-[#34A853] transition-all duration-700" style={{ width: `${68 + index * 8}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="motion-reveal relative" style={{ transitionDelay: '120ms' }}>
            <div className="gravity-frame absolute -inset-3 rounded-lg transition duration-700" />
            <div className="absolute -right-6 top-8 hidden h-28 w-28 rotate-45 border border-[#34A853]/40 lg:block" />
            <div className="gravity-card relative overflow-hidden rounded-lg border border-white/30 bg-white/88 text-navy-ink shadow-raised transition duration-500 hover:-translate-y-2">
              <div className="border-b border-navy/10 bg-white/74 px-5 py-4 backdrop-blur">
                <div className="text-caption font-bold uppercase tracking-wide text-[#4285F4]">Gateway decision room</div>
                <div className="mt-1 flex items-center justify-between gap-4">
                  <div className="font-heading text-h3 font-bold">Live request inspection</div>
                  <div className="flex gap-1.5">
                    {decisionFrames.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveDecision(index)}
                        className={`h-2 rounded-full transition-all ${index === activeDecision ? 'w-7 bg-[#4285F4]' : 'w-2 bg-navy/20'}`}
                        aria-label={`Show gateway decision step ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="rounded-md border border-navy/10 bg-navy-ink p-4 text-white">
                  <div className="flex items-center justify-between gap-3 text-caption font-semibold uppercase tracking-wide text-white/50">
                    <span>Incoming prompt</span>
                    <span>Project: Compliance Portal</span>
                  </div>
                  <p className="mt-4 font-mono text-table leading-6 text-white/82">
                    Summarise customer record <span className="rounded bg-saffron/25 px-1 text-saffron-dawn">[PII detected]</span> and prepare policy response.
                  </p>
                </div>
                <div className="mt-4 rounded-md border border-saffron/25 bg-[#fff7e8] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-caption font-bold uppercase tracking-wide text-saffron-deep">{decision.label}</div>
                      <div className="mt-1 font-heading text-h3 font-bold">{decision.status}</div>
                    </div>
                    <div className="rounded-md bg-navy-ink px-3 py-2 text-caption font-bold text-white">{decision.route}</div>
                  </div>
                  <p className="mt-3 text-table text-navy/66">{decision.detail}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {decision.metrics.map((tag, index) => (
                    <div key={tag} className="floating-chip rounded-md border border-[#34A853]/20 bg-[#E6F4EA] px-3 py-3 text-table font-bold text-[#137333] transition duration-500" style={{ transitionDelay: `${index * 80}ms` }}>
                      {tag}
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  {journey.slice(1).map((item) => (
                    <div key={item.step} className="flex gap-3 rounded-md border border-navy/10 bg-ivory p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-saffron text-caption font-bold text-white">
                        {item.step}
                      </div>
                      <div>
                        <div className="font-semibold">{item.title}</div>
                        <div className="mt-1 text-caption text-navy/58">{item.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="story" className="relative overflow-hidden border-b border-navy/10 bg-white">
        <div className="scroll-stripe absolute inset-x-0 top-0 h-8" />
        <div className="absolute right-0 top-24 hidden h-[420px] w-[420px] rounded-[32px] border border-[#4285F4]/15 lg:block" />
        <div className="mx-auto max-w-content px-5 pb-16 pt-24 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="motion-reveal">
              <SectionLabel>How it works</SectionLabel>
              <h2 className="mt-3 font-heading text-h1 font-bold">The website explains the product as users scroll.</h2>
              <p className="mt-4 text-body-lg text-navy/64">
                A visitor can understand the value without a sales call: connect once, enforce policy,
                route safely, and report evidence to the business.
              </p>
            </div>
            <div className="relative grid gap-4 md:grid-cols-2">
              <div className="absolute left-6 top-8 hidden h-[calc(100%-64px)] w-px bg-gradient-to-b from-[#4285F4] via-[#FBBC05] to-[#34A853] md:block" />
              {journey.map((item, index) => (
                <article key={item.step} className="motion-reveal group relative rounded-lg border border-navy/10 bg-white/82 p-5 shadow-subtle backdrop-blur transition duration-300 hover:-translate-y-2 hover:border-[#4285F4]/35 hover:bg-white hover:shadow-[0_18px_50px_rgba(60,64,67,0.14)]" style={{ transitionDelay: `${index * 90}ms` }}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-navy-ink font-mono text-caption font-bold text-white transition group-hover:bg-[#4285F4]">{item.step}</span>
                    <span className="h-px flex-1 bg-gradient-to-r from-[#4285F4]/45 via-[#FBBC05]/45 to-[#34A853]/35" />
                  </div>
                  <h3 className="mt-4 font-heading text-h3 font-bold">{item.title}</h3>
                  <p className="mt-3 text-table text-navy/64">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="relative overflow-hidden bg-[#F8FAFF]">
        <div className="data-grid data-grid-light" />
        <div className="mx-auto max-w-content px-5 py-16 lg:px-8">
          <div className="motion-reveal mx-auto max-w-3xl text-center">
            <SectionLabel>Platform capabilities</SectionLabel>
            <h2 className="mt-3 font-heading text-h1 font-bold">Everything an enterprise expects before AI goes live</h2>
            <p className="mt-4 text-body-lg text-navy/64">
              The product is explained through business outcomes, not technical noise.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="grid gap-3">
              {capabilities.map(([title, body], index) => (
                <button
                  key={title}
                  onMouseEnter={() => setActiveCapability(index)}
                  onFocus={() => setActiveCapability(index)}
                  onClick={() => setActiveCapability(index)}
                  className={`motion-reveal group flex items-start gap-4 rounded-lg border p-4 text-left backdrop-blur transition duration-300 hover:-translate-y-1 ${index === activeCapability ? 'border-[#4285F4] bg-white shadow-[0_18px_48px_rgba(66,133,244,0.14)]' : 'border-navy/10 bg-white/72 hover:border-[#4285F4]/30 hover:bg-white'}`}
                  style={{ transitionDelay: `${index * 65}ms` }}
                >
                  <span className={`mt-1 h-3 w-3 shrink-0 rounded-sm transition ${index === activeCapability ? 'bg-[#4285F4]' : 'bg-navy/20 group-hover:bg-[#34A853]'}`} />
                  <span>
                    <span className="block font-heading text-h3 font-bold">{title}</span>
                    <span className="mt-1 block text-table text-navy/58">{body}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="motion-reveal gravity-card relative overflow-hidden rounded-lg border border-white/30 bg-navy-ink p-6 text-white shadow-raised" style={{ transitionDelay: '120ms' }}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
              <div className="color-rail color-rail-card" />
              <div className="relative">
                <div className="text-caption font-bold uppercase tracking-wide text-[#8AB4F8]">Capability in action</div>
                <h3 className="mt-3 font-heading text-h1 font-bold text-white">{capability[0]}</h3>
                <p className="mt-4 max-w-xl text-body-lg text-white/70">{capability[1]}</p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/14 bg-white/10 p-5">
                    <div className="text-caption font-bold uppercase tracking-wide text-white/45">Gateway state</div>
                    <div className="mt-2 font-heading text-h3 font-bold text-white">{capability[2]}</div>
                  </div>
                  <div className="rounded-lg border border-white/14 bg-white/10 p-5">
                    <div className="text-caption font-bold uppercase tracking-wide text-white/45">Business signal</div>
                    <div className="mt-2 font-heading text-h3 font-bold text-white">{capability[3]}</div>
                  </div>
                </div>
                <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#4285F4] via-[#FBBC05] to-[#34A853] transition-all duration-500" style={{ width: `${38 + activeCapability * 10}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="demo" className="overflow-hidden bg-white">
        <div className="mx-auto grid max-w-content gap-10 px-5 py-16 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div className="motion-reveal self-center">
            <SectionLabel>Demo video</SectionLabel>
            <h2 className="mt-3 font-heading text-h1 font-bold">A product tour that answers buyer questions quickly</h2>
            <p className="mt-4 text-body-lg text-navy/64">
              The demo area sets expectations clearly: viewers see how IndusGate AI handles keys, policies,
              PII masking, fallback routing, and audit review in one flow.
            </p>
            <div className="mt-6 grid gap-3 text-table text-navy/72">
              {['Create a scoped virtual key', 'Send a governed AI request', 'Review the full audit timeline'].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-md border border-navy/10 bg-[#F8FAFF] px-3 py-2 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-subtle">
                  <span className={`h-2.5 w-2.5 rounded-sm ${index === activeDecision ? 'bg-[#4285F4]' : 'bg-[#34A853]'}`} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <Link to="/login" className="google-button mt-8 inline-flex h-11 items-center rounded-md px-5 font-semibold text-white">
              Open interactive demo
            </Link>
          </div>
          <div className="motion-reveal relative" style={{ transitionDelay: '120ms' }}>
            <div className="absolute -left-5 -top-5 h-24 w-24 border-l-4 border-t-4 border-[#4285F4]/55" />
            <div className="absolute -bottom-5 -right-5 h-24 w-24 border-b-4 border-r-4 border-[#34A853]/55" />
            <div className="gravity-card relative aspect-video overflow-hidden rounded-lg border border-navy/10 bg-navy-ink shadow-raised">
              <img src={heroImage} alt="IndusGate AI product demo preview" className="h-full w-full object-cover opacity-58" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,27,58,0.12),rgba(13,27,58,0.86))]" />
              <div className="absolute left-5 top-5 hidden w-64 rounded-md border border-white/16 bg-navy-ink/85 p-3 font-mono text-caption text-white/75 backdrop-blur sm:block">
                {demoEvents.map((event, index) => (
                  <div key={event} className={`flex gap-2 py-1 transition ${index <= activeDecision + 1 ? 'text-white' : 'text-white/35'}`}>
                    <span className={index <= activeDecision + 1 ? 'text-[#34A853]' : 'text-white/25'}>{'>'}</span>
                    <span>{event}</span>
                  </div>
                ))}
              </div>
              <Link to="/login" className="play-pulse absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-navy-ink shadow-raised" aria-label="Open interactive product demo">
                <span className="ml-1 h-0 w-0 border-y-[11px] border-l-[17px] border-y-transparent border-l-[#4285F4]" />
              </Link>
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <div className="text-caption font-bold uppercase tracking-wide text-white/58">3-minute walkthrough</div>
                <div className="mt-2 max-w-lg font-heading text-h2 font-bold text-white">From request risk to audit evidence</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="business" className="relative overflow-hidden bg-navy-ink text-white">
        <div className="data-grid" />
        <div className="color-rail color-rail-three" />
        <div className="mx-auto max-w-content px-5 py-16 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="motion-reveal">
              <p className="text-caption font-bold uppercase tracking-wide text-[#8AB4F8]">Enterprise business model</p>
              <h2 className="mt-3 font-heading text-h1 font-bold text-white">Simple to evaluate, serious enough to procure</h2>
              <p className="mt-4 text-body-lg text-white/68">
                Buyers can see how IndusGate AI moves from evaluation to enterprise rollout, including
                private deployment options for regulated workloads.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {commercialModels.map((model, index) => (
                <article key={model.title} className={`motion-reveal rounded-lg border p-5 backdrop-blur transition duration-300 hover:-translate-y-2 hover:shadow-[0_18px_50px_rgba(0,0,0,0.18)] ${model.featured ? 'border-[#FBBC05] bg-white text-navy-ink' : 'border-white/14 bg-white/8 text-white hover:bg-white/12'}`} style={{ transitionDelay: `${index * 90}ms` }}>
                  <div className={`text-caption font-bold uppercase tracking-wide ${model.featured ? 'text-[#B06000]' : 'text-white/50'}`}>{model.title}</div>
                  <h3 className={`mt-3 font-heading text-h3 font-bold ${model.featured ? 'text-navy-ink' : 'text-white'}`}>{model.price}</h3>
                  <p className={`mt-3 text-table ${model.featured ? 'text-navy/64' : 'text-white/62'}`}>{model.line}</p>
                  <ul className="mt-5 space-y-2 text-table">
                    {model.includes.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className={`mt-2 h-1.5 w-1.5 rounded-full ${model.featured ? 'bg-[#34A853]' : 'bg-[#FBBC05]'}`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-[#F8FAFF]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4285F4] via-[#FBBC05] to-[#34A853]" />
        <div className="mx-auto flex max-w-content flex-col items-start justify-between gap-6 px-5 py-14 md:flex-row md:items-center lg:px-8">
          <div className="motion-reveal max-w-2xl">
            <SectionLabel>Next step</SectionLabel>
            <h2 className="mt-3 font-heading text-h1 font-bold">See IndusGate AI as your enterprise AI gateway.</h2>
            <p className="mt-3 text-navy/64">
              Launch the prototype, sign in with demo credentials, and walk through the same controls a
              real buyer would evaluate: keys, policies, routing, budgets, traces, and audit logs.
            </p>
          </div>
          <div className="motion-reveal flex flex-col gap-3 sm:flex-row" style={{ transitionDelay: '120ms' }}>
            <Link to="/login" className="google-button inline-flex h-11 items-center justify-center rounded-md px-5 font-semibold text-white">
              Launch prototype
            </Link>
            <a href="mailto:sales@indusgate.example" className="inline-flex h-11 items-center justify-center rounded-md border border-navy/20 px-5 font-semibold text-navy hover:bg-white">
              Talk to sales
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
