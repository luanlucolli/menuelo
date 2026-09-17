import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../../../../shared/utils'
import { buildWhatsappOrder, buildWhatsappOrderUrl } from './cart/buildWhatsappOrder'
import type { CartLine } from './cart/cart-types'
import {
  CART_NOTE_MAX_LENGTH,
  CART_QUANTITY_MAX,
  calculateLineSubtotal,
  normalizeCartNote,
} from './cart/cart-utils'
import { QuantityControl } from './QuantityControl'
import { focusRing, publicCartFocusRing } from '../../lib/tailwind'

function CartLineItem({
  line,
  onIncrease,
  onDecrease,
  onRemove,
  onUpdateNote,
}: {
  line: CartLine
  onIncrease: () => void
  onDecrease: () => void
  onRemove: () => void
  onUpdateNote: (note: string) => void
}) {
  const [editingNote, setEditingNote] = useState(false)
  const [note, setNote] = useState(line.note)

  return (
    <article className="border-b border-menu-border py-5 last:border-b-0">
      <div className="flex items-start justify-between gap-3.5">
        <div className="min-w-0">
          <h3 className="m-0 [overflow-wrap:anywhere] text-base font-[780] leading-[1.3]">{line.productName}</h3>
          {line.variantLabel && <p className="mt-1 text-[.76rem] leading-[1.4] text-menu-muted">{line.variantLabel}</p>}
        </div>
        <strong className="shrink-0 text-[.98rem] font-[820]">{formatMoney(calculateLineSubtotal(line))}</strong>
      </div>

      <p className="mt-1 text-[.76rem] leading-[1.4] text-menu-muted">
        Valor unitário: {formatMoney(line.unitPriceCents)}
      </p>

      {line.customizationDetails && line.customizationDetails.length > 0 && (
        <div className="mt-[11px] grid gap-2 border-l-2 border-[color-mix(in_srgb,var(--color-brand)_45%,var(--color-menu-border))] pl-2.5">
          {line.customizationDetails.map((group) => (
            <div key={group.groupId}>
              <strong className="text-[.75rem] font-[780]">{group.name}</strong>
              <ul className="mt-[3px] grid list-none gap-0.5 p-0">
                {group.options.map((option) => (
                  <li className="[overflow-wrap:anywhere] text-[.76rem] leading-[1.4] text-menu-muted" key={option.optionId}>{option.quantity}x {option.name}{option.priceDeltaCents > 0 && ` (+ ${formatMoney(option.priceDeltaCents)})`}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {line.note && !editingNote && (
        <div className="mt-3 rounded-[10px] bg-menu-surface-muted px-[11px] py-2.5">
          <strong className="text-[.72rem] font-[780]">Observação</strong>
          <p className="mt-[3px] [overflow-wrap:anywhere] text-[.82rem] leading-[1.45]">{line.note}</p>
          {line.quantity > 1 && <small className="mt-[5px] block text-[.7rem] text-menu-muted">Vale para todas as unidades desta linha.</small>}
        </div>
      )}

      {editingNote && (
        <div className="mt-3.5 grid gap-[7px]">
          <label className="text-[.88rem] font-[740]" htmlFor={`cart-note-${line.id}`}>Observação deste item</label>
          <textarea
            id={`cart-note-${line.id}`}
            value={note}
            maxLength={CART_NOTE_MAX_LENGTH}
            rows={3}
            className={`min-h-[86px] w-full resize-y rounded-[11px] border border-menu-border bg-menu-surface px-3 py-[11px] text-[.9rem] leading-[1.45] text-menu-text focus-visible:border-[var(--color-brand)] focus-visible:outline-[3px] focus-visible:outline-[color-mix(in_srgb,var(--color-brand)_22%,transparent)] ${focusRing}`}
            placeholder="Ex.: sem cebola, cortar ao meio"
            onChange={(event) => setNote(event.target.value)}
          />
          <small className="text-[.73rem] leading-[1.4] text-menu-muted">{note.length}/{CART_NOTE_MAX_LENGTH} caracteres</small>
          <div className="flex justify-end gap-3">
            <button className={`min-h-11 cursor-pointer border-0 bg-transparent px-1 text-[.76rem] font-[700] underline underline-offset-[3px] ${publicCartFocusRing}`} type="button" onClick={() => {
              setNote(line.note)
              setEditingNote(false)
            }}>
              Cancelar
            </button>
            <button className={`min-h-11 cursor-pointer border-0 bg-transparent px-1 text-[.76rem] font-[700] text-[color-mix(in_srgb,var(--color-brand)_78%,#211f1c)] underline underline-offset-[3px] ${publicCartFocusRing}`} type="button" onClick={() => {
              const normalizedNote = normalizeCartNote(note)
              onUpdateNote(normalizedNote)
              setNote(normalizedNote)
              setEditingNote(false)
            }}>
              Salvar observação
            </button>
          </div>
        </div>
      )}

      <div className="mt-[15px] flex flex-wrap items-center gap-[8px_12px] max-[359px]:items-start max-[359px]:flex-col">
        <QuantityControl
          itemName={line.productName}
          quantity={line.quantity}
          decreaseDisabled={line.quantity <= 1}
          increaseDisabled={line.quantity >= CART_QUANTITY_MAX}
          onDecrease={onDecrease}
          onIncrease={onIncrease}
        />

        {!editingNote && (
          <button className={`min-h-11 cursor-pointer border-0 bg-transparent px-1 text-[.76rem] font-[700] text-menu-text underline underline-offset-[3px] ${publicCartFocusRing}`} type="button" onClick={() => setEditingNote(true)}>
            {line.note ? 'Editar observação' : 'Adicionar observação'}
          </button>
        )}

        <button className={`min-h-11 cursor-pointer border-0 bg-transparent px-1 text-[.76rem] font-[700] text-menu-danger underline underline-offset-[3px] ${publicCartFocusRing}`} type="button" onClick={onRemove}>
          Remover {line.productName}
        </button>
      </div>
    </article>
  )
}

export function CartDialog({
  businessName,
  whatsapp,
  lines,
  totalCents,
  onClose,
  onIncrease,
  onDecrease,
  onRemove,
  onUpdateNote,
  onClear,
}: {
  businessName: string
  whatsapp: string | null
  lines: CartLine[]
  totalCents: number
  onClose: () => void
  onIncrease: (lineId: string) => void
  onDecrease: (lineId: string) => void
  onRemove: (lineId: string) => void
  onUpdateNote: (lineId: string, note: string) => void
  onClear: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const message = buildWhatsappOrder(businessName, lines)
  const whatsappUrl = buildWhatsappOrderUrl(whatsapp, message)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    const handleClose = () => onCloseRef.current()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto h-auto max-h-[min(90dvh,820px)] w-[min(calc(100%_-_30px),620px)] max-w-none overflow-visible border-0 bg-transparent p-0 text-menu-text motion-reduce:scroll-auto max-[639px]:inset-auto max-[639px]:right-0 max-[639px]:bottom-0 max-[639px]:left-0 max-[639px]:m-0 max-[639px]:max-h-[calc(100dvh_-_max(8px,env(safe-area-inset-top)))] max-[639px]:w-full max-[639px]:overflow-hidden backdrop:bg-[rgb(24_21_18_/_68%)] backdrop:backdrop-blur-[2px]"
      aria-labelledby="menu-cart-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <section className="flex max-h-[min(90dvh,820px)] w-full flex-col overflow-hidden rounded-[22px] bg-menu-surface shadow-[0_28px_70px_rgb(0_0_0_/_34%)] motion-reduce:scroll-auto max-[639px]:h-[calc(100dvh_-_max(8px,env(safe-area-inset-top)))] max-[639px]:max-h-none max-[639px]:rounded-[22px_22px_0_0]">
        <header className="flex min-h-[68px] shrink-0 items-center justify-between border-b border-menu-border bg-menu-surface px-[14px] py-3 pl-5">
          <h2 className="m-0 text-[1.32rem] font-[820] tracking-[-.025em]" id="menu-cart-dialog-title">Seu pedido</h2>
          <button className={`grid h-11 w-11 cursor-pointer place-items-center rounded-full border-0 bg-menu-surface-muted text-menu-text ${publicCartFocusRing}`} type="button" aria-label="Fechar pedido" onClick={() => dialogRef.current?.close()}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 [scrollbar-gutter:stable] motion-reduce:scroll-auto max-[639px]:px-[18px]">
          {!lines.length ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-4 py-10 text-center">
              <h3 className="m-0 text-[1.2rem]">Seu pedido está vazio</h3>
              <p className="mt-2 text-[.88rem] text-menu-muted">Adicione itens do cardápio para continuar</p>
              <button className={`mt-5 min-h-[46px] cursor-pointer rounded-[11px] border border-menu-border bg-menu-surface px-4 py-[9px] font-[720] ${publicCartFocusRing}`} type="button" onClick={() => dialogRef.current?.close()}>
                Voltar ao cardápio
              </button>
            </div>
          ) : lines.map((line) => (
            <CartLineItem
              key={line.id}
              line={line}
              onIncrease={() => onIncrease(line.id)}
              onDecrease={() => onDecrease(line.id)}
              onRemove={() => onRemove(line.id)}
              onUpdateNote={(note) => onUpdateNote(line.id, note)}
            />
          ))}
        </div>

        {lines.length > 0 && (
          <footer className="shrink-0 border-t border-menu-border bg-menu-surface px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3.5 shadow-[0_-7px_20px_rgb(27_23_19_/_7%)] max-[639px]:px-[18px]">
            <div className="flex items-center justify-between gap-4 text-[.92rem] font-[720]">
              <span>Total dos produtos</span>
              <strong className="text-[1.15rem] font-[840]">{formatMoney(totalCents)}</strong>
            </div>

            {!whatsappUrl && (
              <p className="mt-[9px] text-[.73rem] font-[700] leading-[1.4] text-menu-danger">
                O WhatsApp da loja ainda não está configurado.
              </p>
            )}

            <p className="mt-[9px] text-[.73rem] leading-[1.4] text-menu-muted">
              Você será direcionado ao WhatsApp para confirmar o pedido com a loja.
            </p>

            {whatsappUrl ? (
              <a className={`mt-3 flex min-h-[52px] w-full items-center justify-center rounded-[13px] border-0 bg-[var(--color-brand)] px-3.5 py-2.5 text-center text-[.9rem] font-[800] text-[var(--color-brand-text)] no-underline ${publicCartFocusRing}`} href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                Enviar pedido pelo WhatsApp
              </a>
            ) : (
              <button className={`mt-3 flex min-h-[52px] w-full items-center justify-center rounded-[13px] border-0 bg-[#dad6d0] px-3.5 py-2.5 text-center text-[.9rem] font-[800] text-[#6e6962] disabled:cursor-not-allowed ${publicCartFocusRing}`} type="button" disabled>
                Enviar pedido pelo WhatsApp
              </button>
            )}

            <button className={`mx-auto mb-[-8px] mt-[3px] block min-h-11 cursor-pointer border-0 bg-transparent px-1 text-[.76rem] font-[700] text-menu-danger underline underline-offset-[3px] ${publicCartFocusRing}`} type="button" onClick={onClear}>
              Limpar pedido
            </button>
          </footer>
        )}
      </section>
    </dialog>
  )
}
