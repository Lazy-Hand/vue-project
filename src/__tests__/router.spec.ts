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
})
