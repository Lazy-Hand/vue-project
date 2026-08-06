import { createApp } from 'vue'

import App from './App.vue'
import './styles/index.css'
import { setupI18n } from '@/i18n'
import { setupRouter } from './router'
import { pinia, setupPinia } from '@/stores'
import { useAppConfigStore } from '@/stores/app-config'
import { setupPermissionDirective } from '@/directives/permission'

const app = createApp(App)
app.use(setupPinia)
setupI18n(app)
useAppConfigStore(pinia).apply()
setupPermissionDirective(app)
app.use(setupRouter)
app.mount('#app')
