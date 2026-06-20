import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../styles/index.css';
import styles from './App.module.css';
import { api } from '@renderer/services/api';
import { PullRequestDetails, PullRequestFileChange, PullRequestSummary, PullRequestWorkItem, ReviewPromptContext, ReviewSessionOptions } from '@shared/types/models';
import { buildModelOptions } from '@shared/constants/modelOptions';
import { buildPrChangeBoundary, buildPrContextBlock } from '@shared/utils/prContext';
import { buildSkillProjectKeyCandidates } from '@shared/utils/skillProjectKey';
import { useSettingsStore } from '@renderer/features/settings/state/useSettingsStore';
import { usePullRequestStore } from '@renderer/features/pull-requests/state/usePullRequestStore';
import { useReviewStore } from '@renderer/features/review-queue/state/useReviewStore';
import { useUIStore, tabs } from '@renderer/stores/app/useUIStore';
import { useAppInitialization } from '@renderer/app/hooks/useAppInitialization';
import { useWorkItemsSummary } from '@renderer/features/pull-requests/detail/PullRequestDetail/hooks/useWorkItemsSummary';
import { applyPromptTemplate } from '@renderer/utils/applyPromptTemplate';
import PullRequestList from '@renderer/features/pull-requests/PullRequestList/PullRequestList';
import PullRequestDetail from '@renderer/features/pull-requests/detail/PullRequestDetail/PullRequestDetail';
import SettingsPanel from '@renderer/features/settings/SettingsPanel/SettingsPanel';
import PromptResults from '@renderer/features/review-results/PromptResults/PromptResults';
import SettingsModal from '@renderer/features/settings/SettingsModal/SettingsModal';
import ReviewOptionsModal from '@renderer/features/shared/ReviewOptionsModal';
import AskTab from '@renderer/features/ask/AskTab/AskTab';
import SkillsTab from '@renderer/features/skills/SkillsTab/SkillsTab';
import { LABELS } from './labels';

const buildReviewPrompt = (
  promptTemplateText: string,
  summary: PullRequestSummary,
  details: PullRequestDetails | null,
  workItems: PullRequestWorkItem[],
  customInstructions: string
): string => {
  const parts = [
    promptTemplateText,
    '',
    buildPrContextBlock(summary, details, workItems)
  ];

  if (customInstructions.trim()) {
    parts.push('', 'Additional instructions:', customInstructions.trim());
  }

  return parts.join('\n');
};

const filterPathsByExclusion = <T extends { path: string }>(items: T[], excludedFilePatterns: string): T[] => {
  const raw = excludedFilePatterns.trim();
  if (!raw) return items;
  const extensions = raw
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith('*.') ? p.slice(1).toLowerCase() : p.startsWith('.') ? p.toLowerCase() : `.${p}`.toLowerCase()));
  if (extensions.length === 0) return items;
  return items.filter((item) => !extensions.some((ext) => item.path.toLowerCase().endsWith(ext)));
};

export default function App() {
  const prGridRef = useRef<HTMLDivElement | null>(null);
  const hasTestedConnectionRef = useRef(false);
  const hiddenTabs = new Set(['prompt-results']);
  const [customInstructions, setCustomInstructions] = useState('');
  const [excludedFilePatterns, setExcludedFilePatterns] = useState('');
  const [isPrListCollapsed, setIsPrListCollapsed] = useState(false);
  const [quickReviewTarget, setQuickReviewTarget] = useState<PullRequestSummary | null>(null);

  // UI store
  const activeTab = useUIStore((state) => state.activeTab);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const error = useUIStore((state) => state.error);
  const setError = useUIStore((state) => state.setError);
  const isSettingsOpen = useUIStore((state) => state.isSettingsOpen);
  const settingsTab = useUIStore((state) => state.settingsTab);
  const setIsSettingsOpen = useUIStore((state) => state.setIsSettingsOpen);
  const openSettings = useUIStore((state) => state.openSettings);
  const prListWidth = useUIStore((state) => state.prListWidth);
  const setPrListWidth = useUIStore((state) => state.setPrListWidth);
  const skillsMismatchCount = useUIStore((state) => state.skillsMismatchCount);
  const setSkillsMismatchCount = useUIStore((state) => state.setSkillsMismatchCount);

  // Settings store
  const settings = useSettingsStore((state) => state.settings);
  const promptLibrary = useSettingsStore((state) => state.promptLibrary);
  const modelName = useSettingsStore((state) => state.modelName);
  const workItemsSummaryModelName = useSettingsStore((state) => state.workItemsSummaryModelName);
  const workItemsSummaryPromptExtra = useSettingsStore((state) => state.workItemsSummaryPromptExtra);
  const modelsVersion = useSettingsStore((state) => state.modelsVersion);
  const modelFallbackNotice = useSettingsStore((state) => state.modelFallbackNotice);
  const modelCatalogStatus = useSettingsStore((state) => state.modelCatalogStatus);
  const saveSettingsStore = useSettingsStore((state) => state.saveSettings);
  const savePromptLibraryStore = useSettingsStore((state) => state.savePromptLibrary);
  const addPrompt = useSettingsStore((state) => state.addPrompt);
  const removePrompt = useSettingsStore((state) => state.removePrompt);
  const setModelName = useSettingsStore((state) => state.setModelName);
  const setWorkItemsSummaryModelName = useSettingsStore((state) => state.setWorkItemsSummaryModelName);
  const setWorkItemsSummaryPromptExtra = useSettingsStore((state) => state.setWorkItemsSummaryPromptExtra);

  // Pull request store
  const status = usePullRequestStore((state) => state.status);
  const pullRequests = usePullRequestStore((state) => state.pullRequests);
  const selectedId = usePullRequestStore((state) => state.selectedId);
  const details = usePullRequestStore((state) => state.details);
  const fileChanges = usePullRequestStore((state) => state.fileChanges);
  const diffs = usePullRequestStore((state) => state.diffs);
  const workItems = usePullRequestStore((state) => state.workItems);
  const prThreads = usePullRequestStore((state) => state.prThreads);
  const selectedDiffPath = usePullRequestStore((state) => state.selectedDiffPath);
  const loading = usePullRequestStore((state) => state.loading);
  const detailsLoading = usePullRequestStore((state) => state.detailsLoading);
  const workItemsLoading = usePullRequestStore((state) => state.workItemsLoading);
  const diffsLoading = usePullRequestStore((state) => state.diffsLoading);
  const prFilterText = usePullRequestStore((state) => state.prFilterText);
  const prFilterAuthor = usePullRequestStore((state) => state.prFilterAuthor);
  const prFilterAssignedToMe = usePullRequestStore((state) => state.prFilterAssignedToMe);
  const activePrSourceId = usePullRequestStore((state) => state.activePrSourceId);
  const setStatus = usePullRequestStore((state) => state.setStatus);
  const setSelectedDiffPath = usePullRequestStore((state) => state.setSelectedDiffPath);
  const setPromptText = usePullRequestStore((state) => state.setPromptText);
  const setPrFilterText = usePullRequestStore((state) => state.setPrFilterText);
  const setPrFilterAuthor = usePullRequestStore((state) => state.setPrFilterAuthor);
  const setPrFilterAssignedToMe = usePullRequestStore((state) => state.setPrFilterAssignedToMe);
  const setActivePrSourceId = usePullRequestStore((state) => state.setActivePrSourceId);
  const switchPrSource = usePullRequestStore((state) => state.switchPrSource);
  const loadPullRequests = usePullRequestStore((state) => state.loadPullRequests);
  const selectAndLoadDetails = usePullRequestStore((state) => state.selectAndLoadDetails);
  const reloadDetails = usePullRequestStore((state) => state.reloadDetails);
  const reloadThreads = usePullRequestStore((state) => state.reloadThreads);
  const getSelectedSummary = usePullRequestStore((state) => state.getSelectedSummary);
  const getFilteredPullRequests = usePullRequestStore((state) => state.getFilteredPullRequests);

  // Review store
  const jobs = useReviewStore((state) => state.jobs);
  const persistedJobs = useReviewStore((state) => state.persistedJobs);
  const loadPersistedJobs = useReviewStore((state) => state.loadPersistedJobs);
  const enqueueReview = useReviewStore((state) => state.enqueueReview);
  const deleteReviewsForPr = useReviewStore((state) => state.deleteReviewsForPr);
  const clearAllPersistedReviews = useReviewStore((state) => state.clearAllPersistedReviews);
  const clearPersistedReviewsForCompletedPrs = useReviewStore((state) => state.clearPersistedReviewsForCompletedPrs);

  const selectedSummary = getSelectedSummary();

  // Build author name → ID map from loaded PRs
  const authorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const pr of pullRequests) {
      if (pr.author && pr.authorId) map.set(pr.author, pr.authorId);
    }
    return map;
  }, [pullRequests]);

  // Cache author options so the dropdown stays populated during filtered views
  const [cachedAuthorOptions, setCachedAuthorOptions] = useState<string[]>([]);
  useEffect(() => {
    if (!prFilterAuthor) {
      const authors = new Set<string>();
      for (const pr of pullRequests) {
        if (pr.author) authors.add(pr.author);
      }
      setCachedAuthorOptions(Array.from(authors).sort((a, b) => a.localeCompare(b)));
    }
  }, [pullRequests, prFilterAuthor]);

  useEffect(() => {
    if (!prGridRef.current) {
      return;
    }

    prGridRef.current.style.setProperty('--pr-list-width', `${prListWidth}px`);
  }, [prListWidth]);

  // Rebuild model select options when the dynamic model list is refreshed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const modelOpts = useMemo(() => buildModelOptions(), [modelsVersion]);
  const isModelCatalogReady = modelCatalogStatus === 'ready' && modelOpts.length > 0;
  const modelCatalogUnavailableMessage = modelFallbackNotice
    ?? 'Copilot model catalog is unavailable. Model selection and review launch are disabled until model loading succeeds.';

  const baseFilteredPullRequests = useMemo(() => {
    let result = getFilteredPullRequests();
    if (prFilterAssignedToMe) {
      const myName = (settings?.myDisplayName ?? '').trim().toLowerCase();
      if (myName) {
        result = result.filter((pr) =>
          pr.reviewers?.some((r) => r.name.toLowerCase().includes(myName) && (r.vote === 0 || r.vote === null)) ?? false
        );
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullRequests, prFilterText, prFilterAssignedToMe, settings?.myDisplayName]);
  const authorOptions = cachedAuthorOptions;
  const filteredPullRequests = baseFilteredPullRequests;
  const presentError = useCallback((value: unknown) => {
    const message = value instanceof Error ? value.message : String(value);
    setError(message);
    if (message.includes('Open Settings')) {
      openSettings('ado');
    }
  }, [openSettings, setError]);

  const handleError = useCallback((message: string) => {
    presentError(message);
  }, [presentError]);

  // When author filter changes, re-fetch PRs from API with creatorId
  const handleAuthorFilterChange = useCallback((authorName: string) => {
    setPrFilterAuthor(authorName);
    const creatorId = authorName ? authorMap.get(authorName) : undefined;
    void loadPullRequests(creatorId).catch(presentError);
  }, [authorMap, setPrFilterAuthor, loadPullRequests, presentError]);
  const prReviewPrompts = useMemo(
    () => (promptLibrary?.prompts ?? []).filter((prompt) => (prompt.category ?? 'PR Review') === 'PR Review'),
    [promptLibrary]
  );
  const workItemsSummaryPrompts = useMemo(
    () => (promptLibrary?.prompts ?? []).filter((prompt) => (prompt.category ?? 'PR Review') === 'Work Item changes summary'),
    [promptLibrary]
  );

  // ── Initialization & prompt sync ──
  const {
    selectedPromptId, setSelectedPromptId,
    selectedWorkItemsPromptId, setSelectedWorkItemsPromptId
  } = useAppInitialization({
    selectedSummary,
    details,
    prReviewPrompts,
    workItemsSummaryPrompts,
    onError: handleError,
    setPromptText
  });

  // ── Work items summary ──
  const {
    loading: workItemsSummaryLoading,
    text: workItemsSummaryText,
    generate: generateWorkItemsSummary
  } = useWorkItemsSummary({
    selectedSummary,
    details,
    workItems,
    diffs,
    workItemsSummaryModelName,
    workItemsSummaryPromptExtra,
    workItemsSummaryPrompts,
    selectedWorkItemsPromptId,
    onError: handleError
  });

  // ── Load PRs on status change (reset author filter) ──
  useEffect(() => {
    setPrFilterAuthor('');
    void loadPullRequests().catch(presentError);
  }, [status, loadPullRequests, presentError, setPrFilterAuthor]);

  // ── Test Azure DevOps connection on first settings load ──
  useEffect(() => {
    if (!settings || hasTestedConnectionRef.current) return;
    hasTestedConnectionRef.current = true;
    const hasOrgs = (settings.organizations ?? []).length > 0;
    const hasSources = (settings.prSources ?? []).length > 0;
    if (!hasOrgs || !hasSources) {
      openSettings('ado');
      return;
    }
    // Initialise active source from settings if store doesn't have one yet
    if (!activePrSourceId && settings.activePrSourceId) {
      setActivePrSourceId(settings.activePrSourceId);
    }
    void api.testAdoConnection().then((result) => {
      if (!result.ok) {
        presentError(result.message);
      }
    }).catch((error) => presentError(error));
  }, [activePrSourceId, openSettings, presentError, setActivePrSourceId, settings]);

  useEffect(() => {
    api.getSkillsIntegritySummary()
      .then((summary) => setSkillsMismatchCount(summary.mismatchCount))
      .catch(() => setSkillsMismatchCount(0));
  }, [setSkillsMismatchCount]);

  useEffect(() => {
    if (!modelFallbackNotice) {
      return;
    }
    setError(modelFallbackNotice);
  }, [modelFallbackNotice, setError]);

  // ── URL helpers ──
  const getActiveOrgName = (): string | null => {
    const sourceId = activePrSourceId ?? settings?.activePrSourceId;
    const source = settings?.prSources?.find((s) => s.id === sourceId);
    if (!source) return null;
    return settings?.organizations?.find((o) => o.id === source.organizationId)?.name ?? null;
  };

  const getActiveProject = (): string | null => {
    const sourceId = activePrSourceId ?? settings?.activePrSourceId;
    return settings?.prSources?.find((s) => s.id === sourceId)?.project ?? null;
  };

  const openPullRequest = () => {
    if (!selectedSummary || !settings) return;
    const org = getActiveOrgName();
    const project = getActiveProject();
    if (!org || !project) return;
    const repo = selectedSummary.repository || project;
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_git/${encodeURIComponent(repo)}/pullrequest/${selectedSummary.id}`;
    window.open(url, '_blank');
  };

  const openWorkItem = (id: number) => {
    if (!settings) return;
    const org = getActiveOrgName();
    const project = getActiveProject();
    if (!org || !project) return;
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_workitems/edit/${id}`;
    window.open(url, '_blank');
  };

  // ── Current project keys (canonical + legacy fallback) for skill filtering ──
  const currentProjectKeys = useMemo(() => {
    const org = getActiveOrgName();
    const project = getActiveProject();
    return buildSkillProjectKeyCandidates(org, project);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, activePrSourceId]);

  const currentOrganizationId = useMemo(() => {
    const sourceId = activePrSourceId ?? settings?.activePrSourceId;
    const source = settings?.prSources?.find((s) => s.id === sourceId);
    if (!source) return null;
    return source.organizationId ?? null;
  }, [settings, activePrSourceId]);

  // ── Settings handlers ──
  const handleSaveSettings = async (updated: import('@shared/types/models').AppSettings) => {
    try {
      const result = await saveSettingsStore(updated);
      setActivePrSourceId(result.settings.activePrSourceId ?? null);
      await loadPersistedJobs();
      return result;
    } catch (error) {
      presentError(error);
      throw error;
    }
  };

  // ── Review handlers ──
  const resolveReviewPromptContext = useCallback(async (
    summary: PullRequestSummary,
    currentDetails?: PullRequestDetails | null,
    currentWorkItems?: PullRequestWorkItem[],
    currentFileChanges?: PullRequestFileChange[],
    currentDetailsLoading?: boolean,
    currentWorkItemsLoading?: boolean,
    currentDiffsLoading?: boolean
  ): Promise<{ reviewDetails: PullRequestDetails | null; reviewWorkItems: PullRequestWorkItem[]; reviewFileChanges: PullRequestFileChange[] }> => {
    let reviewDetails = currentDetails?.id === summary.id ? currentDetails : null;
    if (!reviewDetails || currentDetailsLoading) {
      reviewDetails = await api.getPullRequestDetails(summary.id);
    }

    let reviewWorkItems: PullRequestWorkItem[] = [];
    const canReuseLoadedWorkItems = currentDetails?.id === summary.id && !currentWorkItemsLoading;
    if (canReuseLoadedWorkItems) {
      reviewWorkItems = currentWorkItems ?? [];
    } else if (reviewDetails?.repositoryId) {
      try {
        reviewWorkItems = await api.getPullRequestWorkItems(reviewDetails.repositoryId, summary.id);
      } catch {
        reviewWorkItems = [];
      }
    }

    let reviewFileChanges: PullRequestFileChange[] = [];
    const canReuseLoadedFileChanges = currentDetails?.id === summary.id && !currentDiffsLoading;
    if (canReuseLoadedFileChanges) {
      reviewFileChanges = currentFileChanges ?? [];
    } else {
      try {
        reviewFileChanges = await api.getPullRequestFileChanges(summary.id);
      } catch {
        reviewFileChanges = [];
      }
    }

    return { reviewDetails, reviewWorkItems, reviewFileChanges };
  }, []);

  const buildReviewPromptContext = useCallback((
    summary: PullRequestSummary,
    reviewDetails: PullRequestDetails | null,
    reviewFileChanges: PullRequestFileChange[],
    reviewSessionOptions?: ReviewSessionOptions
  ): ReviewPromptContext | null => {
    const filteredChangedFiles = filterPathsByExclusion(reviewFileChanges, excludedFilePatterns);
    if ((reviewSessionOptions?.requestedContextMode ?? 'branch-aware') === 'branch-aware' && reviewDetails) {
      return {
        changedFiles: filteredChangedFiles,
        prChangeBoundary: buildPrChangeBoundary(summary.id, reviewDetails, filteredChangedFiles)
      };
    }
    return {
      changedFiles: filteredChangedFiles
    };
  }, [excludedFilePatterns]);

  const handleQueueReview = async (overrideModel?: string, forceNewSession?: boolean, selectedSkillIds?: string[], overridePromptId?: string, reviewSessionOptions?: ReviewSessionOptions) => {
    if (!isModelCatalogReady) {
      setError(modelCatalogUnavailableMessage);
      return;
    }
    if (prReviewPrompts.length === 0) {
      setError('Create a "PR Review" prompt in Prompt Library before launching a review.');
      return;
    }
    if (!selectedSummary) return;
    const effectiveModel = overrideModel || modelName;
    const { reviewDetails, reviewWorkItems, reviewFileChanges } = await resolveReviewPromptContext(
      selectedSummary,
      details,
      workItems,
      fileChanges,
      detailsLoading,
      workItemsLoading,
      diffsLoading
    );
    // Compute effective prompt text (override if a different prompt was chosen in the modal)
    const promptId = overridePromptId ?? selectedPromptId ?? prReviewPrompts[0]?.id ?? null;
    const prompt = promptId ? (prReviewPrompts.find((p) => p.id === promptId) ?? prReviewPrompts[0]) : null;
    if (!prompt) {
      setError('Create a "PR Review" prompt in Prompt Library before launching a review.');
      return;
    }
    const effectivePromptText = applyPromptTemplate(prompt.content, selectedSummary, reviewDetails);
    if (overridePromptId) {
      setSelectedPromptId(prompt.id);
    }
    const basePrompt = buildReviewPrompt(
      effectivePromptText,
      selectedSummary,
      reviewDetails,
      reviewWorkItems,
      customInstructions
    );
    const reviewPromptContext = buildReviewPromptContext(selectedSummary, reviewDetails, reviewFileChanges, reviewSessionOptions);
    try {
      await enqueueReview(selectedSummary, basePrompt, effectiveModel, forceNewSession, selectedSkillIds, reviewSessionOptions, reviewPromptContext);
    } catch (err: unknown) {
      presentError(err);
    }
  };

  const handleQuickReviewFromList = (summary: PullRequestSummary) => {
    if (!isModelCatalogReady) {
      setError(modelCatalogUnavailableMessage);
      return;
    }
    setQuickReviewTarget(summary);
  };

  const handleQuickReviewConfirm = async (opts: {
    model: string;
    promptId: string;
    forceNewSession: boolean;
    selectedSkillIds: string[] | undefined;
    reviewSessionOptions?: ReviewSessionOptions;
  }) => {
    if (!isModelCatalogReady) {
      setQuickReviewTarget(null);
      setError(modelCatalogUnavailableMessage);
      return;
    }
    const summary = quickReviewTarget;
    setQuickReviewTarget(null);
    if (!summary) return;
    if (prReviewPrompts.length === 0) {
      setError('Create a "PR Review" prompt in Prompt Library before launching a review.');
      return;
    }

    const defaultReviewPromptId = opts.promptId
      || promptLibrary?.defaultPromptIdByCategory?.['PR Review']
      || promptLibrary?.defaultPromptId
      || null;
    const defaultPrompt = prReviewPrompts.find((prompt) => prompt.id === defaultReviewPromptId)
      ?? prReviewPrompts[0]
      ?? null;
    const modelForReview = opts.model || settings?.defaultModel?.trim() || modelName;

    try {
      const reviewDetails = await api.getPullRequestDetails(summary.id);
      const [reviewWorkItems, reviewFileChanges] = await Promise.all([
        reviewDetails.repositoryId
          ? api.getPullRequestWorkItems(reviewDetails.repositoryId, summary.id).catch(() => [] as PullRequestWorkItem[])
          : Promise.resolve([] as PullRequestWorkItem[]),
        api.getPullRequestFileChanges(summary.id).catch(() => [] as PullRequestFileChange[])
      ]);
      if (!defaultPrompt) {
        setError('Create a "PR Review" prompt in Prompt Library before launching a review.');
        return;
      }
      const promptTemplateText = applyPromptTemplate(defaultPrompt.content, summary, reviewDetails);
      const prompt = buildReviewPrompt(promptTemplateText, summary, reviewDetails, reviewWorkItems, '');
      const reviewPromptContext = buildReviewPromptContext(summary, reviewDetails, reviewFileChanges, opts.reviewSessionOptions);
      await enqueueReview(summary, prompt, modelForReview, opts.forceNewSession, opts.selectedSkillIds, opts.reviewSessionOptions, reviewPromptContext);
    } catch (err: unknown) {
      presentError(err);
    }
  };

  const handleDeleteReviewsForSelectedPr = async (jobId?: string | null) => {
    if (!selectedSummary) return;
    try {
      await deleteReviewsForPr(selectedSummary, jobId);
    } catch (err: unknown) {
      presentError(err);
    }
  };

  const handleAssignToSelf = async () => {
    if (!selectedSummary || !details?.repositoryId) return;
    try {
      await api.assignReviewerToPullRequest(details.repositoryId, selectedSummary.id);
      await reloadDetails();
    } catch (err: unknown) {
      presentError(err);
    }
  };

  // ── Resize handler ──
  const startResizePrList = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = prListWidth;
    const containerWidth = prGridRef.current?.clientWidth ?? 0;
    const minWidth = 220;
    const maxWidth = containerWidth ? Math.max(containerWidth - 320, minWidth) : 800;
    const handleMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setPrListWidth(Math.min(Math.max(startWidth + delta, minWidth), maxWidth));
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const allReviewJobsForDetail = useMemo(() => {
    const merged = [...jobs, ...persistedJobs];
    const uniqueById = new Map<string, import('@shared/types/models').ReviewJob>();

    for (const job of merged) {
      const existing = uniqueById.get(job.id);
      if (!existing) {
        uniqueById.set(job.id, job);
        continue;
      }

      const existingTime = new Date(existing.completedAt ?? existing.startedAt ?? existing.queuedAt).getTime();
      const currentTime = new Date(job.completedAt ?? job.startedAt ?? job.queuedAt).getTime();
      if (currentTime > existingTime) {
        uniqueById.set(job.id, job);
      }
    }

    return Array.from(uniqueById.values());
  }, [jobs, persistedJobs]);

  return (
    <div className={styles.app}>
      <header className={styles.titlebar}>
        <nav className={styles.tabs}>
          {tabs.filter((tab) => !hiddenTabs.has(tab.id)).map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'skills' && skillsMismatchCount > 0 && (
                <span title={`${skillsMismatchCount} skill(s) out of sync between database and hard disk`} className={styles.skillsWarning}>
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                  <span className={styles.skillsWarningCount}>{skillsMismatchCount}</span>
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className={styles.actions}>
          <button
            className={`btn ${styles.actionIconBtn} ${activeTab === 'prompt-results' ? styles.actionIconBtnActive : ''}`}
            onClick={() => setActiveTab('prompt-results')}
            title={LABELS.tasksResultsDebug}
            aria-label={LABELS.tasksResultsDebug}
            aria-pressed={activeTab === 'prompt-results'}
          >
            <i className="fa-solid fa-bug" aria-hidden="true" />
          </button>
          <button
            className={`btn ${styles.actionIconBtn}`}
            onClick={() => openSettings('ado')}
            title={LABELS.openSettings}
            aria-label={LABELS.openSettings}
          >
            <i className="fa-solid fa-gear" aria-hidden="true" />
          </button>
        </div>
      </header>

      <SettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsTab}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        onClearPersistedReviews={clearAllPersistedReviews}
        onClearPersistedReviewsForCompletedPullRequests={clearPersistedReviewsForCompletedPrs}
      />

      {/* Quick review options modal (triggered from PR list run button) */}
      {quickReviewTarget && (
        <ReviewOptionsModal
          modelName={settings?.defaultModel?.trim() || modelName}
          modelOptions={modelOpts}
          isModelCatalogReady={isModelCatalogReady}
          modelCatalogUnavailableMessage={modelCatalogUnavailableMessage}
          promptLibrary={promptLibrary}
          selectedPromptId={selectedPromptId}
          currentProjectKeys={currentProjectKeys}
          currentOrganizationId={currentOrganizationId}
          onConfirm={(opts) => void handleQuickReviewConfirm(opts)}
          onCancel={() => setQuickReviewTarget(null)}
        />
      )}

      {error && (
        <div className="error">
          {error}
          <button className="btn-icon" onClick={() => setError(null)} title={LABELS.close} aria-label={LABELS.close}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
      )}
      {loading && <div className="loading">{LABELS.loading}</div>}

      <main className={styles.content}>
        {activeTab === 'pull-requests' && (
          <div className={styles.grid} ref={prGridRef}>
            {!isPrListCollapsed && (
              <div className={`${styles.splitPanel} ${styles.prListPanel}`}>
                <PullRequestList
                  status={status}
                  requests={filteredPullRequests}
                  reviewJobs={allReviewJobsForDetail}
                  selectedId={selectedId}
                  onSelect={selectAndLoadDetails}
                  onQuickReview={handleQuickReviewFromList}
                  canQuickReview={isModelCatalogReady}
                  quickReviewBlockedTitle={modelCatalogUnavailableMessage}
                  onStatusChange={setStatus}
                  onRefresh={() => {
                    const creatorId = prFilterAuthor ? authorMap.get(prFilterAuthor) : undefined;
                    loadPullRequests(creatorId).catch(presentError);
                  }}
                  filterText={prFilterText}
                  onFilterTextChange={setPrFilterText}
                  authorFilterText={prFilterAuthor}
                  onAuthorFilterTextChange={handleAuthorFilterChange}
                  authorOptions={authorOptions}
                  filterAssignedToMe={prFilterAssignedToMe}
                  onFilterAssignedToMeChange={setPrFilterAssignedToMe}
                  myDisplayName={settings?.myDisplayName}
                  onToggleCollapse={() => setIsPrListCollapsed(true)}
                  isCollapsed={false}
                  prSources={settings?.prSources ?? []}
                  activePrSourceId={activePrSourceId ?? settings?.activePrSourceId ?? null}
                  onPrSourceChange={(id) => void switchPrSource(id)}
                />
              </div>
            )}
            {isPrListCollapsed && (
              <div className={`${styles.splitPanel} ${styles.prListCollapsedPanel}`}>
                <div className={styles.prListCollapsedHeader}>
                  <button
                    className={styles.prListPinBtn}
                    onClick={() => setIsPrListCollapsed(false)}
                    title={LABELS.pinPRList}
                    aria-label={LABELS.pinPRList}
                  >
                    <i className="fa-solid fa-thumbtack-slash" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
            {!isPrListCollapsed && <div className={styles.splitter} onMouseDown={startResizePrList} />}
            <div className={styles.splitPanelMain}>
              <PullRequestDetail
                summary={selectedSummary}
                details={details}
                diffs={diffs}
                workItems={workItems}
                prThreads={prThreads}
                reviewJobs={allReviewJobsForDetail}
                defaultDiffViewMode={settings?.defaultDiffViewMode ?? 'inline'}
                selectedDiffPath={selectedDiffPath}
                detailsLoading={detailsLoading}
                workItemsLoading={workItemsLoading}
                diffsLoading={diffsLoading}
                modelName={modelName}
                modelOptions={modelOpts}
                onModelChange={setModelName}
                promptLibrary={promptLibrary}
                selectedPromptId={selectedPromptId}
                customInstructions={customInstructions}
                excludedFilePatterns={excludedFilePatterns}
                onSelectedPromptIdChange={setSelectedPromptId}
                onCustomInstructionsChange={setCustomInstructions}
                onExcludedFilePatternsChange={setExcludedFilePatterns}
                onSelectDiff={setSelectedDiffPath}
                onQueueReview={handleQueueReview}
                currentProjectKeys={currentProjectKeys}
                currentOrganizationId={currentOrganizationId}
                onReloadDetails={reloadDetails}
                onReloadThreads={reloadThreads}
                onOpenPullRequest={openPullRequest}
                onOpenWorkItem={openWorkItem}
                onAssignToSelf={handleAssignToSelf}
                workItemsSummaryLoading={workItemsSummaryLoading}
                workItemsSummaryText={workItemsSummaryText}
                workItemsSummaryModelName={workItemsSummaryModelName}
                onWorkItemsSummaryModelChange={setWorkItemsSummaryModelName}
                workItemsPromptLibrary={promptLibrary}
                workItemsSelectedPromptId={selectedWorkItemsPromptId}
                onWorkItemsSelectedPromptIdChange={setSelectedWorkItemsPromptId}
                workItemsSummaryPromptExtra={workItemsSummaryPromptExtra}
                onWorkItemsSummaryPromptExtraChange={setWorkItemsSummaryPromptExtra}
                onGenerateWorkItemsSummary={generateWorkItemsSummary}
                onDeleteReviewRuns={handleDeleteReviewsForSelectedPr}
                onError={handleError}
              />
            </div>
          </div>
        )}

        {activeTab === 'prompt-results' && <PromptResults jobs={jobs} />}
        {activeTab === 'settings' && settings && promptLibrary && (
          <SettingsPanel
            promptLibrary={promptLibrary}
            onSavePromptLibrary={savePromptLibraryStore}
            onAddPrompt={addPrompt}
            onRemovePrompt={removePrompt}
          />
        )}
        {activeTab === 'ask' && (
          <AskTab
            modelOptions={modelOpts}
            defaultModel={modelName}
            modelCatalogUnavailableMessage={modelCatalogUnavailableMessage}
          />
        )}
        {activeTab === 'skills' && <SkillsTab />}
      </main>
    </div>
  );
}
