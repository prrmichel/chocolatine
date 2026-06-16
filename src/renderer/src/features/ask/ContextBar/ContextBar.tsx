import { useState } from 'react';
import { AskContext } from '@shared/types/models';
import { getModelDisplayName } from '@shared/constants/modelOptions';
import { api } from '@renderer/services/api';
import ConfirmDialog from '@renderer/features/shared/ConfirmDialog/ConfirmDialog';
import styles from './ContextBar.module.css';

interface ContextBarProps {
  contexts: AskContext[];
  activeContextId: string | null;
  onSelectContext: (id: string) => void;
  onContextsChange: (updater: (prev: AskContext[]) => AskContext[]) => void;
  onCreateContext: () => void;
}

export default function ContextBar({
  contexts,
  activeContextId,
  onSelectContext,
  onContextsChange,
  onCreateContext
}: ContextBarProps) {
  const [editingContextId, setEditingContextId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingDeleteContext, setPendingDeleteContext] = useState<{ id: string; name: string } | null>(null);

  const startRename = (contextId: string, currentName: string) => {
    setEditingContextId(contextId);
    setEditingName(currentName);
  };

  const commitRename = async () => {
    if (!editingContextId || !editingName.trim()) {
      setEditingContextId(null);
      return;
    }
    try {
      await api.renameAskContext(editingContextId, editingName.trim());
      onContextsChange((prev) =>
        prev.map((c) => (c.id === editingContextId ? { ...c, name: editingName.trim() } : c))
      );
    } catch { /* noop */ }
    setEditingContextId(null);
  };

  const deleteContext = async (contextId: string) => {
    try {
      if (activeContextId === contextId) {
        try {
          await api.cancelAskMessage(contextId);
        } catch {
          // noop
        }
      }
      await api.deleteAskContext(contextId);
      onContextsChange((prev) => {
        const next = prev.filter((c) => c.id !== contextId);
        if (next.length === 0) {
          onSelectContext('');
          onCreateContext();
        } else if (activeContextId === contextId) {
          onSelectContext(next[0]?.id ?? '');
        }
        return next;
      });
    } catch { /* noop */ }
  };

  const confirmDeleteContext = async () => {
    if (!pendingDeleteContext) {
      return;
    }
    const contextId = pendingDeleteContext.id;
    setPendingDeleteContext(null);
    await deleteContext(contextId);
  };

  return (
    <div className={styles.askTabsBar}>
      <div className={`detail-subtabs ${styles.askContextTabs}`}>
        {contexts.map((ctx) => (
          <div
            key={ctx.id}
            className={`detail-subtab ${styles.askContextTab} ${activeContextId === ctx.id ? 'active' : ''}`}
          >
            {editingContextId === ctx.id ? (
              <input
                className={styles.askRenameInput}
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRename();
                  if (e.key === 'Escape') setEditingContextId(null);
                }}
                autoFocus
              />
            ) : (
              <button
                className={styles.askContextBtn}
                onClick={() => onSelectContext(ctx.id)}
                onDoubleClick={() => startRename(ctx.id, ctx.name)}
                title={`Double-click to rename · ${getModelDisplayName(ctx.modelName)}`}
              >
                {ctx.name}
              </button>
            )}
            <button
              className={styles.askCloseBtn}
              onClick={(e) => {
                e.stopPropagation();
                setPendingDeleteContext({ id: ctx.id, name: ctx.name });
              }}
              title="Close context"
              aria-label="Close context"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button className={`btn ${styles.askNewBtn}`} onClick={onCreateContext} title="New conversation">
          <i className="fa-solid fa-plus" aria-hidden="true" />
        </button>
      </div>
      <ConfirmDialog
        isOpen={Boolean(pendingDeleteContext)}
        title="Close chat"
        message={pendingDeleteContext ? `Close “${pendingDeleteContext.name}”? This action cannot be undone.` : ''}
        confirmLabel="Close"
        onConfirm={() => { void confirmDeleteContext(); }}
        onCancel={() => setPendingDeleteContext(null)}
      />
    </div>
  );
}
