import * as AntdvIcons from '@antdv-next/icons'
import { MenuOutlined } from '@antdv-next/icons'
import { defineComponent, h, type Component } from 'vue'

/** Backend / menu `icon` prefix for assets under `src/assets/icons/`. */
export const CUSTOM_ICON_PREFIX = 'custom:'

const antdvIcons = AntdvIcons as Record<string, Component | undefined>
const cache = new Map<string, Component>()
const customIcons = new Map<string, Component>()

/**
 * Menu data predates the Antdv icon package and may still contain legacy names.
 * Keep this map explicit so a backend value always resolves to a stable icon
 * name that the picker can persist.
 */
const legacyIconAliases: Readonly<Record<string, string>> = {
  AddLocation: 'EnvironmentOutlined',
  Aim: 'AimOutlined',
  AlarmClock: 'ClockCircleOutlined',
  ArrowDown: 'ArrowDownOutlined',
  ArrowDownBold: 'ArrowDownOutlined',
  ArrowLeft: 'ArrowLeftOutlined',
  ArrowLeftBold: 'ArrowLeftOutlined',
  ArrowRight: 'ArrowRightOutlined',
  ArrowRightBold: 'ArrowRightOutlined',
  ArrowUp: 'ArrowUpOutlined',
  ArrowUpBold: 'ArrowUpOutlined',
  Avatar: 'UserOutlined',
  Back: 'RollbackOutlined',
  Bell: 'BellOutlined',
  Bottom: 'VerticalAlignBottomOutlined',
  Calendar: 'CalendarOutlined',
  Camera: 'CameraOutlined',
  Check: 'CheckOutlined',
  CircleCheck: 'CheckCircleOutlined',
  CircleClose: 'CloseCircleOutlined',
  CirclePlus: 'PlusCircleOutlined',
  Close: 'CloseOutlined',
  CopyDocument: 'CopyOutlined',
  Delete: 'DeleteOutlined',
  Download: 'DownloadOutlined',
  Edit: 'EditOutlined',
  Expand: 'ExpandOutlined',
  Filter: 'FilterOutlined',
  Folder: 'FolderOutlined',
  FolderAdd: 'FolderAddOutlined',
  FolderOpened: 'FolderOpenOutlined',
  FullScreen: 'FullscreenOutlined',
  Grid: 'AppstoreOutlined',
  Help: 'QuestionOutlined',
  Hide: 'EyeInvisibleOutlined',
  Home: 'HomeOutlined',
  House: 'HomeOutlined',
  InfoFilled: 'InfoCircleFilled',
  Key: 'KeyOutlined',
  Link: 'LinkOutlined',
  List: 'UnorderedListOutlined',
  Loading: 'LoadingOutlined',
  Location: 'EnvironmentOutlined',
  Lock: 'LockOutlined',
  Management: 'SettingOutlined',
  Menu: 'MenuOutlined',
  Message: 'MessageOutlined',
  More: 'MoreOutlined',
  MoreFilled: 'MoreOutlined',
  Notification: 'NotificationOutlined',
  Odometer: 'DashboardOutlined',
  Open: 'ExportOutlined',
  Paperclip: 'PaperClipOutlined',
  Phone: 'PhoneOutlined',
  Picture: 'PictureOutlined',
  Plus: 'PlusOutlined',
  QuestionFilled: 'QuestionCircleFilled',
  Rank: 'HolderOutlined',
  Refresh: 'ReloadOutlined',
  Remove: 'MinusOutlined',
  Search: 'SearchOutlined',
  Select: 'SelectOutlined',
  Setting: 'SettingOutlined',
  Share: 'ShareAltOutlined',
  Sort: 'SortAscendingOutlined',
  Star: 'StarOutlined',
  Tools: 'ToolOutlined',
  Top: 'VerticalAlignTopOutlined',
  Upload: 'UploadOutlined',
  User: 'UserOutlined',
  UserFilled: 'UserOutlined',
  View: 'EyeOutlined',
  Warning: 'WarningOutlined',
  ZoomIn: 'ZoomInOutlined',
  ZoomOut: 'ZoomOutOutlined',
}

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
  const fileName = path
    .split('/')
    .pop()
    ?.replace(/\.svg$/i, '')
  if (!fileName) continue
  registerCustomIcon(fileName, createSvgIconComponent(fileName, markup))
}

function resolveCustomIcon(name: string): Component | undefined {
  const key = name.trim()
  if (!key) return undefined
  return (
    customIcons.get(key) ?? customIcons.get(key.toLowerCase()) ?? customIcons.get(toPascalCase(key))
  )
}

function resolveAntdvIconName(icon: string): string | undefined {
  const key = icon.trim()
  if (!key) return undefined

  const pascalName = toPascalCase(key)
  if (antdvIcons[key]) return key
  if (antdvIcons[pascalName]) return pascalName

  const alias = legacyIconAliases[pascalName]
  if (alias && antdvIcons[alias]) return alias

  const outlined = `${pascalName}Outlined`
  return antdvIcons[outlined] ? outlined : undefined
}

/** Resolve a menu icon for `<component :is>`. */
export function resolveMenuIcon(icon?: string | null): Component {
  if (!icon) return MenuOutlined

  const cached = cache.get(icon)
  if (cached) return cached

  let resolved: Component | undefined

  if (icon.startsWith(CUSTOM_ICON_PREFIX)) {
    resolved = resolveCustomIcon(icon.slice(CUSTOM_ICON_PREFIX.length))
  } else {
    const antIconName = resolveAntdvIconName(icon)
    resolved = antIconName ? antdvIcons[antIconName] : resolveCustomIcon(icon)
  }

  const finalIcon = resolved ?? MenuOutlined
  cache.set(icon, finalIcon)
  return finalIcon
}

export function isCustomMenuIcon(icon?: string | null): boolean {
  if (!icon) return false
  if (icon.startsWith(CUSTOM_ICON_PREFIX)) return true
  return !resolveAntdvIconName(icon) && Boolean(resolveCustomIcon(icon))
}

export function listCustomMenuIconNames(): string[] {
  return [
    ...new Set(
      Object.keys(svgRawModules)
        .map((path) =>
          path
            .split('/')
            .pop()
            ?.replace(/\.svg$/i, ''),
        )
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort()
}

/** Names exported by `@antdv-next/icons` that can be persisted by the picker. */
export function listAntdvIconNames(): string[] {
  return Object.keys(antdvIcons)
    .filter((name) => /(?:Filled|Outlined|TwoTone)$/.test(name) && Boolean(antdvIcons[name]))
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
