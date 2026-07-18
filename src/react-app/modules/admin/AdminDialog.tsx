import { useEffect, useRef, type ReactNode } from 'react'

export function AdminDialog({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const handleCancel = (event: Event) => {
      event.preventDefault()
      onCloseRef.current()
    }
    if (!dialog.open) dialog.showModal()
    dialog.addEventListener('cancel', handleCancel)
    return () => {
      dialog.removeEventListener('cancel', handleCancel)
      if (dialog.open) dialog.close()
    }
  }, [])
  return <dialog ref={ref} className="form-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current() }}>{children}</dialog>
}
