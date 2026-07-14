import { useCallback, useEffect, useState } from 'react';
import { PromptCategory, PromptLibrarySettings } from '@shared/types/models';
import ConfirmDialog from '@renderer/features/shared/ConfirmDialog/ConfirmDialog';
import { LABELS, PR_REVIEW_HELP_EXAMPLE, categoryLabel, confirmDeleteMessage } from './SettingsPanel.messages';
import styles from './SettingsPanel.module.css';

interface SettingsPanelProps {
  promptLibrary: PromptLibrarySettings;
  onSavePromptLibrary: (library: PromptLibrarySettings) => void;
  onAddPrompt: (category?: PromptCategory) => void;
  onRemovePrompt: (id: string) => void;
}

const categories: Array<PromptCategory | 'all'> = ['all', 'PR Review', 'Work Item changes summary'];

const PR_REVIEW_STARTER_TEMPLATE = `You are a senior code reviewer performing a pull request review.

You will receive:
- Pull request title and metadata
- Code changes as unified diffs
- Depending on the execution context, read-only access to the PR review worktree

Review goals:
1. Review only the provided pull request changes.
2. Focus on Security, Correctness, Performance, and Maintainability.
3. Prioritize issues directly tied to changed lines.
4. Include evidence from the changes for each comment.
5. Do not invent issues when evidence is missing.

Additional tasks:
- Verify the pull request title is written in English. If not, propose a corrected English title.
- Verify Product Backlog Item / development-task alignment when the available evidence exposes that linkage (PR title, branch name, diffs, worktree context). Do not invent a mismatch.
- Review dependency additions or changes introduced by this PR. Flag unapproved third-party libraries.`;

const WORK_ITEM_STARTER_TEMPLATE = `You are reviewing an Azure DevOps pull request against linked work items.

Produce a concise change summary with these sections:
1. Overall objective
2. Main implemented changes
3. Work items coverage (map each work item to concrete changes)
4. Risks, gaps, or follow-ups

Requirements:
- Base statements only on provided work-item context and code changes.
- Explicitly mention missing coverage when a work item is not fully addressed.
- Keep the summary clear and operational for release notes and QA handoff.`;

export default function SettingsPanel({
  promptLibrary,
  onSavePromptLibrary,
  onAddPrompt,
  onRemovePrompt
}: SettingsPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | 'all'>('all');
  const [selectedPromptId, setSelectedPromptId] = useState(
    promptLibrary.defaultPromptIdByCategory?.['PR Review']
      ?? promptLibrary.defaultPromptId
      ?? promptLibrary.prompts[0]?.id
      ?? ''
  );
  const [draftName, setDraftName] = useState('');
  const [draftCategory, setDraftCategory] = useState<PromptCategory>('PR Review');
  const [draftContent, setDraftContent] = useState('');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [pendingDeletePrompt, setPendingDeletePrompt] = useState<{ id: string; name: string } | null>(null);

  const filteredPrompts = promptLibrary.prompts.filter((prompt) =>
    selectedCategory === 'all' ? true : (prompt.category ?? 'PR Review') === selectedCategory
  );

  useEffect(() => {
    if (!filteredPrompts.find((prompt) => prompt.id === selectedPromptId)) {
      const preferred = selectedCategory === 'all'
        ? promptLibrary.defaultPromptIdByCategory?.['PR Review'] ?? promptLibrary.defaultPromptId
        : promptLibrary.defaultPromptIdByCategory?.[selectedCategory];
      const fallback = filteredPrompts[0]?.id ?? promptLibrary.prompts[0]?.id ?? '';
      setSelectedPromptId(preferred && filteredPrompts.some((p) => p.id === preferred) ? preferred : fallback);
    }
  }, [promptLibrary, filteredPrompts, selectedPromptId, selectedCategory]);

  useEffect(() => {
    const prDefault = promptLibrary.defaultPromptIdByCategory?.['PR Review'] ?? promptLibrary.defaultPromptId;
    if (prDefault) {
      setSelectedPromptId(prDefault);
      return;
    }
    if (promptLibrary.prompts[0]?.id) {
      setSelectedPromptId(promptLibrary.prompts[0].id);
    }
  }, [promptLibrary.defaultPromptId, promptLibrary.defaultPromptIdByCategory, promptLibrary.prompts]);

  const selectedPrompt = promptLibrary.prompts.find((p) => p.id === selectedPromptId) ?? promptLibrary.prompts[0];

  useEffect(() => {
    setDraftName(selectedPrompt?.name ?? '');
    setDraftCategory((selectedPrompt?.category ?? 'PR Review') as PromptCategory);
    setDraftContent(selectedPrompt?.content ?? '');
  }, [selectedPrompt?.id, selectedPrompt?.name, selectedPrompt?.category, selectedPrompt?.content]);

  const savePromptChanges = useCallback(() => {
    if (!selectedPrompt) {
      return;
    }

    const prompts = promptLibrary.prompts.map((prompt) =>
      prompt.id === selectedPrompt.id
        ? { ...prompt, name: draftName, category: draftCategory, content: draftContent }
        : prompt
    );

    onSavePromptLibrary({ ...promptLibrary, prompts });
  }, [draftCategory, draftContent, draftName, onSavePromptLibrary, promptLibrary, selectedPrompt]);

  const setDefaultPrompt = (id: string, category: PromptCategory) => {
    onSavePromptLibrary({
      ...promptLibrary,
      defaultPromptId: category === 'PR Review' ? id : promptLibrary.defaultPromptId,
      defaultPromptIdByCategory: {
        ...(promptLibrary.defaultPromptIdByCategory ?? {}),
        [category]: id
      }
    });
  };

  const hasPromptChanges = Boolean(
    selectedPrompt
    && (draftName !== selectedPrompt.name
      || draftCategory !== (selectedPrompt.category ?? 'PR Review')
      || draftContent !== selectedPrompt.content)
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (hasPromptChanges && selectedPrompt) {
          savePromptChanges();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasPromptChanges, savePromptChanges, selectedPrompt]);

  const confirmPromptDelete = () => {
    if (!pendingDeletePrompt) {
      return;
    }
    onRemovePrompt(pendingDeletePrompt.id);
    setPendingDeletePrompt(null);
  };

  const insertStarterPrompt = useCallback((category: PromptCategory) => {
    const now = Date.now();
    const id = `prompt-${now}`;
    const isReview = category === 'PR Review';
    const prompt = {
      id,
      name: isReview ? 'Starter PR Review prompt' : 'Starter Work Item summary prompt',
      category,
      content: isReview ? PR_REVIEW_STARTER_TEMPLATE : WORK_ITEM_STARTER_TEMPLATE
    };
    const nextByCategory = {
      ...(promptLibrary.defaultPromptIdByCategory ?? {}),
      [category]: id
    };
    const defaultPromptId = isReview
      ? id
      : (promptLibrary.defaultPromptId ?? nextByCategory['PR Review'] ?? id);
    onSavePromptLibrary({
      ...promptLibrary,
      defaultPromptId,
      defaultPromptIdByCategory: nextByCategory,
      prompts: [...promptLibrary.prompts, prompt]
    });
    setSelectedCategory(category);
    setSelectedPromptId(id);
  }, [onSavePromptLibrary, promptLibrary]);

  return (
    <section className={`panel ${styles.settingsPanel}`}>
      <div className={styles.settingsGrid}>
        <div className={styles.settingsCardFull}>
          <div className="row between">
            <div className="row">
              <button
                className={`btn ${styles.iconActionBtn}`}
                onClick={() => onAddPrompt(selectedCategory === 'all' ? 'PR Review' : selectedCategory)}
                title={LABELS.addPrompt}
                aria-label={LABELS.addPrompt}
              >
                <i className="fa-solid fa-plus" aria-hidden="true" />
              </button>
              <button
                className={`btn btn-danger ${styles.iconActionBtn}`}
                onClick={() => {
                  if (!selectedPrompt) return;
                  setPendingDeletePrompt({ id: selectedPrompt.id, name: selectedPrompt.name });
                }}
                disabled={!selectedPrompt}
                title={LABELS.deleteSelected}
                aria-label={LABELS.deleteSelected}
              >
                <i className="fa-solid fa-trash" aria-hidden="true" />
              </button>
              <button
                className={`btn ${styles.iconActionBtn}`}
                onClick={() => setIsHelpOpen(true)}
                title={LABELS.promptHelp}
                aria-label={LABELS.promptHelp}
              >
                <i className="fa-regular fa-circle-question" aria-hidden="true" />
              </button>
            </div>
            <div className="row">
              <select
                className="select"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value as PromptCategory | 'all')}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.promptLibrary}>
            <div className={styles.promptList}>
              {filteredPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className={`list-item ${selectedPromptId === prompt.id ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPromptId(prompt.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPromptId(prompt.id); } }}
                >
                  <div className="list-title">{prompt.name}</div>
                  <div className="list-meta">
                    <span>{categoryLabel((prompt.category ?? 'PR Review') as PromptCategory)}</span>
                    {(prompt.category ?? 'PR Review') && (
                      <button
                        type="button"
                        className={`${styles.defaultPromptBtn} ${(promptLibrary.defaultPromptIdByCategory?.[(prompt.category ?? 'PR Review') as PromptCategory] === prompt.id) ? styles.defaultPromptBtnActive : ''}`}
                        title={LABELS.setDefault}
                        aria-label={LABELS.setDefault}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDefaultPrompt(prompt.id, (prompt.category ?? 'PR Review') as PromptCategory);
                        }}
                      >
                        <i
                          className={`fa-solid ${(promptLibrary.defaultPromptIdByCategory?.[(prompt.category ?? 'PR Review') as PromptCategory] === prompt.id) ? 'fa-star' : 'fa-star-half-stroke'}`}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {filteredPrompts.length === 0 && (
                <div className={styles.emptyPromptCategory}>
                  <div className="empty">{LABELS.noPromptForCategory}</div>
                  <div className={styles.emptyPromptCategoryHint}>{LABELS.noPromptForCategoryHint}</div>
                  <div className={styles.emptyPromptActions}>
                    {(selectedCategory === 'all' || selectedCategory === 'PR Review') && (
                      <button
                        className="btn"
                        type="button"
                        onClick={() => insertStarterPrompt('PR Review')}
                      >
                        {LABELS.insertPRReviewStarter}
                      </button>
                    )}
                    {(selectedCategory === 'all' || selectedCategory === 'Work Item changes summary') && (
                      <button
                        className="btn"
                        type="button"
                        onClick={() => insertStarterPrompt('Work Item changes summary')}
                      >
                        {LABELS.insertWorkItemStarter}
                      </button>
                    )}
                  </div>
                  <div className={styles.emptyPromptCategoryHint}>{LABELS.starterHelp}</div>
                </div>
              )}
            </div>
            <div className={styles.promptEditor}>
              {selectedPrompt ? (
                <>
                  <label className="form-label">
                    {LABELS.category}
                    <select
                      className="select"
                      value={draftCategory}
                      onChange={(event) => setDraftCategory(event.target.value as PromptCategory)}
                    >
                      <option value="PR Review">{LABELS.categoryPRReview}</option>
                      <option value="Work Item changes summary">{LABELS.categoryWorkItemSummary}</option>
                    </select>
                  </label>
                  <label className="form-label">
                    {LABELS.name}
                    <input
                      className={`input ${styles.promptNameInput}`}
                      type="text"
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                    />
                  </label>
                  <label className={`form-label ${styles.promptContentLabel}`}>
                    {LABELS.content}
                    <textarea
                      className="textarea"
                      value={draftContent}
                      onChange={(event) => setDraftContent(event.target.value)}
                      rows={12}
                    />
                  </label>
                  <div className={styles.promptActions}>
                    <button
                      className="btn primary"
                      onClick={savePromptChanges}
                      disabled={!selectedPrompt || !hasPromptChanges}
                    >
                      {LABELS.savePromptChanges}
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty">{LABELS.noPromptSelected}</div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={Boolean(pendingDeletePrompt)}
        title={LABELS.confirmDeleteTitle}
        message={pendingDeletePrompt ? confirmDeleteMessage(pendingDeletePrompt.name) : ''}
        confirmLabel={LABELS.confirmDelete}
        onConfirm={confirmPromptDelete}
        onCancel={() => setPendingDeletePrompt(null)}
      />
      {isHelpOpen && (
        <div className="modal-backdrop" onClick={() => setIsHelpOpen(false)}>
          <div className={`modal ${styles.promptHelpModal}`} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{LABELS.promptHelpTitle}</h2>
            </div>
            <div className={`modal-body ${styles.promptHelpBody}`}>
              <p>{LABELS.promptHelpIntro}</p>
              <section>
                <h3>{LABELS.promptHelpHowToBuildTitle}</h3>
                <div className={styles.promptHelpPreline}>{LABELS.promptHelpHowToBuild}</div>
              </section>
              <section>
                <h3>{LABELS.promptHelpParsingTitle}</h3>
                <p>{LABELS.promptHelpParsing}</p>
              </section>
              <section>
                <h3>{LABELS.promptHelpChecklistTitle}</h3>
                <div className={styles.promptHelpPreline}>{LABELS.promptHelpChecklist}</div>
              </section>
              <section>
                <div className={styles.promptHelpSectionHeader}>
                  <h3>{LABELS.promptHelpExampleTitle}</h3>
                  <button
                    className={styles.promptHelpCopyBtn}
                    onClick={() => {
                      navigator.clipboard.writeText(PR_REVIEW_HELP_EXAMPLE);
                    }}
                    title={LABELS.promptHelpCopyExample}
                    aria-label={LABELS.promptHelpCopyExample}
                  >
                    <i className="fa-regular fa-copy" aria-hidden="true" />
                  </button>
                </div>
                <pre className={styles.promptHelpExample}>{PR_REVIEW_HELP_EXAMPLE}</pre>
              </section>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setIsHelpOpen(false)}>
                {LABELS.closeHelp}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
