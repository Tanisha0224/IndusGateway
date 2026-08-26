import { chromium } from '../frontend/node_modules/playwright/index.mjs'
import fs from 'node:fs/promises'
import path from 'node:path'

const appUrl = process.env.DEMO_APP_URL || 'http://127.0.0.1:5174'
const outputDir = path.resolve('demo-recording')
const videoDir = path.join(outputDir, 'raw')

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function addCaption(page, title, body) {
  await page.evaluate(({ title, body }) => {
    let box = document.getElementById('demo-caption-box')
    if (!box) {
      box = document.createElement('div')
      box.id = 'demo-caption-box'
      Object.assign(box.style, {
        position: 'fixed',
        left: '24px',
        bottom: '24px',
        zIndex: '2147483647',
        width: 'min(620px, calc(100vw - 48px))',
        padding: '18px 20px',
        borderRadius: '8px',
        background: 'rgba(10, 22, 40, 0.92)',
        color: 'white',
        boxShadow: '0 18px 48px rgba(0,0,0,0.28)',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        pointerEvents: 'none',
      })
      document.body.appendChild(box)
    }
    box.innerHTML = `
      <div style="font-size: 18px; font-weight: 800; line-height: 1.25; margin-bottom: 6px;">${title}</div>
      <div style="font-size: 14px; line-height: 1.45; color: rgba(255,255,255,0.84);">${body}</div>
    `
  }, { title, body })
}

async function shot(page, title, body, duration = 2500) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await addCaption(page, title, body)
  await wait(duration)
}

async function goto(page, route, title, body, duration = 2600) {
  await page.goto(`${appUrl}${route}`, { waitUntil: 'networkidle' })
  await shot(page, title, body, duration)
}

async function closeDrawer(page) {
  const closeButton = page.getByRole('button', { name: /Close panel|Close dialog/i }).first()
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click()
  } else {
    await page.keyboard.press('Escape').catch(() => {})
  }
  await wait(700)
}

await fs.rm(videoDir, { recursive: true, force: true })
await fs.mkdir(videoDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  deviceScaleFactor: 1,
  recordVideo: { dir: videoDir, size: { width: 1440, height: 950 } },
})
const page = await context.newPage()

try {
  await goto(
    page,
    '/',
    'IndusGate AI',
    'Secure enterprise AI gateway for privacy, routing, provider governance, observability, and cost control.',
    3000,
  )

  await goto(page, '/login', 'Real Backend Login', 'The app signs in against the FastAPI backend and persisted Postgres-backed state.', 2000)
  const loginResponse = await page.request.post('http://127.0.0.1:8000/api/auth/session', {
    data: { email: 'platform.admin@indusgate.example', password: 'demo123' },
  })
  if (!loginResponse.ok()) {
    throw new Error(`Backend login failed with ${loginResponse.status()}`)
  }
  const setCookie = loginResponse.headers()['set-cookie'] || ''
  const sessionMatch = setCookie.match(/indusgate_session=([^;]+)/)
  if (!sessionMatch) {
    throw new Error('Backend login did not return an indusgate_session cookie.')
  }
  await context.addCookies([{
    name: 'indusgate_session',
    value: sessionMatch[1],
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }])
  await page.goto(`${appUrl}/dashboard`, { waitUntil: 'networkidle' })
  await page.getByText(/Executive Dashboard/i).first().waitFor({ timeout: 15000 })

  await shot(page, 'Executive Dashboard', 'Live KPIs summarize gateway traffic, usage, provider health, privacy events, and semantic cache savings.', 3500)
  await goto(page, '/org', 'Organisation & Access', 'Admins manage users, roles, departments, status, and access scope. Disabled users are blocked from login.', 2800)
  await goto(page, '/providers', 'Models & Providers', 'Providers are centrally managed. The Local Demo Provider guarantees a working demo without external API keys.', 3000)
  await goto(page, '/aliases', 'Model Aliases', 'Public model aliases hide provider-specific model names and give teams a stable API contract.', 2800)
  await goto(page, '/policies', 'Privacy Policies', 'Privacy rules classify, mask, or block sensitive data before requests leave the gateway.', 3000)
  await goto(page, '/routing', 'Routing Policies', 'Routing rules enforce India-only, protected external fallback, provider allowlists, retries, and region constraints.', 3000)
  await goto(page, '/budgets', 'Budgets & Rate Limits', 'Governance controls track spend, reserve estimated tokens, settle actual usage, and enforce request limits.', 3000)
  await goto(page, '/keys', 'Virtual Keys', 'Applications call the gateway using scoped virtual keys instead of raw provider credentials.', 2600)

  await page.evaluate(async () => {
    await fetch('/api/cache', { method: 'DELETE', credentials: 'include' })
  }).catch(() => {})

  await goto(page, '/playground', 'Request Playground', 'Now we send a real OpenAI-compatible request through /v1/chat/completions.', 2000)
  if (!page.url().includes('/playground')) {
    throw new Error(`Expected Playground after login, got ${page.url()}`)
  }
  const keyInput = page.locator('input[placeholder*="ig_sk"]').first()
  await keyInput.fill('ig_sk_test_demo_secret')
  await page.locator('input[placeholder*="indusgate"]').first().fill('indusgate-demo').catch(async () => {
    await page.getByLabel(/Model alias/i).fill('indusgate-demo')
  })
  await page.getByRole('button', { name: /Send request/i }).click()
  await page.getByText(/Succeeded|HTTP/i).first().waitFor({ timeout: 20000 })
  await shot(page, 'First Gateway Call: Cache Miss', 'The local demo provider responds successfully, while privacy, routing, governance, and cache decisions are written to a trace.', 3600)
  await closeDrawer(page)

  await page.getByRole('button', { name: /Send request/i }).click()
  await page.getByText(/Cache hit/i).first().waitFor({ timeout: 20000 })
  await shot(page, 'Second Gateway Call: Cache Hit', 'Repeating the same prompt returns from semantic cache and skips the provider call.', 3600)
  await closeDrawer(page)

  await goto(page, '/cache', 'Semantic Cache', 'Cache entries are project-scoped. Admins can inspect hits, tokens saved, cost saved, and invalidate entries.', 3200)
  await goto(page, '/traces', 'Request Traces', 'Each gateway request creates an auditable trace across privacy, routing, governance, provider, streaming, and cache stages.', 3000)
  const firstTrace = page.locator('tbody tr').first()
  if (await firstTrace.isVisible().catch(() => false)) {
    await firstTrace.click()
    await shot(page, 'Trace Detail Drawer', 'The trace drawer proves what happened for a single request: policy action, routed provider, cache result, and settlement.', 3600)
    await closeDrawer(page)
  }
  await goto(page, '/health', 'Provider Health', 'Provider health and circuit state protect traffic from unhealthy upstream services.', 2600)
  await goto(page, '/billing', 'Usage & Billing', 'Usage views connect project budgets with token counts, request counts, and estimated spend.', 2600)
  await goto(page, '/audit', 'Audit Logs', 'Administrative actions and gateway events are retained for review and compliance evidence.', 2600)
  await goto(page, '/docs', 'API Documentation', 'Developers get the routes and request format needed to integrate applications with the gateway.', 2600)
  await goto(page, '/alerts', 'Alerts & Notifications', 'Alerts surface provider outages, recovery events, and other operational signals.', 2600)
  await goto(page, '/dashboard', 'Demo Complete', 'IndusGate AI now demonstrates the full secure AI gateway loop end to end.', 3200)
} finally {
  await context.close()
  await browser.close()
}

const rawFiles = await fs.readdir(videoDir)
const webm = rawFiles.filter((file) => file.endsWith('.webm')).sort().at(-1)
if (!webm) {
  throw new Error('Playwright did not produce a video file.')
}
const from = path.join(videoDir, webm)
const to = path.join(outputDir, 'indusgate-demo-walkthrough.webm')
await fs.copyFile(from, to)
console.log(to)
