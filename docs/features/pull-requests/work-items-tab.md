# Work Items Tab

> View linked Azure DevOps work items and generate AI-powered change summaries.

## Overview

The Work Items tab displays all Azure DevOps work items linked to the current pull request. Beyond just viewing them, you can generate AI summaries that describe what changes were made in the context of each work item's requirements. This is a separate task type from code reviews, with its own prompt category and session strategy.

## How to Access

1. Open the **Pull Requests** tab and select a PR.
2. Click the **Work Items** subtab.

## Key Capabilities

### Work Item Display

- Each linked work item appears as an **expandable card**.
- Fields shown: title, description, acceptance criteria, reproduction steps / newsletter description, and comments.
- **Open in Azure DevOps** — Direct link to the work item in your browser.

### AI Change Summaries

- Generate a **work-item changes summary** using a selectable model.
- Use a dedicated prompt template from the **Work Item changes summary** category (managed in [Prompt Library](../prompt-library.md)).
- **Prompt required** — Summary generation is disabled until at least one Work Item changes summary prompt exists.
- Add **custom per-run instructions** tailored to the specific work item.
- View a **history** of generated summaries.
- Inspect the **exact executed prompt** for any summary generation.
- Delete individual summary generations.

### Progress Tracking

- See progress indicators for queued or running summary generations.

## Walkthrough

1. Open a PR and navigate to the **Work Items** tab.
2. Expand a work item card to read its details.
3. Select a model and optionally write custom instructions (create a Work Item changes summary prompt in Prompt Library first if needed).
4. Click **Generate Summary** to start an AI summary of the changes relative to this work item.
5. Once complete, the summary appears below the work item. Inspect the prompt used if needed.
6. Generate additional summaries with different models or instructions to compare results.

## Tips & Best Practices

- Work-item summaries use **isolated sessions** — each generation starts fresh without prior context. This is intentional so that summaries are self-contained.
- Create a dedicated prompt template in the Prompt Library for work-item summaries. You can insert the starter template, then customize it.
- Custom instructions let you focus the summary on specific aspects (e.g., "Focus on security implications" or "Describe only the API changes").

## Related

- [Pull Requests Overview](overview.md) — PR list and detail workspace.
- [Prompt Library](../prompt-library.md) — Manage prompt templates including work-item summary prompts.
- [Session Management](../../concepts/session-management.md) — Why work-item summaries use isolated sessions.
