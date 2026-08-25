import type { ProjectFileAsset } from '@/types/project-file'

export type KnowledgeOrigin = 'MANUAL' | 'AI_IMPORTED' | 'AI_GENERATED'

export type KnowledgeMaterialType =
  | 'DOCUMENT'
  | 'INTERVIEW_NOTE'
  | 'IMAGE'
  | 'AUDIO'
  | 'VIDEO'
  | 'LINK'
  | 'OTHER'

export type RequirementType = 'BUSINESS' | 'FUNCTIONAL' | 'NON_FUNCTIONAL' | 'CONSTRAINT'

export type RequirementStatus = 'DRAFT' | 'CONFIRMED' | 'CHANGED' | 'REJECTED'

export type KnowledgeQuestionStatus = 'OPEN' | 'ANSWERED' | 'CLOSED'

export type PrdDocumentType = 'PRODUCT' | 'FRONTEND' | 'BACKEND' | 'API' | 'DATABASE' | 'TEST' | 'OTHER'

export type PrdDocumentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export type PrdVersionStatus = 'DRAFT' | 'PUBLISHED'

export type RequirementTraceTarget = 'TASK' | 'API' | 'TEST_CASE' | 'PRD' | 'DELIVERABLE' | 'OTHER'

export type RequirementTraceRelation = 'IMPLEMENTS' | 'VERIFIES' | 'DOCUMENTS' | 'DEPENDS_ON'

export interface KnowledgeRecordBase {
  id: string
  origin: KnowledgeOrigin
  aiRunId?: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectKnowledgeRecordBase extends KnowledgeRecordBase {
  projectId: string
}

export interface ProjectKnowledgeMaterial extends ProjectKnowledgeRecordBase {
  title: string
  type: KnowledgeMaterialType
  description: string | null
  assets: ProjectFileAsset[]
  sourceUrl: string | null
}

export interface ProjectKnowledgeMaterialPayload {
  title: string
  type: KnowledgeMaterialType
  description?: string | null
  assetIds?: string[]
  sourceUrl?: string | null
  origin: KnowledgeOrigin
  aiRunId?: string | null
}

export type UpdateProjectKnowledgeMaterialPayload = Partial<ProjectKnowledgeMaterialPayload>

export interface ProjectResearchRecord extends ProjectKnowledgeRecordBase {
  title: string
  occurredAt: string | null
  location: string | null
  participants: string | null
  summary: string | null
  content: string
  assets: ProjectFileAsset[]
  materials: ProjectKnowledgeMaterial[]
}

export interface ProjectResearchRecordPayload {
  title: string
  occurredAt?: string | null
  location?: string | null
  participants?: string | null
  summary?: string | null
  content: string
  assetIds?: string[]
  origin: KnowledgeOrigin
  aiRunId?: string | null
}

export type UpdateProjectResearchRecordPayload = Partial<ProjectResearchRecordPayload>

export interface ProjectRequirement extends ProjectKnowledgeRecordBase {
  code: string
  title: string
  type: RequirementType
  priority: string
  status: RequirementStatus
  description: string | null
  content: string | null
  acceptanceCriteria: string | null
  documentId: string | null
}

export interface ProjectRequirementPayload {
  code: string
  title: string
  type: RequirementType
  priority: string
  status: RequirementStatus
  description?: string | null
  content?: string | null
  acceptanceCriteria?: string | null
  documentId?: string | null
  origin: KnowledgeOrigin
  aiRunId?: string | null
}

export type UpdateProjectRequirementPayload = Partial<ProjectRequirementPayload>

export interface ProjectRequirementEvidence extends KnowledgeRecordBase {
  requirementId?: string
  materialId: string | null
  researchRecordId: string | null
  quote: string | null
  content: string | null
  locator: string | null
}

export interface ProjectRequirementEvidencePayload {
  materialId?: string | null
  researchRecordId?: string | null
  quote?: string | null
  content?: string | null
  locator?: string | null
  origin: KnowledgeOrigin
  aiRunId?: string | null
}

export type UpdateProjectRequirementEvidencePayload = Partial<ProjectRequirementEvidencePayload>

export interface ProjectKnowledgeQuestion extends ProjectKnowledgeRecordBase {
  requirementId: string | null
  question: string
  context: string | null
  answer: string | null
  status: KnowledgeQuestionStatus
  priority: string
  dueAt: string | null
}

export interface ProjectKnowledgeQuestionPayload {
  requirementId?: string | null
  question: string
  context?: string | null
  answer?: string | null
  status: KnowledgeQuestionStatus
  priority: string
  dueAt?: string | null
  origin: KnowledgeOrigin
  aiRunId?: string | null
}

export type UpdateProjectKnowledgeQuestionPayload = Partial<ProjectKnowledgeQuestionPayload>

export interface ProjectPrdDocument extends ProjectKnowledgeRecordBase {
  title: string
  type: PrdDocumentType
  status: PrdDocumentStatus
}

export interface ProjectPrdDocumentPayload {
  title: string
  type: PrdDocumentType
  status: PrdDocumentStatus
  origin: KnowledgeOrigin
  aiRunId?: string | null
}

export type UpdateProjectPrdDocumentPayload = Partial<ProjectPrdDocumentPayload>

export interface ProjectPrdDocumentVersion extends KnowledgeRecordBase {
  documentId?: string
  version: number
  content: string
  changeSummary: string | null
  status: PrdVersionStatus
  assets: ProjectFileAsset[]
}

export interface ProjectPrdDocumentVersionPayload {
  content: string
  changeSummary?: string | null
  status: PrdVersionStatus
  origin: KnowledgeOrigin
  aiRunId?: string | null
  assetIds?: string[]
}

export type UpdateProjectPrdDocumentVersionPayload = Partial<ProjectPrdDocumentVersionPayload>

export interface ProjectRequirementTrace extends KnowledgeRecordBase {
  requirementId?: string
  targetType: RequirementTraceTarget
  targetKey: string
  targetName: string
  targetUrl: string | null
  relationType: RequirementTraceRelation
}

export interface ProjectRequirementTracePayload {
  targetType: RequirementTraceTarget
  targetKey: string
  targetName: string
  targetUrl?: string | null
  relationType: RequirementTraceRelation
  origin: KnowledgeOrigin
  aiRunId?: string | null
}

export type UpdateProjectRequirementTracePayload = Partial<ProjectRequirementTracePayload>

export interface ProjectKnowledgeStats {
  materials: number
  researchRecords: number
  requirements: number
  openQuestions: number
  prdDocuments: number
  traces: number
}
