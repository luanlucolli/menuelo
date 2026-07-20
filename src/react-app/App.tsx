import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const PublicMenu = lazy(() => import('./modules/public-menu/PublicMenu').then((module) => ({ default: module.PublicMenu })))
const AdminLayout = lazy(() => import('./modules/admin/AdminLayout').then((module) => ({ default: module.AdminLayout })))
const DashboardPage = lazy(() => import('./modules/admin/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const CategoriesPage = lazy(() => import('./modules/admin/CategoriesPage').then((module) => ({ default: module.CategoriesPage })))
const ProductsPage = lazy(() => import('./modules/admin/ProductsPage').then((module) => ({ default: module.ProductsPage })))
const SettingsPage = lazy(() => import('./modules/admin/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const ImportExportPage = lazy(() => import('./modules/admin/ImportExportPage').then((module) => ({ default: module.ImportExportPage })))
const QrCodePage = lazy(() => import('./modules/admin/QrCodePage').then((module) => ({ default: module.QrCodePage })))

export default function App() {
  return (
    <Suspense fallback={<main className="state-page"><span className="spinner" /><p>Carregando…</p></main>}>
      <Routes>
        <Route path="/" element={<PublicMenu />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="produtos" element={<ProductsPage />} />
          <Route path="categorias" element={<CategoriesPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="configuracoes/importar-exportar" element={<ImportExportPage />} />
          <Route path="importar-exportar" element={<Navigate to="/admin/configuracoes/importar-exportar" replace />} />
          <Route path="qrcode" element={<QrCodePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
