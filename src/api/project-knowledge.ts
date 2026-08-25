import { request } from '@/utils/request'
import type {
  ProjectKnowledgeMaterial,
  ProjectKnowledgeMaterialPayload,
  ProjectKnowledgeQuestion,
  ProjectKnowledgeQuestionPayload,
  ProjectPrdDocument,
  ProjectPrdDocumentPayload,
  ProjectPrdDocumentVersion,
  ProjectPrdDocumentVersionPayload,
  ProjectRequirement,
  ProjectRequirementEvidence,
  ProjectRequirementEvidencePayload,
  ProjectRequirementPayload,
  ProjectRequirementTrace,
  ProjectRequirementTracePayload,
  ProjectResearchRecord,
  ProjectResearchRecordPayload,
  UpdateProjectKnowledgeMaterialPayload,
  UpdateProjectKnowledgeQuestionPayload,
  UpdateProjectPrdDocumentPayload,
  UpdateProjectPrdDocumentVersionPayload,
  UpdateProjectRequirementEvidencePayload,
  UpdateProjectRequirementPayload,
  UpdateProjectRequirementTracePayload,
  UpdateProjectResearchRecordPayload,
} from '@/types/project-knowledge'

function knowledgePath(projectId: string, suffix: string): string {
  return `/project/${encodeURIComponent(projectId)}/knowledge${suffix}`
}

function encodeId(id: string): string {
  return encodeURIComponent(id)
}

// Materials

export function fetchProjectKnowledgeMaterials(
  projectId: string,
): Promise<ProjectKnowledgeMaterial[]> {
  return request.Get<ProjectKnowledgeMaterial[]>(knowledgePath(projectId, '/materials'), {
    cacheFor: 0,
  })
}

export function createProjectKnowledgeMaterial(
  projectId: string,
  payload: ProjectKnowledgeMaterialPayload,
): Promise<ProjectKnowledgeMaterial> {
  return request.Post<ProjectKnowledgeMaterial>(knowledgePath(projectId, '/materials'), payload, {
    cacheFor: 0,
  })
}

export function updateProjectKnowledgeMaterial(
  projectId: string,
  id: string,
  payload: UpdateProjectKnowledgeMaterialPayload,
): Promise<ProjectKnowledgeMaterial> {
  return request.Patch<ProjectKnowledgeMaterial>(
    knowledgePath(projectId, `/materials/${encodeId(id)}`),
    payload,
    { cacheFor: 0 },
  )
}

export function deleteProjectKnowledgeMaterial(projectId: string, id: string): Promise<void> {
  return request.Delete<void>(
    knowledgePath(projectId, `/materials/${encodeId(id)}`),
    {},
    {
      cacheFor: 0,
    },
  )
}

// Research records

export function fetchProjectResearchRecords(projectId: string): Promise<ProjectResearchRecord[]> {
  return request.Get<ProjectResearchRecord[]>(knowledgePath(projectId, '/research-records'), {
    cacheFor: 0,
  })
}

export function createProjectResearchRecord(
  projectId: string,
  payload: ProjectResearchRecordPayload,
): Promise<ProjectResearchRecord> {
  return request.Post<ProjectResearchRecord>(
    knowledgePath(projectId, '/research-records'),
    payload,
    { cacheFor: 0 },
  )
}

export function updateProjectResearchRecord(
  projectId: string,
  id: string,
  payload: UpdateProjectResearchRecordPayload,
): Promise<ProjectResearchRecord> {
  return request.Patch<ProjectResearchRecord>(
    knowledgePath(projectId, `/research-records/${encodeId(id)}`),
    payload,
    { cacheFor: 0 },
  )
}

export function deleteProjectResearchRecord(projectId: string, id: string): Promise<void> {
  return request.Delete<void>(
    knowledgePath(projectId, `/research-records/${encodeId(id)}`),
    {},
    {
      cacheFor: 0,
    },
  )
}

export function linkResearchRecordMaterials(
  projectId: string,
  id: string,
  materialIds: string[],
): Promise<ProjectResearchRecord> {
  return request.Put<ProjectResearchRecord>(
    knowledgePath(projectId, `/research-records/${encodeId(id)}/materials`),
    { materialIds },
    { cacheFor: 0 },
  )
}

export function unlinkResearchRecordMaterial(
  projectId: string,
  id: string,
  materialId: string,
): Promise<void> {
  return request.Delete<void>(
    knowledgePath(projectId, `/research-records/${encodeId(id)}/materials/${encodeId(materialId)}`),
    {},
    { cacheFor: 0 },
  )
}

// Requirements

export function fetchProjectRequirements(projectId: string): Promise<ProjectRequirement[]> {
  return request.Get<ProjectRequirement[]>(knowledgePath(projectId, '/requirements'), {
    cacheFor: 0,
  })
}

export function createProjectRequirement(
  projectId: string,
  payload: ProjectRequirementPayload,
): Promise<ProjectRequirement> {
  return request.Post<ProjectRequirement>(knowledgePath(projectId, '/requirements'), payload, {
    cacheFor: 0,
  })
}

export function updateProjectRequirement(
  projectId: string,
  id: string,
  payload: UpdateProjectRequirementPayload,
): Promise<ProjectRequirement> {
  return request.Patch<ProjectRequirement>(
    knowledgePath(projectId, `/requirements/${encodeId(id)}`),
    payload,
    { cacheFor: 0 },
  )
}

export function deleteProjectRequirement(projectId: string, id: string): Promise<void> {
  return request.Delete<void>(
    knowledgePath(projectId, `/requirements/${encodeId(id)}`),
    {},
    {
      cacheFor: 0,
    },
  )
}

// Requirement evidence

export function fetchProjectRequirementEvidence(
  projectId: string,
  requirementId: string,
): Promise<ProjectRequirementEvidence[]> {
  return request.Get<ProjectRequirementEvidence[]>(
    knowledgePath(projectId, `/requirements/${encodeId(requirementId)}/evidence`),
    { cacheFor: 0 },
  )
}

export function createProjectRequirementEvidence(
  projectId: string,
  requirementId: string,
  payload: ProjectRequirementEvidencePayload,
): Promise<ProjectRequirementEvidence> {
  return request.Post<ProjectRequirementEvidence>(
    knowledgePath(projectId, `/requirements/${encodeId(requirementId)}/evidence`),
    payload,
    { cacheFor: 0 },
  )
}

export function updateProjectRequirementEvidence(
  projectId: string,
  requirementId: string,
  evidenceId: string,
  payload: UpdateProjectRequirementEvidencePayload,
): Promise<ProjectRequirementEvidence> {
  return request.Patch<ProjectRequirementEvidence>(
    knowledgePath(
      projectId,
      `/requirements/${encodeId(requirementId)}/evidence/${encodeId(evidenceId)}`,
    ),
    payload,
    { cacheFor: 0 },
  )
}

export function deleteProjectRequirementEvidence(
  projectId: string,
  requirementId: string,
  evidenceId: string,
): Promise<void> {
  return request.Delete<void>(
    knowledgePath(
      projectId,
      `/requirements/${encodeId(requirementId)}/evidence/${encodeId(evidenceId)}`,
    ),
    {},
    { cacheFor: 0 },
  )
}

// Questions

export function fetchProjectKnowledgeQuestions(
  projectId: string,
): Promise<ProjectKnowledgeQuestion[]> {
  return request.Get<ProjectKnowledgeQuestion[]>(knowledgePath(projectId, '/questions'), {
    cacheFor: 0,
  })
}

export function createProjectKnowledgeQuestion(
  projectId: string,
  payload: ProjectKnowledgeQuestionPayload,
): Promise<ProjectKnowledgeQuestion> {
  return request.Post<ProjectKnowledgeQuestion>(knowledgePath(projectId, '/questions'), payload, {
    cacheFor: 0,
  })
}

export function updateProjectKnowledgeQuestion(
  projectId: string,
  id: string,
  payload: UpdateProjectKnowledgeQuestionPayload,
): Promise<ProjectKnowledgeQuestion> {
  return request.Patch<ProjectKnowledgeQuestion>(
    knowledgePath(projectId, `/questions/${encodeId(id)}`),
    payload,
    { cacheFor: 0 },
  )
}

export function deleteProjectKnowledgeQuestion(projectId: string, id: string): Promise<void> {
  return request.Delete<void>(
    knowledgePath(projectId, `/questions/${encodeId(id)}`),
    {},
    {
      cacheFor: 0,
    },
  )
}

// PRD documents

export function fetchProjectPrdDocuments(projectId: string): Promise<ProjectPrdDocument[]> {
  return request.Get<ProjectPrdDocument[]>(knowledgePath(projectId, '/prd-documents'), {
    cacheFor: 0,
  })
}

export function createProjectPrdDocument(
  projectId: string,
  payload: ProjectPrdDocumentPayload,
): Promise<ProjectPrdDocument> {
  return request.Post<ProjectPrdDocument>(knowledgePath(projectId, '/prd-documents'), payload, {
    cacheFor: 0,
  })
}

export function updateProjectPrdDocument(
  projectId: string,
  id: string,
  payload: UpdateProjectPrdDocumentPayload,
): Promise<ProjectPrdDocument> {
  return request.Patch<ProjectPrdDocument>(
    knowledgePath(projectId, `/prd-documents/${encodeId(id)}`),
    payload,
    { cacheFor: 0 },
  )
}

export function deleteProjectPrdDocument(projectId: string, id: string): Promise<void> {
  return request.Delete<void>(
    knowledgePath(projectId, `/prd-documents/${encodeId(id)}`),
    {},
    {
      cacheFor: 0,
    },
  )
}

// PRD versions

export function fetchProjectPrdDocumentVersions(
  projectId: string,
  documentId: string,
): Promise<ProjectPrdDocumentVersion[]> {
  return request.Get<ProjectPrdDocumentVersion[]>(
    knowledgePath(projectId, `/prd-documents/${encodeId(documentId)}/versions`),
    { cacheFor: 0 },
  )
}

export function createProjectPrdDocumentVersion(
  projectId: string,
  documentId: string,
  payload: ProjectPrdDocumentVersionPayload,
): Promise<ProjectPrdDocumentVersion> {
  return request.Post<ProjectPrdDocumentVersion>(
    knowledgePath(projectId, `/prd-documents/${encodeId(documentId)}/versions`),
    payload,
    { cacheFor: 0 },
  )
}

export function updateProjectPrdDocumentVersion(
  projectId: string,
  documentId: string,
  versionId: string,
  payload: UpdateProjectPrdDocumentVersionPayload,
): Promise<ProjectPrdDocumentVersion> {
  return request.Patch<ProjectPrdDocumentVersion>(
    knowledgePath(
      projectId,
      `/prd-documents/${encodeId(documentId)}/versions/${encodeId(versionId)}`,
    ),
    payload,
    { cacheFor: 0 },
  )
}

export function deleteProjectPrdDocumentVersion(
  projectId: string,
  documentId: string,
  versionId: string,
): Promise<void> {
  return request.Delete<void>(
    knowledgePath(
      projectId,
      `/prd-documents/${encodeId(documentId)}/versions/${encodeId(versionId)}`,
    ),
    {},
    { cacheFor: 0 },
  )
}

// Requirement traces

export function fetchProjectRequirementTraces(
  projectId: string,
  requirementId: string,
): Promise<ProjectRequirementTrace[]> {
  return request.Get<ProjectRequirementTrace[]>(
    knowledgePath(projectId, `/requirements/${encodeId(requirementId)}/traces`),
    { cacheFor: 0 },
  )
}

export function createProjectRequirementTrace(
  projectId: string,
  requirementId: string,
  payload: ProjectRequirementTracePayload,
): Promise<ProjectRequirementTrace> {
  return request.Post<ProjectRequirementTrace>(
    knowledgePath(projectId, `/requirements/${encodeId(requirementId)}/traces`),
    payload,
    { cacheFor: 0 },
  )
}

export function updateProjectRequirementTrace(
  projectId: string,
  requirementId: string,
  traceId: string,
  payload: UpdateProjectRequirementTracePayload,
): Promise<ProjectRequirementTrace> {
  return request.Patch<ProjectRequirementTrace>(
    knowledgePath(
      projectId,
      `/requirements/${encodeId(requirementId)}/traces/${encodeId(traceId)}`,
    ),
    payload,
    { cacheFor: 0 },
  )
}

export function deleteProjectRequirementTrace(
  projectId: string,
  requirementId: string,
  traceId: string,
): Promise<void> {
  return request.Delete<void>(
    knowledgePath(
      projectId,
      `/requirements/${encodeId(requirementId)}/traces/${encodeId(traceId)}`,
    ),
    {},
    { cacheFor: 0 },
  )
}
