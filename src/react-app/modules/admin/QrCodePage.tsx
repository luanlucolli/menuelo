import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { AlertTriangle, Download, QrCode } from 'lucide-react'
import { messageFromError } from '../../lib/api'
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
    link.download = 'qrcode-cardapio-pipo.svg'
    link.click()
    URL.revokeObjectURL(objectUrl)
  }
  return <div className="admin-page"><div className="admin-heading"><div><p>Divulgação</p><h1>QR Code do cardápio</h1><span>Gerado localmente no navegador, sem serviço externo.</span></div></div>{qrError && <p className="feedback error">{qrError}</p>}{(!data.business.publicSiteUrl || isLocal) && <div className="warning-box"><AlertTriangle /><div><strong>URL pública ainda não está pronta</strong><p>{!data.business.publicSiteUrl ? 'A origem atual está sendo usada. Configure a URL pública antes de imprimir ou divulgar.' : 'A URL configurada é local e não funcionará para seus clientes.'}</p></div></div>}<section className="admin-card qr-card"><div className="qr-preview" dangerouslySetInnerHTML={{ __html: svg }} /><p>{url}</p><button className="primary-button button-nowrap" type="button" disabled={!svg} onClick={download}><Download /> <span>Baixar SVG</span></button><small><QrCode /> Teste o código com outro aparelho antes de imprimir.</small></section></div>
}
