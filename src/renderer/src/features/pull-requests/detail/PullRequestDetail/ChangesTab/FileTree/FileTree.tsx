import { memo, useMemo } from 'react';
import { FileTreeNode, normalizePath } from '../../PullRequestDetail.helpers';
import { FileIcon, FolderIcon } from '@renderer/utils/fileIcons';
import styles from './FileTree.module.css';

interface FileTreeProps {
  nodes: FileTreeNode[];
  selectedPath: string | null;
  onSelectDiff: (path: string) => void;
  commentCounts?: Map<string, number>;
}

export default memo(function FileTree({ nodes, selectedPath, onSelectDiff, commentCounts }: FileTreeProps) {
  return <TreeLevel nodes={nodes} selectedPath={selectedPath} onSelectDiff={onSelectDiff} depth={0} commentCounts={commentCounts} />;
});

/** Small VS Code-style SCM badge: A / M / D / R */
const CHANGE_BADGE: Record<string, { label: string; cls: string }> = {
  add:    { label: 'A', cls: styles.changeBadgeAdd },
  edit:   { label: 'M', cls: styles.changeBadgeEdit },
  delete: { label: 'D', cls: styles.changeBadgeDelete },
  rename: { label: 'R', cls: styles.changeBadgeRename },
};

const TreeLevel = memo(function TreeLevel({
  nodes,
  selectedPath,
  onSelectDiff,
  depth,
  commentCounts
}: {
  nodes: FileTreeNode[];
  selectedPath: string | null;
  onSelectDiff: (path: string) => void;
  depth: number;
  commentCounts?: Map<string, number>;
}) {
  const normalizedSelected = useMemo(() => normalizePath(selectedPath ?? ''), [selectedPath]);

  return (
    <ul className={`${styles.tree} ${depth === 0 ? styles.treeRoot : ''}`}>
      {nodes.map((node) => {
        const isFolder = node.children.length > 0 && !node.diff;
        if (isFolder) {
          return (
            <li key={node.path} className={styles.treeNode}>
              <div className={styles.treeLabel}>
                <FolderIcon size={15} />
                <span>{node.name}</span>
              </div>
              <TreeLevel
                nodes={node.children}
                selectedPath={selectedPath}
                onSelectDiff={onSelectDiff}
                depth={depth + 1}
                commentCounts={commentCounts}
              />
            </li>
          );
        }

        const nodePath = normalizePath(node.diff?.path ?? node.path);
        const isSelected = normalizedSelected === nodePath;
        const changeType = (node.diff?.changeType ?? '').toLowerCase();
        const isDeleted = changeType === 'delete';
        const count = commentCounts?.get(nodePath) ?? 0;
        const badge = CHANGE_BADGE[changeType];

        return (
          <li key={node.path} className={styles.treeNode}>
            <button
              className={`${styles.treeFile} ${isSelected ? styles.treeFileSelected : ''} ${isDeleted ? styles.treeFileDeleted : ''}`}
              onClick={() => onSelectDiff(node.diff?.path ?? node.path)}
              title={node.diff?.changeType ? `${node.diff.changeType}: ${node.name}` : node.name}
            >
              <FileIcon name={node.name} size={15} />
              <span className={`${styles.treeFileName} ${isDeleted ? styles.treeFileNameDeleted : ''}`}>
                {node.name}
              </span>
              <span className={styles.treeFileBadges}>
                {badge && (
                  <span className={badge.cls} title={node.diff?.changeType ?? ''}>
                    {isDeleted ? '−' : badge.label === 'A' ? '+' : badge.label}
                  </span>
                )}
                {count > 0 && (
                  <span className={styles.treeFileCommentCount} title={`${count} comment${count > 1 ? 's' : ''}`}>
                    <i className="fa-solid fa-comment" aria-hidden="true" /> {count}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
});
