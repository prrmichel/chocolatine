import { create } from 'zustand';
import { api } from '@renderer/services/api';
import {
  PullRequestDetails,
  PullRequestFileChange,
  PullRequestFileDiff,
  PullRequestStatus,
  PullRequestSummary,
  PullRequestThread,
  PullRequestWorkItem
} from '@shared/types/models';

interface PullRequestState {
  status: PullRequestStatus;
  pullRequests: PullRequestSummary[];
  selectedId: number | null;
  details: PullRequestDetails | null;
  /** File metadata (paths + changeTypes) — available immediately after loading. */
  fileChanges: PullRequestFileChange[];
  /** Lazily-populated diff texts keyed by file path. */
  diffCache: Map<string, PullRequestFileDiff>;
  diffs: PullRequestFileDiff[];
  workItems: PullRequestWorkItem[];
  prThreads: PullRequestThread[];
  selectedDiffPath: string | null;
  promptText: string;
  promptDiffText: string;
  loading: boolean;
  detailsLoading: boolean;
  workItemsLoading: boolean;
  diffsLoading: boolean;
  singleDiffLoading: boolean;
  prFilterText: string;
  prFilterAuthor: string;
  prFilterAssignedToMe: boolean;
  activePrSourceId: string | null;

  setStatus: (status: PullRequestStatus) => void;
  setSelectedId: (id: number | null) => void;
  setSelectedDiffPath: (path: string | null) => void;
  setPromptText: (text: string) => void;
  setPrFilterText: (text: string) => void;
  setPrFilterAuthor: (text: string) => void;
  setPrFilterAssignedToMe: (value: boolean) => void;
  setActivePrSourceId: (id: string | null) => void;
  switchPrSource: (id: string) => Promise<void>;
  loadPullRequests: (creatorId?: string) => Promise<void>;
  loadDetails: (id: number) => Promise<void>;
  reloadThreads: () => Promise<void>;
  /** Lazily load diff text for a single file (if not already cached). */
  loadSingleDiff: (filePath: string) => Promise<PullRequestFileDiff | null>;
  /** Build promptDiffText from all cached diffs. */
  buildPromptDiffText: () => string;
  selectAndLoadDetails: (id: number) => void;
  reloadDetails: () => Promise<void>;

  /** Computed: selected summary object */
  getSelectedSummary: () => PullRequestSummary | null;
  /** Computed: filtered pull requests */
  getFilteredPullRequests: () => PullRequestSummary[];
}

export const usePullRequestStore = create<PullRequestState>((set, get) => ({
  status: 'active',
  pullRequests: [],
  selectedId: null,
  details: null,
  fileChanges: [],
  diffCache: new Map(),
  diffs: [],
  workItems: [],
  prThreads: [],
  selectedDiffPath: null,
  promptText: '',
  promptDiffText: '',
  loading: false,
  detailsLoading: false,
  workItemsLoading: false,
  diffsLoading: false,
  singleDiffLoading: false,
  prFilterText: '',
  prFilterAuthor: '',
  prFilterAssignedToMe: false,
  activePrSourceId: null,

  setStatus: (status) => set({ status }),
  setSelectedId: (id) => set({ selectedId: id }),
  setSelectedDiffPath: (path) => {
    set({ selectedDiffPath: path });
    if (path) void get().loadSingleDiff(path);
  },
  setPromptText: (text) => set({ promptText: text }),
  setPrFilterText: (text) => set({ prFilterText: text }),
  setPrFilterAuthor: (text) => set({ prFilterAuthor: text }),
  setPrFilterAssignedToMe: (value) => set({ prFilterAssignedToMe: value }),
  setActivePrSourceId: (id) => set({ activePrSourceId: id }),

  switchPrSource: async (id: string) => {
    set({ activePrSourceId: id, prFilterAuthor: '' });
    await api.setActivePrSource(id);
    await get().loadPullRequests();
  },

  loadPullRequests: async (creatorId?: string) => {
    set({ loading: true });
    try {
      const data = await api.getPullRequests(get().status, creatorId || undefined);
      set({ pullRequests: data });
      const first = data[0];
      if (first) {
        set({ selectedId: first.id });
        void get().loadDetails(first.id);
      }
    } finally {
      set({ loading: false });
    }
  },

  loadDetails: async (id: number) => {
    set({
      detailsLoading: true,
      workItemsLoading: true,
      diffsLoading: true,
      details: null,
      fileChanges: [],
      diffCache: new Map(),
      diffs: [],
      workItems: [],
      prThreads: [],
      selectedDiffPath: null,
      promptDiffText: ''
    });

    try {
      const info = await api.getPullRequestDetails(id);
      set({ details: info, detailsLoading: false });

      const workItemsPromise = api.getPullRequestWorkItems(info.repositoryId, id)
        .then((items) => set({ workItems: items }))
        .catch(() => {})
        .finally(() => set({ workItemsLoading: false }));

      const threadsPromise = Promise.resolve().then(() => {
        if (typeof api.getPullRequestThreads === 'function') {
          return api.getPullRequestThreads(info.repositoryId, id).then((threads) => set({ prThreads: threads }));
        }
        return undefined;
      }).catch(() => set({ prThreads: [] }));

      // Step 1: Load file metadata (fast — no diff computation)
      const fileChangesPromise = api.getPullRequestFileChanges(id)
        .then((changes) => {
          // Create placeholder diffs with empty diffText for the tree
          const placeholderDiffs: PullRequestFileDiff[] = changes.map((c) => ({
            path: c.path,
            changeType: c.changeType,
            diffText: ''
          }));
          set({
            fileChanges: changes,
            diffs: placeholderDiffs,
            selectedDiffPath: changes[0]?.path ?? null
          });

          // Step 2: Lazily load the first selected file's diff
          if (changes[0]) {
            void get().loadSingleDiff(changes[0].path);
          }
        })
        .catch(() => {})
        .finally(() => set({ diffsLoading: false }));

      await Promise.allSettled([workItemsPromise, fileChangesPromise, threadsPromise]);
    } catch {
      set({ detailsLoading: false, workItemsLoading: false, diffsLoading: false });
    }
  },

  loadSingleDiff: async (filePath: string) => {
    const { selectedId, diffCache } = get();
    if (!selectedId) return null;

    // Already cached
    const cached = diffCache.get(filePath);
    if (cached && cached.diffText) return cached;

    set({ singleDiffLoading: true });
    try {
      const result = await api.getSingleFileDiff(selectedId, filePath);
      const newCache = new Map(get().diffCache);
      const change = get().fileChanges.find((c) => c.path === filePath);
      const diff: PullRequestFileDiff = {
        path: filePath,
        changeType: change?.changeType ?? result.changeType,
        diffText: result.diffText
      };
      newCache.set(filePath, diff);

      // Also update the diffs array so existing components can find the diff text
      const updatedDiffs = get().diffs.map((d) =>
        d.path === filePath ? diff : d
      );

      set({ diffCache: newCache, diffs: updatedDiffs });
      return diff;
    } catch {
      return null;
    } finally {
      set({ singleDiffLoading: false });
    }
  },

  reloadThreads: async () => {
    const { selectedId, details } = get();
    if (!selectedId || !details?.repositoryId || typeof api.getPullRequestThreads !== 'function') {
      return;
    }

    try {
      const threads = await api.getPullRequestThreads(details.repositoryId, selectedId);
      set({ prThreads: threads });
    } catch {
      // Keep the current thread list when refresh fails.
    }
  },

  buildPromptDiffText: () => {
    const { diffs } = get();
    return diffs.map((diff) => `File: ${diff.path}\n${diff.diffText}`).join('\n\n');
  },

  selectAndLoadDetails: (id: number) => {
    set({ selectedId: id });
    void get().loadDetails(id);
  },

  reloadDetails: async () => {
    const { selectedId, loadDetails } = get();
    if (selectedId) {
      await loadDetails(selectedId);
    }
  },

  getSelectedSummary: () => {
    const { pullRequests, selectedId } = get();
    return pullRequests.find((pr) => pr.id === selectedId) ?? null;
  },

  getFilteredPullRequests: () => {
    const { pullRequests, prFilterText } = get();
    const query = prFilterText.trim().toLowerCase();
    if (!query) {
      return pullRequests;
    }
    return pullRequests.filter((pr) => {
      const targetSuffix = pr.targetRef?.split('/').filter(Boolean).pop() ?? '';
      const draftLabel = pr.isDraft ? 'draft' : '';
      const haystack = `${pr.id} ${pr.title} ${pr.author} ${pr.status} ${draftLabel} ${pr.targetRef ?? ''} ${targetSuffix}`.toLowerCase();
      return haystack.includes(query);
    });
  }
}));
