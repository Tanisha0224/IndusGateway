import { format, formatDistanceToNow } from 'date-fns'

export function inr(n: number, decimals = 2) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
export function num(n: number) { return n.toLocaleString('en-US') }
export function pct(n: number, decimals = 0) { return (n * 100).toFixed(decimals) + '%' }
export function dateShort(iso: string) { return format(new Date(iso), 'dd MMM yyyy') }
export function dateTime(iso: string) { return format(new Date(iso), 'dd MMM yyyy, HH:mm') }
export function relative(iso: string) { return formatDistanceToNow(new Date(iso), { addSuffix: true }) }
export function ms(n: number) { return n >= 1000 ? (n / 1000).toFixed(2) + 's' : Math.round(n) + 'ms' }
