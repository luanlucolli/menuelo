import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, Upload, X } from 'lucide-react'
import { useState } from 'react'
import type { MenuImport } from '../../../../shared/schemas'
import { api, fieldErrorsFromError, jsonBody, messageFromError } from '../../lib/api'
import { AdminNotice, type Notice } from './AdminNotice'

interface ImportSummary {
  incoming: { categories: number; products: number; variants: number; hours: number; paymentMethods: number; deliveryZones: number }
  current: { categories: number; products: number; variants: number; hours: number; paymentMethods: number; deliveryZones: number }
  missingImageKeys: string[]
}

export function ImportExportPage() {
  const queryClient = useQueryClient()
  const [data, setData] = useState<MenuImport | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [feedback, setFeedback] = useState<Notice | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true); setFeedback(null)
    try {
      const response = await fetch('/admin/api/export')
      if (!response.ok) throw new Error('Não foi possível gerar a cópia de segurança.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pipo-cardapio-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setFeedback({ kind: 'success', message: 'Cópia dos dados baixada.' })
    } catch (cause) { setFeedback({ kind: 'error', message: messageFromError(cause) }) } finally { setBusy(false) }
  }

  const validateFile = async (file: File) => {
    setBusy(true); setFeedback(null); setSummary(null); setData(null); setConfirmation('')
    try {
      if (file.size > 2_000_000) throw new Error('O arquivo é grande demais. Escolha uma cópia de até 2 MB.')
      let parsed: unknown
      try { parsed = JSON.parse(await file.text()) } catch { throw new Error('Este arquivo não é uma cópia de segurança válida do Pipo.') }
      const result = await api<ImportSummary>('/admin/api/import/validate', { method: 'POST', body: jsonBody(parsed) })
      setData(parsed as MenuImport)
      setSummary(result)
      setFeedback({ kind: 'success', message: 'Arquivo válido. Confira o resumo antes de substituir os dados atuais.' })
    } catch (cause) {
      const details = Object.values(fieldErrorsFromError(cause)).flat().slice(0, 3).join(' ')
      setFeedback({ kind: 'error', message: details || messageFromError(cause) })
    } finally { setBusy(false) }
  }

  const apply = async () => {
    if (!data || !summary || confirmation !== 'SUBSTITUIR') return
    setBusy(true); setFeedback(null)
    try {
      await api('/admin/api/import/apply', { method: 'POST', body: jsonBody({ mode: 'replace', confirmed: true, data }) })
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
      await queryClient.invalidateQueries({ queryKey: ['menu'] })
      setFeedback({ kind: 'success', message: 'Dados restaurados com sucesso. Fotos antigas não utilizadas foram preservadas no armazenamento.' })
      setData(null); setSummary(null); setConfirmation('')
    } catch (cause) { setFeedback({ kind: 'error', message: messageFromError(cause) }) } finally { setBusy(false) }
  }

  const cancelImport = () => { setData(null); setSummary(null); setConfirmation(''); setFeedback({ kind: 'info', message: 'Restauração cancelada. Nenhum dado foi alterado.' }) }
  const dimensions = summary ? [
    ['Categorias', summary.current.categories, summary.incoming.categories],
    ['Produtos', summary.current.products, summary.incoming.products],
    ['Tamanhos e opções', summary.current.variants, summary.incoming.variants],
    ['Horários', summary.current.hours, summary.incoming.hours],
    ['Formas de pagamento', summary.current.paymentMethods, summary.incoming.paymentMethods],
    ['Regiões', summary.current.deliveryZones, summary.incoming.deliveryZones],
  ] : []
  const missingImageNames = data && summary ? data.categories.flatMap((category) => category.products).filter((product) => product.imageKey && summary.missingImageKeys.includes(product.imageKey)).map((product) => product.name) : []

  return <div className="admin-page"><div className="admin-heading"><div><p>Ferramentas</p><h1>Cópia de segurança</h1><span>Baixe uma cópia dos dados ou restaure uma cópia anterior.</span></div></div>
    {feedback && <AdminNotice notice={feedback} />}
    <div className="two-card-grid"><section className="admin-card action-card"><Download /><h2>Baixar cópia dos dados</h2><p>Salva produtos, categorias, preços, horários e configurações em um arquivo. As fotos não ficam dentro desse arquivo.</p><button className="primary-button" type="button" disabled={busy} onClick={() => void download()}><Download /> {busy ? 'Preparando…' : 'Baixar cópia'}</button></section>
    <section className="admin-card action-card"><Upload /><h2>Restaurar dados</h2><p>Escolha um arquivo criado por esta ferramenta. Primeiro conferiremos o conteúdo sem alterar nada.</p><label className="primary-button file-button">{busy ? 'Verificando…' : 'Escolher arquivo'}<input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void validateFile(file); event.currentTarget.value = '' }} /></label></section></div>
    {summary && <section className="admin-card import-summary"><div className="card-heading"><div><h2>Confira antes de substituir</h2><p>Nenhuma alteração foi aplicada até agora.</p></div><button className="secondary-button" type="button" onClick={cancelImport}><X /> Cancelar</button></div><div className="diff-table" role="table" aria-label="Comparação da cópia de segurança"><div role="row"><strong role="columnheader">Informação</strong><strong role="columnheader">Atual</strong><strong role="columnheader">Cópia</strong></div>{dimensions.map(([label, current, incoming]) => <div role="row" key={String(label)}><span role="cell">{label}</span><span role="cell">{current}</span><strong role="cell">{incoming}</strong></div>)}</div>{summary.missingImageKeys.length > 0 && <div className="warning-box"><AlertTriangle /><div><strong>Algumas fotos não foram encontradas ({summary.missingImageKeys.length})</strong><p>Esses produtos usarão a imagem padrão. A restauração ainda pode continuar.</p>{missingImageNames.length > 0 && <ul className="plain-warning-list">{missingImageNames.slice(0, 20).map((name) => <li key={name}>{name}</li>)}</ul>}</div></div>}<div className="destructive-confirm"><AlertTriangle /><div><h3>Esta ação substituirá os dados atuais</h3><p>Digite <strong>SUBSTITUIR</strong> para confirmar.</p><label>Confirmação<input value={confirmation} autoComplete="off" onChange={(event) => setConfirmation(event.target.value.toLocaleUpperCase('pt-BR'))} /></label></div></div><button className="danger-button" type="button" disabled={busy || confirmation !== 'SUBSTITUIR'} onClick={() => void apply()}>{busy ? 'Substituindo…' : 'Substituir dados atuais'}</button></section>}
  </div>
}
