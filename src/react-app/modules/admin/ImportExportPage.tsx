import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, Upload, X } from 'lucide-react'
import { useState } from 'react'
import type { MenuImport } from '../../../../shared/schemas'
import { api, fieldErrorsFromError, jsonBody, messageFromError } from '../../lib/api'
import { AdminNotice, type Notice } from './AdminNotice'
import { useAdminMenu } from './hooks'
import { publicChangeNotice } from './publicationNotice'
import { dangerButton, fieldLabel, focusRing, primaryButton, secondaryButton, textInput } from '../../lib/tailwind'

interface ImportSummary {
  incoming: { categories: number; products: number; variants: number; customizationGroups: number; customizationOptions: number; hours: number; paymentMethods: number; deliveryZones: number }
  current: { categories: number; products: number; variants: number; customizationGroups: number; customizationOptions: number; hours: number; paymentMethods: number; deliveryZones: number }
  missingImageKeys: string[]
}

export function BackupManager() {
  const queryClient = useQueryClient()
  const { data: menu } = useAdminMenu()
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
      link.download = `copia-${menu?.business.slug || 'cardapio'}-${new Date().toISOString().slice(0, 10)}.json`
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
      try { parsed = JSON.parse(await file.text()) } catch { throw new Error('Este arquivo não é uma cópia de segurança válida.') }
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
      setFeedback(publicChangeNotice('Dados restaurados com sucesso. Fotos antigas não utilizadas foram preservadas no armazenamento.'))
      setData(null); setSummary(null); setConfirmation('')
    } catch (cause) { setFeedback({ kind: 'error', message: messageFromError(cause) }) } finally { setBusy(false) }
  }

  const cancelImport = () => { setData(null); setSummary(null); setConfirmation(''); setFeedback({ kind: 'info', message: 'Restauração cancelada. Nenhum dado foi alterado.' }) }
  const dimensions = summary ? [
    ['Categorias', summary.current.categories, summary.incoming.categories],
    ['Produtos', summary.current.products, summary.incoming.products],
    ['Tamanhos e opções', summary.current.variants, summary.incoming.variants],
    ['Grupos de montagem', summary.current.customizationGroups, summary.incoming.customizationGroups],
    ['Opções de montagem', summary.current.customizationOptions, summary.incoming.customizationOptions],
    ['Horários', summary.current.hours, summary.incoming.hours],
    ['Formas de pagamento', summary.current.paymentMethods, summary.incoming.paymentMethods],
    ['Regiões', summary.current.deliveryZones, summary.incoming.deliveryZones],
  ] : []
  const missingImageNames = data && summary ? data.categories.flatMap((category) => category.products).filter((product) => product.imageKey && summary.missingImageKeys.includes(product.imageKey)).map((product) => product.name) : []

  return <>
    {feedback && <AdminNotice notice={feedback} />}
    <div className="grid gap-3 min-[650px]:grid-cols-2"><section className="flex flex-col items-start rounded-[.7rem] border border-border bg-[#faf8f5] p-[.9rem]"><Download className="w-5 text-[var(--color-brand)]" /><h3 className="mb-[.2rem] mt-[.65rem] text-base">Baixar cópia dos dados</h3><p className="my-[.2rem] mb-[.9rem] flex-1 text-[.86rem] leading-[1.45] text-muted">Salva produtos, categorias, preços, horários e configurações em um arquivo. As fotos não ficam dentro desse arquivo.</p><button className={`${primaryButton} whitespace-nowrap`} type="button" disabled={busy} onClick={() => void download()}><Download /> <span>{busy ? 'Preparando…' : 'Baixar cópia'}</span></button></section>
    <section className="flex flex-col items-start rounded-[.7rem] border border-border bg-[#faf8f5] p-[.9rem]"><Upload className="w-5 text-[var(--color-brand)]" /><h3 className="mb-[.2rem] mt-[.65rem] text-base">Restaurar dados</h3><p className="my-[.2rem] mb-[.9rem] flex-1 text-[.86rem] leading-[1.45] text-muted">Escolha um arquivo criado por esta ferramenta. Primeiro conferiremos o conteúdo sem alterar nada.</p><label className={`relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-[.4rem] rounded-[.55rem] border border-border bg-surface-strong px-[.9rem] py-[.65rem] font-[750] ${focusRing}`}>{busy ? 'Verificando…' : 'Escolher arquivo'}<input className="absolute h-px w-px opacity-0" type="file" accept="application/json,.json" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void validateFile(file); event.currentTarget.value = '' }} /></label></section></div>
    {summary && <section className="grid gap-4 rounded-[.7rem] border border-border bg-[#faf8f5] p-[.9rem]"><div className="mb-0 flex items-start justify-between gap-4"><div><h3 className="m-0 text-base">Confira antes de substituir</h3><p className="mt-1 text-[.86rem] text-muted">Nenhuma alteração foi aplicada até agora.</p></div><button className={secondaryButton} type="button" onClick={cancelImport}><X /> Cancelar</button></div><div className="grid overflow-hidden rounded-[.65rem] border border-border" role="table" aria-label="Comparação da cópia de segurança"><div className="grid grid-cols-[minmax(0,1fr)_4rem_4rem] gap-2 border-b border-border bg-[#eee9e1] px-[.7rem] py-[.55rem]" role="row"><strong role="columnheader">Informação</strong><strong className="text-right" role="columnheader">Atual</strong><strong className="text-right" role="columnheader">Cópia</strong></div>{dimensions.map(([label, current, incoming]) => <div className="grid grid-cols-[minmax(0,1fr)_4rem_4rem] gap-2 border-b border-border px-[.7rem] py-[.55rem] last:border-b-0" role="row" key={String(label)}><span role="cell">{label}</span><span className="text-right" role="cell">{current}</span><strong className="text-right" role="cell">{incoming}</strong></div>)}</div>{summary.missingImageKeys.length > 0 && <div className="my-4 flex items-start gap-3 rounded-[.7rem] border border-[#e3bd72] bg-[#fff2d8] p-3 text-[#68420b]"><AlertTriangle className="w-5 shrink-0" /><div><strong>Algumas fotos não foram encontradas ({summary.missingImageKeys.length})</strong><p className="mt-1">Esses produtos usarão a imagem padrão. A restauração ainda pode continuar.</p>{missingImageNames.length > 0 && <ul className="max-h-36 overflow-auto pl-5 text-[.72rem]">{missingImageNames.slice(0, 20).map((name) => <li key={name}>{name}</li>)}</ul>}</div></div>}<div className="my-4 flex items-start gap-3 rounded-[.7rem] border border-[#e0aaaa] bg-[#fff0f0] p-[.9rem] text-[#711f1f]"><AlertTriangle className="w-5 shrink-0" /><div className="grid flex-1 gap-[.45rem]"><h3 className="m-0">Esta ação substituirá os dados atuais</h3><p className="m-0">Digite <strong>SUBSTITUIR</strong> para confirmar.</p><label className={fieldLabel}>Confirmação<input className={`${textInput} border-[#c98d8d]`} value={confirmation} autoComplete="off" onChange={(event) => setConfirmation(event.target.value.toLocaleUpperCase('pt-BR'))} /></label></div></div><button className={dangerButton} type="button" disabled={busy || confirmation !== 'SUBSTITUIR'} onClick={() => void apply()}>{busy ? 'Substituindo…' : 'Substituir dados atuais'}</button></section>}
  </>
}
