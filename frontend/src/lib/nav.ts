export interface NavItem { path: string; label: string; moduleKey: string; icon: string; group: string }

export const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Executive Dashboard', moduleKey: 'dashboard', icon: 'Dashboard', group: 'Overview' },

  { path: '/keys', label: 'Virtual Keys', moduleKey: 'keys', icon: 'Key', group: 'Gateway Configuration' },
  { path: '/providers', label: 'Models & Providers', moduleKey: 'providers', icon: 'Server', group: 'Gateway Configuration' },
  { path: '/aliases', label: 'Model Aliases', moduleKey: 'aliases', icon: 'Alias', group: 'Gateway Configuration' },
  { path: '/policies', label: 'Privacy Policies', moduleKey: 'policies', icon: 'Audit', group: 'Gateway Configuration' },
  { path: '/routing', label: 'Routing Policies', moduleKey: 'routing', icon: 'Route', group: 'Gateway Configuration' },
  { path: '/budgets', label: 'Budgets & Rate Limits', moduleKey: 'budgets', icon: 'Budget', group: 'Gateway Configuration' },

  { path: '/playground', label: 'Request Playground', moduleKey: 'playground', icon: 'Play', group: 'Testing & Observability' },
  { path: '/traces', label: 'Request Traces', moduleKey: 'traces', icon: 'Trace', group: 'Testing & Observability' },
  { path: '/health', label: 'Provider Health', moduleKey: 'health', icon: 'Health', group: 'Testing & Observability' },
  { path: '/cache', label: 'Semantic Cache', moduleKey: 'cache', icon: 'Cache', group: 'Testing & Observability' },

  { path: '/audit', label: 'Audit Logs', moduleKey: 'audit', icon: 'Audit', group: 'Governance' },
  { path: '/billing', label: 'Usage & Billing', moduleKey: 'billing', icon: 'Billing', group: 'Governance' },
  { path: '/org', label: 'Organisation & Access', moduleKey: 'org', icon: 'Org', group: 'Governance' },
  { path: '/docs', label: 'API Documentation', moduleKey: 'docs', icon: 'Docs', group: 'Governance' },

  { path: '/alerts', label: 'Alerts & Notifications', moduleKey: 'alerts', icon: 'Bell', group: 'Settings' },
]

export const navGroups = ['Overview', 'Gateway Configuration', 'Testing & Observability', 'Governance', 'Settings']
