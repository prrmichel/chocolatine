# Azure DevOps Settings

> Configure Azure DevOps organizations, PR sources, and display name.

## Overview

The Azure DevOps settings tab is the first tab in the Settings modal. It lets you connect Chocolatine to one or more Azure DevOps organizations and define **PR sources** — combinations of organization, project, and optional repository — that determine which pull requests are loaded. Without at least one organization and one PR source, the app cannot load pull requests or fetch work items.

On first launch, the Settings modal opens automatically if no organizations or PR sources are configured.

> **Note:** If you are upgrading from a previous version that used a single organization/project configuration, Chocolatine automatically migrates your existing settings into the new multi-organization structure on first launch.

## How to Access

1. Click the **gear icon** in the application title bar.
2. The **Azure DevOps** tab is selected by default.

## Key Capabilities

### Organizations

Organizations represent your Azure DevOps instances. Each organization has a name and a Personal Access Token (PAT).

| Field | Description | Required |
|-------|-------------|----------|
| **Organization name** | Your Azure DevOps organization name (e.g., `my-company`). | Yes |
| **Personal Access Token (PAT)** | An Azure DevOps PAT with appropriate permissions. | Yes |

- **Add organization** — Register a new Azure DevOps organization with its PAT.
- **Edit** — Update the organization name or replace its PAT. Leave the PAT field blank to keep the stored PAT unchanged.
- **Delete** — Remove an organization. If PR sources still depend on it, the app asks for confirmation and deletes those PR sources in the same save.
- **Test** — Verify the connection to the organization. Existing organizations can be tested with their stored PAT even if you do not re-enter it.
- **Create a token** link — When editing, a direct link to the Azure DevOps token page is shown for the entered organization.

### PR Sources

PR sources define where pull requests are fetched from. Each source is linked to an organization and specifies a project and an optional repository filter.

| Field | Description | Required |
|-------|-------------|----------|
| **Name** | A friendly label for the PR source (e.g., `MyOrg/MyProject`). | Yes |
| **Organization** | The parent organization (selected from the list above). | Yes |
| **Project** | The Azure DevOps project to query for PRs. | Yes |
| **Repository** | Restrict PR loading to a specific repository within the project. | No |

- **Add PR source** — Create a new PR source linked to an existing organization.
- **Edit** — Update the source name, linked organization, project, or repository filter.
- **Delete** — Remove a PR source.

When multiple PR sources are configured, a **dropdown selector** appears at the top of the Pull Requests list, allowing you to switch between sources on the fly. Switching reloads the PR list from the newly selected source.

### Display Name

- **My display name** — Used by the "Assigned to me" filter on the Pull Requests tab. Set this to your Azure DevOps display name so filtering works correctly.

## Walkthrough

1. Open the Settings modal (gear icon).
2. In the **Organizations** section, click **Add organization**.
3. Enter your **Organization name**.
4. Click the **Create a token** link to open the Azure DevOps token page, then generate a PAT with at minimum **Code (Read)** and **Work Items (Read)** scopes.
5. Paste the PAT and click **Save**.
6. Click **Test** to verify the connection — a green success message confirms the link.
7. In the **PR Sources** section, click **Add PR source**.
8. Enter a **Name**, select the **Organization**, and enter the **Project**.
9. Optionally enter a **Repository** name to narrow the PR list to a single repo.
10. Click **Save**.
11. Enter your **display name** exactly as it appears in Azure DevOps.
12. Close the modal.

> **Note:** The Azure DevOps REST API version is hardcoded to `7.1` and is not configurable from the UI.

## Tips & Best Practices

- Create a dedicated PAT per organization with the minimum required scopes rather than using a full-access token.
- Organization and project names are case-sensitive — match them exactly.
- If the connection test fails, check for typos and verify that the PAT has not expired.
- PAT-bearing saves fail closed. If protected storage is unavailable, the app keeps the modal open, saves non-secret changes it safely can, and shows which Azure DevOps entries still need attention.
- PATs are stored locally in the app's settings file and are protected with OS-backed encryption when available.
- PATs are not transmitted anywhere other than to the Azure DevOps REST API.
- The protected-storage fallback contract is documented in [Persistence](../concepts/persistence.md).
- Use the **repository filter** on a PR source when your project contains many repositories and you only work on one — this significantly reduces noise in the PR list.
- Deleting an organization also removes any dependent PR sources after explicit confirmation.
- When you have a single PR source, the source selector is hidden to keep the UI clean.

## Related

- [First-Run Setup](../getting-started/first-run-setup.md) — Initial configuration walkthrough.
- [Pull Requests Overview](../features/pull-requests/overview.md) — Where the connection is used.
- [Preferences Settings](preferences.md) — Model, concurrency, and display options.
- [Data Management Settings](data-management.md) — Database and cleanup options.
- [Persistence](../concepts/persistence.md) — How organizations and PR sources are stored.
