# Data Management Settings

> Manage the database location, purge old data, and clean up persisted reviews.

## Overview

The Data Management tab in the Settings modal controls where the app stores its data and provides tools to clean up old or unwanted records. All persistent data (reviews, conversations, prompts, rules) is stored in a local SQLite database.

## How to Access

1. Click the **gear icon** in the application title bar.
2. Switch to the **Data** tab.

## Key Capabilities

### Database Location

| Setting | Description |
|---------|-------------|
| **Database folder** | Choose where the SQLite database (`app.db`) is stored. By default, it lives in the Electron userData folder (`C:\Users\<you>\AppData\Roaming\Chocolatine\`). Use the folder picker to relocate it. |

### Data Purge

| Action | Description |
|--------|-------------|
| **Purge old data** | Delete review jobs, follow-up conversations, and other stored data older than a selected age threshold. |

### Review Cleanup

| Action | Description |
|--------|-------------|
| **Delete all persisted reviews** | Remove all stored review jobs from the database. |
| **Delete reviews for completed PRs** | Remove stored reviews only for PRs that are no longer active in Azure DevOps. |

## Walkthrough

1. Open the Settings modal (gear icon).
2. Switch to the **Data** tab.
3. To move the database, click the **folder picker** and select a new location. The app moves the database file and restarts from the new location.
4. To clean up old data, select an age threshold and click **Purge**.
5. To clear all reviews, click **Delete all persisted reviews** (with confirmation).

## Tips & Best Practices

- Relocating the database to a synced folder (e.g., OneDrive) is not recommended — SQLite does not handle concurrent access from multiple instances well.
- Periodic purging keeps the database small and the app responsive, especially if you review many PRs.
- Deleting reviews for completed PRs is a safe cleanup — those PRs are already merged or abandoned.
- The database also stores prompt templates and rules. Purge operations do **not** affect prompts or rules — only review jobs and conversations.

## Related

- [Azure DevOps Settings](azure-devops.md) — Connection configuration.
- [Preferences Settings](preferences.md) — Model and display options.
- [Persistence](../concepts/persistence.md) — What is stored and how.
