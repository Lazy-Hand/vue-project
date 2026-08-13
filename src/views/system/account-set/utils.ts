import type {
  AccountSetPayload,
  AccountSetUserAssignment,
  UpdateAccountSetPayload,
} from '@/types/account-set'

export interface AccountSetFormValues {
  code: string
  name: string
  sort: number
  enabled: boolean
  description: string
}

export function buildAccountSetPayload(
  values: AccountSetFormValues,
  mode: 'create' | 'edit',
): AccountSetPayload | UpdateAccountSetPayload {
  const common: UpdateAccountSetPayload = {
    name: values.name.trim(),
    sort: values.sort,
    enabled: values.enabled,
  }
  const description = values.description.trim()
  if (description) common.description = description

  if (mode === 'edit') return common

  return {
    code: values.code.trim(),
    ...common,
  }
}

export function isAccountSetTextValid(value: string, minLength = 1, maxLength = 64): boolean {
  const length = value.trim().length
  return length >= minLength && length <= maxLength
}

export function toggleAccountSetUserSelection(
  assignment: Pick<AccountSetUserAssignment, 'userIds' | 'defaultUserId'>,
  userId: string,
): AccountSetUserAssignment {
  if (assignment.userIds.includes(userId)) {
    const userIds = assignment.userIds.filter((id) => id !== userId)
    if (assignment.defaultUserId === userId || !assignment.defaultUserId) return { userIds }
    return { userIds, defaultUserId: assignment.defaultUserId }
  }

  const userIds = [...assignment.userIds, userId]
  if (!assignment.defaultUserId) return { userIds }
  return { userIds, defaultUserId: assignment.defaultUserId }
}

export function isDefaultUserSelected(
  assignment: Pick<AccountSetUserAssignment, 'userIds' | 'defaultUserId'>,
): boolean {
  return !assignment.defaultUserId || assignment.userIds.includes(assignment.defaultUserId)
}
