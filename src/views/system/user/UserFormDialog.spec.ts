import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Upload } from 'antdv-next'

import { i18n } from '@/i18n'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import type {
  UploadBusinessContext,
  UploadProgress,
  UploadRequest,
  UploadResponse,
} from '@/types/file'
import type { ManagedUser } from '@/types/user'
import UserFormDialog from './UserFormDialog.vue'

// jsdom 未实现 matchMedia，antdv 响应式观察器需要它
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

vi.mock('@/api/file', () => ({
  buildFileUrl: (path: string | null) => path ?? '',
  createImageUploadRequest:
    vi.fn<
      (
        file: File,
        context?: UploadBusinessContext,
        onProgress?: (progress: UploadProgress) => void,
      ) => UploadRequest<UploadResponse>
    >(),
}))

import { createImageUploadRequest } from '@/api/file'

const EDITING_USER: ManagedUser = {
  id: '5',
  username: 'alice',
  nickname: null,
  email: null,
  phone: null,
  avatar: null,
  deptId: null,
  deptName: null,
  enabled: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const UPLOAD_RESPONSE: UploadResponse = {
  id: '9',
  originalName: 'avatar.png',
  filename: 'avatar.png',
  mimetype: 'image/png',
  category: 'IMAGE',
  size: 1024,
  path: 'uploads/image/2026-08/avatar.png',
  url: 'http://localhost:4658/api/uploads/image/2026-08/avatar.png',
  businessType: null,
  businessId: null,
}

function mockUpload(): void {
  vi.mocked(createImageUploadRequest).mockReturnValue({
    response: Promise.resolve(UPLOAD_RESPONSE),
    abort: async () => {},
  })
}

async function runAvatarUpload(wrapper: ReturnType<typeof mount>): Promise<void> {
  const customRequest = wrapper.findComponent(Upload).props('customRequest') as (options: {
    file: File
  }) => void
  customRequest({ file: new File(['x'], 'avatar.png', { type: 'image/png' }) })
  await flushPromises()
}

describe('UserFormDialog avatar upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    i18n.global.locale.value = 'zh-CN'
    useAuthStore(pinia).setAccess([], ['system:file:uploadImage'])
  })

  it('passes the avatar business context when editing an existing user', async () => {
    mockUpload()
    const wrapper = mount(UserFormDialog, {
      props: { modelValue: true, mode: 'edit', editing: EDITING_USER, deptTree: [], posts: [] },
      global: { plugins: [i18n] },
    })

    await runAvatarUpload(wrapper)

    expect(createImageUploadRequest).toHaveBeenCalledWith(expect.any(File), {
      businessType: 'USER_AVATAR',
      businessId: '5',
    })
  })

  it('omits the business context when creating a user', async () => {
    mockUpload()
    const wrapper = mount(UserFormDialog, {
      props: { modelValue: true, mode: 'create', deptTree: [], posts: [] },
      global: { plugins: [i18n] },
    })

    await runAvatarUpload(wrapper)

    expect(createImageUploadRequest).toHaveBeenCalledWith(expect.any(File), undefined)
  })

  it('emits the pending avatar file id on create submit', async () => {
    mockUpload()
    const wrapper = mount(UserFormDialog, {
      props: { modelValue: true, mode: 'create', deptTree: [], posts: [] },
      global: { plugins: [i18n] },
    })

    await runAvatarUpload(wrapper)

    const inputs = wrapper.findAll('input')
    const usernameInput = inputs[0]
    const passwordInput = inputs[1]
    expect(usernameInput).toBeDefined()
    expect(passwordInput).toBeDefined()
    if (!usernameInput || !passwordInput) throw new Error('expected form inputs')
    await usernameInput.setValue('bob')
    await passwordInput.setValue('password123')

    await wrapper.find('.ant-modal-footer .ant-btn-primary').trigger('click')
    await flushPromises()

    const submitEvents = wrapper.emitted('submit')
    expect(submitEvents).toBeDefined()
    if (!submitEvents) throw new Error('expected submit event')
    expect(submitEvents[0]).toEqual([expect.objectContaining({ username: 'bob' }), [], '9'])
  })
})
