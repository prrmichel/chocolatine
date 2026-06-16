# Quick Start

> Run your first AI-powered code review in under 5 minutes.

## Overview

This guide walks you through the fastest path from opening the app to reading your first Copilot review findings. It assumes you have already completed [First-Run Setup](first-run-setup.md).

## How to Access

Open the app. The **Pull Requests** tab is selected by default.

## Walkthrough

1. **Load pull requests** — The left panel shows PRs from your active PR source. If you have multiple PR sources, use the dropdown at the top of the list to switch between them. Use the status filter (Active, Completed, Abandoned, All) to narrow the list.

2. **Select a PR** — Click a pull request to open its detail workspace on the right.

3. **Go to the Reviews tab** — Click the **Reviews** subtab in the PR detail area.

4. **Choose a prompt** — Select a prompt template from the **PR Review** category dropdown. If you haven't created any prompts yet, go to the [Prompt Library](../features/prompt-library.md) first to add one.

5. **Choose a model** — Pick a model from the dropdown, or leave it on the default.

6. **Start the review** — Click **Run Review**. The job is enqueued and starts processing. You can track progress in the [Task Queue](../features/task-queue.md).

7. **Read the findings** — Once the review completes, findings appear grouped by severity. Click any finding to navigate to the relevant file and line in the **Changes** tab.

8. **Explore the diffs** — Switch to the **Changes** tab to see code diffs with AI review comments overlaid inline on the relevant lines.

9. **Ask follow-up questions** — If a finding needs deeper investigation, open the **Follow-up** tab for that review run and start a conversation.

## Quick Review Shortcut

You can also trigger a **quick review** directly from the PR list without opening the detail workspace:

- Hover over a PR in the list and click the **quick review** action button.
- This uses the default prompt and the currently selected (or default) model.

## Tips & Best Practices

- Start with **Auto** as default, then pin a concrete model only when you need reproducibility.
- Define [Rules](../features/rules-library.md) for your codebase languages early — they are automatically injected into every review prompt and significantly improve finding quality.
- Use the severity filter on the Reviews tab to focus on critical findings first.
- The **Summary** tab gives you a quick overview of all review runs with finding counts per severity.

## Related

- [Pull Requests Overview](../features/pull-requests/overview.md) — Full Pull Requests feature documentation.
- [Reviews Tab](../features/pull-requests/reviews-tab.md) — Detailed review capabilities.
- [Prompt Library](../features/prompt-library.md) — Manage prompt templates.
- [Supported Models](../reference/supported-models.md) — Runtime model-catalog behavior.
