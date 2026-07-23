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
    <article className="menu-cart-line">
      <div className="menu-cart-line-heading">
        <div>
          <h3>{line.productName}</h3>
          {line.variantLabel && <p>{line.variantLabel}</p>}
        </div>
        <strong>{formatMoney(calculateLineSubtotal(line))}</strong>
      </div>

      <p className="menu-cart-unit-price">
        Valor unitário: {formatMoney(line.unitPriceCents)}
      </p>

      {line.note && !editingNote && (
        <div className="menu-cart-line-note">
          <strong>Observação</strong>
          <p>{line.note}</p>
          {line.quantity > 1 && <small>Vale para todas as unidades desta linha.</small>}
        </div>
      )}

      {editingNote && (
        <div className="menu-cart-note-editor">
          <label htmlFor={`cart-note-${line.id}`}>Observação deste item</label>
          <textarea
            id={`cart-note-${line.id}`}
            value={note}
            maxLength={CART_NOTE_MAX_LENGTH}
            rows={3}
            placeholder="Ex.: sem cebola, cortar ao meio"
            onChange={(event) => setNote(event.target.value)}
          />
          <small>{note.length}/{CART_NOTE_MAX_LENGTH} caracteres</small>
          <div>
            <button type="button" onClick={() => {
              setNote(line.note)
              setEditingNote(false)
            }}>
              Cancelar
            </button>
            <button type="button" onClick={() => {
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

      <div className="menu-cart-line-actions">
        <QuantityControl
          itemName={line.productName}
          quantity={line.quantity}
          decreaseDisabled={line.quantity <= 1}
          increaseDisabled={line.quantity >= CART_QUANTITY_MAX}
          onDecrease={onDecrease}
          onIncrease={onIncrease}
        />

        {!editingNote && (
          <button className="menu-cart-note-action" type="button" onClick={() => setEditingNote(true)}>
            {line.note ? 'Editar observação' : 'Adicionar observação'}
          </button>
        )}

        <button className="menu-cart-remove" type="button" onClick={onRemove}>
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
      className="menu-cart-dialog"
      aria-labelledby="menu-cart-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <section className="menu-cart-sheet">
        <header className="menu-cart-header">
          <h2 id="menu-cart-dialog-title">Seu pedido</h2>
          <button type="button" aria-label="Fechar pedido" onClick={() => dialogRef.current?.close()}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="menu-cart-content">
          {!lines.length ? (
            <div className="menu-cart-empty">
              <h3>Seu pedido está vazio</h3>
              <p>Adicione itens do cardápio para continuar</p>
              <button type="button" onClick={() => dialogRef.current?.close()}>
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
          <footer className="menu-cart-summary">
            <div className="menu-cart-total">
              <span>Total dos produtos</span>
              <strong>{formatMoney(totalCents)}</strong>
            </div>

            {!whatsappUrl && (
              <p className="menu-cart-whatsapp-warning">
                O WhatsApp da loja ainda não está configurado.
              </p>
            )}

            <p className="menu-cart-whatsapp-help">
              Você será direcionado ao WhatsApp para confirmar o pedido com a loja.
            </p>

            {whatsappUrl ? (
              <a className="menu-cart-submit" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                Enviar pedido pelo WhatsApp
              </a>
            ) : (
              <button className="menu-cart-submit" type="button" disabled>
                Enviar pedido pelo WhatsApp
              </button>
            )}

            <button className="menu-cart-clear" type="button" onClick={onClear}>
              Limpar pedido
            </button>
          </footer>
        )}
      </section>
    </dialog>
  )
}
