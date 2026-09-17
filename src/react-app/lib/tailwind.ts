export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export const focusRing = 'focus-visible:outline-[3px] focus-visible:outline-[var(--color-brand)] focus-visible:outline-offset-2'

export const primaryButton = `inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-[.4rem] rounded-[.55rem] border-0 bg-[var(--color-brand)] px-4 py-[.7rem] font-[800] text-[var(--color-brand-text)] no-underline transition-opacity motion-reduce:transition-none [&_svg]:h-[1.05rem] [&_svg]:w-[1.05rem] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

export const secondaryButton = `inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-[.4rem] rounded-[.55rem] border border-border bg-surface-strong px-[.9rem] py-[.65rem] font-[750] no-underline transition-colors motion-reduce:transition-none [&_svg]:h-[1.05rem] [&_svg]:w-[1.05rem] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

export const dangerButton = `inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-[.4rem] rounded-[.55rem] border border-danger bg-danger px-[.9rem] py-[.65rem] font-[750] text-white no-underline transition-opacity motion-reduce:transition-none [&_svg]:h-[1.05rem] [&_svg]:w-[1.05rem] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

export const iconButton = `inline-grid h-9 w-9 cursor-pointer place-items-center rounded-[.45rem] border border-border bg-white text-text transition-opacity motion-reduce:transition-none [&_svg]:h-4 [&_svg]:w-4 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`

export const fieldLabel = 'grid gap-[.35rem] text-[.8rem] font-[750] text-[#423e38] [&_small]:font-[500] [&_small]:text-muted'

export const textInput = `min-h-[44px] w-full rounded-[.55rem] border border-border bg-white px-[.7rem] py-[.6rem] text-text ${focusRing} aria-[invalid=true]:border-danger`

export const checkField = `flex min-h-[44px] items-center gap-[.5rem] text-[.8rem] font-[650] text-text ${focusRing}`

export const fieldError = 'mt-[.35rem] block text-[.78rem] font-[600] text-danger'

export const fieldHelp = 'mt-[.35rem] block text-[.78rem] text-muted'
