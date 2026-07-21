import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MenuResponse, Product, ZonedClock } from '../../../../shared/schemas'
import { getZonedClock, normalizeSearch } from '../../../../shared/utils'

export function usePublicMenuInteractions(menu: MenuResponse, initialClock: ZonedClock) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [clock, setClock] = useState(initialClock)
  const categoryNavRef = useRef<HTMLDivElement>(null)
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null)
  const searching = Boolean(normalizeSearch(search))

  const categories = useMemo(() => {
    const term = normalizeSearch(search)
    if (!term) return menu.categories
    return menu.categories.map((category) => ({
      ...category,
      products: category.products.filter((product) => normalizeSearch(`${product.name} ${product.ingredients ?? ''}`).includes(term)),
    })).filter((category) => category.products.length)
  }, [menu, search])

  const closeProduct = useCallback(() => {
    setSelected(null)
    requestAnimationFrame(() => selectedTriggerRef.current?.focus())
  }, [])

  useEffect(() => {
    const updateClock = () => setClock(getZonedClock(new Date(), menu.business.timezone))
    updateClock()
    const delay = 60_000 - Date.now() % 60_000
    let interval = 0
    const timeout = window.setTimeout(() => {
      updateClock()
      interval = window.setInterval(updateClock, 60_000)
    }, delay)
    return () => {
      window.clearTimeout(timeout)
      if (interval) window.clearInterval(interval)
    }
  }, [menu.business.timezone])

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

  const scrollToCategory = (slug: string) => {
    setActiveCategory(slug)
    document.getElementById(slug)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  const selectProduct = (product: Product, trigger: HTMLButtonElement) => {
    selectedTriggerRef.current = trigger
    setSelected(product)
  }

  return {
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
  }
}
