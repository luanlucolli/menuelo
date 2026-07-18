import type { BusinessHour } from '../schemas'

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

export function slugify(value: string): string {
  return normalizeSearch(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item'
}

export function parseTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export interface OpenStatus {
  isOpen: boolean
  closesAt?: string
}

export function calculateOpenStatus(hours: BusinessHour[], weekday: number, minutesNow: number): OpenStatus | null {
  const representedDays = new Set(hours.map((hour) => hour.weekday))
  if (representedDays.size !== 7) return null

  const today = hours.filter((hour) => hour.weekday === weekday && !hour.isClosed)
  const yesterdayWeekday = (weekday + 6) % 7
  const yesterday = hours.filter((hour) => hour.weekday === yesterdayWeekday && !hour.isClosed)

  for (const interval of today) {
    if (!interval.opensAt || !interval.closesAt) continue
    const opens = parseTime(interval.opensAt)
    const closes = parseTime(interval.closesAt)
    if (closes > opens && minutesNow >= opens && minutesNow < closes) return { isOpen: true, closesAt: interval.closesAt }
    if (closes <= opens && minutesNow >= opens) return { isOpen: true, closesAt: interval.closesAt }
  }

  for (const interval of yesterday) {
    if (!interval.opensAt || !interval.closesAt) continue
    const opens = parseTime(interval.opensAt)
    const closes = parseTime(interval.closesAt)
    if (closes <= opens && minutesNow < closes) return { isOpen: true, closesAt: interval.closesAt }
  }

  return { isOpen: false }
}

export function getZonedClock(date: Date, timezone: string): { weekday: number; minutes: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { weekday: weekdays[parts.weekday] ?? 0, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}
