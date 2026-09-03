import { theme as antdTheme, type ThemeConfig } from 'antdv-next'

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/

function parseHex(color: string): [number, number, number] | null {
  const matched = HEX_COLOR_RE.exec(color.trim())
  if (!matched?.[1]) return null

  const hex = matched[1]
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}

function mix(channel: number, target: number, weight: number): number {
  return Math.round(channel * (1 - weight) + target * weight)
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

/** Mix primary with white (lighten) or black (darken) for application CSS vars. */
export function buildPrimaryColorVars(primary: string): Record<string, string> | null {
  const rgb = parseHex(primary)
  if (!rgb) return null

  const [r, g, b] = rgb
  const light = (weight: number) =>
    toHex(mix(r, 255, weight), mix(g, 255, weight), mix(b, 255, weight))
  const dark = (weight: number) => toHex(mix(r, 0, weight), mix(g, 0, weight), mix(b, 0, weight))

  return {
    '--app-color-primary': primary.toUpperCase(),
    '--app-color-primary-light-3': light(0.3),
    '--app-color-primary-light-5': light(0.5),
    '--app-color-primary-light-7': light(0.7),
    '--app-color-primary-light-8': light(0.8),
    '--app-color-primary-light-9': light(0.9),
    '--app-color-primary-dark-2': dark(0.2),
  }
}

export function applyPrimaryColor(primary: string): boolean {
  const vars = buildPrimaryColorVars(primary)
  if (!vars) return false

  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
  return true
}

export function applyDocumentLocale(locale: string): void {
  document.documentElement.lang = locale
}

export function applyThemeMode(isDark: boolean): void {
  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.setAttribute('data-theme', isDark ? 'dark' : 'light')
}

export function getAntdThemeConfig(isDark: boolean, primaryColor: string): ThemeConfig {
  if (isDark) {
    return {
      algorithm: antdTheme.darkAlgorithm,
      cssVar: true,
      token: {
        colorPrimary: primaryColor,
        colorBgBase: '#16171a',
        colorBgContainer: '#1c1d22',
        colorBgElevated: '#222429',
        colorBgLayout: '#16171a',
        colorBgSpotlight: '#262830',
        colorBorder: '#2e3038',
        colorBorderSecondary: '#262830',
        colorSplit: '#262830',
        colorText: '#f1f5f9',
        colorTextSecondary: '#94a3b8',
        colorTextTertiary: '#64748b',
        colorTextQuaternary: '#475569',
      },
      components: {
        Card: {
          colorBgContainer: '#222429',
          colorBorderSecondary: '#2e3038',
        },
        Table: {
          colorBgContainer: '#1c1d22',
          headerBg: '#22242a',
          headerColor: '#cbd5e1',
          headerSplitColor: 'transparent',
          rowHoverBg: '#262830',
          borderColor: '#262830',
        },
        Button: {
          defaultBg: '#22242a',
          defaultBorderColor: '#2e3038',
          defaultColor: '#f1f5f9',
          defaultGhostColor: '#f1f5f9',
        },
        Input: {
          colorBgContainer: '#22242a',
          colorBorder: '#2e3038',
          colorText: '#f1f5f9',
          colorTextPlaceholder: '#64748b',
        },
        Select: {
          colorBgContainer: '#22242a',
          colorBorder: '#2e3038',
          colorText: '#f1f5f9',
          colorTextPlaceholder: '#64748b',
          optionSelectedBg: '#2a2520',
        },
        Modal: {
          contentBg: '#1c1d22',
          headerBg: '#1c1d22',
        },
        Drawer: {
          colorBgElevated: '#1c1d22',
        },
        Dropdown: {
          colorBgElevated: '#1c1d22',
        },
        Menu: {
          colorItemBg: 'transparent',
          colorItemBgHover: '#262830',
          colorItemBgSelected: '#2a2520',
          colorItemText: '#94a3b8',
          colorItemTextHover: '#ffffff',
          colorItemTextSelected: '#f97316',
          colorSubItemBg: 'transparent',
        },
        Pagination: {
          itemBg: '#22242a',
          itemLinkBg: '#22242a',
        },
        Segmented: {
          trackBg: '#16171a',
          itemSelectedBg: '#2e3038',
          itemSelectedColor: '#ffffff',
        },
        Tabs: {
          cardBg: '#1c1d22',
          itemColor: '#94a3b8',
          itemSelectedColor: '#ffffff',
          itemHoverColor: '#cbd5e1',
          itemActiveColor: '#ffffff',
        },
      },
    }
  }

  return {
    algorithm: antdTheme.defaultAlgorithm,
    cssVar: true,
    token: {
      colorPrimary: primaryColor,
      colorBgLayout: '#f8fafc',
    },
  }
}
