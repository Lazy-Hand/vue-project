import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'

export function usePermission() {
  const authStore = useAuthStore(pinia)

  function hasPermission(code: string | string[]): boolean {
    return authStore.hasPermission(code)
  }

  function hasAnyPermission(codes: string[]): boolean {
    if (codes.length === 0) return true
    return codes.some((code) => authStore.permissions.includes(code))
  }

  return {
    hasPermission,
    hasAnyPermission,
  }
}
