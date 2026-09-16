import { useEffect, useRef, type ReactNode } from 'react'
import { focusRing } from '../../lib/tailwind'

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
  return <dialog ref={ref} className={`fixed inset-0 z-[100] m-0 grid h-full max-h-none w-full max-w-none items-end border-0 bg-transparent p-0 backdrop:bg-[rgb(22_18_15_/_64%)] md:items-center md:p-6 ${focusRing}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current() }}>{children}</dialog>
}
