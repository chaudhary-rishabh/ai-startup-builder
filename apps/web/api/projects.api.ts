import api from '@/lib/axios'
import type { BuildMode, Project } from '@/types'

export interface CreateProjectPayload {
  name: string
  description?: string
  emoji: string
  buildMode: BuildMode
}

export interface UpdateProjectPayload {
  name?: string
  description?: string
  emoji?: string
  isStarred?: boolean
  status?: 'active' | 'archived'
}

export interface ProjectsListResponse {
  projects: Project[]
  total: number
  page: number
  limit: number
}

export async function getProjects(params?: {
  status?: 'active' | 'archived' | 'all'
  starred?: boolean
  page?: number
  limit?: number
}): Promise<ProjectsListResponse> {
  const res = await api.get<{ data: ProjectsListResponse }>('/projects', { params })
  return res.data.data
}

export async function getProject(id: string): Promise<Project> {
  const res = await api.get<{ data: Project }>(`/projects/${id}`)
  return res.data.data
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const res = await api.post<{ data: Project }>('/projects', payload)
  return res.data.data
}

export async function updateProject(id: string, payload: UpdateProjectPayload): Promise<Project> {
  const res = await api.patch<{ data: Project }>(`/projects/${id}`, payload)
  return res.data.data
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`)
}

export async function archiveProject(id: string): Promise<Project> {
  return updateProject(id, { status: 'archived' })
}

export async function duplicateProject(id: string): Promise<Project> {
  const res = await api.post<{ data: Project }>(`/projects/${id}/duplicate`)
  return res.data.data
}

export async function starProject(id: string, starred: boolean): Promise<Project> {
  return updateProject(id, { isStarred: starred })
}

export async function advancePhase(
  projectId: string,
  targetPhase: number,
): Promise<{ previousPhase: number; currentPhase: number }> {
  const res = await api.post<{ data: { previousPhase: number; currentPhase: number } }>(
    `/projects/${projectId}/advance-phase`,
    { targetPhase },
  )
  return res.data.data
}

export function getPhaseRoute(projectId: string, phase: number): string {
  switch (phase) {
    case 1:
      return `/project/${projectId}/validate`
    case 2:
      return `/project/${projectId}/plan`
    case 3:
      return `/project/${projectId}/design`
    case 4:
      return `/project/${projectId}/build`
    case 5:
      return `/project/${projectId}/deploy`
    case 6:
      return `/project/${projectId}/growth`
    default:
      return `/project/${projectId}`
  }
}
