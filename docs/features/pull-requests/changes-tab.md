# Changes Tab

> Browse code diffs with inline AI review comments and Azure DevOps discussion threads overlaid on the relevant lines.

## Overview

The Changes tab is the most feature-dense part of the app. It combines a file tree, code diffs, Copilot review findings, and human discussion threads into a single workspace. The goal is to let you reconcile AI findings, human comments, and raw code changes without leaving the screen.

## How to Access

1. Open the **Pull Requests** tab and select a PR.
2. Click the **Changes** subtab.

## Key Capabilities

### File Tree

- Built automatically from the PR diff.
- Search/filter files by name.
- Resize or collapse the file tree panel via drag handle.

### Code Diffs

- **Inline** and **side-by-side** display modes (configurable in [Preferences](../../settings/preferences.md)).
- Select a file in the tree to view its diff.
- Fetch and display **full-file diffs** on demand for additional context.

### AI Review Comments (Overlay)

- Copilot review comments are overlaid inline on matching changed lines.
- **Fallback placement** — When a finding maps to a line not visible in the diff, a synthetic line is inserted.
- **File-level comments** — Findings that don't map to a specific line appear at the top of the file.
- **Filter by review run** — Show or hide comments from specific review runs.
- **Hide all review runs** — Temporarily remove all AI comments from the view.

### Azure DevOps Threads (Overlay)

- User discussion threads from Azure DevOps are displayed inline alongside AI comments.
- Toggle visibility of user comments independently from AI comments.

### Comment Management

- Track **read/unread** state for Copilot comments.
- Track **favorite** state for Copilot comments.
- Track **read/unread** state for Azure DevOps user threads.
- **Bulk mark** visible comments as read or unread.
- Toggle visibility of read vs. unread Copilot comments.

### Follow-up Integration

- Select code in the diff and start a **follow-up question** about that selection.
- Open the follow-up chat panel from a specific review run directly within the Changes view.

## Walkthrough

1. Open a PR and navigate to the **Changes** tab.
2. Browse the file tree on the left. Click a file to view its diff.
3. If review runs have been completed, AI comments appear inline on the changed lines.
4. Hover over a comment to see actions: mark read, mark favorite.
5. Use the comment filter at the top to show only a specific review run.
6. To investigate a finding further, select the relevant code and click the follow-up action to start a conversation.

## Tips & Best Practices

- Collapse the file tree when focusing on a single file — the diff view gets more horizontal space.
- Use the **read/unread** tracking to keep track of which findings you've already reviewed. Bulk-mark as read once you've triaged a file.
- Side-by-side mode is better for large files, while inline mode works well for small targeted changes.
- The "full-file diff" option is useful when AI comments reference code outside the visible changed lines.

## Related

- [Pull Requests Overview](overview.md) — PR list and detail workspace.
- [Reviews Tab](reviews-tab.md) — Run reviews that populate the inline comments.
- [Follow-up Tab](follow-up-tab.md) — Continue investigation of findings.
- [User Comments Tab](user-comments-tab.md) — Focused view of Azure DevOps threads.
- [Preferences Settings](../../settings/preferences.md) — Diff display mode.
