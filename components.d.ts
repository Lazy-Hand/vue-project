/* eslint-disable */
// @ts-nocheck
// oxlint-disable
// Shared component declarations. Antdv Next components are imported explicitly.
export {}

declare module 'vue' {
  export interface GlobalComponents {
    DictSelect: (typeof import('./src/components/DictSelect/index.vue'))['default']
    DictTag: (typeof import('./src/components/DictTag/index.vue'))['default']
    IconPicker: (typeof import('./src/components/IconPicker/index.vue'))['default']
    MenuIcon: (typeof import('./src/components/MenuIcon/index.vue'))['default']
    ProTable: (typeof import('./src/components/ProTable/index.vue'))['default']
    RouterLink: (typeof import('vue-router'))['RouterLink']
    RouterView: (typeof import('vue-router'))['RouterView']
  }
}

declare global {
  const DictSelect: (typeof import('./src/components/DictSelect/index.vue'))['default']
  const DictTag: (typeof import('./src/components/DictTag/index.vue'))['default']
  const IconPicker: (typeof import('./src/components/IconPicker/index.vue'))['default']
  const MenuIcon: (typeof import('./src/components/MenuIcon/index.vue'))['default']
  const ProTable: (typeof import('./src/components/ProTable/index.vue'))['default']
  const RouterLink: (typeof import('vue-router'))['RouterLink']
  const RouterView: (typeof import('vue-router'))['RouterView']
}
