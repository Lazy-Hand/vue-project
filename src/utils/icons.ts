import { Menu } from '@element-plus/icons-vue'
import * as ElementPlusIcons from '@element-plus/icons-vue'
import type { Component } from 'vue'

const icons = ElementPlusIcons as Record<string, Component | undefined>
const cache = new Map<string, Component>()

function toPascalCase(name: string): string {
  return name
    .trim()
    .replace(/\.vue$/i, '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * Resolve an Element Plus icon by runtime name.
 * Accepts PascalCase (`Setting`) or kebab/snake (`setting`, `user-filled`).
 * Does not globally register icons — only returns the component for `<component :is>`.
 */
export function resolveMenuIcon(icon?: string | null): Component {
  if (!icon) return Menu

  const cached = cache.get(icon)
  if (cached) return cached

  const resolved = icons[icon] ?? icons[toPascalCase(icon)] ?? Menu
  cache.set(icon, resolved)
  return resolved
}
