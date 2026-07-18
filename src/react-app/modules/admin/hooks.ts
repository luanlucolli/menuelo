import { useQuery } from '@tanstack/react-query'
import type { MenuResponse } from '../../../../shared/schemas'
import { api } from '../../lib/api'

export function useAdminMenu() {
  return useQuery({ queryKey: ['admin', 'menu'], queryFn: () => api<MenuResponse>('/admin/api/menu'), staleTime: 10_000 })
}
