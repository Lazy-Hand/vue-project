import type { App, Directive } from 'vue'

import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'

type PermissionValue = string | string[] | undefined

function checkPermission(value: PermissionValue): boolean {
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return true
  }
  return useAuthStore(pinia).hasPermission(value)
}

export const permissionDirective: Directive<HTMLElement, PermissionValue> = {
  mounted(el, binding) {
    if (!checkPermission(binding.value)) {
      el.parentNode?.removeChild(el)
    }
  },
  updated(el, binding) {
    if (!checkPermission(binding.value)) {
      el.parentNode?.removeChild(el)
    }
  },
}

export function setupPermissionDirective(app: App): void {
  app.directive('permission', permissionDirective)
}
