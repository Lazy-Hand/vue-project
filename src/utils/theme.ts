const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/

function parseHex(color: string): [number, number, number] | null {
  const matched = HEX_COLOR_RE.exec(color.trim())
  if (!matched?.[1]) return null

  const hex = matched[1]
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)]
}

function mix(channel: number, target: number, weight: number): number {
  return Math.round(channel * (1 - weight) + target * weight)
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

/** Mix primary with white (lighten) or black (darken) for Element Plus CSS vars. */
export function buildPrimaryColorVars(primary: string): Record<string, string> | null {
  const rgb = parseHex(primary)
  if (!rgb) return null

  const [r, g, b] = rgb
  const light = (weight: number) => toHex(mix(r, 255, weight), mix(g, 255, weight), mix(b, 255, weight))
  const dark = (weight: number) => toHex(mix(r, 0, weight), mix(g, 0, weight), mix(b, 0, weight))

  return {
    '--el-color-primary': primary.toUpperCase(),
    '--el-color-primary-light-3': light(0.3),
    '--el-color-primary-light-5': light(0.5),
    '--el-color-primary-light-7': light(0.7),
    '--el-color-primary-light-8': light(0.8),
    '--el-color-primary-light-9': light(0.9),
    '--el-color-primary-dark-2': dark(0.2),
  }
}

export function applyPrimaryColor(primary: string): boolean {
  const vars = buildPrimaryColorVars(primary)
  if (!vars) return false

  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
  root.style.setProperty('--app-color-primary', primary.toUpperCase())
  return true
}

export function applyDocumentLocale(locale: string): void {
  document.documentElement.lang = locale
}
