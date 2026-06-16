# User Comments Tab

> Isolated view of Azure DevOps PR discussion threads for focused human comment review.

## Overview

The User Comments tab provides a dedicated space to browse and manage Azure DevOps discussion threads attached to the pull request. While the Changes tab overlays these threads inline on the code, this tab presents them as a standalone searchable list. It is useful when you want to focus solely on human discussion rather than AI output.

## How to Access

1. Open the **Pull Requests** tab and select a PR.
2. Click the **User Comments** subtab.

## Key Capabilities

### Search & Filter

- Search threads by **file path**, **line number**, **status**, **author**, and **text content**.
- Sort threads by **latest activity**.

### Read/Unread Tracking

- **Bulk mark** all visible threads as read or unread.
- Mark **individual threads** as read or unread.

### Navigation

- Click a thread to navigate to the relevant **file and line** in the Changes view.

## Walkthrough

1. Open a PR and go to the **User Comments** tab.
2. Browse the list of discussion threads.
3. Use the search box to filter by file, author, or text.
4. Mark threads as read as you process them.
5. Click a thread to jump to the relevant code in the Changes view for context.

## Tips & Best Practices

- Use this tab when you want to triage human discussion separately from AI findings. The Changes tab combines both, which can be overwhelming on heavily discussed PRs.
- Sort by latest activity to catch recently updated threads first.
- The read/unread state is persisted locally, so your triage progress is preserved across sessions.

## Related

- [Pull Requests Overview](overview.md) — PR list and detail workspace.
- [Changes Tab](changes-tab.md) — View threads inline on the code.
