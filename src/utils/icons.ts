import { Menu } from '@element-plus/icons-vue'
import * as ElementPlusIcons from '@element-plus/icons-vue'
import { defineComponent, h, type Component } from 'vue'

/** Backend / menu `icon` prefix for assets under `src/assets/icons/`. */
export const CUSTOM_ICON_PREFIX = 'custom:'

const epIcons = ElementPlusIcons as Record<string, Component | undefined>
const cache = new Map<string, Component>()
const customIcons = new Map<string, Component>()

const svgRawModules = import.meta.glob<string>('@/assets/icons/**/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
})

function toPascalCase(name: string): string {
  return name
    .trim()
    .replace(/\.vue$/i, '')
    .replace(/\.svg$/i, '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function createSvgIconComponent(name: string, markup: string): Component {
  return defineComponent({
    name: `CustomIcon${toPascalCase(name)}`,
    render() {
      return h('span', {
        class: 'custom-menu-icon',
        // Local static SVGs only — never pass user-authored markup here.
        innerHTML: markup.trim(),
      })
    },
  })
}

function registerCustomIcon(name: string, component: Component): void {
  customIcons.set(name, component)
  customIcons.set(name.toLowerCase(), component)
  customIcons.set(toPascalCase(name), component)
}

for (const [path, markup] of Object.entries(svgRawModules)) {
  const fileName = path.split('/').pop()?.replace(/\.svg$/i, '')
  if (!fileName) continue
  registerCustomIcon(fileName, createSvgIconComponent(fileName, markup))
}

function resolveCustomIcon(name: string): Component | undefined {
  const key = name.trim()
  if (!key) return undefined
  return (
    customIcons.get(key) ??
    customIcons.get(key.toLowerCase()) ??
    customIcons.get(toPascalCase(key))
  )
}

/**
 * Resolve a menu icon for `<component :is>`.
 *
 * - Element Plus: `Setting` / `user-filled`
 * - Custom SVG in `src/assets/icons/foo.svg`: `custom:foo` or `foo`（EP 未命中时回落）
 */
export function resolveMenuIcon(icon?: string | null): Component {
  if (!icon) return Menu

  const cached = cache.get(icon)
  if (cached) return cached

  let resolved: Component | undefined

  if (icon.startsWith(CUSTOM_ICON_PREFIX)) {
    resolved = resolveCustomIcon(icon.slice(CUSTOM_ICON_PREFIX.length))
  } else {
    resolved = epIcons[icon] ?? epIcons[toPascalCase(icon)]
    if (!resolved) {
      resolved = resolveCustomIcon(icon)
    }
  }

  const finalIcon = resolved ?? Menu
  cache.set(icon, finalIcon)
  return finalIcon
}

export function isCustomMenuIcon(icon?: string | null): boolean {
  if (!icon) return false
  if (icon.startsWith(CUSTOM_ICON_PREFIX)) return true
  if (epIcons[icon] || epIcons[toPascalCase(icon)]) return false
  return Boolean(resolveCustomIcon(icon))
}

export function listCustomMenuIconNames(): string[] {
  return [...new Set(
    Object.keys(svgRawModules)
      .map((path) => path.split('/').pop()?.replace(/\.svg$/i, ''))
      .filter((name): name is string => Boolean(name)),
  )].sort()
}

/** PascalCase names exported by `@element-plus/icons-vue`. */
export function listElementPlusIconNames(): string[] {
  return Object.keys(epIcons)
    .filter((name) => name !== 'default' && Boolean(epIcons[name]))
    .sort((a, b) => a.localeCompare(b))
}

/** Build the stored value for a custom SVG icon file name. */
export function toCustomIconValue(fileName: string): string {
  const name = fileName.trim().replace(/\.svg$/i, '')
  if (!name) return ''
  if (name.startsWith(CUSTOM_ICON_PREFIX)) return name
  return `${CUSTOM_ICON_PREFIX}${name}`
}

/** Strip `custom:` for display / matching against asset file names. */
export function getCustomIconFileName(icon?: string | null): string | null {
  if (!icon?.startsWith(CUSTOM_ICON_PREFIX)) return null
  const name = icon.slice(CUSTOM_ICON_PREFIX.length).trim()
  return name || null
}
