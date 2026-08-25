<script setup lang="ts">
import { computed, reactive, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Drawer, Empty, Menu, MenuItem, message } from 'antdv-next'
import {
  ApartmentOutlined,
  BookOutlined,
  FileTextOutlined,
  LinkOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
} from '@antdv-next/icons'

import {
  fetchProjectKnowledgeMaterials,
  fetchProjectKnowledgeQuestions,
  fetchProjectPrdDocuments,
  fetchProjectRequirementTraces,
  fetchProjectRequirements,
  fetchProjectResearchRecords,
} from '@/api/project-knowledge'
import { usePermission } from '@/composables/usePermission'
import type { ProjectKnowledgeStats } from '@/types/project-knowledge'
import { errorMessage } from './knowledge/knowledge-utils'
import ProjectKnowledgeMaterialsTab from './knowledge/ProjectKnowledgeMaterialsTab.vue'
import ProjectKnowledgePrdTab from './knowledge/ProjectKnowledgePrdTab.vue'
import ProjectKnowledgeQuestionsTab from './knowledge/ProjectKnowledgeQuestionsTab.vue'
import ProjectKnowledgeRequirementsTab from './knowledge/ProjectKnowledgeRequirementsTab.vue'
import ProjectKnowledgeResearchTab from './knowledge/ProjectKnowledgeResearchTab.vue'
import ProjectKnowledgeTracesTab from './knowledge/ProjectKnowledgeTracesTab.vue'

interface Props {
  open: boolean
  projectId: string
  projectName: string
}

type KnowledgeDomain = 'materials' | 'research' | 'requirements' | 'questions' | 'prd' | 'traces'

interface DomainItem {
  key: KnowledgeDomain
  label: string
  description: string
  statKey: keyof ProjectKnowledgeStats
  icon: Component
}

const props = defineProps<Props>()
const { t } = useI18n()
const { hasPermission } = usePermission()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const canQuery = computed(() => hasPermission('system:project:query'))
const canManage = computed(() => hasPermission('system:project:manageKnowledge'))
const activeDomain = ref<KnowledgeDomain>('materials')
const statsLoading = ref(false)
const stats = reactive<ProjectKnowledgeStats>({
  materials: 0,
  researchRecords: 0,
  requirements: 0,
  openQuestions: 0,
  prdDocuments: 0,
  traces: 0,
})

const domains = computed<DomainItem[]>(() => [
  {
    key: 'materials',
    label: t('projectKnowledge.navMaterials'),
    description: t('projectKnowledge.navMaterialsDescription'),
    statKey: 'materials',
    icon: BookOutlined,
  },
  {
    key: 'research',
    label: t('projectKnowledge.navResearch'),
    description: t('projectKnowledge.navResearchDescription'),
    statKey: 'researchRecords',
    icon: MessageOutlined,
  },
  {
    key: 'requirements',
    label: t('projectKnowledge.navRequirements'),
    description: t('projectKnowledge.navRequirementsDescription'),
    statKey: 'requirements',
    icon: ApartmentOutlined,
  },
  {
    key: 'questions',
    label: t('projectKnowledge.navQuestions'),
    description: t('projectKnowledge.navQuestionsDescription'),
    statKey: 'openQuestions',
    icon: QuestionCircleOutlined,
  },
  {
    key: 'prd',
    label: t('projectKnowledge.navPrd'),
    description: t('projectKnowledge.navPrdDescription'),
    statKey: 'prdDocuments',
    icon: FileTextOutlined,
  },
  {
    key: 'traces',
    label: t('projectKnowledge.navTraces'),
    description: t('projectKnowledge.navTracesDescription'),
    statKey: 'traces',
    icon: LinkOutlined,
  },
])

const activeComponent = computed(() => {
  const components: Record<KnowledgeDomain, Component> = {
    materials: ProjectKnowledgeMaterialsTab,
    research: ProjectKnowledgeResearchTab,
    requirements: ProjectKnowledgeRequirementsTab,
    questions: ProjectKnowledgeQuestionsTab,
    prd: ProjectKnowledgePrdTab,
    traces: ProjectKnowledgeTracesTab,
  }
  return components[activeDomain.value]
})

function resetStats(): void {
  stats.materials = 0
  stats.researchRecords = 0
  stats.requirements = 0
  stats.openQuestions = 0
  stats.prdDocuments = 0
  stats.traces = 0
}

async function loadStats(): Promise<void> {
  if (!props.open || !canQuery.value || !props.projectId) return
  statsLoading.value = true
  try {
    const [materials, researchRecords, requirements, questions, prdDocuments] = await Promise.all([
      fetchProjectKnowledgeMaterials(props.projectId),
      fetchProjectResearchRecords(props.projectId),
      fetchProjectRequirements(props.projectId),
      fetchProjectKnowledgeQuestions(props.projectId),
      fetchProjectPrdDocuments(props.projectId),
    ])
    const traceGroups = await Promise.all(
      requirements.map((requirement) =>
        fetchProjectRequirementTraces(props.projectId, requirement.id),
      ),
    )
    stats.materials = materials.length
    stats.researchRecords = researchRecords.length
    stats.requirements = requirements.length
    stats.openQuestions = questions.filter((question) => question.status === 'OPEN').length
    stats.prdDocuments = prdDocuments.length
    stats.traces = traceGroups.reduce((total, group) => total + group.length, 0)
  } catch (error) {
    resetStats()
    message.error(errorMessage(error, t('projectKnowledge.requestFailed')))
  } finally {
    statsLoading.value = false
  }
}

function selectDomain(domain: KnowledgeDomain): void {
  activeDomain.value = domain
}

function handleMenuClick(info: { key: string | number }): void {
  const domain = String(info.key)
  if (domains.value.some((item) => item.key === domain)) {
    selectDomain(domain as KnowledgeDomain)
  }
}

function handleChanged(): void {
  void loadStats()
}

watch(
  () => [props.open, props.projectId] as const,
  ([open]) => {
    if (open) void loadStats()
    else resetStats()
  },
  { immediate: true },
)
</script>

<template>
  <Drawer
    v-model:open="visible"
    :title="t('projectKnowledge.workbenchTitle')"
    :size="1180"
    destroy-on-hidden
    class="project-knowledge-drawer"
  >
    <div v-if="!canQuery" class="knowledge-access-empty">
      <Empty :description="t('projectKnowledge.queryPermissionRequired')" />
    </div>
    <div v-else class="knowledge-workbench">
      <header class="knowledge-workbench__hero">
        <div>
          <div class="knowledge-workbench__kicker">{{ t('projectKnowledge.workbenchKicker') }}</div>
          <h1>{{ projectName }}</h1>
          <p>{{ t('projectKnowledge.workbenchDescription') }}</p>
        </div>
        <div class="knowledge-chain" :aria-label="t('projectKnowledge.chainAriaLabel')">
          <span>{{ t('projectKnowledge.chainEvidence') }}</span>
          <span class="knowledge-chain__arrow">→</span>
          <span class="knowledge-chain__active">{{ t('projectKnowledge.chainRequirement') }}</span>
          <span class="knowledge-chain__arrow">→</span>
          <span>{{ t('projectKnowledge.chainDeliverable') }}</span>
        </div>
      </header>

      <div class="knowledge-stats" :class="{ 'is-loading': statsLoading }">
        <div v-for="domain in domains" :key="domain.key" class="knowledge-stats__item">
          <span>{{ domain.label }}</span>
          <strong>{{ stats[domain.statKey] }}</strong>
        </div>
      </div>

      <div class="knowledge-workbench__body">
        <nav class="knowledge-nav" :aria-label="t('projectKnowledge.navigationLabel')">
          <div class="knowledge-nav__menu-shell">
            <Menu
              :selected-keys="[activeDomain]"
              mode="inline"
              class="knowledge-nav__menu"
              @click="handleMenuClick"
            >
              <MenuItem
                v-for="(domain, index) in domains"
                :key="domain.key"
                class="knowledge-nav__item"
                :class="activeDomain === domain.key ? 'is-active' : ''"
              >
                <span class="knowledge-nav__index">{{ String(index + 1).padStart(2, '0') }}</span>
                <component :is="domain.icon" class="knowledge-nav__icon" />
                <span class="knowledge-nav__copy">
                  <strong>{{ domain.label }}</strong>
                  <small>{{ domain.description }}</small>
                </span>
                <span class="knowledge-nav__count">{{ stats[domain.statKey] }}</span>
              </MenuItem>
            </Menu>
          </div>
        </nav>

        <main class="knowledge-workbench__main">
          <component
            :is="activeComponent"
            :project-id="projectId"
            :can-manage="canManage"
            @changed="handleChanged"
          />
        </main>
      </div>
    </div>
  </Drawer>
</template>

<style scoped lang="scss">
.knowledge-access-empty {
  display: grid;
  min-height: 360px;
  place-items: center;
}

.knowledge-workbench {
  min-height: 680px;
  color: #1e293b;
}

.knowledge-workbench__hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  padding: 4px 0 24px;
  border-bottom: 1px solid #cbd5e1;
}

.knowledge-workbench__kicker {
  color: #0f766e;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.knowledge-workbench__hero h1 {
  margin: 6px 0 4px;
  color: #0f172a;
  font-size: clamp(24px, 3vw, 36px);
  font-weight: 650;
  letter-spacing: -0.03em;
}

.knowledge-workbench__hero p {
  max-width: 620px;
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.knowledge-chain {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.knowledge-chain__active {
  color: #0f766e;
}

.knowledge-chain__arrow {
  color: #94a3b8;
  font-size: 17px;
}

.knowledge-stats {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  border-bottom: 1px solid #cbd5e1;
  transition: opacity 160ms ease;
}

.knowledge-stats.is-loading {
  opacity: 0.55;
}

.knowledge-stats__item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  padding: 14px 12px;
  border-right: 1px solid #e2e8f0;
}

.knowledge-stats__item:last-child {
  border-right: 0;
}

.knowledge-stats__item span {
  overflow: hidden;
  color: #64748b;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-stats__item strong {
  color: #0f172a;
  font-size: 20px;
  font-weight: 650;
}

.knowledge-workbench__body {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 560px;
}

.knowledge-nav {
  padding: 18px 18px 18px 0;
  border-right: 1px solid #cbd5e1;
}

.knowledge-nav__menu-shell {
  width: 100%;
  background: transparent;
}

.knowledge-nav__menu-shell :deep(.ant-menu) {
  width: 100%;
  border-inline-end: 0;
  background: transparent;
}

.knowledge-nav__menu-shell :deep(.ant-menu-item) {
  display: grid !important;
  grid-template-columns: 28px 20px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start !important;
  height: auto !important;
  min-height: 0;
  margin: 0 0 2px;
  padding: 13px 10px !important;
  border: 0;
  border-left: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: #64748b;
  line-height: normal !important;
  overflow: visible !important;
  text-overflow: clip;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease;
}

.knowledge-nav__menu-shell :deep(.ant-menu-item:hover) {
  background: #f8fafc;
  color: #0f766e;
}

.knowledge-nav__menu-shell :deep(.ant-menu-item:focus-visible) {
  outline: 2px solid #0f766e;
  outline-offset: -2px;
}

.knowledge-nav__menu-shell :deep(.ant-menu-item-selected) {
  border-left-color: #0f766e;
  background: #f0fdfa;
  color: #0f766e;
}

.knowledge-nav__menu-shell :deep(.ant-menu-item::after) {
  display: none;
}

.knowledge-nav__menu-shell :deep(.ant-menu-title-content) {
  display: contents !important;
  min-width: 0;
  overflow: visible !important;
  text-overflow: clip;
}

.knowledge-nav__index {
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.knowledge-nav__icon {
  margin-top: 1px;
  font-size: 15px;
}

.knowledge-nav__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.knowledge-nav__copy strong {
  font-size: 13px;
  font-weight: 650;
}

.knowledge-nav__copy small {
  overflow: hidden;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-nav__count {
  min-width: 22px;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  text-align: right;
}

.knowledge-workbench__main {
  min-width: 0;
  padding: 28px 0 40px 28px;
}

@media (max-width: 840px) {
  .knowledge-workbench__hero {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }

  .knowledge-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .knowledge-stats__item:nth-child(3) {
    border-right: 0;
  }

  .knowledge-workbench__body {
    grid-template-columns: 1fr;
  }

  .knowledge-nav {
    padding: 14px 0;
    border-right: 0;
    border-bottom: 1px solid #cbd5e1;
  }

  .knowledge-nav__menu-shell :deep(.ant-menu) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
  }

  .knowledge-workbench__main {
    padding: 24px 0 36px;
  }
}

@media (max-width: 480px) {
  .knowledge-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .knowledge-stats__item:nth-child(3) {
    border-right: 1px solid #e2e8f0;
  }

  .knowledge-stats__item:nth-child(2n) {
    border-right: 0;
  }

  .knowledge-nav {
    padding-top: 12px;
  }

  .knowledge-nav__menu-shell :deep(.ant-menu) {
    grid-template-columns: 1fr;
  }

  .knowledge-chain {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .knowledge-nav__menu-shell :deep(.ant-menu-item),
  .knowledge-stats {
    transition: none;
  }
}
</style>
