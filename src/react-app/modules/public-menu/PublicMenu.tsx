import { useQuery } from '@tanstack/react-query'
import { AtSign, Clock3, ExternalLink, MapPin, MessageCircle, Phone, Search, UtensilsCrossed, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MenuResponse, Product } from '../../../../shared/schemas'
import { buildGoogleMapsDirectionsUrl, calculateOpenStatus, formatMoney, formatStructuredAddress, getZonedClock, normalizeSearch } from '../../../../shared/utils'
import { api } from '../../lib/api'
import { ProductCard, ProductDialog } from './ProductCard'
import { Seo } from './Seo'

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

export function PublicMenu() {
  const refreshToken = new URLSearchParams(window.location.search).get('refresh')
  const menuPath = refreshToken ? `/api/menu?refresh=${encodeURIComponent(refreshToken)}` : '/api/menu'
  const { data, isLoading, error } = useQuery({ queryKey: ['menu', refreshToken], queryFn: () => api<MenuResponse>(menuPath), staleTime: refreshToken ? 0 : 60_000 })
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const categoryNavRef = useRef<HTMLDivElement>(null)
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null)
  const searching = Boolean(normalizeSearch(search))
  const closeProduct = useCallback(() => {
    setSelected(null)
    requestAnimationFrame(() => selectedTriggerRef.current?.focus())
  }, [])

  const categories = useMemo(() => {
    if (!data) return []
    const term = normalizeSearch(search)
    if (!term) return data.categories
    return data.categories.map((category) => ({
      ...category,
      products: category.products.filter((product) => normalizeSearch(`${product.name} ${product.ingredients ?? ''}`).includes(term)),
    })).filter((category) => category.products.length)
  }, [data, search])

  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>('[data-category-section]')]
    if (!sections.length) return
    let animationFrame = 0

    const updateActiveCategory = () => {
      animationFrame = 0
      const navBottom = categoryNavRef.current?.parentElement?.getBoundingClientRect().bottom ?? 0
      const activationLine = navBottom + 40
      let current = sections[0]

      if (Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2) {
        current = sections.at(-1) ?? current
      } else {
        for (const section of sections) {
          if (section.getBoundingClientRect().top > activationLine) break
          current = section
        }
      }

      setActiveCategory((previous) => previous === current.id ? previous : current.id)
    }

    const scheduleUpdate = () => {
      if (animationFrame) return
      animationFrame = window.requestAnimationFrame(updateActiveCategory)
    }

    updateActiveCategory()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    return () => {
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
    }
  }, [categories])

  useEffect(() => {
    const container = categoryNavRef.current
    const activeButton = [...(container?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find((button) => button.dataset.category === activeCategory)
    if (!container || !activeButton) return

    const containerRect = container.getBoundingClientRect()
    const buttonRect = activeButton.getBoundingClientRect()
    const left = container.scrollLeft + buttonRect.left - containerRect.left
      - (container.clientWidth - buttonRect.width) / 2
    container.scrollTo({
      left,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [activeCategory])

  if (isLoading) return <main className="state-page"><span className="spinner" /> <p>Carregando cardápio…</p></main>
  if (error || !data) return <main className="state-page"><h1>Não foi possível abrir o cardápio</h1><p>Tente novamente em alguns instantes.</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></main>

  const allProducts = categories.flatMap((category) => category.products)
  const featured = allProducts.filter((product) => product.isFeatured)
  const promotions = allProducts.filter((product) => product.variants.some((variant) => variant.promotionalPriceCents !== null))
  const clock = getZonedClock(new Date(), data.business.timezone)
  const openStatus = calculateOpenStatus(data.hours, clock.weekday, clock.minutes)
  const whatsappDigits = (data.business.whatsapp ?? '').replace(/\D/g, '')
  const validWhatsapp = /^\d{10,15}$/.test(whatsappDigits)
  const businessAddress = formatStructuredAddress(data.business) ?? data.business.address
  const mapsUrl = data.business.mapsUrl ?? buildGoogleMapsDirectionsUrl(businessAddress)

  const scrollTo = (slug: string) => {
    setActiveCategory(slug)
    document.getElementById(slug)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }
  const selectProduct = (product: Product, trigger: HTMLButtonElement) => {
    selectedTriggerRef.current = trigger
    setSelected(product)
  }

  return (
    <div className="public-shell">
      <Seo menu={data} />
      <header className="cover" style={data.business.coverImageKey ? { backgroundImage: `linear-gradient(180deg, rgba(20,18,15,.12), rgba(20,18,15,.72)), url(/media/${data.business.coverImageKey})` } : undefined}>
        <div className="cover-pattern" aria-hidden="true"><UtensilsCrossed /></div>
        <div className="cover-content">
          <p className="eyebrow">Cardápio digital</p>
          <h1>{data.business.name}</h1>
          {data.business.slogan && <p>{data.business.slogan}</p>}
          {openStatus && <span className={`status-pill ${openStatus.isOpen ? 'open' : 'closed'}`}>{openStatus.isOpen ? 'Aberto agora' : 'Fechado agora'}</span>}
        </div>
      </header>

      <main>
        {data.business.specialMessage && <div className="special-message"><Clock3 /><span>{data.business.specialMessage}</span></div>}
        <div className="search-wrap">
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor="menu-search">Pesquisar no cardápio</label>
          <input id="menu-search" type="search" placeholder="Buscar por nome ou ingrediente" value={search} onChange={(event) => setSearch(event.target.value)} />
          {search && <button className="clear-search" type="button" aria-label="Limpar pesquisa" onClick={() => setSearch('')}><X /></button>}
        </div>

        {!searching && <nav className="category-nav" aria-label="Categorias do cardápio">
          <div ref={categoryNavRef}>
            {categories.map((category) => <button className={activeCategory === category.slug ? 'active' : ''} data-category={category.slug} type="button" key={category.id} onClick={() => scrollTo(category.slug)}>{category.name}</button>)}
          </div>
        </nav>}

        <div className="menu-content">
          {!allProducts.length && <div className="empty-state"><Search /><h2>Nenhum item encontrado</h2><p>Tente outra palavra na pesquisa.</p>{searching && <button type="button" className="secondary-button" onClick={() => setSearch('')}>Limpar pesquisa</button>}</div>}
          {searching && allProducts.length > 0 ? <section className="search-results"><div className="section-title"><p>Resultados</p><h2>{allProducts.length} {allProducts.length === 1 ? 'item encontrado' : 'itens encontrados'}</h2></div><div className="product-grid">{allProducts.map((product) => <ProductCard key={product.id} product={product} onSelect={selectProduct} />)}</div></section> : <>
          {featured.length > 0 && <section className="highlight-section"><div className="section-title"><p>Destaques</p><h2>Escolhas da casa</h2></div><div className="product-grid">{featured.map((product) => <ProductCard key={`featured-${product.id}`} product={product} onSelect={selectProduct} />)}</div></section>}
          {promotions.length > 0 && <section className="promotion-section"><div className="section-title"><p>Promoções</p><h2>Preços especiais</h2></div><div className="product-grid">{promotions.map((product) => <ProductCard key={`promo-${product.id}`} product={product} onSelect={selectProduct} />)}</div></section>}
          {categories.map((category) => (
            <section key={category.id} id={category.slug} data-category-section className="category-section">
              <div className="section-title"><h2>{category.name}</h2>{category.description && <p>{category.description}</p>}</div>
              <div className="product-grid">{category.products.map((product) => <ProductCard key={product.id} product={product} onSelect={selectProduct} />)}</div>
            </section>
          ))}</>}
        </div>
      </main>

      <footer className="public-footer">
        <div className="footer-grid">
          {businessAddress && <section><h2><MapPin /> Localização</h2><p>{businessAddress}</p>{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">Como chegar <ExternalLink /></a>}</section>}
          {data.hours.length > 0 && <section><h2><Clock3 /> Horários</h2><ul>{[...data.hours].sort((a, b) => a.weekday - b.weekday || a.sortOrder - b.sortOrder).map((hour) => <li key={hour.id}><span>{WEEKDAYS[hour.weekday]}</span><strong>{hour.isClosed ? 'Fechado' : `${hour.opensAt}–${hour.closesAt}`}</strong></li>)}</ul></section>}
          {data.paymentMethods.length > 0 && <section><h2>Formas de pagamento</h2><p>{data.paymentMethods.map((method) => method.name).join(' · ')}</p></section>}
          {data.deliveryZones.length > 0 && <section><h2>Regiões e taxas</h2><ul>{data.deliveryZones.map((zone) => <li key={zone.id}><span>{zone.name}{zone.notes ? ` — ${zone.notes}` : ''}</span><strong>{zone.feeCents === null ? 'Consulte' : formatMoney(zone.feeCents)}</strong></li>)}</ul></section>}
          {(data.business.phone || data.business.instagramUrl || data.business.facebookUrl) && <section><h2>Contato</h2><div className="footer-links">{data.business.phone && <a href={`tel:${data.business.phone}`}><Phone /> {data.business.phone}</a>}{data.business.instagramUrl && <a href={data.business.instagramUrl} target="_blank" rel="noreferrer"><AtSign /> Instagram</a>}{data.business.facebookUrl && <a href={data.business.facebookUrl} target="_blank" rel="noreferrer">Facebook</a>}</div></section>}
        </div>
        <p className="footer-brand">{data.business.name} · Cardápio digital</p>
      </footer>

      {validWhatsapp && <a className="whatsapp-fab" href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer" aria-label="Abrir conversa no WhatsApp"><MessageCircle /></a>}
      {selected && <ProductDialog product={selected} onClose={closeProduct} />}
    </div>
  )
}
