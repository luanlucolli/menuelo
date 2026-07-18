import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, FileJson, Upload } from 'lucide-react'
import { useState } from 'react'
import type { MenuImport } from '../../../../shared/schemas'
import { api, jsonBody, messageFromError } from '../../lib/api'

interface ImportSummary {
  incoming: { categories: number; products: number; variants: number; hours: number; paymentMethods: number; deliveryZones: number }
  current: { categories: number; products: number; variants: number; hours: number; paymentMethods: number; deliveryZones: number }
  missingImageKeys: string[]
}

export function ImportExportPage() {
  const queryClient = useQueryClient()
  const [data, setData] = useState<MenuImport | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true); setFeedback('')
    try {
      const response = await fetch('/admin/api/export')
      if (!response.ok) throw new Error('Não foi possível gerar a exportação.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pipo-cardapio-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setFeedback('Arquivo exportado.')
    } catch (cause) { setFeedback(messageFromError(cause)) } finally { setBusy(false) }
  }

  const validateFile = async (file: File) => {
    setBusy(true); setFeedback(''); setSummary(null); setData(null)
    try {
      if (file.size > 2_000_000) throw new Error('O arquivo excede o limite de 2 MB.')
      const parsed: unknown = JSON.parse(await file.text())
      const result = await api<ImportSummary>('/admin/api/import/validate', { method: 'POST', body: jsonBody(parsed) })
      setData(parsed as MenuImport)
      setSummary(result)
      setFeedback('Arquivo válido. Revise as diferenças antes de aplicar.')
    } catch (cause) { setFeedback(messageFromError(cause)) } finally { setBusy(false) }
  }

  const apply = async () => {
    if (!data || !summary || !window.confirm('Esta ação substituirá categorias, produtos, horários, pagamentos e regiões atuais. Continuar?')) return
    setBusy(true); setFeedback('')
    try {
      await api('/admin/api/import/apply', { method: 'POST', body: jsonBody({ mode: 'replace', confirmed: true, data }) })
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
      await queryClient.invalidateQueries({ queryKey: ['menu'] })
      setFeedback('Importação aplicada com sucesso. Objetos R2 antigos não foram excluídos.')
      setData(null); setSummary(null)
    } catch (cause) { setFeedback(messageFromError(cause)) } finally { setBusy(false) }
  }

  const dimensions = summary ? [
    ['Categorias', summary.current.categories, summary.incoming.categories],
    ['Produtos', summary.current.products, summary.incoming.products],
    ['Variações', summary.current.variants, summary.incoming.variants],
    ['Horários', summary.current.hours, summary.incoming.hours],
    ['Pagamentos', summary.current.paymentMethods, summary.incoming.paymentMethods],
    ['Regiões', summary.current.deliveryZones, summary.incoming.deliveryZones],
  ] : []

  return <div className="admin-page"><div className="admin-heading"><div><p>Dados</p><h1>Importar e exportar</h1><span>Formato JSON versionado. Imagens são referenciadas pelas chaves do R2, sem binários.</span></div></div>{feedback && <p className="feedback" role="status">{feedback}</p>}
    <div className="two-card-grid"><section className="admin-card action-card"><FileJson /><h2>Exportar JSON</h2><p>Baixe uma cópia dos dados atuais para backup ou edição controlada.</p><button className="primary-button" type="button" disabled={busy} onClick={download}><Download /> Exportar cardápio</button></section>
    <section className="admin-card action-card"><Upload /><h2>Validar importação</h2><p>Primeiro validamos schema, limites, diferenças e referências de imagens.</p><label className="primary-button file-button">Escolher JSON<input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void validateFile(file) }} /></label></section></div>
    {summary && <section className="admin-card import-summary"><div className="card-heading"><div><h2>Resumo da substituição</h2><p>Nenhuma alteração foi aplicada ainda.</p></div></div><div className="diff-table" role="table" aria-label="Diferenças da importação"><div role="row"><strong role="columnheader">Tipo</strong><strong role="columnheader">Atual</strong><strong role="columnheader">Novo</strong></div>{dimensions.map(([label, current, incoming]) => <div role="row" key={String(label)}><span role="cell">{label}</span><span role="cell">{current}</span><strong role="cell">{incoming}</strong></div>)}</div>{summary.missingImageKeys.length > 0 && <div className="warning-box"><AlertTriangle /><div><strong>Imagens ausentes ({summary.missingImageKeys.length})</strong><p>Esses itens usarão o placeholder. Nenhum objeto R2 será excluído.</p><ul>{summary.missingImageKeys.slice(0, 20).map((key) => <li key={key}>{key}</li>)}</ul></div></div>}<button className="danger-button" type="button" disabled={busy} onClick={apply}>{busy ? 'Aplicando…' : 'Confirmar e substituir o menu'}</button></section>}
  </div>
}
