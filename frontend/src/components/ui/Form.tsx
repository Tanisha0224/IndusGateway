import clsx from 'clsx'
import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function Field({ label, required, helper, error, children, htmlFor }: { label: string; required?: boolean; helper?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-table font-semibold text-navy">
        {label} {required ? <span className="text-critical">*</span> : <span className="font-normal text-navy/40">(optional)</span>}
      </label>
      {children}
      {helper && !error && <span className="text-caption text-navy/50">{helper}</span>}
      {error && <span className="text-caption font-medium text-critical">{error}</span>}
    </div>
  )
}

const baseInput = 'h-11 w-full rounded-md border border-navy/20 bg-white px-3.5 text-body text-navy-ink placeholder:text-navy/35 focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/25 disabled:bg-ivory disabled:text-navy/40'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  const { className, error, ...rest } = props
  return <input className={clsx(baseInput, error && 'border-critical focus:border-critical focus:ring-critical/20', className)} {...rest} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props
  return <textarea className={clsx(baseInput, 'h-auto min-h-[96px] py-2.5', className)} {...rest} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props
  return (
    <select className={clsx(baseInput, 'appearance-none bg-[url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="%231A2B4A"><path d="M5.5 7.5l4.5 4.5 4.5-4.5"/></svg>\')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} {...rest}>
      {children}
    </select>
  )
}

export function Checkbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-body text-navy-ink">
      <input type="checkbox" className="h-[18px] w-[18px] rounded border-navy/30 text-saffron focus:ring-saffron/40" {...rest} />
      {label}
    </label>
  )
}

export function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-navy/10 pb-2">
      <h4 className="font-heading text-body-lg font-semibold text-navy-ink">{title}</h4>
      {description && <p className="mt-0.5 text-table text-navy/55">{description}</p>}
    </div>
  )
}
