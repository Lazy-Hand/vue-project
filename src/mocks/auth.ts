import { defineMock } from '@alova/mock'

import type { ApiResponse, AuthTokenData, AuthUser, LoginParams } from '@/types/auth'
import type { PermissionTreeNode } from '@/types/permission'

const MOCK_USERNAME = 'admin'
const MOCK_PASSWORD = 'Admin@123456'

function createUser(): AuthUser {
  return {
    id: '1',
    username: MOCK_USERNAME,
    nickname: 'Mock 管理员',
    email: 'admin@example.com',
    phone: '13800138000',
    avatar: null,
    enabled: true,
  }
}

function createAuthTokenData(): AuthTokenData {
  return {
    accessToken: `mock-access-token-${Date.now()}`,
    tokenType: 'Bearer',
    expiresIn: 7200,
    user: createUser(),
  }
}

type MenuI18n = { 'zh-CN': string; 'en-US': string }

function localizeName(names: MenuI18n, locale: string | undefined): string {
  if (locale === 'en-US') return names['en-US']
  return names['zh-CN']
}

function createMenus(locale?: string): PermissionTreeNode[] {
  return [
    {
      id: '10',
      type: 'DIRECTORY',
      code: 'dashboard',
      name: localizeName({ 'zh-CN': '仪表盘', 'en-US': 'Dashboard' }, locale),
      parentId: null,
      path: '/dashboard',
      component: null,
      icon: 'Odometer',
      sort: 0,
      enabled: true,
      children: [
        {
          id: '11',
          type: 'MENU',
          code: 'system:dashboard',
          name: localizeName({ 'zh-CN': '管理仪表盘', 'en-US': 'Admin Dashboard' }, locale),
          parentId: '10',
          path: '/dashboard',
          component: 'dashboard/index',
          icon: 'Odometer',
          sort: 1,
          enabled: true,
          children: [],
        },
      ],
    },
    {
      id: '1',
      type: 'DIRECTORY',
      code: 'system',
      name: localizeName({ 'zh-CN': '系统管理', 'en-US': 'System' }, locale),
      parentId: null,
      path: '/system',
      component: null,
      icon: 'Setting',
      sort: 1,
      enabled: true,
      children: [
        {
          id: '2',
          type: 'MENU',
          code: 'system:user',
          name: localizeName({ 'zh-CN': '用户管理', 'en-US': 'Users' }, locale),
          parentId: '1',
          path: '/system/user',
          component: 'system/user/index',
          icon: 'User',
          sort: 1,
          enabled: true,
          children: [],
        },
        {
          id: '3',
          type: 'MENU',
          code: 'system:role',
          name: localizeName({ 'zh-CN': '角色管理', 'en-US': 'Roles' }, locale),
          parentId: '1',
          path: '/system/role',
          component: 'system/role/index',
          icon: 'UserFilled',
          sort: 2,
          enabled: true,
          children: [],
        },
        {
          id: '4',
          type: 'MENU',
          code: 'system:permission',
          name: localizeName({ 'zh-CN': '权限管理', 'en-US': 'Permissions' }, locale),
          parentId: '1',
          path: '/system/permission',
          component: 'system/permission/index',
          icon: 'Key',
          sort: 3,
          enabled: true,
          children: [],
        },
      ],
    },
  ]
}

const MOCK_PERMISSIONS = [
  'system:dashboard:query',
  'system:user:query',
  'system:user:create',
  'system:user:update',
  'system:user:delete',
  'system:role:query',
  'system:permission:query',
]

function success<T>(data: T): ApiResponse<T> {
  return {
    code: 0,
    message: 'success',
    data,
  }
}

function requestLocale(headers: Record<string, string | undefined> | undefined): string | undefined {
  return headers?.['X-Locale'] ?? headers?.['x-locale']
}

export default defineMock({
  '[POST]/auth/login': ({ data }) => {
    const credentials = data as Partial<LoginParams>

    if (credentials.username !== MOCK_USERNAME || credentials.password !== MOCK_PASSWORD) {
      return {
        status: 401,
        statusText: 'Unauthorized',
        body: {
          code: 401,
          message: '用户名或密码错误',
          data: null,
        },
      }
    }

    return success(createAuthTokenData())
  },
  '[POST]/auth/refresh': () => success(createAuthTokenData()),
  '[GET]/auth/me': () => success(createUser()),
  '[GET]/auth/me/permissions': () => success(MOCK_PERMISSIONS),
  '[GET]/auth/me/menus': ({ headers }) =>
    success(createMenus(requestLocale(headers as Record<string, string | undefined>))),
  '[GET]/auth/me/account-sets': () =>
    success([
      {
        id: '1',
        code: 'DEFAULT',
        name: '默认账套',
        isDefault: true,
        enabled: true,
      },
    ]),
  '[POST]/auth/logout': () => success({ success: true }),
})
