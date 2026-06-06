import { create } from 'zustand';
import { Project, ViewState, SectionKey } from '../types';

interface AppState {
  view: ViewState;
  projects: Project[];
  currentProjectId: string | null;
  setView: (view: ViewState) => void;
  createProject: (projectData: Partial<Project>) => Project;
  setCurrentProject: (id: string | null) => void;
  updateProjectContent: (sectionGroup: 'introduction'|'body'|'conclusion'|'appendix', section: string, content: string) => void;
  deleteProject: (id: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useAppStore = create<AppState>((set, get) => ({
  view: 'dashboard',
  projects: [],
  currentProjectId: null,

  setView: (view) => set({ view }),

  createProject: (data) => {
    const newProject: Project = {
      id: generateId(),
      title: data.title || 'Dự án không tên',
      field: data.field || '',
      level: data.level || '',
      members: data.members || [],
      teacher: data.teacher || '',
      problem: data.problem || '',
      importance: data.importance || '',
      objectives: data.objectives || [],
      methods: data.methods || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      progress: 0,
      content: {
        introduction: { reason: '', purpose: '', questions: '', hypothesis: data.content?.introduction?.hypothesis || '' },
        body: { chapter1: '', chapter2: '', chapter3: '', chapter4: '' },
        conclusion: { summary: '', suggestions: '' },
        appendix: { references: '' }
      }
    };
    
    set((state) => ({
      projects: [...state.projects, newProject],
      currentProjectId: newProject.id,
      view: 'editor'
    }));
    
    return newProject;
  },

  setCurrentProject: (id) => set({ currentProjectId: id, view: id ? 'editor' : 'dashboard' }),

  updateProjectContent: (group, section, content) => {
    set((state) => {
      const projects = state.projects.map(p => {
        if (p.id === state.currentProjectId) {
          return {
            ...p,
            updatedAt: Date.now(),
            content: {
              ...p.content,
              [group]: {
                ...(p.content[group] as any),
                [section]: content
              }
            }
          };
        }
        return p;
      });
      return { projects };
    });
  },

  deleteProject: (id) => {
    set((state) => ({
      projects: state.projects.filter(p => p.id !== id),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
      view: state.currentProjectId === id ? 'dashboard' : state.view
    }));
  }
}));
