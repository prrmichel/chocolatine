# Pull Requests

> The primary workspace for browsing, reviewing, and discussing Azure DevOps pull requests with AI assistance.

## Overview

The Pull Requests tab is the default view and the central hub of Chocolatine. It combines a filterable PR list on the left with a full-featured detail workspace on the right. From here you can load PRs from Azure DevOps, inspect code changes, run Copilot reviews, read human discussion threads, and hold follow-up conversations — all without leaving the screen.

The detail workspace is organized into six subtabs, each focused on a different aspect of the PR: Summary, Changes, Work Items, Reviews, Follow-up, and User Comments. The PR detail area now also supports richer collaboration workflows such as sending Copilot findings back to Azure DevOps as markdown comments and resolving or reactivating Azure DevOps threads directly inside the app.

## How to Access

The Pull Requests tab is selected by default when the app launches. You can also switch to it from any other tab by clicking **Pull Requests** in the main navigation.

## Key Capabilities

### PR List (Left Panel)

- **PR source selector** — When multiple PR sources are configured in [Azure DevOps Settings](../../settings/azure-devops.md), a dropdown appears at the top of the list letting you switch between sources. Switching reloads the PR list from the selected organization/project/repository.
- **Status filter** — Load PRs by status: Active, Completed, Abandoned, or All.
- **Text search** — Filter across PR id, title, author, status, draft flag, and target branch.
- **Author filter** — Filter by author using a generated list of available authors.
- **Assigned to me** — One-click filter based on the display name set in Settings.
- **Visual badges** — Draft status, non-default target branch, reviewer group, and reviewer vote state.
- **Review indicators** — Per-PR count of completed review runs and whether a review is currently queued or running.
- **Quick review** — Launch a review directly from the list using the default prompt and model.
- **Refresh** — Reload the PR list from Azure DevOps.
- **Pin/unpin** — Collapse the PR list to give more space to the detail panel.

### PR Detail Workspace (Right Panel)

When a PR is selected, the detail workspace loads with header actions and six subtabs.

#### Header Actions

- **Assign as reviewer** — Add yourself as a reviewer on the PR in Azure DevOps.
- **Open work item** — Open the first linked work item in Azure DevOps.
- **Reload details** — Refresh PR metadata, diffs, and threads.
- **Open in Azure DevOps** — Open the PR directly in your browser.

#### Subtabs

| Subtab | Purpose | Details |
|--------|---------|---------|
| **Summary** | PR metadata and review history overview | [Summary Tab](summary-tab.md) |
| **Changes** | Code diffs with inline AI and human comments, send-to-ADO, and thread actions | [Changes Tab](changes-tab.md) |
| **Work Items** | Linked work items and AI summaries | [Work Items Tab](work-items-tab.md) |
| **Reviews** | Run and inspect Copilot code reviews | [Reviews Tab](reviews-tab.md) |
| **Follow-up** | Persistent chat on review results | [Follow-up Tab](follow-up-tab.md) |
| **User Comments** | Azure DevOps discussion threads with read/resolve/reactivate actions | [User Comments Tab](user-comments-tab.md) |

## Walkthrough

1. Open the app — the Pull Requests tab is shown by default.
2. If you have multiple PR sources, select the desired source from the dropdown at the top of the list.
3. Use the status dropdown to select **Active** (or your preferred filter).
4. Optionally filter by author or use the search box.
5. Click a PR in the list to open its detail workspace.
6. Browse the subtabs: start with **Summary** for an overview, then move to **Reviews** to run a Copilot review.
7. After a review completes, explore **Changes** to see findings inline on the code.
8. Use **Follow-up** for deeper investigation on specific findings.

## Tips & Best Practices

- Pin the PR list (collapse it) when you're focused on a single PR — the detail workspace gets significantly more horizontal space.
- The quick review action on the PR list is the fastest way to get a first pass. You can then refine with the full Reviews tab.
- Use "Assigned to me" to quickly find PRs where you are a reviewer.
- Review indicators in the PR list help you track which PRs already have completed reviews without opening each one.

## Related

- [Azure DevOps Settings](../../settings/azure-devops.md) — Configure organizations and PR sources.
- [Quick Start](../getting-started/quick-start.md) — Your first review in 5 minutes.
- [Reviews Tab](reviews-tab.md) — Running and inspecting reviews.
- [Changes Tab](changes-tab.md) — Code diffs and inline comments.
- [Task Queue](../task-queue.md) — Monitoring review job progress.
