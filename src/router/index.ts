import { createRouter, createWebHistory } from 'vue-router'
import type { App } from 'vue'

import { createAuthGuard } from './guards/auth'
import { setupDynamicRoutes } from './dynamic'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'layout',
      component: () => import('@/layouts/main/index.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/home/index.vue'),
          meta: {
            title: '首页',
          },
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/login/index.vue'),
      meta: {
        requiresAuth: false,
      },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/error/404.vue'),
    },
  ],
})

setupDynamicRoutes(router)

export const setupRouter = (app: App) => {
  router.beforeEach(createAuthGuard())
  app.use(router)
}
export default router
