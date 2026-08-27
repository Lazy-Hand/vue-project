import { describe, expect, it } from 'vitest'

import router from '@/router'

describe('static routes', () => {
  it('registers the authenticated home route under layout', () => {
    const route = router.resolve('/')

    expect(route.name).toBe('home')
    expect(route.matched.some((item) => item.name === 'layout')).toBe(true)
    expect(route.meta.requiresAuth).not.toBe(false)
  })

  it('registers login as a public route', () => {
    const route = router.resolve('/login')

    expect(route.name).toBe('login')
    expect(route.meta.requiresAuth).toBe(false)
  })

  it('registers forgot-password as a public route', () => {
    const route = router.resolve('/forgot')

    expect(route.name).toBe('forgot')
    expect(route.meta.requiresAuth).toBe(false)
  })

  it('registers profile under the authenticated layout', () => {
    const route = router.resolve('/profile')

    expect(route.name).toBe('profile')
    expect(route.matched.some((item) => item.name === 'layout')).toBe(true)
    expect(route.meta.requiresAuth).not.toBe(false)
  })
})
