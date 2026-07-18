import { AlertTriangle, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { AdminDialog } from './AdminDialog'

export function ConfirmDialog({ title, description, details, confirmLabel, busy = false, onConfirm, onClose }: { title: string; description: string; details?: ReactNode; confirmLabel: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  const close = () => { if (!busy) onClose() }
  return (
    <AdminDialog onClose={close}>
      <section className="admin-form-dialog confirm-dialog" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
        <div className="form-dialog-heading"><div><AlertTriangle aria-hidden="true" /><h2 id="confirm-dialog-title">{title}</h2></div><button type="button" aria-label="Fechar" disabled={busy} onClick={close}><X /></button></div>
        <p id="confirm-dialog-description">{description}</p>
        {details}
        <div className="form-actions"><button className="secondary-button" type="button" autoFocus disabled={busy} onClick={close}>Cancelar</button><button className="danger-button" type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Excluindo…' : confirmLabel}</button></div>
      </section>
    </AdminDialog>
  )
}
