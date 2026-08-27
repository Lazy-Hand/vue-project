export interface AuthUser {
  id: string
  username: string
  nickname: string | null
  email: string | null
  phone: string | null
  avatar: string | null
  enabled: boolean
}

export interface LoginParams {
  username: string
  password: string
  /** 服务端开启验证码后必填，与后端 GET /auth/captcha 返回的 captchaId 对应 */
  captchaId?: string
  captchaCode?: string
}

export interface CaptchaInfo {
  captchaId: string
  image: string
  expiresIn: number
}

export interface ForgotPasswordParams {
  usernameOrEmail: string
}

export interface ResetPasswordParams {
  token: string
  newPassword: string
}

export interface UpdateProfileParams {
  nickname?: string
  email?: string
  phone?: string
  avatar?: string
}

export interface ChangePasswordParams {
  oldPassword: string
  newPassword: string
}

export interface AuthTokenData {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: AuthUser
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  errors?: unknown
}

export interface AuthTokenState {
  accessToken: string
  expiresAt: number
}

export interface ApiErrorDetails {
  status?: number
  code?: number
  errors?: unknown
}

/**
 * 后端验证码稳定业务码（BusinessException）。
 * 40101=需提供验证码（登录被拒，应显示验证码后重试），40102=验证码错误或已过期（应刷新验证码）。
 */
export const CAPTCHA_CODE_REQUIRED = 40101
export const CAPTCHA_CODE_INVALID = 40102
