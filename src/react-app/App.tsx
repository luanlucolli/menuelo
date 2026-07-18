import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicMenu } from './modules/public-menu/PublicMenu'
import { AdminLayout } from './modules/admin/AdminLayout'
import { DashboardPage } from './modules/admin/DashboardPage'
import { CategoriesPage } from './modules/admin/CategoriesPage'
import { ProductsPage } from './modules/admin/ProductsPage'
import { SettingsPage } from './modules/admin/SettingsPage'
import { ImportExportPage } from './modules/admin/ImportExportPage'
import { QrCodePage } from './modules/admin/QrCodePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicMenu />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="importar-exportar" element={<ImportExportPage />} />
        <Route path="qrcode" element={<QrCodePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
