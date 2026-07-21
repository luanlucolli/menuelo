import type { Notice } from './AdminNotice'

export function publicChangeNotice(message: string): Notice {
  return { kind: 'success', message: `${message} Pode levar até 1 minuto para aparecer no cardápio público.` }
}
