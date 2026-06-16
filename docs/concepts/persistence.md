# Persistence

> What is stored, where, how external data flows work, and how PAT storage is handled.

## Overview

Chocolatine stores persistent data locally using two mechanisms: a JSON settings file for app configuration and a SQLite database for application data. This local-first model keeps review history, rules, prompts, and conversations on your machine.

## Storage Locations

| Data | Storage | Default Path |
|------|---------|--------------|
| **App settings** | JSON file | `C:\Users\<you>\AppData\Roaming\Chocolatine\config\settings.json` |
| **Database** | SQLite (`app.db`) | `C:\Users\<you>\AppData\Roaming\Chocolatine\` (relocatable in [Data Management](../settings/data-management.md)) |

## What Is Stored in the Database

| Data Category | Examples |
|---------------|----------|
| **Review jobs** | Completed and failed review outputs, model metadata, timestamps, attempt history. |
| **Follow-up contexts** | Conversation history for follow-up chats attached to review runs. |
| **Ask contexts** | Message history for general Copilot chat conversations. |
| **Prompt templates** | PR Review and Work Item summary prompts, with defaults per category. |
| **Rules library** | Languages (name + glob filters) and their associated rules (code, description, active state). |
| **Work-item summary instructions** | Custom instructions saved per work-item summary flow. |
| **Copilot session mappings** | Context ID → session ID associations for reconnecting to persisted Copilot sessions. |
| **UI preferences** | Collapsed states, panel dimensions, and other local UI state. |

## What Is Stored in Settings

| Setting | Examples |
|---------|----------|
| **Azure DevOps** | Legacy organization, project, PAT fields (kept for backward compatibility). |
| **Organizations** | List of Azure DevOps organizations, each with a name and PAT. |
| **PR Sources** | List of PR sources linking an organization to a project and optional repository filter. |
| **Active PR Source** | The currently selected PR source ID. |
| **Preferences** | Default model, max concurrent reviews, diff mode, display name. |
| **Panel colors** | PR list, file tree, follow-up panel background colors. |

## External Data Flows

Chocolatine is local-first, but some features require external API calls.

| Destination | What is sent | Why |
|-------------|--------------|-----|
| **Azure DevOps REST API** | Organization/project/repository identifiers, PAT (for auth), PR/work-item request parameters. | Load pull requests, file changes, comments, and linked work items. |
| **GitHub Copilot** | Prompt templates, selected review context, diffs/chunks, and follow-up/Ask chat content. | Generate AI-assisted reviews, summaries, and chat responses. |

Chocolatine does **not** sync your local SQLite database to a cloud backend.

## PAT Handling Contract

This section is the canonical home for the protected PAT storage decision.

### Current behavior

- PATs are stored in the local settings file.
- When OS-backed protection is available, PAT values are encrypted before being written.
- If encryption is unavailable, current runtime behavior may persist plaintext PAT values locally.

### Decision baseline for hardening (#10)

The protected-storage fallback contract has been defined as **fail-closed on save**:

- PAT persistence must not silently downgrade to plaintext.
- If protected storage is unavailable, the app must show an explicit, user-understandable error and avoid saving PAT secrets in plaintext.
- Secret-bearing saves are scoped to Azure DevOps organization writes that create or change PAT material. If secure storage is unavailable, the app leaves those writes unsaved instead of storing organization metadata without its PAT.
- PR source edits that depend on a failed organization edit are rejected in the same save attempt, while unrelated non-sensitive settings may still save.
- Metadata-only organization renames remain allowed when the stored PAT is unchanged, and deleting an organization remains allowed because it removes credential material instead of weakening it.
- The app does not offer a session-only PAT fallback when protected storage is unavailable.
- A successful connection test does not override the secure-storage requirement for save.
- If a stored protected PAT later cannot be decrypted, Azure DevOps actions that require a PAT fail explicitly and direct the user back to Settings.
- This decision is implemented in follow-up hardening work (#22).


## Migrations

The database uses a schema version number (currently v6). When the app starts:

1. It checks the current database schema version.
2. If the version is older, it runs migrations sequentially to bring the schema up to date.
3. A one-time migration also handles converting legacy file-based storage (from earlier app versions) to the database.

Migrations are automatic and transparent. You don't need to take any action.

> **Note:** When upgrading from a single-organization configuration to the multi-organization model, the app automatically migrates existing Azure DevOps settings into the new `organizations` and `prSources` structures on first launch.

## Related

- [Data Management Settings](../settings/data-management.md) — Relocate database and purge data.
- [Session Management](session-management.md) — How session mappings are stored.
- [Rules Library](../features/rules-library.md) — Rules stored in the database.
- [Prompt Library](../features/prompt-library.md) — Prompts stored in the database.
