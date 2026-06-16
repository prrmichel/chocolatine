# First-Run Setup

> Configure Azure DevOps organizations, PR sources, and app defaults so Chocolatine can connect to your projects.

## Overview

On first launch, Chocolatine detects that no Azure DevOps organizations or PR sources are configured and automatically opens the Settings modal. You must complete this step before you can load pull requests or run reviews.

This guide assumes a Windows 10/11 source-first setup. Linux and macOS support are roadmap targets and not available yet.

## How to Access

The Settings modal opens automatically on first launch. You can also open it at any time by clicking the **gear icon** in the title bar.

## Key Capabilities

### Azure DevOps Connection

- Add one or more **Organizations**, each with a name and **Personal Access Token (PAT)**.
- Create one or more **PR Sources** that link an organization to a project and, optionally, a specific repository.
- **Test** each organization's connection individually.

### Display Name

- Set **My display name** — this is used by the "Assigned to me" filter on the Pull Requests tab.

### Default Preferences

- Choose a **Default model** for reviews (can be overridden per review run).
- Set the **Max concurrent reviews** for the queue (default determines how many reviews run in parallel).
- Select a **Diff display mode** (inline or side-by-side).

## Walkthrough

1. Launch the app. The Settings modal opens automatically.
2. Go to the **Azure DevOps** tab.
3. Click **Add organization**. Enter your organization name and PAT, then click **Save**.
4. Click **Test** to verify the connection — a green success message confirms the link.
5. Click **Add PR source**. Give it a name, select the organization, enter the project, and optionally specify a repository. Click **Save**.
6. Enter your **display name** so "Assigned to me" filtering works.
7. Switch to the **Preferences** tab.
8. Select your preferred **Default model**.
9. Adjust **Max concurrent reviews** if needed.
10. Close the modal. The app loads your pull requests automatically.

## Tips & Best Practices

- Create a dedicated Azure DevOps PAT per organization with the minimum required scopes: **Code (Read)** and **Work Items (Read)**.
- If the connection test fails, verify the organization and project names match exactly — they are case-sensitive.
- You can add multiple organizations and PR sources to work across different Azure DevOps instances from a single app.
- You can change all settings later from the gear icon without restarting the app, though some changes (like database folder) take effect after restart.
- PAT storage behavior and protected-storage fallback policy are documented in [Persistence](../concepts/persistence.md).

## Related

- [Installation](installation.md) — Prerequisites and install steps.
- [Quick Start](quick-start.md) — Run your first review.
- [Azure DevOps Settings](../settings/azure-devops.md) — Detailed settings reference.
- [Preferences Settings](../settings/preferences.md) — Model, concurrency, and display options.
