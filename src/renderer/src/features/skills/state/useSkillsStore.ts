import { create } from 'zustand';
import { SkillDiskSyncResult, SkillFile, SkillInfo, SkillIntegritySummary, SkillScope, SkillSyncResult } from '@shared/types/models';
import { api } from '@renderer/services/api';
import { useUIStore } from '@renderer/stores/app/useUIStore';

interface SkillsState {
  skills: SkillInfo[];
  selectedSkillId: string | null;
  selectedSkillFiles: SkillFile[];
  activeFilter: 'all' | 'global' | string; // 'all', 'global', or projectKey
  isLoading: boolean;
  isSyncing: boolean;
  projectKeys: string[];
  integritySummary: SkillIntegritySummary | null;
  isSavingAllToDisk: boolean;

  loadSkills: () => Promise<void>;
  loadProjectKeys: () => Promise<void>;
  loadIntegritySummary: () => Promise<void>;
  validateAllSkills: () => Promise<SkillIntegritySummary>;
  saveAllSkillsToDisk: () => Promise<SkillDiskSyncResult>;
  selectSkill: (id: string | null) => Promise<void>;
  setFilter: (filter: 'all' | 'global' | string) => void;
  syncProject: (orgName: string, projectName: string, repositoryId: string, repositoryName: string) => Promise<SkillSyncResult>;
  saveGlobal: (name: string, description: string, content: string, linkedOrganizationIds?: string[] | null, existingId?: string) => Promise<SkillInfo>;
  deleteGlobal: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  toggleHidden: (id: string, isHidden: boolean) => Promise<void>;
  updateLinkedOrgs: (id: string, linkedOrganizationIds: string[] | null) => Promise<void>;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  selectedSkillId: null,
  selectedSkillFiles: [],
  activeFilter: 'all',
  isLoading: false,
  isSyncing: false,
  projectKeys: [],
  integritySummary: null,
  isSavingAllToDisk: false,

  loadSkills: async () => {
    set({ isLoading: true });
    try {
      const filter = get().activeFilter;
      let scope: SkillScope | undefined;
      let projectKey: string | undefined;
      if (filter === 'global') {
        scope = 'global';
      } else if (filter !== 'all') {
        scope = 'project';
        projectKey = filter;
      }
      const skills = await api.getSkills(scope, projectKey);
      set({ skills });
      useUIStore.getState().setSkillsMismatchCount(skills.filter((skill) => skill.isMismatched).length);
    } finally {
      set({ isLoading: false });
    }
  },

  loadProjectKeys: async () => {
    const projectKeys = await api.getSkillProjectKeys();
    set({ projectKeys });
  },

  loadIntegritySummary: async () => {
    const summary = await api.getSkillsIntegritySummary();
    set({ integritySummary: summary });
    useUIStore.getState().setSkillsMismatchCount(summary.mismatchCount);
  },

  validateAllSkills: async () => {
    const summary = await api.validateAllSkills();
    set({ integritySummary: summary });
    useUIStore.getState().setSkillsMismatchCount(summary.mismatchCount);
    await get().loadSkills();
    return summary;
  },

  saveAllSkillsToDisk: async () => {
    set({ isSavingAllToDisk: true });
    try {
      const result = await api.saveAllSkillsToDisk();
      set({ integritySummary: result.summary });
      useUIStore.getState().setSkillsMismatchCount(result.summary.mismatchCount);
      await get().loadSkills();
      return result;
    } finally {
      set({ isSavingAllToDisk: false });
    }
  },

  selectSkill: async (id) => {
    if (!id) {
      set({ selectedSkillId: null, selectedSkillFiles: [] });
      return;
    }
    set({ selectedSkillId: id });
    try {
      const files = await api.getSkillFiles(id);
      set({ selectedSkillFiles: files });
    } catch {
      set({ selectedSkillFiles: [] });
    }
  },

  setFilter: (filter) => {
    set({ activeFilter: filter, selectedSkillId: null, selectedSkillFiles: [] });
  },

  syncProject: async (orgName, projectName, repositoryId, repositoryName) => {
    set({ isSyncing: true });
    try {
      const result = await api.syncProjectSkills(orgName, projectName, repositoryId, repositoryName);
      await get().loadSkills();
      await get().loadProjectKeys();
      await get().loadIntegritySummary();
      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  saveGlobal: async (name, description, content, linkedOrganizationIds?, existingId?) => {
    const saved = await api.saveGlobalSkill(name, description, content, linkedOrganizationIds, existingId);
    await get().loadSkills();
    await get().loadIntegritySummary();
    return saved;
  },

  deleteGlobal: async (id) => {
    await api.deleteGlobalSkill(id);
    set((state) => ({
      skills: state.skills.filter((s) => s.id !== id),
      selectedSkillId: state.selectedSkillId === id ? null : state.selectedSkillId,
      selectedSkillFiles: state.selectedSkillId === id ? [] : state.selectedSkillFiles
    }));
    await get().loadIntegritySummary();
  },

  deleteProject: async (id) => {
    await api.deleteProjectSkill(id);
    set((state) => ({
      skills: state.skills.filter((s) => s.id !== id),
      selectedSkillId: state.selectedSkillId === id ? null : state.selectedSkillId,
      selectedSkillFiles: state.selectedSkillId === id ? [] : state.selectedSkillFiles
    }));
    await get().loadIntegritySummary();
  },

  toggleHidden: async (id, isHidden) => {
    await api.toggleSkillHidden(id, isHidden);
    set((state) => ({
      skills: state.skills.map((s) => s.id === id ? { ...s, isHidden } : s)
    }));
    await get().loadIntegritySummary();
  },

  updateLinkedOrgs: async (id, linkedOrganizationIds) => {
    await api.updateSkillLinkedOrganizations(id, linkedOrganizationIds);
    set((state) => ({
      skills: state.skills.map((s) => s.id === id ? { ...s, linkedOrganizationIds } : s)
    }));
    await get().loadIntegritySummary();
  }
}));
