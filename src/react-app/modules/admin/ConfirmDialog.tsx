import { AlertTriangle, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { AdminDialog } from './AdminDialog'
import { dangerButton, focusRing, secondaryButton } from '../../lib/tailwind'

export function ConfirmDialog({ title, description, details, confirmLabel, busy = false, onConfirm, onClose }: { title: string; description: string; details?: ReactNode; confirmLabel: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  const close = () => { if (!busy) onClose() }
  return (
    <AdminDialog onClose={close}>
      <section className="w-full max-h-[94dvh] max-w-[31rem] overflow-y-auto rounded-[1.2rem_1.2rem_0_0] bg-surface-strong p-4 shadow-menu-lg md:rounded-[1rem]" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
        <div className="mb-4 flex items-center justify-between gap-4"><div className="flex items-center gap-[.55rem]"><AlertTriangle className="w-[1.35rem] text-danger" aria-hidden="true" /><h2 className="m-0" id="confirm-dialog-title">{title}</h2></div><button className={`grid h-11 w-11 place-items-center rounded-full bg-[#efebe5] text-[1.5rem] ${focusRing}`} type="button" aria-label="Fechar" disabled={busy} onClick={close}><X /></button></div>
        <p className="my-[.4rem] mb-4 text-muted [line-height:1.55]" id="confirm-dialog-description">{description}</p>
        {details}
        <div className="mt-2 flex flex-wrap justify-end gap-[.55rem]"><button className={secondaryButton} type="button" autoFocus disabled={busy} onClick={close}>Cancelar</button><button className={dangerButton} type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Excluindo…' : confirmLabel}</button></div>
      </section>
    </AdminDialog>
  )
}
