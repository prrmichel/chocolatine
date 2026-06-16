# Preferences Settings

> Configure the default AI model, review worktree root folder, diff display mode, queue concurrency, and panel colors.

## Overview

The Preferences tab in the Settings modal controls the app's general behavior and appearance. These settings affect how reviews are processed, where branch-aware review worktrees are prepared, how code diffs are displayed, and the visual styling of certain panels.

## How to Access

1. Click the **gear icon** in the application title bar.
2. Switch to the **Preferences** tab.

## Key Capabilities

### AI Model

| Setting | Description |
|---------|-------------|
| **Default model** | The model pre-selected for new reviews and chats. Can be overridden per review run. **Auto** is the safe default. A metadata panel next to the picker shows key SDK `ModelInfo` fields (policy, capabilities, limits, reasoning support, billing multiplier). See [Supported Models](../reference/supported-models.md) for model-catalog behavior. |
| **Review worktree root folder** | Required for the standard branch-aware review path. Chocolatine creates its managed `mirrors/` and `worktrees/` folders under this root. Pick a short local path on Windows to reduce `Filename too long` failures during git worktree preparation. |

### Review Queue

| Setting | Description |
|---------|-------------|
| **Max concurrent reviews** | How many review jobs run in parallel. Higher values process queues faster but consume more API capacity. |

### Display

| Setting | Description |
|---------|-------------|
| **Diff display mode** | Choose between **inline** (unified) and **side-by-side** (split) diff views in the Changes tab. |

### Panel Colors

- **PR list background** — Background color for the pull request list panel.
- **File tree background** — Background color for the file tree panel in the Changes tab.
- **Follow-up panel background** — Background color for the follow-up chat panel.
- All colors have **live preview** — changes are reflected immediately in the UI.

## Walkthrough

1. Open the Settings modal (gear icon).
2. Switch to the **Preferences** tab.
3. Select your preferred **default model** from the dropdown.
4. Set the **review worktree root folder**. Standard branch-aware reviews stay blocked until this is configured, but you can still use the explicit diff-only override for individual runs.
5. Adjust **max concurrent reviews** based on your needs (start with 2-3).
6. Choose your preferred **diff display mode**.
7. Optionally customize **panel colors** — the preview updates in real time.
8. Close the modal. Changes take effect immediately.

## Tips & Best Practices

- Keep **Auto** as your default unless you intentionally need a concrete model.
- On Windows, prefer a short local root such as `C:\reviews` or `D:\cr` for the review worktree root folder. Deep repository paths plus nested worktrees can exceed the default path-length limit.
- Higher concurrency processes queued reviews faster but may cause rate limiting on the Copilot API.
- Side-by-side diff mode requires more horizontal space — best on wide monitors.
- Panel colors are cosmetic and do not affect functionality. Use them to visually distinguish different workspace areas.

## Related

- [Azure DevOps Settings](azure-devops.md) — Connection configuration.
- [Data Management Settings](data-management.md) — Database and cleanup.
- [Supported Models](../reference/supported-models.md) — SDK-driven model-catalog behavior.
- [Changes Tab](../features/pull-requests/changes-tab.md) — Where diff display mode is applied.
- [Task Queue](../features/task-queue.md) — Where concurrency settings take effect.
