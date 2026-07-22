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
import type { CSSProperties } from 'react'
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
  readableBrandText,
} from '../../../../shared/utils'
import whatsappLogo from '../../../assets/WhatsApp-logo.webp'
import { ProductCard, ProductDialog } from './ProductCard'
import { usePublicMenuInteractions } from './usePublicMenuInteractions'

const WEEKDAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

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

  const whatsappDigits = (
    menu.business.whatsapp ?? ''
  ).replace(/\D/g, '')

  const validWhatsapp = /^\d{10,15}$/.test(whatsappDigits)

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

  const publicTheme: PublicThemeStyle = {
    '--color-brand': menu.business.primaryColor,
    '--color-brand-text': readableBrandText(
      menu.business.primaryColor,
    ),
  }

  return (
    <div className="public-shell" style={publicTheme}>
      <header
        className="menu-hero"
        style={
          menu.business.coverImageKey
            ? {
                backgroundImage: `url(/media/${menu.business.coverImageKey})`,
              }
            : undefined
        }
      >
        <div
          className="menu-hero-shade"
          aria-hidden="true"
        />

        <div className="menu-hero-content">
          <h1>{menu.business.name}</h1>

          {menu.business.slogan && (
            <p className="menu-hero-slogan">
              {menu.business.slogan}
            </p>
          )}

          <div className="menu-hero-meta">
            {openStatus && (
              <div
                className={`menu-open-status${
                  openStatus.isOpen
                    ? ' menu-open-status--open'
                    : ' menu-open-status--closed'
                }`}
              >
                <span aria-hidden="true" />

                <div>
                  <strong>
                    {openStatus.isOpen
                      ? 'Aberto agora'
                      : 'Fechado agora'}
                  </strong>

                  {openStatus.isOpen &&
                    openStatus.closesAt && (
                      <small>
                        Fecha às {openStatus.closesAt}
                      </small>
                    )}
                </div>
              </div>
            )}

            {heroLocation && (
              <span className="menu-hero-location">
                <MapPin aria-hidden="true" />
                {heroLocation}
              </span>
            )}
          </div>
        </div>
      </header>

      <main>
        {specialMessage && (
          <div className="menu-special-message">
            <Megaphone aria-hidden="true" />
            <span>{specialMessage}</span>
          </div>
        )}

        {showBusinessInfo && (
          <details className="menu-store-disclosure">
            <summary>
              <span className="menu-store-summary-copy">
                <strong>Informações da loja</strong>
                <small>
                  Contato, localização e horários
                </small>
              </span>

              <ChevronDown
                className="menu-store-chevron"
                aria-hidden="true"
              />
            </summary>

            <div className="menu-store-grid">
              {validWhatsapp && (
                <a
                  className="menu-store-item"
                  href={`https://wa.me/${whatsappDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir WhatsApp: ${formattedWhatsapp}`}
                >
                  <img
                    className="menu-store-logo"
                    src={whatsappLogo}
                    alt=""
                    aria-hidden="true"
                  />

                  <div>
                    <strong>{formattedWhatsapp}</strong>
                    <span>Falar pelo WhatsApp</span>
                  </div>

                  <ExternalLink aria-hidden="true" />
                </a>
              )}

              {showPhone && (
                <a
                  className="menu-store-item"
                  href={`tel:${phoneDigits}`}
                >
                  <Phone aria-hidden="true" />

                  <div>
                    <strong>{formattedPhone}</strong>
                    <span>Ligar para a loja</span>
                  </div>
                </a>
              )}

              {businessAddress && mapsUrl && (
                <a
                  className="menu-store-item"
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ver localização: ${businessAddress}`}
                >
                  <MapPin aria-hidden="true" />

                  <div>
                    <strong>{locationTitle}</strong>
                    <span>
                      {locationSubtitle ||
                        'Abrir no Google Maps'}
                    </span>
                  </div>

                  <ExternalLink aria-hidden="true" />
                </a>
              )}

              {menu.hours.length > 0 && (
                <a
                  className="menu-store-item"
                  href="#horarios-da-loja"
                >
                  <Clock3 aria-hidden="true" />

                  <div>
                    <strong>Horários</strong>
                    <span>Ver dias e horários</span>
                  </div>
                </a>
              )}

              {instagramUrl && (
                <a
                  className="menu-store-item"
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <AtSign aria-hidden="true" />

                  <div>
                    <strong>Instagram</strong>
                    <span>Abrir perfil</span>
                  </div>

                  <ExternalLink aria-hidden="true" />
                </a>
              )}

              {facebookUrl && (
                <a
                  className="menu-store-item"
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <AtSign aria-hidden="true" />

                  <div>
                    <strong>Facebook</strong>
                    <span>Abrir página</span>
                  </div>

                  <ExternalLink aria-hidden="true" />
                </a>
              )}
            </div>
          </details>
        )}

        <div className="menu-toolbar">
          <div className="menu-toolbar-inner">
            <div className="menu-search" role="search">
              <Search aria-hidden="true" />

              <label
                className="sr-only"
                htmlFor="menu-search"
              >
                Pesquisar no cardápio
              </label>

              <input
                id="menu-search"
                type="search"
                placeholder="O que você quer comer?"
                value={search}
                autoComplete="off"
                onChange={(event) => {
                  setSearch(event.target.value)
                }}
              />

              {search && (
                <button
                  className="menu-clear-search"
                  type="button"
                  aria-label="Limpar pesquisa"
                  onClick={() => setSearch('')}
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </div>

            {!searching && categories.length > 0 && (
              <nav
                className="menu-category-nav"
                aria-label="Categorias do cardápio"
              >
                <div ref={categoryNavRef}>
                  {categories.map((category) => (
                    <button
                      className={
                        activeCategory === category.slug
                          ? 'active'
                          : ''
                      }
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

        <div className="menu-content">
          {!allProducts.length && (
            <div className="menu-empty-state">
              <Search aria-hidden="true" />

              <h2>
                {searching
                  ? 'Nenhum item encontrado'
                  : 'Cardápio em preparação'}
              </h2>

              <p>
                {searching
                  ? 'Tente pesquisar por outro nome ou ingrediente.'
                  : 'Os produtos serão publicados em breve.'}
              </p>

              {searching && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                >
                  Limpar pesquisa
                </button>
              )}
            </div>
          )}

          {searching && allProducts.length > 0 ? (
            <section className="menu-section">
              <header className="menu-section-header">
                <div>
                  <h2>Resultados da busca</h2>
                  <p aria-live="polite">
                    {allProducts.length}{' '}
                    {allProducts.length === 1
                      ? 'item encontrado'
                      : 'itens encontrados'}
                  </p>
                </div>
              </header>

              <div className="menu-product-grid">
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
                <section className="menu-section menu-section--promotion">
                  <header className="menu-section-header">
                    <div>
                      <h2>Ofertas</h2>
                      <p>
                        Produtos com preço especial
                      </p>
                    </div>
                  </header>

                  <div className="menu-product-grid">
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
                <section className="menu-section">
                  <header className="menu-section-header">
                    <div>
                      <h2>Destaques da casa</h2>
                      <p>
                        Algumas sugestões para escolher mais
                        rápido
                      </p>
                    </div>
                  </header>

                  <div className="menu-product-grid">
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
                  className="menu-section menu-category-section"
                >
                  <header className="menu-section-header">
                    <div>
                      <h2>{category.name}</h2>

                      {category.description && (
                        <p>{category.description}</p>
                      )}
                    </div>

                    <span className="menu-section-count">
                      {category.products.length}{' '}
                      {category.products.length === 1
                        ? 'item'
                        : 'itens'}
                    </span>
                  </header>

                  <div className="menu-product-grid">
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

      <footer className="menu-footer">
        <div className="menu-footer-grid">
          {businessAddress && (
            <section>
              <h2>
                <MapPin aria-hidden="true" />
                Localização
              </h2>

              <p>{businessAddress}</p>

              {mapsUrl && (
                <a
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
              <h2>
                <Clock3 aria-hidden="true" />
                Horários
              </h2>

              <ul>
                {[...menu.hours]
                  .sort(
                    (first, second) =>
                      first.weekday - second.weekday ||
                      first.sortOrder - second.sortOrder,
                  )
                  .map((hour) => (
                    <li key={hour.id}>
                      <span>
                        {WEEKDAYS[hour.weekday]}
                      </span>

                      <strong>
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
              <h2>Formas de pagamento</h2>

              <p>
                {menu.paymentMethods
                  .map((method) => method.name)
                  .join(' · ')}
              </p>
            </section>
          )}

          {menu.deliveryZones.length > 0 && (
            <section>
              <h2>Regiões e taxas</h2>

              <ul>
                {menu.deliveryZones.map((zone) => (
                  <li key={zone.id}>
                    <span>
                      {zone.name}
                      {zone.notes
                        ? ` — ${zone.notes}`
                        : ''}
                    </span>

                    <strong>
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
              <h2>Contato</h2>

              <div className="menu-footer-links">
                {menu.business.phone && (
                  <a href={`tel:${phoneDigits}`}>
                    <Phone aria-hidden="true" />
                    {formattedPhone}
                  </a>
                )}

                {instagramUrl && (
                  <a
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

        <p className="menu-footer-brand">
          {menu.business.name} · Cardápio digital
        </p>
      </footer>

      {validWhatsapp && (
        <a
          className="menu-whatsapp-fab"
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
        />
      )}
    </div>
  )
}
