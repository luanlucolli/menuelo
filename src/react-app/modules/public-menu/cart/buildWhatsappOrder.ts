import { formatMoney, normalizeWhatsappNumber } from '../../../../../shared/utils'
import type { CartLine } from './cart-types'
import { calculateCartTotal, calculateLineSubtotal, normalizeCartNote } from './cart-utils'

export function buildWhatsappOrder(businessName: string, lines: CartLine[]): string {
  const items = lines.map((line, index) => {
    const details = [
      `*${index + 1}. ${line.quantity}x ${line.productName}*`,
      line.variantLabel?.trim() ? `Opção: ${line.variantLabel.trim()}` : null,
      line.customizationDetails?.length
        ? ['Montagem:', ...line.customizationDetails.map((group) => `- ${group.name}: ${group.options.map((option) => `${option.quantity}x ${option.name}${option.priceDeltaCents > 0 ? ` (+ ${formatMoney(option.priceDeltaCents)})` : ''}`).join(', ')}`)].join('\n')
        : null,
      `Valor unitário: ${formatMoney(line.unitPriceCents)}`,
      `Subtotal: ${formatMoney(calculateLineSubtotal(line))}`,
      normalizeCartNote(line.note) ? `Observação: ${normalizeCartNote(line.note)}` : null,
    ]
    return details.filter((detail): detail is string => Boolean(detail)).join('\n')
  })

  return [
    `Olá! Quero fazer este pedido na *${businessName.trim()}*:`,
    '',
    items.join('\n\n'),
    '',
    `*Total dos produtos: ${formatMoney(calculateCartTotal(lines))}*`,
    '',
    'Pedido montado pelo cardápio digital.',
  ].join('\n')
}

export function buildWhatsappOrderUrl(whatsapp: string | null, message: string): string | null {
  const number = normalizeWhatsappNumber(whatsapp)
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null
}
