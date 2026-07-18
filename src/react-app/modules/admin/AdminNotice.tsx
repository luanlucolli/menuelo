import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'

export type NoticeKind = 'success' | 'error' | 'info'

export interface Notice {
  kind: NoticeKind
  message: string
}

export function AdminNotice({ notice, action }: { notice: Notice; action?: ReactNode }) {
  const Icon = notice.kind === 'success' ? CheckCircle2 : notice.kind === 'error' ? AlertCircle : Info
  return (
    <div className={`feedback ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'} aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}>
      <Icon aria-hidden="true" />
      <span>{notice.message}</span>
      {action}
    </div>
  )
}
