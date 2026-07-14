# Reviews Tab

> The command center for running, inspecting, and managing Copilot code reviews.

## Overview

The Reviews tab is where you launch AI code reviews and explore the results. You select a prompt template and model, start the review, and then inspect the parsed findings organized by severity. Each run's metadata, raw output, usage diagnostics, and exact prompt are available for inspection. This is the core of Chocolatine's value.

## How to Access

1. Open the **Pull Requests** tab and select a PR.
2. Click the **Reviews** subtab.

## Key Capabilities

### Running Reviews

- **Select a prompt** — Choose from the PR Review category in the Prompt Library.
- **Prompt required** — Review launch is disabled until at least one PR Review prompt exists.
- **Select a model** — Pick any supported model or leave the default. The modal shows a side metadata panel for the selected model from SDK `ModelInfo` (policy, capabilities, limits, reasoning support, billing multiplier). BYOK models (configured in [AI Providers](../../settings/ai-providers.md)) appear with a distinct badge and no cost multiplier.
- **Standard review launch** — The normal review path prepares or refreshes the PR worktree when you click **Run Review**, then runs a branch-aware review against that PR-scoped checkout. This path requires a configured **review worktree root folder** in [Preferences](../../settings/preferences.md).
- **Custom instructions** — Add per-run instructions that are appended to the prompt.
- **Exclude file types** — Specify file extensions to exclude from the review (e.g., `*.md; *.json`). Matching files are removed from the branch-aware change-boundary block and from any diff-text fallback payload, keeping reviews focused on the code that matters.
- **Visible preparation phase** — Review launch shows branch-context preparation as part of the same run instead of a separate prerequisite task.
- **Automatic diff-only fallback** — After the review worktree root folder is configured, branch-context preparation failures still fall back to the existing diff-only path and record the fallback reason in run metadata.
- **Manual diff-only override** — Review Options keeps a secondary advanced control for intentionally skipping branch-context preparation. When the review worktree root folder is missing, the modal blocks standard branch-aware launch but still allows this explicit override.
- **Run Review** — Start a single review with the chosen prompt and model.

### Inspecting Results

- Findings are grouped by **severity** (critical, high, medium, low, info).
- **Filter by severity** — Show only findings of a specific severity level.
- **Mark read/unread** — Track which findings you've triaged, individually or in bulk.
- Each run shows metadata: model, status, date, batch label, finding count, and whether the run executed in branch-aware or diff-only mode.
- **Collapse/expand** individual review runs.
- **Copy raw response** — Copy the full model output to the clipboard.
- **Inspect prompt** — View the exact prompt that was sent to the model, including injected rules.
- **Navigate to code** — Click a finding to jump to the relevant file and line in the Changes or User Comments view.

### Copying & Exporting Comments

- **Copy comment as markdown** — Accent-colored button at the right of each comment header.
Copies the full comment (metadata, message, evidence, suggestion, solution) as formatted markdown.
- **Copy individual fields** — Each field (message, solution, suggestion, evidence) has its own copy button.
Hidden when the field is empty.
Both header and field buttons show a checkmark + "Copied!" tooltip for 2 seconds after copying.

#### Exporting Multiple Comments

Open the **export modal** from the run header's export button to copy several comments at once.

- **Selection** — All comments are pre-selected.
Click a card or its checkbox to toggle selection.
Selected cards show a blue left-border accent.
- **Toolbar** — **Select all**, **Deselect all**, and per-severity quick-select buttons (e.g., click the "Warning" badge to select only warnings).
A "X selected" counter tracks the current selection.
- **Run summary** — The review run's overall summary is displayed above the comment list and included in the exported markdown.
- **Copy action** — The footer shows **Copy selected as markdown** (hidden when nothing is selected).
Exported text includes the run header, summary, severity counts, and all selected comments separated by `---`.

### Managing Runs

- **Show all runs** or isolate a specific run.
- **Delete a single run** or delete all runs for the current PR.
- **Open follow-up** — Start a follow-up conversation for a specific run. Branch-aware runs reuse the same review workspace when available.
- **Re-review** — Re-queue a completed review. The previous results are saved to history, and the session is reused so the model can build on prior analysis with the same branch-aware context when available.

## Walkthrough

1. Open a PR and navigate to the **Reviews** tab.
2. Select a prompt template from the **PR Review** dropdown (create one in Prompt Library first if needed).
3. Pick a model (or keep the default).
4. Optionally type custom instructions.
5. Optionally enter file extensions to exclude (e.g., `*.md; *.json`).
6. Click **Run Review**. If the review worktree root folder is configured, Chocolatine prepares or refreshes branch context as part of the same run, then starts the review. If the folder is missing, the modal asks you to configure Preferences or switch this run to diff-only mode. The job appears in the [Task Queue](../task-queue.md).
7. Once complete, findings appear on screen. Use severity filters to focus.
8. If the run fell back to diff-only mode, refresh branch context and rerun the review to retry branch-aware execution.
9. Click a finding to see the relevant code in the **Changes** tab.
10. Click **Follow-up** on a run to ask deeper questions about the findings.

## Tips & Best Practices

- Inspect the generated prompt at least once to understand what the model receives — branch-aware runs now inject prompt template, custom instructions, PR context, and a PR change-boundary block; diff-only and fallback runs still include diff text.
- Review run metadata now includes token-first **review usage diagnostics** when the SDK emits usage signals.
- Use the **Branch context** panel as status/refresh/diagnostics for the selected PR. Normal review launch prepares branch context automatically; the panel is no longer a prerequisite step, but it now shows a direct **Open Settings** shortcut when the review worktree root folder is missing.
- If a run falls back to diff-only mode, the result view calls that out explicitly and tells you to refresh branch context and rerun the review.
- Branch-aware follow-up and re-review work best when you keep using the same prepared PR context and refresh it after new commits are pushed to the source branch.
- The re-review feature reuses the Copilot session, so the model remembers its prior analysis. Use it to iterate: run once, check findings, add custom instructions, re-review.
- Define [Rules](../rules-library.md) for your codebase languages — they are automatically injected and improve finding quality significantly.
- BYOK models (configured in [AI Providers](../../settings/ai-providers.md)) are first-class options for reviews. Switching between Copilot and BYOK models for the same PR starts a fresh session.
- Use the **Exclude file types** field to skip auto-generated, configuration, or documentation files that add noise to review results.

## Related

- [Pull Requests Overview](overview.md) — PR list and detail workspace.
- [Changes Tab](changes-tab.md) — View findings inline on the code.
- [Follow-up Tab](follow-up-tab.md) — Ask questions about a review run.
- [Prompt Library](../prompt-library.md) — Manage review prompt templates.
- [Rules Library](../rules-library.md) — Define rules auto-injected into prompts.
- [Task Queue](../task-queue.md) — Monitor in-progress review jobs.
- [Review Execution](../../concepts/review-execution.md) — Queue mechanics and chunking.
- [Rules Injection](../../concepts/rules-injection.md) — How rules end up in the prompt.
