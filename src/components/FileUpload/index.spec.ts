import { flushPromises, mount } from '@vue/test-utils'
import { UploadDragger } from 'antdv-next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import * as fileApi from '@/api/file'
import type { MultipartUploadPart, MultipartUploadSession, UploadResponse } from '@/types/file'
import FileUpload, { type FileUploadExpose } from './index.vue'
import { GIB, MIB, validateFile } from './utils'

vi.mock('@/api/file', () => ({
  abortMultipartUpload: vi
    .fn<(..._args: never[]) => Promise<unknown>>()
    .mockResolvedValue(undefined),
  completeMultipartUpload: vi
    .fn<(..._args: never[]) => Promise<unknown>>()
    .mockResolvedValue({ id: 'completed' }),
  createAudioUploadRequest: vi.fn<(..._args: never[]) => unknown>(),
  createFileUploadRequest: vi.fn<(..._args: never[]) => unknown>(),
  createImageUploadRequest: vi.fn<(..._args: never[]) => unknown>(),
  createVideoUploadRequest: vi.fn<(..._args: never[]) => unknown>(),
  createMultipartPartUploadRequest: vi.fn<(..._args: never[]) => unknown>(),
  initiateMultipartUpload: vi.fn<(..._args: never[]) => Promise<unknown>>(),
}))

function makeFile(name: string, type: string, size = 4): File {
  const file = new File([new Uint8Array(size)], name, { type })
  return file
}

function setReportedSize(file: File, size: number): File {
  Object.defineProperty(file, 'size', { configurable: true, value: size })
  return file
}

function expose(wrapper: ReturnType<typeof mount>): FileUploadExpose {
  return wrapper.vm as unknown as FileUploadExpose
}

function beforeUpload(wrapper: ReturnType<typeof mount>): (file: File) => false {
  const dragger = wrapper.findComponent(UploadDragger)
  return dragger.props('beforeUpload') as (file: File) => false
}

describe('FileUpload utilities', () => {
  it('validates category MIME, extension, and byte limits', () => {
    expect(
      validateFile({ name: 'report.pdf', type: 'application/pdf', size: 4 }, 'FILE').valid,
    ).toBe(true)
    expect(
      validateFile({ name: 'report.txt', type: 'text/plain', size: 4 }, 'FILE').error?.code,
    ).toBe('type')
    expect(
      validateFile({ name: 'picture.png', type: 'image/png', size: 10 * MIB + 1 }, 'IMAGE').error
        ?.code,
    ).toBe('size')
    expect(
      validateFile({ name: 'movie.mp4', type: 'video/mp4', size: 5 * GIB + 1 }, 'VIDEO').error
        ?.code,
    ).toBe('size')
  })
})

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const regularResponse = { id: 'file-1' } as unknown as UploadResponse
    const multipartResponse = { id: 'video-1' } as unknown as UploadResponse
    i18n.global.locale.value = 'zh-CN'
    vi.mocked(fileApi.createFileUploadRequest).mockImplementation((_file, _context, onProgress) => {
      onProgress?.({ loaded: 4, total: 4, percent: 100 })
      return {
        response: Promise.resolve(regularResponse),
        abort: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      }
    })
    vi.mocked(fileApi.createMultipartPartUploadRequest).mockImplementation(
      (_kind, _uploadId, _partNumber, blob, _checksum, onProgress) => {
        onProgress?.({ loaded: blob.size, total: blob.size, percent: 100 })
        return {
          response: Promise.resolve({
            partNumber: _partNumber,
            size: blob.size,
            checksum: _checksum,
          } as MultipartUploadPart),
          abort: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
        }
      },
    )
    vi.mocked(fileApi.initiateMultipartUpload).mockResolvedValue({
      uploadId: 'session-1',
      category: 'VIDEO',
      status: 'UPLOADING',
      originalName: 'clip.mp4',
      mimeType: 'video/mp4',
      totalSize: 201 * MIB,
      partSize: 150 * MIB,
      totalParts: 2,
      uploadedParts: [],
      missingPartNumbers: [1, 2],
      expiresAt: '2099-01-01T00:00:00.000Z',
    } satisfies MultipartUploadSession)
    vi.mocked(fileApi.completeMultipartUpload).mockResolvedValue(multipartResponse)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('uploads a regular file and exposes the completed response', async () => {
    const wrapper = mount(FileUpload, {
      props: { autoUpload: false },
      global: { plugins: [i18n] },
    })
    beforeUpload(wrapper)(makeFile('readme.pdf', 'application/pdf'))

    await expose(wrapper).upload()
    await flushPromises()

    expect(fileApi.createFileUploadRequest).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('success')?.[0]?.[0]).toEqual({ id: 'file-1' })
    expect(expose(wrapper).getUploadedFiles()).toEqual([{ id: 'file-1' }])
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toEqual([{ id: 'file-1' }])
  })

  it('uploads PDF/video chunks in order and completes the session', async () => {
    const digest = vi
      .fn<(algorithm: string, data: ArrayBuffer) => Promise<ArrayBuffer>>()
      .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
    vi.stubGlobal('crypto', { subtle: { digest } })
    const wrapper = mount(FileUpload, {
      props: { category: 'VIDEO', autoUpload: false },
      global: { plugins: [i18n] },
    })
    const file = setReportedSize(makeFile('clip.mp4', 'video/mp4', 4), 201 * MIB)
    beforeUpload(wrapper)(file)

    await expose(wrapper).upload()
    await flushPromises()

    expect(fileApi.initiateMultipartUpload).toHaveBeenCalledWith(
      'videos',
      expect.objectContaining({ originalName: 'clip.mp4', totalSize: 201 * MIB }),
    )
    expect(fileApi.createMultipartPartUploadRequest).toHaveBeenCalledTimes(2)
    expect(fileApi.createMultipartPartUploadRequest).toHaveBeenNthCalledWith(
      1,
      'videos',
      'session-1',
      1,
      expect.any(Blob),
      expect.any(String),
      expect.any(Function),
    )
    expect(fileApi.createMultipartPartUploadRequest).toHaveBeenNthCalledWith(
      2,
      'videos',
      'session-1',
      2,
      expect.any(Blob),
      expect.any(String),
      expect.any(Function),
    )
    expect(fileApi.completeMultipartUpload).toHaveBeenCalledWith('videos', 'session-1')
    expect(expose(wrapper).getUploadedFiles()).toEqual([{ id: 'video-1' }])
  })

  it('cancels an in-flight regular request', async () => {
    let resolveRequest: (value: UploadResponse) => void = () => undefined
    const abort = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    vi.mocked(fileApi.createFileUploadRequest).mockImplementation(() => ({
      response: new Promise<UploadResponse>((resolve) => {
        resolveRequest = resolve
      }),
      abort,
    }))
    const wrapper = mount(FileUpload, {
      props: { autoUpload: false },
      global: { plugins: [i18n] },
    })
    beforeUpload(wrapper)(makeFile('cancel.pdf', 'application/pdf'))

    const uploadPromise = expose(wrapper).upload()
    await flushPromises()
    const cancelButton = wrapper.find('button[aria-label="取消上传"]')
    expect(cancelButton.exists()).toBe(true)
    await Promise.all([cancelButton.trigger('click'), cancelButton.trigger('click')])
    resolveRequest({ id: 'late' } as unknown as UploadResponse)
    await uploadPromise
    await flushPromises()

    expect(abort).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('已取消')
    expect(wrapper.emitted('success')).toBeUndefined()
  })
})
