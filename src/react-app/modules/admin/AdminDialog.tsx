import { useEffect, useRef, type ReactNode } from 'react'

export function AdminDialog({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const handleClose = () => onCloseRef.current()
    if (!dialog.open) dialog.showModal()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [])
  return <dialog ref={ref} className="form-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) event.currentTarget.close() }}>{children}</dialog>
}
