import type { RouteRecordRaw, Router } from 'vue-router'
import type { Component } from 'vue'

import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { PermissionTreeNode } from '@/types/permission'

export const LAYOUT_ROUTE_NAME = 'layout'

const viewModules = import.meta.glob<{ default: Component }>('@/views/**/*.vue')

const PLACEHOLDER_VIEW = () => import('@/views/placeholder/index.vue')

let routerInstance: Router | null = null
let registeredRouteNames: string[] = []

export function setupDynamicRoutes(router: Router): void {
  routerInstance = router
}

function getRouter(): Router {
  if (!routerInstance) {
    throw new Error('Dynamic routes are not initialized. Call setupDynamicRoutes(router) first.')
  }
  return routerInstance
}

function resolveViewLoader(component: string) {
  const normalized = component.replace(/^\/+/, '').replace(/\.vue$/, '')
  const key = `/src/views/${normalized}.vue`
  const matched = viewModules[key]
  return matched ?? PLACEHOLDER_VIEW
}

function collectMenuRoutes(nodes: PermissionTreeNode[], routes: RouteRecordRaw[] = []): RouteRecordRaw[] {
  for (const node of nodes) {
    if (!node.enabled) {
      continue
    }

    if (node.type === 'MENU' && node.path && node.component) {
      routes.push({
        path: node.path,
        name: node.code,
        component: resolveViewLoader(node.component),
        meta: {
          title: node.name,
          icon: node.icon ?? undefined,
          permission: node.code,
        },
      })
    }

    if (node.children?.length) {
      collectMenuRoutes(node.children, routes)
    }
  }

  return routes
}

export function menusToRoutes(menus: PermissionTreeNode[]): RouteRecordRaw[] {
  return collectMenuRoutes(menus)
}

function removeDynamicRoutes(): void {
  const router = getRouter()
  for (const name of registeredRouteNames) {
    if (router.hasRoute(name)) {
      router.removeRoute(name)
    }
  }
  registeredRouteNames = []
}

export function registerDynamicRoutes(menus = useAuthStore(pinia).menus): string[] {
  removeDynamicRoutes()

  const router = getRouter()
  const routes = menusToRoutes(menus)
  const names: string[] = []

  for (const route of routes) {
    router.addRoute(LAYOUT_ROUTE_NAME, route)
    if (typeof route.name === 'string') {
      names.push(route.name)
    }
  }

  registeredRouteNames = names
  return names
}

export function resetDynamicRoutes(): void {
  if (routerInstance) {
    removeDynamicRoutes()
  }
  useAuthStore(pinia).clearAccess()
}

export function getRegisteredDynamicRouteNames(): string[] {
  return [...registeredRouteNames]
}
