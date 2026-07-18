import { useQuery } from '@tanstack/react-query'
import { AtSign, Clock3, ExternalLink, MapPin, MessageCircle, Phone, Search, UtensilsCrossed } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { MenuResponse, Product } from '../../../../shared/schemas'
import { calculateOpenStatus, formatMoney, getZonedClock, normalizeSearch } from '../../../../shared/utils'
import { api } from '../../lib/api'
import { ProductCard, ProductDialog } from './ProductCard'
import { Seo } from './Seo'

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

export function PublicMenu() {
  const { data, isLoading, error } = useQuery({ queryKey: ['menu'], queryFn: () => api<MenuResponse>('/api/menu'), staleTime: 60_000 })
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)

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
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible?.target.id) setActiveCategory(visible.target.id)
    }, { rootMargin: '-32% 0px -55% 0px', threshold: [0.05, 0.25, 0.6] })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [categories])

  if (isLoading) return <main className="state-page"><span className="spinner" /> <p>Carregando cardápio…</p></main>
  if (error || !data) return <main className="state-page"><h1>Não foi possível abrir o cardápio</h1><p>Tente novamente em alguns instantes.</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></main>

  const allProducts = categories.flatMap((category) => category.products)
  const featured = allProducts.filter((product) => product.isFeatured)
  const promotions = allProducts.filter((product) => product.variants.some((variant) => variant.promotionalPriceCents !== null))
  const clock = getZonedClock(new Date(), data.business.timezone)
  const openStatus = calculateOpenStatus(data.hours, clock.weekday, clock.minutes)
  const whatsappDigits = (data.business.whatsapp ?? '').replace(/\D/g, '')
  const validWhatsapp = /^\d{10,15}$/.test(whatsappDigits)

  const scrollTo = (slug: string) => {
    document.getElementById(slug)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
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
        </div>

        <nav className="category-nav" aria-label="Categorias do cardápio">
          <div>
            {categories.map((category) => <button className={activeCategory === category.slug ? 'active' : ''} type="button" key={category.id} onClick={() => scrollTo(category.slug)}>{category.name}</button>)}
          </div>
        </nav>

        <div className="menu-content">
          {!allProducts.length && <div className="empty-state"><Search /><h2>Nenhum item encontrado</h2><p>Tente outra palavra na pesquisa.</p></div>}
          {featured.length > 0 && <section className="highlight-section"><div className="section-title"><p>Destaques</p><h2>Escolhas da casa</h2></div><div className="product-grid">{featured.map((product) => <ProductCard key={`featured-${product.id}`} product={product} onSelect={setSelected} />)}</div></section>}
          {promotions.length > 0 && <section className="promotion-section"><div className="section-title"><p>Promoções</p><h2>Preços especiais</h2></div><div className="product-grid">{promotions.map((product) => <ProductCard key={`promo-${product.id}`} product={product} onSelect={setSelected} />)}</div></section>}
          {categories.map((category) => (
            <section key={category.id} id={category.slug} data-category-section className="category-section">
              <div className="section-title"><h2>{category.name}</h2>{category.description && <p>{category.description}</p>}</div>
              <div className="product-grid">{category.products.map((product) => <ProductCard key={product.id} product={product} onSelect={setSelected} />)}</div>
            </section>
          ))}
        </div>
      </main>

      <footer className="public-footer">
        <div className="footer-grid">
          {data.business.address && <section><h2><MapPin /> Localização</h2><p>{data.business.address}</p>{data.business.mapsUrl && <a href={data.business.mapsUrl} target="_blank" rel="noreferrer">Abrir no Google Maps <ExternalLink /></a>}</section>}
          {data.hours.length > 0 && <section><h2><Clock3 /> Horários</h2><ul>{[...data.hours].sort((a, b) => a.weekday - b.weekday || a.sortOrder - b.sortOrder).map((hour) => <li key={hour.id}><span>{WEEKDAYS[hour.weekday]}</span><strong>{hour.isClosed ? 'Fechado' : `${hour.opensAt}–${hour.closesAt}`}</strong></li>)}</ul></section>}
          {data.paymentMethods.length > 0 && <section><h2>Formas de pagamento</h2><p>{data.paymentMethods.map((method) => method.name).join(' · ')}</p></section>}
          {data.deliveryZones.length > 0 && <section><h2>Regiões e taxas</h2><ul>{data.deliveryZones.map((zone) => <li key={zone.id}><span>{zone.name}{zone.notes ? ` — ${zone.notes}` : ''}</span><strong>{zone.feeCents === null ? 'Consulte' : formatMoney(zone.feeCents)}</strong></li>)}</ul></section>}
          {(data.business.phone || data.business.instagramUrl || data.business.facebookUrl) && <section><h2>Contato</h2><div className="footer-links">{data.business.phone && <a href={`tel:${data.business.phone}`}><Phone /> {data.business.phone}</a>}{data.business.instagramUrl && <a href={data.business.instagramUrl} target="_blank" rel="noreferrer"><AtSign /> Instagram</a>}{data.business.facebookUrl && <a href={data.business.facebookUrl} target="_blank" rel="noreferrer">Facebook</a>}</div></section>}
        </div>
        <p className="footer-brand">{data.business.name} · Cardápio digital</p>
      </footer>

      {validWhatsapp && <a className="whatsapp-fab" href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer" aria-label="Abrir conversa no WhatsApp"><MessageCircle /></a>}
      {selected && <ProductDialog product={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
