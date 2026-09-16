import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/tailwind'

export type NoticeKind = 'success' | 'error' | 'info'

export interface Notice {
  kind: NoticeKind
  message: string
}

export function AdminNotice({ notice, action }: { notice: Notice; action?: ReactNode }) {
  const Icon = notice.kind === 'success' ? CheckCircle2 : notice.kind === 'error' ? AlertCircle : Info
  return (
    <div className={cn('my-[.8rem] flex items-start gap-[.55rem] rounded-[.6rem] border p-[.7rem_.85rem] [&>svg]:mt-[.08rem] [&>svg]:h-[1.15rem] [&>svg]:w-[1.15rem] [&>svg]:shrink-0 [&>span]:flex-1', notice.kind === 'success' && 'border-[#b8ddc8] bg-[#e7f5ed] text-[#155b36]', notice.kind === 'error' && 'border-[#e0aaaa] bg-[#fff0f0] text-danger', notice.kind === 'info' && 'border-[#b9cee3] bg-[#edf6ff] text-[#234f74]')} role={notice.kind === 'error' ? 'alert' : 'status'} aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}>
      <Icon aria-hidden="true" />
      <span>{notice.message}</span>
      {action}
    </div>
  )
}
