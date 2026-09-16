import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const AdminLayout = lazy(() => import('./modules/admin/AdminLayout').then((module) => ({ default: module.AdminLayout })))
const DashboardPage = lazy(() => import('./modules/admin/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const CategoriesPage = lazy(() => import('./modules/admin/CategoriesPage').then((module) => ({ default: module.CategoriesPage })))
const ProductsPage = lazy(() => import('./modules/admin/ProductsPage').then((module) => ({ default: module.ProductsPage })))
const SettingsPage = lazy(() => import('./modules/admin/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const QrCodePage = lazy(() => import('./modules/admin/QrCodePage').then((module) => ({ default: module.QrCodePage })))

export default function App() {
  return (
    <Suspense fallback={<main className="grid min-h-[100dvh] place-content-center justify-items-center gap-[.8rem] p-8 text-center"><span className="h-8 w-8 animate-[spin_.8s_linear_infinite] rounded-full border-[3px] border-border border-t-[var(--color-brand)]" /><p>Carregando…</p></main>}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="produtos" element={<ProductsPage />} />
          <Route path="categorias" element={<CategoriesPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="configuracoes/importar-exportar" element={<Navigate to="/admin/configuracoes?secao=avancado" replace />} />
          <Route path="importar-exportar" element={<Navigate to="/admin/configuracoes?secao=avancado" replace />} />
          <Route path="qrcode" element={<QrCodePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  )
}
