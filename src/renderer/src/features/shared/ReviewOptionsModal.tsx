import { useState, useCallback, useMemo, useEffect } from 'react';
import { PromptLibrarySettings, ReviewSessionOptions, SkillInfo } from '@shared/types/models';
import { formatSkillProjectKey, matchesSkillProjectKeyCandidates } from '@shared/utils/skillProjectKey';
import { api } from '@renderer/services/api';
import { useSettingsStore } from '@renderer/features/settings/state/useSettingsStore';
import ModelSelect from './ModelSelect/ModelSelect';
import { LABELS } from './ReviewOptionsModal.messages';
import styles from './ReviewOptionsModal.module.css';

export interface ReviewOptionsModalProps {
  modelName: string;
  modelOptions: { id: string; label: string; disabled?: boolean }[];
  isModelCatalogReady: boolean;
  modelCatalogUnavailableMessage?: string;
  promptLibrary: PromptLibrarySettings | null;
  selectedPromptId: string | null;
  currentProjectKeys?: string[];
  currentOrganizationId?: string | null;
  onConfirm: (opts: {
    model: string;
    promptId: string;
    forceNewSession: boolean;
    selectedSkillIds: string[] | undefined;
    reviewSessionOptions?: ReviewSessionOptions;
  }) => void;
  onCancel: () => void;
}

export default function ReviewOptionsModal({
  modelName,
  modelOptions,
  isModelCatalogReady,
  modelCatalogUnavailableMessage,
  promptLibrary,
  selectedPromptId,
  currentProjectKeys = [],
  currentOrganizationId,
  onConfirm,
  onCancel
}: ReviewOptionsModalProps) {
  const reviewPrompts = useMemo(
    () => (promptLibrary?.prompts ?? []).filter((p) => (p.category ?? 'PR Review') === 'PR Review'),
    [promptLibrary]
  );
  const hasReviewPrompt = reviewPrompts.length > 0;
  const settings = useSettingsStore((state) => state.settings);

  const [optionsModel, setOptionsModel] = useState(modelName);
  const [optionsPromptId, setOptionsPromptId] = useState(selectedPromptId ?? reviewPrompts[0]?.id ?? '');
  const [optionsForceNew, setOptionsForceNew] = useState(true);
  const [optionsSkillIds, setOptionsSkillIds] = useState<Set<string>>(new Set());
  const [allSkills, setAllSkills] = useState<SkillInfo[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [optionsDiffOnlyOverride, setOptionsDiffOnlyOverride] = useState(false);
  const isReviewWorktreeRootConfigured = Boolean(settings?.reviewStorage?.folderPath?.trim());
  const isBranchAwareLaunchBlocked = !isReviewWorktreeRootConfigured && !optionsDiffOnlyOverride;

  useEffect(() => {
    if (!reviewPrompts.find((prompt) => prompt.id === optionsPromptId)) {
      setOptionsPromptId(selectedPromptId ?? reviewPrompts[0]?.id ?? '');
    }
  }, [optionsPromptId, reviewPrompts, selectedPromptId]);

  const relevantSkills = useMemo(() => {
    return allSkills.filter((s) =>
      !s.isHidden && (
        (s.scope === 'global' && (
          !s.linkedOrganizationIds || s.linkedOrganizationIds.length === 0 ||
          (currentOrganizationId && s.linkedOrganizationIds.includes(currentOrganizationId))
        )) ||
        (s.scope === 'project' && matchesSkillProjectKeyCandidates(s.projectKey, currentProjectKeys))
      )
    );
  }, [allSkills, currentProjectKeys, currentOrganizationId]);

  const relevantSkillIds = useMemo(() => relevantSkills.map((skill) => skill.id), [relevantSkills]);
  const areAllRelevantSkillsSelected = useMemo(
    () => relevantSkillIds.length > 0 && relevantSkillIds.every((id) => optionsSkillIds.has(id)),
    [optionsSkillIds, relevantSkillIds]
  );

  // Load skills on mount
  useEffect(() => {
    api.getSkills().then((s) => {
      setAllSkills(s ?? []);
      const activeIds = new Set(
        (s ?? []).filter((sk: SkillInfo) =>
          sk.isActive && !sk.isHidden &&
          ((sk.scope === 'global' && (
            !sk.linkedOrganizationIds || sk.linkedOrganizationIds.length === 0 ||
            (currentOrganizationId && sk.linkedOrganizationIds.includes(currentOrganizationId))
          )) ||
          (sk.scope === 'project' && matchesSkillProjectKeyCandidates(sk.projectKey, currentProjectKeys)))
        ).map((sk: SkillInfo) => sk.id)
      );
      setOptionsSkillIds(activeIds);
    }).catch(() => setAllSkills([]));
  }, [currentProjectKeys, currentOrganizationId]);

  const toggleSkill = useCallback((id: string) => {
    setOptionsSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAllRelevantSkills = useCallback(() => {
    setOptionsSkillIds((prev) => {
      const next = new Set(prev);
      if (relevantSkillIds.every((id) => next.has(id))) {
        relevantSkillIds.forEach((id) => next.delete(id));
      } else {
        relevantSkillIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [relevantSkillIds]);

  const handleConfirm = useCallback(() => {
    const selectedIds = Array.from(optionsSkillIds);
    const reviewSessionOptions: ReviewSessionOptions = {
      requestedContextMode: optionsDiffOnlyOverride ? 'diff-only' : 'branch-aware'
    };

    onConfirm({
      model: optionsModel,
      promptId: optionsPromptId,
      forceNewSession: optionsForceNew,
      selectedSkillIds: selectedIds.length > 0 ? selectedIds : undefined,
      reviewSessionOptions
    });
  }, [onConfirm, optionsDiffOnlyOverride, optionsForceNew, optionsModel, optionsPromptId, optionsSkillIds]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className={`modal ${styles.reviewOptionsModal}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{LABELS.reviewOptions}</h2>
        </div>
        <div className={`modal-body ${styles.reviewOptionsBody}`}>
          {/* Review Prompt */}
          <label>
            {LABELS.reviewPrompt}
            <select
              className="model-select"
              value={optionsPromptId}
              onChange={(e) => setOptionsPromptId(e.target.value)}
              disabled={!hasReviewPrompt}
            >
              {!hasReviewPrompt ? (
                <option value="">{LABELS.noPromptOption}</option>
              ) : (
                reviewPrompts.map((prompt) => (
                  <option key={`opts-prompt-${prompt.id}`} value={prompt.id}>{prompt.name}</option>
                ))
              )}
            </select>
          </label>
          {!hasReviewPrompt && <p className="muted">{LABELS.noPromptHelp}</p>}

          {/* Model */}
          {isModelCatalogReady ? (
            <>
              <label>
                {LABELS.model}
                <ModelSelect
                  value={optionsModel}
                  options={modelOptions}
                  onChange={setOptionsModel}
                  className="model-select"
                  keyPrefix="review-opts"
                />
              </label>
            </>
          ) : (
            <div className="muted">{modelCatalogUnavailableMessage ?? LABELS.modelCatalogUnavailable}</div>
          )}

          {/* New session */}
          <label className={styles.inlineCheckboxLabel}>
            <input
              className={styles.checkboxInput}
              type="checkbox"
              checked={optionsForceNew}
              onChange={(e) => setOptionsForceNew(e.target.checked)}
            />
            <span className={styles.checkboxText}>{LABELS.createNewSession}</span>
          </label>

          <fieldset className={styles.workspaceFieldset}>
            <legend className={styles.workspaceLegend}>{LABELS.advancedHeading}</legend>
            <label className={styles.inlineCheckboxLabel}>
              <input
                className={styles.checkboxInput}
                type="checkbox"
                checked={showAdvancedOptions}
                onChange={(event) => setShowAdvancedOptions(event.target.checked)}
              />
              <span className={styles.checkboxText}>{LABELS.showAdvancedOptions}</span>
            </label>
            {showAdvancedOptions && (
              <>
                <label className={styles.inlineCheckboxLabel}>
                  <input
                    className={styles.checkboxInput}
                    type="checkbox"
                    checked={optionsDiffOnlyOverride}
                    onChange={(event) => setOptionsDiffOnlyOverride(event.target.checked)}
                  />
                  <span className={styles.checkboxText}>{LABELS.diffOnlyOverride}</span>
                </label>
                <p className={styles.workspaceHint}>{LABELS.diffOnlyHint}</p>
              </>
            )}
          </fieldset>

          {/* Skills */}
          <fieldset className={styles.skillsFieldset}>
            <legend className={styles.skillsLegend}>{LABELS.skills}</legend>
            {relevantSkills.length > 0 && (
              <div className={styles.skillsToolbar}>
                <button className="btn" type="button" onClick={toggleAllRelevantSkills}>
                  {areAllRelevantSkillsSelected ? LABELS.unselectAllSkills : LABELS.selectAllSkills}
                </button>
              </div>
            )}
            {relevantSkills.length === 0 ? (
              <p className={styles.emptyState}>{LABELS.noSkillsAvailable}</p>
            ) : (
              <div className={styles.skillsList}>
                <div className={styles.skillsListHeader} aria-hidden="true">
                  <span />
                  <span>{LABELS.skillNameColumn}</span>
                  <span>{LABELS.skillScopeColumn}</span>
                </div>
                {relevantSkills.map((skill: SkillInfo) => (
                  <label
                    key={skill.id}
                    className={`${styles.skillRow} ${optionsSkillIds.has(skill.id) ? styles.skillRowSelected : ''}`.trim()}
                  >
                    <input
                      className={styles.checkboxInput}
                      type="checkbox"
                      checked={optionsSkillIds.has(skill.id)}
                      onChange={() => toggleSkill(skill.id)}
                    />
                    <span>{skill.name}</span>
                    <span className={styles.skillScope}>
                      {skill.scope === 'project' ? formatSkillProjectKey(skill.projectKey) : 'Global'}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>{LABELS.cancel}</button>
          <button
            className="btn accent"
            onClick={handleConfirm}
            disabled={!optionsPromptId || !hasReviewPrompt || isBranchAwareLaunchBlocked || !isModelCatalogReady}
            title={
              !isModelCatalogReady
                ? (modelCatalogUnavailableMessage ?? LABELS.modelCatalogUnavailable)
                : (!hasReviewPrompt
                  ? LABELS.runReviewPromptRequired
                  : (isBranchAwareLaunchBlocked ? LABELS.runReviewBlocked : undefined))
            }
          >
            <i className={`fa-solid fa-play ${styles.confirmIcon}`} aria-hidden="true" />
            {LABELS.runReview}
          </button>
        </div>
      </div>
    </div>
  );
}
