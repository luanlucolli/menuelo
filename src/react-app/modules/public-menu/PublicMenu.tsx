import { AtSign, Clock3, ExternalLink, MapPin, Megaphone, Phone, Search, Store, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { MenuResponse, ZonedClock } from '../../../../shared/schemas'
import { safePublicHttpUrl } from '../../../../shared/public-seo'
import { buildGoogleMapsDirectionsUrl, calculateOpenStatus, formatBrazilianPhone, formatMoney, formatStructuredAddress, readableBrandText } from '../../../../shared/utils'
import whatsappLogo from '../../../assets/WhatsApp-logo.webp'
import { ProductCard, ProductDialog } from './ProductCard'
import { usePublicMenuInteractions } from './usePublicMenuInteractions'

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
type PublicThemeStyle = CSSProperties & { '--color-brand': string; '--color-brand-text': string }

export function PublicMenu({ menu, initialClock }: { menu: MenuResponse; initialClock: ZonedClock }) {
  const { activeCategory, categories, categoryNavRef, clock, closeProduct, search, searching, selected, selectProduct, setSearch, scrollToCategory } = usePublicMenuInteractions(menu, initialClock)
  const allProducts = categories.flatMap((category) => category.products)
  const featured = allProducts.filter((product) => product.isFeatured)
  const promotions = allProducts.filter((product) => product.variants.some((variant) => variant.promotionalPriceCents !== null))
  const openStatus = calculateOpenStatus(menu.hours, clock.weekday, clock.minutes)
  const whatsappDigits = (menu.business.whatsapp ?? '').replace(/\D/g, '')
  const validWhatsapp = /^\d{10,15}$/.test(whatsappDigits)
  const phoneDigits = (menu.business.phone ?? '').replace(/\D/g, '')
  const showPhone = Boolean(menu.business.phone && (!validWhatsapp || phoneDigits !== whatsappDigits))
  const formattedWhatsapp = menu.business.whatsapp ? formatBrazilianPhone(menu.business.whatsapp) : ''
  const formattedPhone = menu.business.phone ? formatBrazilianPhone(menu.business.phone) : ''
  const businessAddress = formatStructuredAddress(menu.business) ?? menu.business.address
  const mapsUrl = safePublicHttpUrl(menu.business.mapsUrl) ?? buildGoogleMapsDirectionsUrl(businessAddress)
  const instagramUrl = safePublicHttpUrl(menu.business.instagramUrl)
  const facebookUrl = safePublicHttpUrl(menu.business.facebookUrl)
  const locationTitle = menu.business.addressNeighborhood || businessAddress
  const locationSubtitle = menu.business.addressNeighborhood && (menu.business.addressCity || menu.business.addressState)
    ? [menu.business.addressCity, menu.business.addressState].filter(Boolean).join(', ')
    : null
  const showBusinessInfo = Boolean(validWhatsapp || showPhone || (businessAddress && mapsUrl) || instagramUrl)
  const specialMessage = menu.business.specialMessage?.trim()
  const publicTheme: PublicThemeStyle = {
    '--color-brand': menu.business.primaryColor,
    '--color-brand-text': readableBrandText(menu.business.primaryColor),
  }

  return (
    <div className="public-shell" style={publicTheme}>
      <header className="cover relative h-64 overflow-hidden md:h-72" style={menu.business.coverImageKey ? { backgroundImage: `url(/media/${menu.business.coverImageKey})` } : undefined}>
        <div className="absolute inset-0 z-0 bg-gradient-to-t bg-linear-to-t from-black/90 via-black/40 to-transparent" aria-hidden="true" />
        <div className="cover-content relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col items-center justify-end px-4 pb-6 text-center">
          <p className="eyebrow">Cardápio digital</p>
          <h1 className="text-center text-3xl font-bold text-white sm:text-4xl lg:text-5xl">{menu.business.name}</h1>
          {openStatus && <div className={`cover-status mt-3 flex items-center gap-2 rounded-full bg-gray-900/80 px-4 py-1.5 shadow-lg backdrop-blur-sm ${openStatus.isOpen ? 'open' : 'closed'}`}><span aria-hidden="true" /><div><strong>{openStatus.isOpen ? 'Aberto agora' : 'Fechado agora'}</strong>{openStatus.isOpen && openStatus.closesAt && <small>Até às {openStatus.closesAt}</small>}</div></div>}
          {menu.business.slogan && <p>{menu.business.slogan}</p>}
        </div>
      </header>

      <main>
        {specialMessage && <div className="special-message"><Megaphone aria-hidden="true" /><span>{specialMessage}</span></div>}
        {showBusinessInfo && <section className="business-info" aria-labelledby="business-info-title">
          <div className="business-info-heading"><Store aria-hidden="true" /><strong id="business-info-title">Informações da loja</strong></div>
          <div className="business-info-content">
          {validWhatsapp && <a className="business-info-item" href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer" aria-label={`Abrir WhatsApp: ${formattedWhatsapp}`}><img className="business-info-logo" src={whatsappLogo} alt="" aria-hidden="true" /><div><strong>{formattedWhatsapp}</strong><span>WhatsApp</span></div><ExternalLink aria-hidden="true" /></a>}
          {showPhone && <a className="business-info-item" href={`tel:${phoneDigits}`}><Phone /><div><strong>{formattedPhone}</strong><span>Telefone</span></div></a>}
          {businessAddress && mapsUrl && <a className="business-info-item location" href={mapsUrl} target="_blank" rel="noreferrer" aria-label={`Ver localização: ${businessAddress}`}><MapPin /><div><strong>{locationTitle}</strong>{locationSubtitle && <span>{locationSubtitle}</span>}</div><ExternalLink aria-hidden="true" /></a>}
          {instagramUrl && <a className="business-info-item" href={instagramUrl} target="_blank" rel="noreferrer"><AtSign /><div><strong>Instagram</strong><span>Abrir perfil</span></div><ExternalLink aria-hidden="true" /></a>}
          </div>
        </section>}
        <div className="search-wrap">
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor="menu-search">Pesquisar no cardápio</label>
          <input id="menu-search" type="search" placeholder="Buscar por nome ou ingrediente" value={search} onChange={(event) => setSearch(event.target.value)} />
          {search && <button className="clear-search" type="button" aria-label="Limpar pesquisa" onClick={() => setSearch('')}><X /></button>}
        </div>

        {!searching && <nav className="category-nav" aria-label="Categorias do cardápio">
          <div ref={categoryNavRef}>
            {categories.map((category) => <button className={activeCategory === category.slug ? 'active' : ''} data-category={category.slug} type="button" key={category.id} title={category.name} onClick={() => scrollToCategory(category.slug)}>{category.name}</button>)}
          </div>
        </nav>}

        <div className="menu-content">
          {!allProducts.length && <div className="empty-state"><Search /><h2>{searching ? 'Nenhum item encontrado' : 'Cardápio em preparação'}</h2><p>{searching ? 'Tente outra palavra na pesquisa.' : 'Os itens serão publicados em breve.'}</p>{searching && <button type="button" className="secondary-button" onClick={() => setSearch('')}>Limpar pesquisa</button>}</div>}
          {searching && allProducts.length > 0 ? <section className="search-results"><div className="section-title"><p>Resultados</p><h2>{allProducts.length} {allProducts.length === 1 ? 'item encontrado' : 'itens encontrados'}</h2></div><div className="product-grid">{allProducts.map((product) => <ProductCard key={product.id} product={product} coverImageKey={menu.business.coverImageKey} onSelect={selectProduct} />)}</div></section> : <>
          {featured.length > 0 && <section className="highlight-section"><div className="section-title"><p>Destaques</p><h2>Escolhas da casa</h2></div><div className="product-grid">{featured.map((product) => <ProductCard key={`featured-${product.id}`} product={product} coverImageKey={menu.business.coverImageKey} onSelect={selectProduct} />)}</div></section>}
          {promotions.length > 0 && <section className="promotion-section"><div className="section-title"><p>Promoções</p><h2>Preços especiais</h2></div><div className="product-grid">{promotions.map((product) => <ProductCard key={`promo-${product.id}`} product={product} coverImageKey={menu.business.coverImageKey} onSelect={selectProduct} />)}</div></section>}
          {categories.map((category) => (
            <section key={category.id} id={category.slug} data-category-section className="category-section">
              <div className="section-title"><h2>{category.name}</h2>{category.description && <p>{category.description}</p>}</div>
              <div className="product-grid">{category.products.map((product) => <ProductCard key={product.id} product={product} coverImageKey={menu.business.coverImageKey} onSelect={selectProduct} />)}</div>
            </section>
          ))}</>}
        </div>
      </main>

      <footer className="public-footer">
        <div className="footer-grid">
          {businessAddress && <section><h2><MapPin /> Localização</h2><p>{businessAddress}</p>{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">Como chegar <ExternalLink /></a>}</section>}
          {menu.hours.length > 0 && <section><h2><Clock3 /> Horários</h2><ul>{[...menu.hours].sort((a, b) => a.weekday - b.weekday || a.sortOrder - b.sortOrder).map((hour) => <li key={hour.id}><span>{WEEKDAYS[hour.weekday]}</span><strong>{hour.isClosed ? 'Fechado' : `${hour.opensAt}–${hour.closesAt}`}</strong></li>)}</ul></section>}
          {menu.paymentMethods.length > 0 && <section><h2>Formas de pagamento</h2><p>{menu.paymentMethods.map((method) => method.name).join(' · ')}</p></section>}
          {menu.deliveryZones.length > 0 && <section><h2>Regiões e taxas</h2><ul>{menu.deliveryZones.map((zone) => <li key={zone.id}><span>{zone.name}{zone.notes ? ` — ${zone.notes}` : ''}</span><strong>{zone.feeCents === null ? 'Consulte' : formatMoney(zone.feeCents)}</strong></li>)}</ul></section>}
          {(menu.business.phone || instagramUrl || facebookUrl) && <section><h2>Contato</h2><div className="footer-links">{menu.business.phone && <a href={`tel:${phoneDigits}`}><Phone /> {formattedPhone}</a>}{instagramUrl && <a href={instagramUrl} target="_blank" rel="noreferrer"><AtSign /> Instagram</a>}{facebookUrl && <a href={facebookUrl} target="_blank" rel="noreferrer">Facebook</a>}</div></section>}
        </div>
        <p className="footer-brand">{menu.business.name} · Cardápio digital</p>
      </footer>

      {validWhatsapp && <a className="whatsapp-fab" href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer" aria-label="Abrir conversa no WhatsApp"><img src={whatsappLogo} alt="" aria-hidden="true" /></a>}
      {selected && <ProductDialog product={selected} coverImageKey={menu.business.coverImageKey} onClose={closeProduct} />}
    </div>
  )
}
