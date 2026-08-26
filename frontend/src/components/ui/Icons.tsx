// Minimal line-icon set — 24x24 grid, ~1.75px stroke, rounded caps.
// Single consistent style throughout the app (per IndusGate AI brand guide §12).
import { SVGProps } from 'react'

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const Icon = {
  Dashboard: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="12" width="8" height="9" rx="1.5" /><rect x="3" y="15" width="8" height="6" rx="1.5" /></svg>,
  Key: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l2 2M14 9l2 2" /></svg>,
  Server: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /><circle cx="7" cy="7.5" r="1" fill="currentColor" stroke="none" /><circle cx="7" cy="16.5" r="1" fill="currentColor" stroke="none" /></svg>,
  Alias: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M4 7h11a4 4 0 010 8H7" /><path d="M9 11l-3 3 3 3" /></svg>,
  Route: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 8.5v3a4 4 0 004 4h4" /></svg>,
  Budget: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5c0-1.4 1.2-2.5 2.5-2.5 1.6 0 2.5.9 2.5 2s-1 1.7-2.5 2c-1.5.3-2.5 1-2.5 2s.9 2 2.5 2c1.3 0 2.5-1.1 2.5-2.5" /></svg>,
  Play: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5v-7z" fill="currentColor" stroke="none" /></svg>,
  Trace: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M4 6h16M4 12h10M4 18h13" /><circle cx="20" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>,
  Audit: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>,
  Health: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>,
  Cache: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>,
  Billing: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></svg>,
  Org: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><rect x="9" y="3" width="6" height="6" rx="1" /><rect x="3" y="15" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><path d="M12 9v3M12 12H6v3M12 12h6v3" /></svg>,
  Bell: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M6 10a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10z" /><path d="M10 19a2 2 0 004 0" /></svg>,
  Docs: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>,
  Shield: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>,
  Chevron: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>,
  ChevronDown: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M6 9l6 6 6-6" /></svg>,
  Copy: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><rect x="9" y="9" width="11" height="11" rx="1.5" /><path d="M5 15V5a1 1 0 011-1h10" /></svg>,
  Check: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M5 13l4 4L19 7" /></svg>,
  Refresh: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3" /><path d="M18 3v5h-5M6 21v-5h5" /></svg>,
  Trash: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" /></svg>,
  Warn: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M12 4l9 16H3L12 4z" /><path d="M12 10v4M12 17h.01" /></svg>,
  Lock: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V7a4 4 0 118 0v4" /></svg>,
  Plus: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>,
  Filter: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M4 5h16M7 12h10M10 19h4" /></svg>,
  ExternalLink: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M14 5h5v5M19 5l-9 9M9 5H6a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1v-3" /></svg>,
  Sparkle: (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M12 3l1.6 4.9L18 9.5l-4.4 1.6L12 16l-1.6-4.9L6 9.5l4.4-1.6L12 3z" /></svg>,
}
