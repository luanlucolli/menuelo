import {
  AtSign,
  ChevronDown,
  Clock3,
  ExternalLink,
  MapPin,
  Megaphone,
  Phone,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type {
  MenuResponse,
  ZonedClock,
} from '../../../../shared/schemas'
import { safePublicHttpUrl } from '../../../../shared/public-seo'
import {
  buildGoogleMapsDirectionsUrl,
  calculateOpenStatus,
  formatBrazilianPhone,
  formatMoney,
  formatStructuredAddress,
  normalizeWhatsappNumber,
  readableBrandText,
} from '../../../../shared/utils'
import whatsappLogo from '../../../assets/WhatsApp-logo.webp'
import { CartBar } from './CartBar'
import { CartDialog } from './CartDialog'
import { ProductCard, ProductDialog } from './ProductCard'
import { useCart } from './cart/useCart'
import { usePublicMenuInteractions } from './usePublicMenuInteractions'
import { cn, focusRing } from '../../lib/tailwind'

const WEEKDAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

const storeItemClass = `grid min-h-[62px] grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-t border-menu-border py-[11px] no-underline first:border-t-0 min-[650px]:rounded-[.7rem] min-[650px]:border-0 min-[650px]:bg-[#faf8f4] min-[650px]:p-3 ${focusRing}`
const storeIconClass = 'h-[30px] w-[30px] shrink-0 rounded-[9px] bg-[color-mix(in_srgb,var(--color-brand)_9%,#fff)] p-[5px] text-[var(--color-brand)]'
const footerHeadingClass = 'mb-[11px] flex items-center gap-2 text-[.92rem] font-[760] text-white [&_svg]:h-[17px] [&_svg]:w-[17px]'
const footerTextClass = 'm-0 text-[.82rem] leading-[1.55] text-[rgb(255_255_255_/_68%)]'
const footerLinkClass = `mt-2.5 inline-flex items-center gap-1.5 text-[.82rem] font-[700] text-white no-underline [&_svg]:h-[15px] [&_svg]:w-[15px] ${focusRing}`
const footerListClass = 'm-0 grid list-none gap-[7px] p-0'
const footerListItemClass = 'flex items-start justify-between gap-4 text-[.8rem] text-[rgb(255_255_255_/_68%)]'

type PublicThemeStyle = CSSProperties & {
  '--color-brand': string
  '--color-brand-text': string
}

export function PublicMenu({
  menu,
  initialClock,
}: {
  menu: MenuResponse
  initialClock: ZonedClock
}) {
  const {
    activeCategory,
    categories,
    categoryNavRef,
    clock,
    closeProduct,
    search,
    searching,
    selected,
    selectProduct,
    setSearch,
    scrollToCategory,
  } = usePublicMenuInteractions(menu, initialClock)
  const cart = useCart(menu)
  const [cartOpen, setCartOpen] = useState(false)
  const [itemAddedFeedback, setItemAddedFeedback] = useState<string | null>(null)
  const cartTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!itemAddedFeedback) return
    const timeout = window.setTimeout(() => setItemAddedFeedback(null), 2800)
    return () => window.clearTimeout(timeout)
  }, [itemAddedFeedback])

  const allProducts = categories.flatMap(
    (category) => category.products,
  )

  const promotions = allProducts.filter((product) =>
    product.variants.some(
      (variant) =>
        variant.isActive &&
        variant.promotionalPriceCents !== null,
    ),
  )

  const promotionIds = new Set(
    promotions.map((product) => product.id),
  )

  const featured = allProducts.filter(
    (product) =>
      product.isFeatured && !promotionIds.has(product.id),
  )

  const openStatus = calculateOpenStatus(
    menu.hours,
    clock.weekday,
    clock.minutes,
  )

  const whatsappDigits = normalizeWhatsappNumber(menu.business.whatsapp)
  const validWhatsapp = Boolean(whatsappDigits)

  const phoneDigits = (
    menu.business.phone ?? ''
  ).replace(/\D/g, '')

  const showPhone = Boolean(
    menu.business.phone &&
      (!validWhatsapp || phoneDigits !== whatsappDigits),
  )

  const formattedWhatsapp = menu.business.whatsapp
    ? formatBrazilianPhone(menu.business.whatsapp)
    : ''

  const formattedPhone = menu.business.phone
    ? formatBrazilianPhone(menu.business.phone)
    : ''

  const businessAddress =
    formatStructuredAddress(menu.business) ??
    menu.business.address

  const mapsUrl =
    safePublicHttpUrl(menu.business.mapsUrl) ??
    buildGoogleMapsDirectionsUrl(businessAddress)

  const instagramUrl = safePublicHttpUrl(
    menu.business.instagramUrl,
  )

  const facebookUrl = safePublicHttpUrl(
    menu.business.facebookUrl,
  )

  const locationTitle =
    menu.business.addressNeighborhood ||
    businessAddress ||
    'Localização'

  const locationSubtitle =
    menu.business.addressNeighborhood &&
    (menu.business.addressCity ||
      menu.business.addressState)
      ? [
          menu.business.addressCity,
          menu.business.addressState,
        ]
          .filter(Boolean)
          .join(', ')
      : null

  const heroLocation = [
    menu.business.addressCity,
    menu.business.addressState,
  ]
    .filter(Boolean)
    .join(', ')

  const showBusinessInfo = Boolean(
    validWhatsapp ||
      showPhone ||
      (businessAddress && mapsUrl) ||
      instagramUrl ||
      facebookUrl ||
      menu.hours.length,
  )

  const specialMessage =
    menu.business.specialMessage?.trim()

  const marqueeCopies = specialMessage
    ? specialMessage.length <= 20
      ? 6
      : specialMessage.length <= 50
        ? 4
        : specialMessage.length <= 100
          ? 3
          : 2
    : 0

  const marqueeDuration = specialMessage
    ? Math.max(
        26,
        Math.min(
          120,
          marqueeCopies * (specialMessage.length * 0.22 + 5),
        ),
      )
    : 0

  const publicTheme: PublicThemeStyle = {
    '--color-brand': menu.business.primaryColor,
    '--color-brand-text': readableBrandText(
      menu.business.primaryColor,
    ),
  }

  return (
    <div
      className="min-h-screen overflow-x-clip bg-menu-background text-menu-text [text-rendering:optimizeLegibility]"
      style={publicTheme}
    >
      <header
        className="relative min-h-[220px] overflow-hidden bg-[var(--color-brand)] bg-cover bg-center text-white min-[720px]:min-h-[270px] min-[1024px]:min-h-[300px]"
        style={
          menu.business.coverImageKey
            ? {
                backgroundImage: `url(/media/${menu.business.coverImageKey})`,
              }
            : undefined
        }
      >
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0_/_12%)_0%,rgb(0_0_0_/_28%)_42%,rgb(0_0_0_/_88%)_100%)]"
          aria-hidden="true"
        />

        <div className="relative z-[1] mx-auto flex min-h-[220px] w-full max-w-[1120px] flex-col items-start justify-end px-[18px] pb-5 pt-7 min-[720px]:min-h-[270px] min-[720px]:px-6 min-[720px]:pb-[30px] min-[1024px]:min-h-[300px]">
          <h1 className="m-0 max-w-[18ch] text-[clamp(1.85rem,7vw,3.25rem)] font-[800] leading-[1.03] tracking-[-.045em] [text-wrap:balance] [text-shadow:0_2px_18px_rgb(0_0_0_/_42%)]">{menu.business.name}</h1>

          {menu.business.slogan && (
            <p className="mt-2 max-w-[42rem] text-[.94rem] leading-[1.45] text-[rgb(255_255_255_/_84%)]">
              {menu.business.slogan}
            </p>
          )}

          <div className="mt-3.5 flex w-full flex-wrap items-center gap-[10px_16px]">
            {openStatus && (
              <div
                className="inline-flex min-h-[38px] items-center gap-[9px] rounded-[10px] border border-[rgb(255_255_255_/_18%)] bg-[rgb(16_16_16_/_66%)] px-3 py-[7px] shadow-[0_5px_18px_rgb(0_0_0_/_22%)] backdrop-blur-[10px]"
              >
                <span className={cn('h-[9px] w-[9px] shrink-0 rounded-full', openStatus.isOpen ? 'bg-[#41db85] shadow-[0_0_0_4px_rgb(65_219_133_/_16%)]' : 'bg-[#ff7474] shadow-[0_0_0_4px_rgb(255_116_116_/_16%)]')} aria-hidden="true" />

                <div className="flex flex-col">
                  <strong className="text-[.82rem] leading-[1.1]">
                    {openStatus.isOpen
                      ? 'Aberto agora'
                      : 'Fechado agora'}
                  </strong>

                  {openStatus.isOpen &&
                    openStatus.closesAt && (
                      <small className="mt-0.5 text-[.7rem] text-[rgb(255_255_255_/_74%)]">
                        Fecha às {openStatus.closesAt}
                      </small>
                    )}
                </div>
              </div>
            )}

            {heroLocation && (
              <span className="inline-flex items-center gap-1.5 text-[.82rem] font-[600] text-[rgb(255_255_255_/_82%)]">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {heroLocation}
              </span>
            )}
          </div>
        </div>
      </header>

      <main>
        {specialMessage && (
          <div className="relative flex min-h-[46px] w-full items-center overflow-hidden border-b border-[color-mix(in_srgb,var(--color-brand)_18%,var(--color-menu-border))] bg-[color-mix(in_srgb,var(--color-brand)_7%,#fff)] text-menu-text">
            <span className="sr-only">{specialMessage}</span>

            <div
              className="w-full min-w-0 overflow-hidden [mask-image:linear-gradient(to_right,transparent_0,#000_18px,#000_calc(100%_-_18px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,#000_18px,#000_calc(100%_-_18px),transparent_100%)] motion-reduce:overflow-visible motion-reduce:[mask-image:none] motion-reduce:[-webkit-mask-image:none]"
              aria-hidden="true"
            >
              <div
                className="flex w-max animate-menu-marquee [backface-visibility:hidden] [will-change:transform] [transform:translate3d(0,0,0)] [@media(hover:hover)]:hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:transform-none motion-reduce:animate-none motion-reduce:[will-change:auto]"
                style={{
                  animationDuration: `${marqueeDuration}s`,
                }}
              >
                {[0, 1].map((groupIndex) => (
                  <div
                    className="flex shrink-0 items-center gap-[clamp(36px,8vw,72px)] pr-[clamp(36px,8vw,72px)] motion-reduce:hidden motion-reduce:first-child:flex motion-reduce:first-child:w-full motion-reduce:first-child:px-[18px]"
                    key={groupIndex}
                  >
                    {Array.from(
                      { length: marqueeCopies },
                      (_, itemIndex) => (
                        <span
                          className="inline-flex min-h-[46px] shrink-0 items-center gap-[clamp(36px,8vw,72px)] whitespace-nowrap text-[.86rem] font-[700] tracking-[.005em] motion-reduce:hidden motion-reduce:first-child:inline-flex motion-reduce:first-child:whitespace-normal"
                          key={`${groupIndex}-${itemIndex}`}
                        >
                          <Megaphone className="h-[17px] w-[17px] shrink-0 text-[var(--color-brand)] [stroke-width:2.2]" aria-hidden="true" />
                          <span>{specialMessage}</span>
                        </span>
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showBusinessInfo && (
          <details className="group border-b border-menu-border bg-menu-surface">
            <summary className="mx-auto flex min-h-[58px] w-full max-w-[1120px] cursor-pointer list-none items-center justify-between px-[18px] py-2.5 select-none marker:hidden min-[720px]:px-6 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 flex-col">
                <strong className="text-[.92rem] font-[750]">Informações da loja</strong>
                <small className="mt-0.5 text-[.74rem] text-menu-muted">
                  Contato, localização e horários
                </small>
              </span>

              <ChevronDown
                className="h-5 w-5 text-menu-muted transition-transform duration-150 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>

            <div className="mx-auto grid w-full max-w-[1120px] gap-0 px-[18px] pb-4 min-[650px]:grid-cols-2 min-[650px]:gap-[28px] min-[650px]:p-[.6rem_24px]">
              {whatsappDigits && (
                <a
                  className={storeItemClass}
                  href={`https://wa.me/${whatsappDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir WhatsApp: ${formattedWhatsapp}`}
                >
                  <img
                    className={storeIconClass}
                    src={whatsappLogo}
                    alt=""
                    aria-hidden="true"
                  />

                  <div className="flex min-w-0 flex-col">
                    <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[.88rem] font-[720]">{formattedWhatsapp}</strong>
                    <span className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[.74rem] text-menu-muted">Falar pelo WhatsApp</span>
                  </div>

                  <ExternalLink className="h-[17px] w-[17px] text-[#aaa49c]" aria-hidden="true" />
                </a>
              )}

              {showPhone && (
                <a
                  className={storeItemClass}
                  href={`tel:${phoneDigits}`}
                >
                  <Phone className={storeIconClass} aria-hidden="true" />

                  <div className="flex min-w-0 flex-col">
                    <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[.88rem] font-[720]">{formattedPhone}</strong>
                    <span className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[.74rem] text-menu-muted">Ligar para a loja</span>
                  </div>
                </a>
              )}

              {businessAddress && mapsUrl && (
                <a
                  className={storeItemClass}
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ver localização: ${businessAddress}`}
                >
                  <div
                    className="relative h-9 w-9 shrink-0 overflow-hidden rounded-[10px] border border-menu-border bg-[#f5f2ed]"
                    aria-hidden="true"
                  >
                    <span className="absolute left-1 top-1 z-0 h-2 w-2 rounded-[3px] border border-[#e8e2da] bg-[#eeebe5] shadow-[16px_15px_0_#ece7df]" />
                    <span className="absolute right-[3px] bottom-1 z-0 h-[7px] w-2 rounded-[3px] border border-[#e8e2da] bg-[#eeebe5]" />
                    <span className="absolute left-[-7px] top-[6px] z-[1] h-[5px] w-[49px] rotate-[-14deg] rounded-full border border-[#e6e0d8] bg-white" />
                    <span className="absolute left-[-4px] top-6 z-[1] h-[6px] w-11 rotate-[20deg] rounded-full border border-[#e6e0d8] bg-white" />
                    <span className="absolute left-6 top-[-5px] z-[1] h-[47px] w-[5px] rotate-[12deg] rounded-full border border-[#e6e0d8] bg-white" />
                    <span className="absolute left-[13px] top-2.5 z-[2] h-3 w-3 rotate-[-45deg] rounded-[50%_50%_50%_0] border-2 border-white bg-[var(--color-brand)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-brand)_18%,transparent)] after:absolute after:left-0.5 after:top-0.5 after:h-1 after:w-1 after:rounded-full after:bg-white after:content-['']" />
                  </div>

                  <div className="flex min-w-0 flex-col">
                    <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[.88rem] font-[720]">{locationTitle}</strong>
                    <span className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[.74rem] text-menu-muted">
                      {locationSubtitle ||
                        'Abrir no Google Maps'}
                    </span>
                  </div>

                  <ExternalLink className="h-[17px] w-[17px] text-[#aaa49c]" aria-hidden="true" />
                </a>
              )}

              {menu.hours.length > 0 && (
                <a
                  className={storeItemClass}
                  href="#horarios-da-loja"
                >
                  <Clock3 className={storeIconClass} aria-hidden="true" />

                  <div className="flex min-w-0 flex-col">
                    <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[.88rem] font-[720]">Horários</strong>
                    <span className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[.74rem] text-menu-muted">Ver dias e horários</span>
                  </div>
                </a>
              )}

              {instagramUrl && (
                <a
                  className={storeItemClass}
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <AtSign className={storeIconClass} aria-hidden="true" />

                  <div className="flex min-w-0 flex-col">
                    <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[.88rem] font-[720]">Instagram</strong>
                    <span className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[.74rem] text-menu-muted">Abrir perfil</span>
                  </div>

                  <ExternalLink className="h-[17px] w-[17px] text-[#aaa49c]" aria-hidden="true" />
                </a>
              )}

              {facebookUrl && (
                <a
                  className={storeItemClass}
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <AtSign className={storeIconClass} aria-hidden="true" />

                  <div className="flex min-w-0 flex-col">
                    <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[.88rem] font-[720]">Facebook</strong>
                    <span className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[.74rem] text-menu-muted">Abrir página</span>
                  </div>

                  <ExternalLink className="h-[17px] w-[17px] text-[#aaa49c]" aria-hidden="true" />
                </a>
              )}
            </div>
          </details>
        )}

        <div className="sticky top-0 z-[30] border-b border-menu-border bg-[rgb(247_246_243_/_94%)] backdrop-blur-[14px]">
          <div className="mx-auto w-full max-w-[1120px] px-4 py-[11px] pb-[9px] min-[720px]:px-6 min-[1024px]:grid min-[1024px]:grid-cols-[minmax(300px,420px)_minmax(0,1fr)] min-[1024px]:items-center min-[1024px]:gap-[18px]">
            <div className="relative flex items-center" role="search">
              <Search className="absolute left-[15px] z-[1] h-5 w-5 text-[#817b74]" aria-hidden="true" />

              <label
                className="sr-only"
                htmlFor="menu-search"
              >
                Pesquisar no cardápio
              </label>

              <input
                id="menu-search"
                type="search"
                className={`h-12 w-full rounded-[13px] border border-menu-border bg-menu-surface px-12 py-0 pl-[45px] text-[.95rem] text-menu-text outline-none transition-[border-color,box-shadow] placeholder:text-[#918b84] focus:border-[var(--color-brand)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-brand)_15%,transparent)] ${focusRing}`}
                placeholder="O que você quer comer?"
                value={search}
                autoComplete="off"
                onChange={(event) => {
                  setSearch(event.target.value)
                }}
              />

              {search && (
                <button
                  className={`absolute right-[7px] grid h-9 w-9 place-items-center rounded-[9px] border-0 bg-transparent text-menu-muted ${focusRing}`}
                  type="button"
                  aria-label="Limpar pesquisa"
                  onClick={() => setSearch('')}
                >
                  <X className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
              )}
            </div>

            {!searching && categories.length > 0 && (
              <nav
                className="mt-[9px] overflow-hidden min-[1024px]:mt-0"
                aria-label="Categorias do cardápio"
              >
                <div className="flex gap-2 overflow-x-auto pb-0.5 [overscroll-behavior-inline:contain] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[1024px]:justify-start" ref={categoryNavRef}>
                  {categories.map((category) => (
                    <button
                      className={cn('min-h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-[10px] border border-menu-border bg-menu-surface px-3 py-[7px] text-[.81rem] font-[680] text-[#3d3934] transition-[color,border-color,background-color] hover:border-[var(--color-brand)] aria-[current=true]:!border-[var(--color-brand)] aria-[current=true]:!bg-[var(--color-brand)] aria-[current=true]:!text-[var(--color-brand-text)]', focusRing)}
                      data-category={category.slug}
                      type="button"
                      key={category.id}
                      aria-current={
                        activeCategory === category.slug
                          ? 'true'
                          : undefined
                      }
                      onClick={() =>
                        scrollToCategory(category.slug)
                      }
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </nav>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1120px] px-0 pb-[72px] pt-[22px] min-[720px]:px-6">
          {!allProducts.length && (
            <div className="mx-auto my-[52px] flex max-w-[520px] flex-col items-center px-6 text-center text-menu-muted">
              <Search className="h-[30px] w-[30px]" aria-hidden="true" />

              <h2 className="mt-[15px] text-[1.3rem] text-menu-text">
                {searching
                  ? 'Nenhum item encontrado'
                  : 'Cardápio em preparação'}
              </h2>

              <p className="mt-2 text-[.9rem] leading-[1.5]">
                {searching
                  ? 'Tente pesquisar por outro nome ou ingrediente.'
                  : 'Os produtos serão publicados em breve.'}
              </p>

              {searching && (
                <button
                  className={`mt-[18px] min-h-[42px] rounded-[10px] border border-menu-border bg-menu-surface px-[15px] py-2 font-[700] text-menu-text ${focusRing}`}
                  type="button"
                  onClick={() => setSearch('')}
                >
                  Limpar pesquisa
                </button>
              )}
            </div>
          )}

          {searching && allProducts.length > 0 ? (
            <section className="mt-8 first:mt-0">
              <header className="flex min-h-11 items-end justify-between gap-4 px-[17px] pb-3 min-[720px]:px-0">
                <div>
                  <h2 className="m-0 text-[clamp(1.35rem,5vw,1.75rem)] font-[790] leading-[1.12] tracking-[-.035em] [text-wrap:balance]">Resultados da busca</h2>
                  <p className="mt-[5px] text-[.84rem] leading-[1.45] text-menu-muted" aria-live="polite">
                    {allProducts.length}{' '}
                    {allProducts.length === 1
                      ? 'item encontrado'
                      : 'itens encontrados'}
                  </p>
                </div>
              </header>

              <div className="grid border-y border-menu-border bg-menu-surface min-[720px]:grid-cols-2 min-[720px]:gap-3 min-[720px]:border-0 min-[720px]:bg-transparent">
                {allProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={selectProduct}
                  />
                ))}
              </div>
            </section>
          ) : (
            <>
              {promotions.length > 0 && (
                <section className="mt-8 first:mt-0 rounded-[1.2rem] bg-[color-mix(in_srgb,var(--color-brand)_7%,#fff)] pt-8 min-[720px]:p-[1.2rem]">
                  <header className="flex min-h-11 items-end justify-between gap-4 px-[17px] pb-3 min-[720px]:px-0">
                    <div>
                      <h2 className="m-0 text-[clamp(1.35rem,5vw,1.75rem)] font-[790] leading-[1.12] tracking-[-.035em]">Ofertas</h2>
                      <p className="mt-[5px] text-[.84rem] leading-[1.45] text-menu-muted">
                        Produtos com preço especial
                      </p>
                    </div>
                  </header>

                  <div className="grid border-y border-menu-border bg-menu-surface min-[720px]:grid-cols-2 min-[720px]:gap-3 min-[720px]:border-0 min-[720px]:bg-transparent">
                    {promotions.map((product) => (
                      <ProductCard
                        key={`promotion-${product.id}`}
                        product={product}
                        onSelect={selectProduct}
                      />
                    ))}
                  </div>
                </section>
              )}

              {featured.length > 0 && (
                <section className="mt-8 first:mt-0">
                  <header className="flex min-h-11 items-end justify-between gap-4 px-[17px] pb-3 min-[720px]:px-0">
                    <div>
                      <h2 className="m-0 text-[clamp(1.35rem,5vw,1.75rem)] font-[790] leading-[1.12] tracking-[-.035em]">Destaques da casa</h2>
                      <p className="mt-[5px] text-[.84rem] leading-[1.45] text-menu-muted">
                        Algumas sugestões para escolher mais
                        rápido
                      </p>
                    </div>
                  </header>

                  <div className="grid border-y border-menu-border bg-menu-surface min-[720px]:grid-cols-2 min-[720px]:gap-3 min-[720px]:border-0 min-[720px]:bg-transparent">
                    {featured.map((product) => (
                      <ProductCard
                        key={`featured-${product.id}`}
                        product={product}
                        onSelect={selectProduct}
                      />
                    ))}
                  </div>
                </section>
              )}

              {categories.map((category) => (
                <section
                  key={category.id}
                  id={category.slug}
                  data-category-section
                  className="mt-8 scroll-mt-[126px] first:mt-0"
                >
                  <header className="flex min-h-11 items-end justify-between gap-4 px-[17px] pb-3 min-[720px]:px-0 max-[359px]:items-start">
                    <div>
                      <h2 className="m-0 text-[clamp(1.35rem,5vw,1.75rem)] font-[790] leading-[1.12] tracking-[-.035em] [text-wrap:balance]">{category.name}</h2>

                      {category.description && (
                        <p className="mt-[5px] max-w-[42rem] text-[.84rem] leading-[1.45] text-menu-muted">{category.description}</p>
                      )}
                    </div>

                    <span className="shrink-0 pb-0.5 text-[.75rem] font-[650] text-menu-muted max-[359px]:hidden">
                      {category.products.length}{' '}
                      {category.products.length === 1
                        ? 'item'
                        : 'itens'}
                    </span>
                  </header>

                  <div className="grid border-y border-menu-border bg-menu-surface min-[720px]:grid-cols-2 min-[720px]:gap-3 min-[720px]:border-0 min-[720px]:bg-transparent">
                    {category.products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onSelect={selectProduct}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      </main>

      <footer className={cn('bg-[#211f1c] px-[18px] pb-[max(84px,calc(68px_+_env(safe-area-inset-bottom)))] pt-[38px] text-white min-[720px]:px-6 min-[720px]:pb-6 min-[1024px]:pb-6', cart.lines.length > 0 && 'pb-[max(118px,calc(102px_+_env(safe-area-inset-bottom)))] min-[720px]:pb-[110px]')}>
        <div className="mx-auto grid w-full max-w-[1120px] gap-[30px] min-[720px]:grid-cols-2 min-[1024px]:grid-cols-4">
          {businessAddress && (
            <section>
              <h2 className={footerHeadingClass}>
                <MapPin aria-hidden="true" />
                Localização
              </h2>

              <p className={footerTextClass}>{businessAddress}</p>

              {mapsUrl && (
                <a
                  className={footerLinkClass}
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Como chegar
                  <ExternalLink aria-hidden="true" />
                </a>
              )}
            </section>
          )}

          {menu.hours.length > 0 && (
            <section id="horarios-da-loja">
              <h2 className={footerHeadingClass}>
                <Clock3 aria-hidden="true" />
                Horários
              </h2>

              <ul className={footerListClass}>
                {[...menu.hours]
                  .sort(
                    (first, second) =>
                      first.weekday - second.weekday ||
                      first.sortOrder - second.sortOrder,
                  )
                  .map((hour) => (
                    <li className={footerListItemClass} key={hour.id}>
                      <span>
                        {WEEKDAYS[hour.weekday]}
                      </span>

                      <strong className="shrink-0 font-[680] text-white">
                        {hour.isClosed
                          ? 'Fechado'
                          : `${hour.opensAt}–${hour.closesAt}`}
                      </strong>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {menu.paymentMethods.length > 0 && (
            <section>
              <h2 className={footerHeadingClass}>Formas de pagamento</h2>

              <p className={footerTextClass}>
                {menu.paymentMethods
                  .map((method) => method.name)
                  .join(' · ')}
              </p>
            </section>
          )}

          {menu.deliveryZones.length > 0 && (
            <section>
              <h2 className={footerHeadingClass}>Regiões e taxas</h2>

              <ul className={footerListClass}>
                {menu.deliveryZones.map((zone) => (
                  <li className={footerListItemClass} key={zone.id}>
                    <span>
                      {zone.name}
                      {zone.notes
                        ? ` — ${zone.notes}`
                        : ''}
                    </span>

                    <strong className="shrink-0 font-[680] text-white">
                      {zone.feeCents === null
                        ? 'Consulte'
                        : formatMoney(zone.feeCents)}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(menu.business.phone ||
            instagramUrl ||
            facebookUrl) && (
            <section>
              <h2 className={footerHeadingClass}>Contato</h2>

              <div className="flex flex-wrap gap-x-[18px] gap-y-2">
                {menu.business.phone && (
                  <a className={footerLinkClass.replace('mt-2.5', 'mt-0')} href={`tel:${phoneDigits}`}>
                    <Phone aria-hidden="true" />
                    {formattedPhone}
                  </a>
                )}

                {instagramUrl && (
                  <a
                    className={footerLinkClass.replace('mt-2.5', 'mt-0')}
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <AtSign aria-hidden="true" />
                    Instagram
                  </a>
                )}

                {facebookUrl && (
                  <a
                    className={footerLinkClass.replace('mt-2.5', 'mt-0')}
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Facebook
                  </a>
                )}
              </div>
            </section>
          )}
        </div>

        <p className="mx-auto mt-[34px] w-full max-w-[1120px] border-t border-[rgb(255_255_255_/_12%)] pt-[18px] text-center text-[.8rem] text-[rgb(255_255_255_/_46%)]">
          {menu.business.name} · Cardápio digital
        </p>
      </footer>

      {whatsappDigits && !cart.lines.length && (
        <a
          className={`fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-[35] grid h-14 w-14 place-items-center border-0 bg-transparent p-0 ${focusRing}`}
          href={`https://wa.me/${whatsappDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir conversa no WhatsApp"
          title="Falar pelo WhatsApp"
        >
          <img
            src={whatsappLogo}
            alt=""
            aria-hidden="true"
          />
        </a>
      )}

      {selected && (
        <ProductDialog
          product={selected}
          onClose={closeProduct}
          onAdd={(product, variant, quantity, note, customizations) => {
            cart.addItem(product, variant, quantity, note, customizations)
            setItemAddedFeedback('Item adicionado ao pedido')
          }}
        />
      )}

      {cart.lines.length > 0 && (
        <CartBar
          itemCount={cart.itemCount}
          totalCents={cart.totalCents}
          onOpen={(trigger) => {
            cartTriggerRef.current = trigger
            setCartOpen(true)
          }}
        />
      )}

      {(itemAddedFeedback || cart.restorationNotice) && (
        <div className="fixed bottom-[calc(88px_+_env(safe-area-inset-bottom))] left-3 right-3 z-[55] mx-auto flex min-h-12 max-w-[520px] items-center justify-between gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--color-menu-success)_24%,#fff)] bg-menu-success-background px-3 py-2.5 text-[.82rem] font-[700] text-[#11663c] shadow-[0_10px_30px_rgb(28_25_22_/_20%)] min-[720px]:bottom-24 min-[720px]:left-auto min-[720px]:right-6 min-[720px]:mx-0 min-[720px]:w-[340px]" role="status">
          <span>{itemAddedFeedback ?? cart.restorationNotice}</span>
          {cart.restorationNotice && !itemAddedFeedback && (
            <button
              className={`grid h-11 w-11 shrink-0 place-items-center border-0 bg-transparent text-inherit ${focusRing}`}
              type="button"
              aria-label="Fechar aviso"
              onClick={cart.dismissRestorationNotice}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {cartOpen && (
        <CartDialog
          businessName={menu.business.name}
          whatsapp={menu.business.whatsapp}
          lines={cart.lines}
          totalCents={cart.totalCents}
          onIncrease={cart.increase}
          onDecrease={cart.decrease}
          onRemove={cart.remove}
          onUpdateNote={cart.updateNote}
          onClear={cart.clear}
          onClose={() => {
            setCartOpen(false)
            requestAnimationFrame(() => {
              if (cartTriggerRef.current?.isConnected) cartTriggerRef.current.focus()
              else document.getElementById('menu-search')?.focus()
            })
          }}
        />
      )}
    </div>
  )
}
