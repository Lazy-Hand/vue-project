import { createAlovaMockAdapter } from '@alova/mock'
import adapterFetch from 'alova/fetch'


const fetchAdapter = adapterFetch()

export const mockEnabled =
  import.meta.env.DEV &&
  import.meta.env.MODE !== 'test' &&
  import.meta.env.VITE_ENABLE_MOCK !== 'false'

export const requestAdapter = mockEnabled
  ? createAlovaMockAdapter([], {
      httpAdapter: fetchAdapter,
      delay: 300,
      matchMode: 'methodurl',
      mockRequestLogger: true,
    })
  : fetchAdapter
