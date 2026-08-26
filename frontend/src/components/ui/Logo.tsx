import clsx from 'clsx'

type LogoMarkProps = {
  className?: string
  title?: string
}

export function LogoMark({ className, title = 'IndusGate AI' }: LogoMarkProps) {
  return (
    <svg
      className={clsx('block', className)}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="16" fill="url(#indusgate-bg)" />
      <path
        d="M32 10.5 48 17v13.2c0 10.7-6.3 18.4-16 22.9-9.7-4.5-16-12.2-16-22.9V17l16-6.5Z"
        fill="white"
        fillOpacity=".94"
      />
      <path
        d="M32 15.6 43.3 20v10c0 7.8-4.2 13.5-11.3 17-7.1-3.5-11.3-9.2-11.3-17V20L32 15.6Z"
        fill="#0B1733"
      />
      <path
        d="M22.7 33.2c7.9-8.5 16.4-10.5 25.6-6.1"
        stroke="#34A853"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path
        d="M15.9 34.9c8.4-11.2 19-15.5 31.8-12.7"
        stroke="#4285F4"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path
        d="M22.3 39.5c8 3.6 15.2 2.5 21.7-3.2"
        stroke="#FBBC05"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <circle cx="32" cy="31.7" r="5.8" fill="white" />
      <circle cx="32" cy="31.7" r="2.7" fill="#EA4335" />
      <path
        d="M27.2 20.9h9.6"
        stroke="white"
        strokeOpacity=".72"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="indusgate-bg" x1="7" y1="8" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4285F4" />
          <stop offset=".43" stopColor="#34A853" />
          <stop offset=".72" stopColor="#FBBC05" />
          <stop offset="1" stopColor="#EA4335" />
        </linearGradient>
      </defs>
    </svg>
  )
}

type ProductLogoProps = {
  className?: string
  markClassName?: string
  textClassName?: string
  compact?: boolean
}

export function ProductLogo({ className, markClassName, textClassName, compact = false }: ProductLogoProps) {
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <LogoMark className={clsx('h-9 w-9 shrink-0 drop-shadow-[0_10px_24px_rgba(66,133,244,0.24)]', markClassName)} />
      {!compact && (
        <div className={clsx('leading-tight', textClassName)}>
          <div className="font-heading text-h3 font-bold leading-none text-navy-ink">IndusGate AI</div>
          <div className="mt-1 text-caption font-semibold uppercase tracking-wide text-navy/45">AI Gateway</div>
        </div>
      )}
    </div>
  )
}
