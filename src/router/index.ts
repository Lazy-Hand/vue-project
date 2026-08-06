import { createRouter, createWebHistory } from 'vue-router'
import type {App} from "vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [],
})
export const setupRouter = (app: App) => {
  app.use(router)
}
export default router
