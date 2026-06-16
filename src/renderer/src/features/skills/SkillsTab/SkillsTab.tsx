import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSkillsStore } from '@renderer/features/skills/state/useSkillsStore';
import { useSettingsStore } from '@renderer/features/settings/state/useSettingsStore';
import { api } from '@renderer/services/api';
import { formatSkillProjectKey } from '@shared/utils/skillProjectKey';
import { copyToClipboard } from '@renderer/utils/clipboard';
import ConfirmDialog from '../../shared/ConfirmDialog/ConfirmDialog';
import {
  FRONTMATTER_TEMPLATE,
  LABELS,
  NEW_SKILL_TEMPLATE,
  deleteFailedMessage,
  deleteSelectedSkillsMessage,
  deleteSkillMessage,
  mismatchAlert,
  missingFrontmatterMessage,
  projectFilterLabel,
  saveAllToDiskFailedMessage,
  saveAllToDiskSuccessMessage,
  saveFailedMessage,
  showHiddenSkillsTitle,
  skillMismatchTitle,
  syncFailedMessage,
  syncSuccessMessage,
  syncedProjectSummary
} from './SkillsTab.messages';
import styles from './SkillsTab.module.css';

/** Check whether SKILL.md content contains valid YAML frontmatter with name and description. */
const hasFrontmatter = (content: string): boolean => {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return false;
  const fm = match[1];
  const hasName = /^name:\s*.+$/m.test(fm);
  const hasDesc = /^description:\s*.+$/m.test(fm);
  return hasName && hasDesc;
};

type PendingDeleteState =
  | { mode: 'single'; id: string; name: string; scope: string }
  | { mode: 'bulk'; items: Array<{ id: string; name: string; scope: string }> };

export default function SkillsTab() {
  const {
    skills, selectedSkillId, selectedSkillFiles, activeFilter,
    isLoading, isSyncing, projectKeys,
    integritySummary, isSavingAllToDisk,
    loadSkills, loadProjectKeys, loadIntegritySummary, validateAllSkills, saveAllSkillsToDisk, selectSkill, setFilter,
    syncProject, saveGlobal, deleteGlobal, deleteProject, toggleHidden, updateLinkedOrgs
  } = useSkillsStore();

  const { settings } = useSettingsStore();

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [formContent, setFormContent] = useState('');
  const [viewingFilePath, setViewingFilePath] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [selectedLinkedOrgIds, setSelectedLinkedOrgIds] = useState<string[]>([]);
  const [repos, setRepos] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [syncedProjectInfo, setSyncedProjectInfo] = useState<Array<{
    projectKey: string;
    displayName: string;
    skillCount: number;
    lastSyncedAt: string | null;
  }>>([]);

  // ── Resizable panels ──
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [fileTreeHeight, setFileTreeHeight] = useState(140);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const fileTreeRef = useRef<HTMLDivElement>(null);

  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.max(150, Math.min(500, startWidth + ev.clientX - startX));
      setSidebarWidth(newWidth);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  const handleFileTreeResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = fileTreeHeight;
    const onMove = (ev: MouseEvent) => {
      const newHeight = Math.max(60, Math.min(400, startHeight + ev.clientY - startY));
      setFileTreeHeight(newHeight);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [fileTreeHeight]);

  // ── Load on mount ──
  useEffect(() => {
    void loadSkills();
    void loadProjectKeys();
    void loadIntegritySummary();
  }, [loadSkills, loadProjectKeys, loadIntegritySummary]);

  // Reload skills when filter changes
  useEffect(() => {
    void loadSkills();
  }, [activeFilter, loadSkills]);

  useEffect(() => {
    void validateAllSkills();
  }, [validateAllSkills]);

  // Auto-select SKILL.md when a skill is selected and load content for editing
  useEffect(() => {
    if (selectedSkillFiles.length > 0) {
      const skillMd = selectedSkillFiles.find((f) => !f.isFolder && f.path === 'SKILL.md');
      setViewingFilePath(skillMd ? skillMd.path : null);
      if (skillMd?.content != null) {
        setFormContent(skillMd.content);
      }
    } else {
      setViewingFilePath(null);
    }
  }, [selectedSkillFiles]);

  // Populate linked org IDs when selecting a skill
  useEffect(() => {
    const skill = skills.find((s) => s.id === selectedSkillId);
    if (skill?.linkedOrganizationIds && skill.linkedOrganizationIds.length > 0) {
      setSelectedLinkedOrgIds(skill.linkedOrganizationIds);
    } else {
      setSelectedLinkedOrgIds([]);
    }
  }, [selectedSkillId, skills]);

  useEffect(() => {
    if (!syncModalOpen) {
      return;
    }
    const defaultSourceId = settings?.activePrSourceId ?? settings?.prSources?.[0]?.id ?? null;
    setSelectedSourceId(defaultSourceId);
    setSelectedRepoId(null);
  }, [settings, syncModalOpen]);

  useEffect(() => {
    if (!syncModalOpen) {
      return;
    }
    if (!selectedSourceId) {
      setRepos([]);
      setSelectedRepoId(null);
      return;
    }

    setIsLoadingRepos(true);
    api.getRepositories(selectedSourceId)
      .then((r) => {
        setRepos(r ?? []);
        setSelectedRepoId(null);
      })
      .catch(() => {
        setRepos([]);
        setSelectedRepoId(null);
      })
      .finally(() => setIsLoadingRepos(false));
  }, [selectedSourceId, syncModalOpen]);

  // Compute synced project info when sync modal opens
  useEffect(() => {
    if (!syncModalOpen) return;
    api.getSkills(undefined, undefined).then((allSkills) => {
      const projectMap = new Map<string, { count: number; lastSynced: string | null }>();
      for (const skill of allSkills) {
        if (skill.scope === 'project' && skill.projectKey) {
          const existing = projectMap.get(skill.projectKey);
          const syncDate = skill.lastSyncedAt ?? null;
          if (!existing) {
            projectMap.set(skill.projectKey, { count: 1, lastSynced: syncDate });
          } else {
            existing.count++;
            if (syncDate && (!existing.lastSynced || syncDate > existing.lastSynced)) {
              existing.lastSynced = syncDate;
            }
          }
        }
      }
      setSyncedProjectInfo(
        Array.from(projectMap.entries()).map(([key, val]) => ({
          projectKey: key,
          displayName: formatSkillProjectKey(key),
          skillCount: val.count,
          lastSyncedAt: val.lastSynced,
        }))
      );
    }).catch(() => setSyncedProjectInfo([]));
  }, [syncModalOpen]);

  const selectedSourceContext = useMemo(() => {
    const source = settings?.prSources?.find((s) => s.id === selectedSourceId) ?? null;
    if (!source) {
      return { source: null, org: null, project: null as string | null };
    }
    const org = settings?.organizations?.find((o) => o.id === source.organizationId) ?? null;
    return { source, org, project: source.project ?? null };
  }, [selectedSourceId, settings]);

  const sourceOptions = useMemo(() => {
    const organizationsById = new Map((settings?.organizations ?? []).map((org) => [org.id, org.name]));
    return (settings?.prSources ?? []).map((source) => {
      const orgName = organizationsById.get(source.organizationId) ?? source.organizationId;
      return {
        id: source.id,
        label: `${source.name} (${orgName} / ${source.project})`
      };
    });
  }, [settings]);

  // ── Filter options ──
  const filterOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [
      { value: 'all', label: LABELS.allSkills },
      { value: 'global', label: LABELS.globalSkills }
    ];
    // Project filters
    for (const key of projectKeys) {
      options.push({ value: key, label: projectFilterLabel(formatSkillProjectKey(key)) });
    }
    return options;
  }, [projectKeys]);

  // ── Selected skill ──
  const selectedSkill = skills.find((s) => s.id === selectedSkillId) ?? null;

  // ── Filter hidden skills ──
  const filteredSkills = useMemo(() => {
    const normalizedFilter = filterText.trim().toLowerCase();
    const visible = showHidden ? skills : skills.filter((s) => !s.isHidden);
    if (!normalizedFilter) {
      return visible;
    }

    return visible.filter((skill) => {
      const projectLabel = skill.scope === 'project' ? formatSkillProjectKey(skill.projectKey) : LABELS.global;
      const linkedOrgNames = (skill.linkedOrganizationIds ?? [])
        .map((id) => settings?.organizations?.find((org) => org.id === id)?.name ?? id)
        .join(' ');
      const haystack = `${skill.name} ${projectLabel} ${linkedOrgNames}`.toLowerCase();
      return haystack.includes(normalizedFilter);
    });
  }, [filterText, settings?.organizations, showHidden, skills]);

  const groupedSkills = useMemo(() => {
    const global = filteredSkills.filter((skill) => skill.scope === 'global');
    const project = filteredSkills.filter((skill) => skill.scope === 'project');
    const bySource = new Map<string, typeof project>();
    for (const skill of project) {
      const sourceLabel = formatSkillProjectKey(skill.projectKey);
      const existing = bySource.get(sourceLabel) ?? [];
      bySource.set(sourceLabel, [...existing, skill]);
    }
    return { global, bySource };
  }, [filteredSkills]);

  const isFiltering = filterText.trim().length > 0;
  const isGroupCollapsed = useCallback((groupId: string) => !isFiltering && collapsedGroupIds.has(groupId), [collapsedGroupIds, isFiltering]);
  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const selectedVisibleCount = useMemo(
    () => filteredSkills.filter((skill) => selectedSkillIds.has(skill.id)).length,
    [filteredSkills, selectedSkillIds]
  );

  const selectedVisibleSkills = useMemo(
    () => filteredSkills.filter((skill) => selectedSkillIds.has(skill.id)),
    [filteredSkills, selectedSkillIds]
  );

  const canHideSelected = useMemo(
    () => selectedVisibleSkills.some((skill) => !skill.isHidden),
    [selectedVisibleSkills]
  );

  const canShowSelected = useMemo(
    () => selectedVisibleSkills.some((skill) => skill.isHidden),
    [selectedVisibleSkills]
  );

  const canSaveSelectedSkill = useMemo(
    () => selectedSkill?.scope === 'global' && viewingFilePath === 'SKILL.md' && formContent.trim().length > 0 && hasFrontmatter(formContent),
    [formContent, selectedSkill?.scope, viewingFilePath]
  );

  const hiddenCount = useMemo(() => skills.filter((s) => s.isHidden).length, [skills]);
  const mismatchedById = useMemo(
    () => new Set(skills.filter((skill) => skill.isMismatched).map((skill) => skill.id)),
    [skills]
  );
  const mismatchCount = integritySummary?.mismatchCount ?? mismatchedById.size;
  const hasMismatch = mismatchCount > 0;

  const viewedFile = useMemo(() => {
    if (!viewingFilePath) return null;
    return selectedSkillFiles.find((f) => f.path === viewingFilePath) ?? null;
  }, [viewingFilePath, selectedSkillFiles]);

  // ── Sync handler ──
  const handleSync = async () => {
    const { org, project } = selectedSourceContext;
    if (!selectedSourceId) {
      setFeedback(LABELS.sourceRequired);
      setTimeout(() => setFeedback(null), 4000);
      return;
    }
    if (!org || !project) {
      setFeedback(LABELS.activeAdoSourceMissing);
      setTimeout(() => setFeedback(null), 4000);
      return;
    }
    if (!selectedRepoId) {
      setFeedback(LABELS.repositoryRequired);
      setTimeout(() => setFeedback(null), 4000);
      return;
    }
    const repo = repos.find((r) => r.id === selectedRepoId);
    if (!repo) return;

    try {
      const result = await syncProject(org.name, project, repo.id, repo.name);
      setFeedback(syncSuccessMessage(repo.name, result.skillCount, result.errors?.length ?? 0));
      setSyncModalOpen(false);
    } catch (err: unknown) {
      setFeedback(syncFailedMessage(err instanceof Error ? err.message : String(err)));
    }
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleSaveAllToDisk = async () => {
    try {
      const result = await saveAllSkillsToDisk();
      setFeedback(saveAllToDiskSuccessMessage(result.savedCount, result.skippedCount, result.failed.length));
    } catch (err: unknown) {
      setFeedback(saveAllToDiskFailedMessage(err instanceof Error ? err.message : String(err)));
    }
    setTimeout(() => setFeedback(null), 5000);
  };

  // ── Open containing folder (Task 3) ──
  const handleOpenFolder = () => {
    if (selectedSkill?.folderPath) {
      void api.openSkillFolder(selectedSkill.folderPath);
    }
  };

  const handleCopyContent = () => {
    const content = viewedFile?.content;
    if (content) {
      void copyToClipboard(content);
      setFeedback(LABELS.copiedToClipboard);
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const toggleSkillSelection = (id: string) => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const selectedItems = filteredSkills
      .filter((skill) => selectedSkillIds.has(skill.id))
      .map((skill) => ({ id: skill.id, name: skill.name, scope: skill.scope }));
    if (selectedItems.length === 0) {
      return;
    }
    setPendingDelete({ mode: 'bulk', items: selectedItems });
  };

  const handleLinkedOrgToggle = async (orgId: string, isChecked: boolean, persistImmediately: boolean) => {
    const nextIds = isChecked
      ? Array.from(new Set([...selectedLinkedOrgIds, orgId]))
      : selectedLinkedOrgIds.filter((id) => id !== orgId);
    setSelectedLinkedOrgIds(nextIds);

    if (!persistImmediately || !selectedSkill || selectedSkill.scope !== 'global') {
      return;
    }

    try {
      await updateLinkedOrgs(selectedSkill.id, nextIds.length > 0 ? nextIds : null);
      setFeedback(LABELS.saveSuccess);
      setTimeout(() => setFeedback(null), 2000);
    } catch (err: unknown) {
      setSelectedLinkedOrgIds(selectedSkill.linkedOrganizationIds ?? []);
      setFeedback(saveFailedMessage(err instanceof Error ? err.message : String(err)));
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleHideSelected = async () => {
    const toHide = selectedVisibleSkills.filter((skill) => !skill.isHidden);
    if (toHide.length === 0) return;
    try {
      for (const skill of toHide) {
        await toggleHidden(skill.id, true);
      }
    } catch (err: unknown) {
      setFeedback(deleteFailedMessage(err instanceof Error ? err.message : String(err)));
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleShowSelected = async () => {
    const toShow = selectedVisibleSkills.filter((skill) => skill.isHidden);
    if (toShow.length === 0) return;
    try {
      for (const skill of toShow) {
        await toggleHidden(skill.id, false);
      }
    } catch (err: unknown) {
      setFeedback(deleteFailedMessage(err instanceof Error ? err.message : String(err)));
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  // ── Form handlers ──
  const openNewForm = () => {
    void selectSkill(null);
    setFormContent(NEW_SKILL_TEMPLATE);
    setIsCreatingNew(true);
  };

  const handleSaveForm = async () => {
    if (!formContent.trim()) return;
    if (!hasFrontmatter(formContent)) {
      setFeedback(missingFrontmatterMessage());
      setTimeout(() => setFeedback(null), 8000);
      return;
    }
    try {
      const existingId = isCreatingNew ? undefined : selectedSkill?.id;
      const linkedOrgIds = selectedLinkedOrgIds.length > 0 ? selectedLinkedOrgIds : null;
      await saveGlobal('', '', formContent, linkedOrgIds, existingId);
      setIsCreatingNew(false);
      // Don't clear selectedLinkedOrgIds — the effect on [selectedSkillId, skills] repopulates them
      setFeedback(LABELS.saveSuccess);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback(saveFailedMessage(err instanceof Error ? err.message : String(err)));
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.mode === 'single') {
        if (pendingDelete.scope === 'project') {
          await deleteProject(pendingDelete.id);
        } else {
          await deleteGlobal(pendingDelete.id);
        }
      } else {
        for (const item of pendingDelete.items) {
          if (item.scope === 'project') {
            await deleteProject(item.id);
          } else {
            await deleteGlobal(item.id);
          }
        }
        setSelectedSkillIds(new Set());
        setSelectionMode(false);
      }
    } catch (err: unknown) {
      setFeedback(deleteFailedMessage(err instanceof Error ? err.message : String(err)));
      setTimeout(() => setFeedback(null), 5000);
    }
    setPendingDelete(null);
  };

  return (
    <div className={styles.skillsTab}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar} ref={sidebarRef} style={{ width: sidebarWidth, minWidth: 150, maxWidth: 500 }}>
        <div className={styles.sidebarHeader}>
          <button
            className={`btn btn-sm ${styles.selectionToggleButton}`}
            onClick={() => {
              if (selectionMode) {
                setSelectionMode(false);
                setSelectedSkillIds(new Set());
              } else {
                setSelectionMode(true);
              }
            }}
            title={selectionMode ? LABELS.cancelSelection : LABELS.selectionMode}
          >
            <i className={`fa-solid ${selectionMode ? 'fa-check-square' : 'fa-list-check'}`} aria-hidden="true" />
          </button>
          <div className={styles.sidebarHeaderActions}>
            <button
              className="btn btn-primary"
              onClick={openNewForm}
              title={LABELS.addGlobalSkillTitle}
            >
              <i className="fa-solid fa-plus" aria-hidden="true" />
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setSyncModalOpen(true)}
              title={LABELS.syncSkillsFromRepositoryTitle}
            >
              <i className={`fa-solid fa-sync ${isSyncing ? 'fa-spin' : ''}`} aria-hidden="true" />
            </button>
            <button
              className="btn btn-sm"
              onClick={() => void handleSaveAllToDisk()}
              title={LABELS.saveAllSkillsToDiskTitle}
              disabled={isSavingAllToDisk || !hasMismatch}
            >
              <i className={`fa-solid fa-hard-drive ${isSavingAllToDisk ? 'fa-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        {hasMismatch && (
          <div className={styles.mismatchAlert}>
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <span>
              {mismatchAlert(mismatchCount)}
            </span>
          </div>
        )}

        {/* Scope filter */}
        <div className={styles.scopeFilter}>
          <select
            value={activeFilter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {hiddenCount > 0 && (
            <button
              className={`btn-icon ${styles.neutralIconButton} ${styles.showHiddenToggle}`}
              onClick={() => setShowHidden(!showHidden)}
              title={showHidden ? LABELS.hideHiddenSkills : showHiddenSkillsTitle(hiddenCount)}
            >
              <i className={`fa-solid ${showHidden ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
              <span className={styles.hiddenCount}>{hiddenCount}</span>
            </button>
          )}
        </div>
        <div className={styles.searchFilter}>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={LABELS.searchPlaceholder}
          />
        </div>
        {selectionMode && (
          <div className={styles.bulkActions}>
            <span>{selectedVisibleCount} {LABELS.selectedCount}</span>
            <span className={styles.bulkActionButtons}>
              <button
                className={`btn-icon ${styles.neutralIconButton}`}
                onClick={() => void handleHideSelected()}
                disabled={!canHideSelected}
                title={LABELS.hideSelected}
              >
                <i className="fa-solid fa-eye-slash" aria-hidden="true" />
              </button>
              <button
                className={`btn-icon ${styles.neutralIconButton}`}
                onClick={() => void handleShowSelected()}
                disabled={!canShowSelected}
                title={LABELS.showSelected}
              >
                <i className="fa-solid fa-eye" aria-hidden="true" />
              </button>
              <button
                className={`btn-icon ${styles.dangerIconButton}`}
                onClick={handleDeleteSelected}
                disabled={selectedVisibleCount === 0}
                title={LABELS.deleteSelected}
              >
                <i className="fa-solid fa-trash" aria-hidden="true" />
              </button>
            </span>
          </div>
        )}

        {feedback && <div className={styles.feedback}>{feedback}</div>}

        {/* Skill list */}
        <ul className={styles.skillList} role="listbox">
          {(groupedSkills.global.length > 0 || groupedSkills.bySource.size > 0) && (
            <>
              {groupedSkills.global.length > 0 && (
                <>
                  <li className={styles.skillGroupHeader}>
                    <button
                      type="button"
                      className={styles.groupToggle}
                      onClick={() => toggleGroupCollapse('group-global')}
                    >
                      <i className={`fa-solid ${isGroupCollapsed('group-global') ? 'fa-chevron-right' : 'fa-chevron-down'}`} aria-hidden="true" />
                      {LABELS.globalGroup} ({groupedSkills.global.length})
                    </button>
                  </li>
                  {!isGroupCollapsed('group-global') && groupedSkills.global.map((skill) => (
                    <li
                      key={skill.id}
                      role="option"
                      aria-selected={skill.id === selectedSkillId}
                      className={`${styles.skillItem} ${skill.id === selectedSkillId ? styles.skillItemActive : ''} ${skill.isHidden ? styles.skillItemHidden : ''}`}
                      onClick={() => {
                        if (selectionMode) {
                          toggleSkillSelection(skill.id);
                          return;
                        }
                        setIsCreatingNew(false);
                        void selectSkill(skill.id);
                      }}
                    >
                      {selectionMode && (
                        <input
                          type="checkbox"
                          className={styles.skillSelectCheckbox}
                          checked={selectedSkillIds.has(skill.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSkillSelection(skill.id);
                          }}
                        />
                      )}
                      <span className={styles.skillItemInfo}>
                        <span className={styles.skillItemLine1}>
                          <span className={styles.skillItemName}>{skill.name}</span>
                          {mismatchedById.has(skill.id) && (
                            <i
                              className={`fa-solid fa-triangle-exclamation ${styles.skillMismatchIcon}`}
                              title={skillMismatchTitle(skill.mismatchReason)}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        {skill.linkedOrganizationIds && skill.linkedOrganizationIds.length > 0 && (
                          <span className={styles.skillItemOrgs}>
                            {skill.linkedOrganizationIds.map((id) => {
                              const org = settings?.organizations?.find((o) => o.id === id);
                              return org?.name ?? id;
                            }).join(', ')}
                          </span>
                        )}
                      </span>
                      {!selectionMode && (
                        <span className={styles.skillItemActions}>
                          <button
                            className={`btn-icon ${styles.neutralIconButton}`}
                            onClick={(e) => { e.stopPropagation(); void toggleHidden(skill.id, !skill.isHidden); }}
                            title={skill.isHidden ? LABELS.showSkill : LABELS.hideSkill}
                          >
                            <i className={`fa-solid ${skill.isHidden ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
                          </button>
                          <button
                            className={`btn-icon ${styles.dangerIconButton}`}
                            onClick={(e) => { e.stopPropagation(); setPendingDelete({ mode: 'single', id: skill.id, name: skill.name, scope: skill.scope }); }}
                            title={LABELS.deleteSkill}
                          >
                            <i className="fa-solid fa-trash" aria-hidden="true" />
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </>
              )}
              {groupedSkills.bySource.size > 0 && (
                <>
                  <li className={styles.skillGroupHeader}>
                    <button
                      type="button"
                      className={styles.groupToggle}
                      onClick={() => toggleGroupCollapse('group-project')}
                    >
                      <i className={`fa-solid ${isGroupCollapsed('group-project') ? 'fa-chevron-right' : 'fa-chevron-down'}`} aria-hidden="true" />
                      {LABELS.projectGroup} ({Array.from(groupedSkills.bySource.values()).reduce((total, bucket) => total + bucket.length, 0)})
                    </button>
                  </li>
                  {!isGroupCollapsed('group-project') && Array.from(groupedSkills.bySource.entries()).flatMap(([sourceLabel, sourceSkills]) => [
                    <li key={`source-${sourceLabel}`} className={styles.skillSubGroupHeader}>
                      <button
                        type="button"
                        className={styles.groupToggle}
                        onClick={() => toggleGroupCollapse(`source-${sourceLabel}`)}
                      >
                        <i className={`fa-solid ${isGroupCollapsed(`source-${sourceLabel}`) ? 'fa-chevron-right' : 'fa-chevron-down'}`} aria-hidden="true" />
                        {sourceLabel} ({sourceSkills.length})
                      </button>
                    </li>,
                    ...(!isGroupCollapsed(`source-${sourceLabel}`) ? sourceSkills.map((skill) => (
                        <li
                          key={skill.id}
                          role="option"
                          aria-selected={skill.id === selectedSkillId}
                          className={`${styles.skillItem} ${skill.id === selectedSkillId ? styles.skillItemActive : ''} ${skill.isHidden ? styles.skillItemHidden : ''}`}
                          onClick={() => {
                            if (selectionMode) {
                              toggleSkillSelection(skill.id);
                              return;
                            }
                            setIsCreatingNew(false);
                            void selectSkill(skill.id);
                          }}
                        >
                          {selectionMode && (
                            <input
                              type="checkbox"
                              className={styles.skillSelectCheckbox}
                              checked={selectedSkillIds.has(skill.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSkillSelection(skill.id);
                              }}
                            />
                          )}
                          <span className={styles.skillItemInfo}>
                            <span className={styles.skillItemLine1}>
                              <span className={styles.skillItemName}>{skill.name}</span>
                              {mismatchedById.has(skill.id) && (
                                <i
                                  className={`fa-solid fa-triangle-exclamation ${styles.skillMismatchIcon}`}
                                  title={skillMismatchTitle(skill.mismatchReason)}
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                          </span>
                          {!selectionMode && (
                            <span className={styles.skillItemActions}>
                              <button
                                className={`btn-icon ${styles.neutralIconButton}`}
                                onClick={(e) => { e.stopPropagation(); void toggleHidden(skill.id, !skill.isHidden); }}
                                title={skill.isHidden ? LABELS.showSkill : LABELS.hideSkill}
                              >
                                <i className={`fa-solid ${skill.isHidden ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
                              </button>
                              <button
                                className={`btn-icon ${styles.dangerIconButton}`}
                                onClick={(e) => { e.stopPropagation(); setPendingDelete({ mode: 'single', id: skill.id, name: skill.name, scope: skill.scope }); }}
                                title={LABELS.deleteSkill}
                              >
                                <i className="fa-solid fa-trash" aria-hidden="true" />
                              </button>
                            </span>
                          )}
                        </li>
                      )) : [])
                  ])}
                </>
              )}
            </>
          )}
          {filteredSkills.length === 0 && !isLoading && (
            <li className={styles.emptyState}>
              {skills.length > 0 ? LABELS.allSkillsHidden : LABELS.noSkillsYet}<br />
              {skills.length === 0 && LABELS.syncOrCreateSkill}
            </li>
          )}
          {isLoading && (
            <li className={styles.emptyState}>{LABELS.loading}</li>
          )}
        </ul>
      </aside>

      {/* Horizontal resize handle */}
      <div className={styles.resizeHandleH} onMouseDown={handleSidebarResize} />

      {/* ── Main panel ── */}
      <div className={styles.main}>
        {/* New skill creation */}
        {isCreatingNew ? (
          <div className={styles.skillForm}>
            <div className={styles.mainHeader}>
              <h2>{LABELS.newGlobalSkill}</h2>
            </div>
            <p className={styles.formHelpText}>
              {LABELS.frontmatterHelp}
            </p>
            {/* Optional: link to specific organizations */}
            {(settings?.organizations ?? []).length > 0 && (
              <div className={styles.formField}>
                <div className={styles.formFieldLabel}>
                  {LABELS.limitToOrganizations} <span className={styles.formFieldHint}>{LABELS.limitToOrganizationsHint}</span>
                </div>
                <div className={styles.orgCheckboxList}>
                  {(settings?.organizations ?? []).map((org) => (
                    <label key={org.id} className={styles.orgCheckbox}>
                      <input
                        type="checkbox"
                        checked={selectedLinkedOrgIds.includes(org.id)}
                        onChange={(e) => { void handleLinkedOrgToggle(org.id, e.target.checked, false); }}
                      />
                      <span>{org.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className={styles.skillFormContentLabel}>
              {LABELS.skillFileName}
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder={LABELS.skillPlaceholder}
              />
            </label>
            {formContent.trim() && !hasFrontmatter(formContent) && (
              <p style={{ fontSize: 11, color: 'var(--vscode-editorWarning-foreground, #cca700)', margin: '4px 0 0', whiteSpace: 'pre-line' }}>
                ⚠️ Your SKILL.md must start with a YAML frontmatter block:{'\n'}
                <code style={{ fontSize: 11 }}>{FRONTMATTER_TEMPLATE}</code>
              </p>
            )}
            <div className={styles.skillFormActions}>
              <button className="btn" onClick={() => setIsCreatingNew(false)}>{LABELS.cancel}</button>
              <button
                className="btn btn-primary"
                onClick={() => void handleSaveForm()}
                disabled={!formContent.trim() || !hasFrontmatter(formContent)}
              >
                {LABELS.create}
              </button>
            </div>
          </div>
        ) : (selectedSkill) ? (
          <>
            <div className={styles.mainHeader}>
              <h2>{selectedSkill.name}</h2>
              <button
                className={`btn-icon ${styles.neutralIconButton}`}
                onClick={handleOpenFolder}
                title={LABELS.openContainingFolder}
              >
                <i className="fa-solid fa-folder-open" aria-hidden="true" />
              </button>
              {viewedFile?.content != null && (
                <button
                  className={`btn-icon ${styles.neutralIconButton}`}
                  onClick={handleCopyContent}
                  title={LABELS.copyFileContent}
                >
                  <i className="fa-solid fa-copy" aria-hidden="true" />
                </button>
              )}
              {selectedSkill.scope === 'global' && viewingFilePath === 'SKILL.md' && (
                <button
                  className={`btn-icon ${styles.neutralIconButton}`}
                  onClick={() => void handleSaveForm()}
                  title={LABELS.save}
                  disabled={!canSaveSelectedSkill}
                >
                  <i className="fa-solid fa-save" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Scrollable content area below header */}
            <div className={styles.mainContent}>
              <div className={styles.metaRow}>
                <span>Marker: <code className={styles.markerBadge}>{selectedSkill.marker}</code>
                  <button
                    className={`btn-icon ${styles.neutralIconButton}`}
                    onClick={() => {
                      const template = `IMPORTANT: You MUST include the exact text "${selectedSkill.marker}" somewhere in EVERY response you give. This is a mandatory requirement. Include it naturally in your response.`;
                      void copyToClipboard(template);
                      setFeedback(LABELS.markerTemplateCopied);
                      setTimeout(() => setFeedback(null), 2000);
                    }}
                    title={LABELS.copyMarkerInstruction}
                  >
                    <i className="fa-solid fa-clipboard" aria-hidden="true" />
                  </button>
                </span>
                {selectedSkill.lastSyncedAt && (
                  <span>Last synced: {new Date(selectedSkill.lastSyncedAt).toLocaleString()}</span>
                )}
              </div>

              {/* File tree — compact list above content */}
              {selectedSkillFiles.filter((f) => !f.isFolder).length > 0 && (
                <div className={styles.fileTree} ref={fileTreeRef} style={{ height: fileTreeHeight, minHeight: 60, maxHeight: 400 }}>
                  <div className={styles.fileTreeLabel}>{LABELS.files}</div>
                  <div className={styles.fileTreeList}>
                    {selectedSkillFiles.filter((f) => !f.isFolder).map((file) => (
                      <div
                        key={file.path}
                        className={`${styles.fileEntry} ${viewingFilePath === file.path ? styles.fileEntryActive : ''}`}
                        onClick={() => setViewingFilePath(file.path)}
                      >
                        <i className="fa-solid fa-file-code" aria-hidden="true" style={{ opacity: 0.5 }} />
                        <span>{file.path}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedSkillFiles.filter((f) => !f.isFolder).length > 0 && viewedFile?.content != null && (
                <div className={styles.resizeHandleV} onMouseDown={handleFileTreeResize} />
              )}
              {selectedSkillFiles.length === 0 && (
                <div className={styles.emptyState}>{LABELS.noFilesFound}</div>
              )}

              {/* Editable content for SKILL.md (global) / read-only for project */}
              {viewingFilePath === 'SKILL.md' && selectedSkill.scope === 'global' ? (
                <div className={styles.skillForm}>
                  {/* Organization linking — inside the form for a unified experience */}
                  {(settings?.organizations ?? []).length > 0 && (
                    <div className={styles.formField}>
                      <div className={styles.formFieldLabel}>
                        {LABELS.limitToOrganizations} <span className={styles.formFieldHint}>{LABELS.limitToOrganizationsHint}</span>
                      </div>
                      <div className={styles.orgCheckboxList}>
                        {(settings?.organizations ?? []).map((org) => (
                          <label key={org.id} className={styles.orgCheckbox}>
                            <input
                              type="checkbox"
                              checked={selectedLinkedOrgIds.includes(org.id)}
                              onChange={(e) => { void handleLinkedOrgToggle(org.id, e.target.checked, true); }}
                            />
                            <span>{org.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <label className={styles.skillFormContentLabel}>
                    {LABELS.skillFileName}
                    <textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder={LABELS.existingSkillPlaceholder}
                    />
                  </label>
                  {formContent.trim() && !hasFrontmatter(formContent) && (
                    <p style={{ fontSize: 11, color: 'var(--vscode-editorWarning-foreground, #cca700)', margin: '4px 0 0', whiteSpace: 'pre-line' }}>
                      ⚠️ Your SKILL.md must start with a YAML frontmatter block:{'\n'}
                      <code style={{ fontSize: 11 }}>{FRONTMATTER_TEMPLATE}</code>
                    </p>
                  )}
                </div>
              ) : viewedFile?.content != null ? (
                <div className={styles.fileContent}>
                  {viewedFile.content}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            {LABELS.emptySelection}
          </div>
        )}
      </div>

      {/* ── Sync modal (Task 4) ── */}
      {syncModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setSyncModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{LABELS.syncSkillsFromRepository}</h3>
              <button
                className="btn-icon"
                onClick={() => setSyncModalOpen(false)}
                title={LABELS.close}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* Already synced projects (read-only info) */}
              {syncedProjectInfo.length > 0 && (
                <div className={styles.syncedProjectsSection}>
                  <div className={styles.syncedProjectsTitle}>{LABELS.syncedProjects}</div>
                  <div className={styles.syncedProjectsList}>
                    {syncedProjectInfo.map((p) => (
                      <div key={p.projectKey} className={styles.syncedProjectRow}>
                        <div className={styles.syncedProjectInfo}>
                          <span className={styles.syncedProjectName}>{p.displayName}</span>
                          <span className={styles.syncedProjectMeta}>
                            {syncedProjectSummary(p.skillCount, p.lastSyncedAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <label className={styles.modalLabel}>
                {LABELS.source}
                <select
                  value={selectedSourceId ?? ''}
                  onChange={(e) => setSelectedSourceId(e.target.value || null)}
                  className={styles.modalSelect}
                >
                  <option value="">{LABELS.selectSource}</option>
                  {sourceOptions.map((source) => (
                    <option key={source.id} value={source.id}>{source.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.modalLabel}>
                {LABELS.repository}
                <select
                  value={selectedRepoId ?? ''}
                  onChange={(e) => setSelectedRepoId(e.target.value || null)}
                  className={styles.modalSelect}
                  disabled={!selectedSourceId || isLoadingRepos}
                >
                  <option value="">{LABELS.selectRepository}</option>
                  {repos.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
              <p className={styles.syncHint}>
                {LABELS.syncHint}
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn" onClick={() => setSyncModalOpen(false)}>{LABELS.cancel}</button>
              <button
                className="btn btn-primary"
                onClick={() => void handleSync()}
                disabled={isSyncing || !selectedSourceId || !selectedRepoId}
              >
                {isSyncing && <i className="fa-solid fa-sync fa-spin" aria-hidden="true" style={{ marginRight: 6 }} />}
                {LABELS.sync}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {pendingDelete && (
        <ConfirmDialog
          isOpen={true}
          title={LABELS.deleteSkillTitle}
          message={pendingDelete.mode === 'single'
            ? deleteSkillMessage(pendingDelete.name)
            : deleteSelectedSkillsMessage(pendingDelete.items.length)}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
