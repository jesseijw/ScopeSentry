import { create } from 'zustand'
import { Project } from '../types'

interface ProjectsStore {
  projects: Project[]
  selectedProjectId: string | null
  setProjects: (projects: Project[]) => void
  upsertProject: (project: Project) => void
  removeProject: (id: string) => void
  setSelectedProject: (id: string | null) => void
  optimisticUpdateProject: (id: string, partial: Partial<Project>) => void
}

export const useProjectsStore = create<ProjectsStore>((set) => ({
  projects: [],
  selectedProjectId: null,

  setProjects: (projects) => {
    set({ projects })
  },

  upsertProject: (project) => {
    set((state) => {
      const exists = state.projects.find((p) => p.id === project.id)
      if (exists) {
        return {
          projects: state.projects.map((p) => (p.id === project.id ? project : p)),
        }
      }
      return { projects: [...state.projects, project] }
    })
  },

  removeProject: (id) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }))
  },

  setSelectedProject: (id) => {
    set({ selectedProjectId: id })
  },

  optimisticUpdateProject: (id, partial) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...partial } : p
      ),
    }))
  },
}))
