import { create } from 'zustand';

const tabs = [
  { id: 'pull-requests', label: 'Pull Requests' },
  { id: 'prompt-results', label: 'Tasks results' },
  { id: 'settings', label: 'Prompt library' },
  { id: 'skills', label: 'Skills Library' },
  { id: 'ask', label: 'Ask' }
] as const;

export type TabId = (typeof tabs)[number]['id'];
export { tabs };
export type SettingsTabId = 'ado' | 'preferences' | 'data';

interface UIState {
  activeTab: TabId;
  error: string | null;
  isSettingsOpen: boolean;
  settingsTab: SettingsTabId;
  prListWidth: number;
  skillsMismatchCount: number;

  setActiveTab: (tab: TabId) => void;
  setError: (error: string | null) => void;
  setIsSettingsOpen: (open: boolean) => void;
  openSettings: (tab?: SettingsTabId) => void;
  setPrListWidth: (width: number) => void;
  setSkillsMismatchCount: (count: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'pull-requests',
  error: null,
  isSettingsOpen: false,
  settingsTab: 'ado',
  prListWidth: 320,
  skillsMismatchCount: 0,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setError: (error) => set({ error }),
  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
  openSettings: (tab = 'ado') => set({ isSettingsOpen: true, settingsTab: tab }),
  setPrListWidth: (width) => set({ prListWidth: width }),
  setSkillsMismatchCount: (count) => set({ skillsMismatchCount: Math.max(0, count) })
}));
