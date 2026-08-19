export interface TabItem {
  key: string
  title: string
  path: string
  fullPath: string
  name?: string
  icon?: string | null
  closable: boolean
  keepAlive?: boolean
}

export type TabCloseType = 'current' | 'left' | 'right' | 'other' | 'all'
