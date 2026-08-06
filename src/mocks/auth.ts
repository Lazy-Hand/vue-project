import { defineMock } from '@alova/mock'

import type { ApiResponse, AuthTokenData, LoginParams } from '@/types/auth'

const MOCK_USERNAME = 'admin'
const MOCK_PASSWORD = 'Admin@123456'

function createAuthTokenData(): AuthTokenData {
  return {
    accessToken: `mock-access-token-${Date.now()}`,
    tokenType: 'Bearer',
    expiresIn: 7200,
    user: {
      id: '1',
      username: MOCK_USERNAME,
      nickname: 'Mock 管理员',
      email: 'admin@example.com',
      phone: '13800138000',
      avatar: null,
      enabled: true,
    },
  }
}

function success<T>(data: T): ApiResponse<T> {
  return {
    code: 0,
    message: 'success',
    data,
  }
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
})
