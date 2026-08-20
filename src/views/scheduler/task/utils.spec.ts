import { describe, expect, it } from 'vitest'
import type { ProTableRequestParams } from '@/types/pro-table'
import {
  formatJsonString,
  getNextCronRuns,
  jobGroupColor,
  mapJobQuery,
  misfirePolicyLabel,
  parseCronField,
} from './utils'

describe('scheduler task utilities', () => {
  it('maps ProTable params to JobQuery correctly', () => {
    const params: ProTableRequestParams = {
      page: 2,
      pageSize: 15,
      jobName: '  retention  ',
      jobGroup: '  SYSTEM  ',
      status: 'ENABLED',
    }

    expect(mapJobQuery(params)).toEqual({
      page: 2,
      pageSize: 15,
      jobName: 'retention',
      jobGroup: 'SYSTEM',
      status: 'ENABLED',
    })
  })

  it('omits empty params', () => {
    const params: ProTableRequestParams = {
      page: 1,
      pageSize: 10,
      jobName: '',
      jobGroup: '',
      status: null,
    }

    expect(mapJobQuery(params)).toEqual({ page: 1, pageSize: 10 })
  })

  it('maps jobGroup to semantic color tags', () => {
    expect(jobGroupColor('SYSTEM')).toBe('blue')
    expect(jobGroupColor('BUSINESS')).toBe('purple')
    expect(jobGroupColor('DATABASE')).toBe('cyan')
    expect(jobGroupColor('LOG')).toBe('orange')
    expect(jobGroupColor('OTHER')).toBe('default')
    expect(jobGroupColor(null)).toBe('default')
  })

  it('formats misfire policy labels', () => {
    const mockT = (k: string) => k

    expect(misfirePolicyLabel('DEFAULT', mockT)).toBe('scheduler.task.misfireDefault')
    expect(misfirePolicyLabel('IGNORE', mockT)).toBe('scheduler.task.misfireIgnore')
    expect(misfirePolicyLabel('FIRE_ONCE', mockT)).toBe('scheduler.task.misfireFireOnce')
  })

  it('parses cron fields accurately', () => {
    expect(parseCronField('*', 0, 5)).toEqual([0, 1, 2, 3, 4, 5])
    expect(parseCronField('*/2', 0, 5)).toEqual([0, 2, 4])
    expect(parseCronField('1,3,5', 0, 5)).toEqual([1, 3, 5])
    expect(parseCronField('2-4', 0, 5)).toEqual([2, 3, 4])
    expect(parseCronField('invalid', 0, 5)).toBeNull()
  })

  it('calculates next execution runs for cron expressions', () => {
    const baseTime = new Date('2026-08-19T10:00:00.000Z')
    const runs = getNextCronRuns('0 0 * * * *', 3, baseTime)
    expect(runs).toHaveLength(3)

    const invalidRuns = getNextCronRuns('invalid cron')
    expect(invalidRuns).toEqual([])
  })

  it('formats json strings', () => {
    expect(formatJsonString('{"a":1}').formatted).toBe('{\n  "a": 1\n}')
    expect(formatJsonString('invalid').success).toBe(false)
    expect(formatJsonString('').formatted).toBe('')
  })
})
