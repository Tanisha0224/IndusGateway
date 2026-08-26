import { Icon } from '../ui/Icons'
import type { TraceStage } from '../../types'

export function TraceTimeline({ stages }: { stages: TraceStage[] }) {
  return (
    <ol className="flex flex-col gap-0">
      {stages.map((s, i) => (
        <li key={s.name} className="relative flex gap-3 pb-4 last:pb-0">
          {i < stages.length - 1 && <span className="absolute left-[9px] top-5 h-full w-px bg-navy/10" />}
          <span className={`z-10 mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full ${
            s.status === 'completed' ? 'bg-emerald' : s.status === 'warning' ? 'bg-saffron' : s.status === 'failed' ? 'bg-critical' : 'bg-navy/20'
          }`}>
            {s.status === 'completed' && <Icon.Check className="h-3 w-3 text-white" />}
            {s.status === 'failed' && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-table font-semibold text-navy-ink">{s.label}</span>
              <span className="flex-shrink-0 text-caption tnum text-navy/40">{s.durationMs}ms</span>
            </div>
            <p className="text-caption text-navy/55">{s.decision}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
