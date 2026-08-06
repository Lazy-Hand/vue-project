import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Set to false for routes that can be opened without authentication. */
    requiresAuth?: boolean
    title?: string
    icon?: string
    permission?: string
  }
}

export {}
