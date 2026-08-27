import { request, authMeta, refreshAccessToken } from '@/utils/request'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type { AccountSetSummary } from '@/types/account-set'
import type {
  AuthTokenData,
  AuthUser,
  CaptchaInfo,
  ChangePasswordParams,
  ForgotPasswordParams,
  LoginParams,
  ResetPasswordParams,
  UpdateProfileParams,
} from '@/types/auth'
import type { PermissionTreeNode } from '@/types/permission'

export async function loginAuth(params: LoginParams): Promise<AuthTokenData> {
  const tokenData = await request.Post<AuthTokenData>('/auth/login', params, {
    meta: authMeta.login,
    cacheFor: 0,
  })
  useAuthStore(pinia).setSession(tokenData)
  return tokenData
}

/** 获取登录验证码（SVG data URI 图片 + captchaId）。服务端未开启验证码时该接口同样可用，仅登录时不强制校验。 */
export function fetchCaptcha(): Promise<CaptchaInfo> {
  return request.Get<CaptchaInfo>('/auth/captcha', {
    meta: authMeta.visitor,
    cacheFor: 0,
  })
}

/** 申请密码重置：恒定成功（防枚举），命中账号且绑定邮箱时发送一次性重置链接。 */
export function forgotPassword(params: ForgotPasswordParams): Promise<{ success: boolean }> {
  return request.Post<{ success: boolean }>('/auth/forgot-password', params, {
    meta: authMeta.visitor,
    cacheFor: 0,
  })
}

/** 使用重置令牌设置新密码，成功后该账号全部会话被强制下线。 */
export function resetPassword(params: ResetPasswordParams): Promise<{ success: boolean }> {
  return request.Post<{ success: boolean }>('/auth/reset-password', params, {
    meta: authMeta.visitor,
    cacheFor: 0,
  })
}

/** 更新当前用户资料（昵称/邮箱/手机号/头像），返回最新用户信息。 */
export function updateProfile(params: UpdateProfileParams): Promise<AuthUser> {
  return request.Patch<AuthUser>('/auth/me', params, { cacheFor: 0 })
}

/** 修改当前用户密码；成功后其他会话被撤销，当前登录保持有效。 */
export function changePassword(params: ChangePasswordParams): Promise<{ success: boolean }> {
  return request.Patch<{ success: boolean }>('/auth/password', params, { cacheFor: 0 })
}

export function refreshAuth(): Promise<AuthTokenData> {
  return refreshAccessToken()
}

export function fetchAuthMe(): Promise<AuthUser> {
  return request.Get<AuthUser>('/auth/me', { cacheFor: 0 })
}

export function fetchAuthPermissions(): Promise<string[]> {
  return request.Get<string[]>('/auth/me/permissions', { cacheFor: 0 })
}

export function fetchAuthMenus(): Promise<PermissionTreeNode[]> {
  return request.Get<PermissionTreeNode[]>('/auth/me/menus', { cacheFor: 0 })
}

export function fetchMyAccountSets(): Promise<AccountSetSummary[]> {
  return request.Get<AccountSetSummary[]>('/auth/me/account-sets', { cacheFor: 0 })
}

export async function bootstrapAccess(): Promise<void> {
  const authStore = useAuthStore(pinia)
  const [accountSets, menus, permissions] = await Promise.all([
    fetchMyAccountSets(),
    fetchAuthMenus(),
    fetchAuthPermissions(),
  ])
  authStore.setAccountSets(accountSets)
  authStore.setAccess(menus, permissions)
}

/** Re-fetch menus after locale change so sidebar/route titles match X-Locale. */
export async function refreshLocalizedMenus(): Promise<void> {
  const authStore = useAuthStore(pinia)
  if (!authStore.accessReady) return

  const menus = await fetchAuthMenus()
  authStore.setAccess(menus, authStore.permissions)
  const { registerDynamicRoutes } = await import('@/router/dynamic')
  registerDynamicRoutes(menus)
}

export async function logoutAuth(): Promise<void> {
  try {
    await request.Post<{ success: boolean }>(
      '/auth/logout',
      {},
      {
        cacheFor: 0,
      },
    )
  } finally {
    const { resetDynamicRoutes } = await import('@/router/dynamic')
    resetDynamicRoutes()
    useAuthStore(pinia).clearSession()
  }
}
