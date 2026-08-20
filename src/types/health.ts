export interface DatabaseHealthDetail {
  status: 'up' | 'down'
  latencyMs: number
  version?: string
}

export interface RedisHealthDetail {
  status: 'up' | 'down'
  latencyMs: number
  usedMemoryHuman?: string
  connectedClients?: number
}

export interface ProcessHealthDetail {
  nodeVersion: string
  memoryRssBytes: number
  memoryHeapUsedBytes: number
  memoryHeapTotalBytes: number
}

export interface DetailedHealthStatus {
  status: 'ok'
  uptimeSeconds: number
  database: DatabaseHealthDetail
  redis: RedisHealthDetail
  process: ProcessHealthDetail
}
