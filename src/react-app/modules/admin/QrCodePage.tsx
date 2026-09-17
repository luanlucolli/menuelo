import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { AlertTriangle, Download, QrCode } from 'lucide-react'
import { messageFromError } from '../../lib/api'
import { cn, primaryButton } from '../../lib/tailwind'
import { AdminState } from './DashboardPage'
import { useAdminMenu } from './hooks'

export function QrCodePage() {
  const { data, isLoading, error } = useAdminMenu()
  const [svg, setSvg] = useState('')
  const [qrError, setQrError] = useState('')
  const url = useMemo(() => data?.business.publicSiteUrl || window.location.origin, [data])
  const isLocal = useMemo(() => { try { const hostname = new URL(url).hostname; return hostname === 'localhost' || hostname.startsWith('127.') || hostname === '::1' } catch { return true } }, [url])
  useEffect(() => {
    if (!url) return
    QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#211f1b', light: '#ffffff' }, width: 360 }).then(setSvg).catch((cause: unknown) => setQrError(messageFromError(cause)))
  }, [url])
  if (isLoading) return <AdminState message="Gerando QR Code…" />
  if (error || !data) return <AdminState error message={messageFromError(error)} />
  const download = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `qrcode-${data.business.slug}.svg`
    link.click()
    URL.revokeObjectURL(objectUrl)
  }
  return <div className="mx-auto w-full max-w-[72rem]"><div className="mb-[1.3rem] flex flex-wrap items-end justify-between gap-4"><div><p className="mb-[.2rem] text-[.75rem] font-[850] uppercase tracking-[.1em] text-[var(--color-brand-strong)]">Divulgação</p><h1 className="m-0 text-[clamp(1.8rem,7vw,2.5rem)] tracking-[-.035em]">QR Code do cardápio</h1><span className="mt-[.35rem] block text-muted">Gerado localmente no navegador, sem serviço externo.</span></div></div>{qrError && <p className="my-[.8rem] rounded-[.6rem] border border-[#e0aaaa] bg-[#fff0f0] p-[.7rem_.85rem] text-danger" role="alert">{qrError}</p>}{(!data.business.publicSiteUrl || isLocal) && <div className="my-4 flex items-start gap-3 rounded-[.7rem] border border-[#e3bd72] bg-[#fff2d8] p-3 text-[#68420b]"><AlertTriangle className="w-5 shrink-0" /><div><strong>URL pública ainda não está pronta</strong><p className="mt-1">{!data.business.publicSiteUrl ? 'A origem atual está sendo usada. Configure a URL pública antes de imprimir ou divulgar.' : 'A URL configurada é local e não funcionará para seus clientes.'}</p></div></div>}<section className="grid justify-items-center gap-4 rounded-[.85rem] border border-border bg-surface-strong p-4 text-center shadow-menu-sm"><div className="w-[min(100%,23rem)] rounded-[.8rem] border border-border bg-white p-3 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} /><p className="m-0 max-w-full [overflow-wrap:anywhere] text-muted">{url}</p><button className={cn(primaryButton, 'whitespace-nowrap')} type="button" disabled={!svg} onClick={download}><Download /> <span>Baixar SVG</span></button><small className="flex items-center gap-[.35rem] text-muted"><QrCode className="w-4" /> Teste o código com outro aparelho antes de imprimir.</small></section></div>
}
