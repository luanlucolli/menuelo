export function centsFromMoneyInput(value: string): number | null {
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  const cents = Number(digits)
  return Number.isSafeInteger(cents) ? cents : null
}
