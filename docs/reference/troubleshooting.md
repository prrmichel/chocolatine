# Troubleshooting

> Common issues and solutions.

## Overview

This page covers the most frequently encountered problems and how to resolve them.

## Issues

### No PRs Load After Launch

**Symptoms**: The Pull Requests list is empty or shows an error.

**Solutions**:
1. Open Settings (gear icon) → **Azure DevOps** tab.
2. Verify that at least one **organization** is configured and its **PAT** is valid.
3. Verify that at least one **PR source** exists with the correct project (and optional repository).
4. Click **Test** on the organization to confirm the connection.
5. If you have multiple PR sources, check that the correct one is selected in the PR source dropdown above the PR list.
6. Ensure the PAT has at least **Code (Read)** and **Work Items (Read)** scopes.

### Reviews Never Complete

**Symptoms**: Review jobs stay in "running" state indefinitely.

**Solutions**:
1. Check the [Task Queue](../features/task-queue.md) for error indicators.
2. Verify your GitHub Copilot subscription is active.
3. Try canceling the stuck job and re-queuing with a different model.
4. Restart the app — some transient Copilot session issues resolve on restart.

### Settings Don't Take Effect

**Symptoms**: Changed settings don't seem to apply.

**Solutions**:
1. Close and reopen the Settings modal to confirm changes were saved.
2. Restart the app — some settings (like database folder) require a restart.
3. Check the settings file directly at `C:\Users\<you>\AppData\Roaming\Chocolatine\config\settings.json`.

### Review Findings Don't Appear Inline

**Symptoms**: Reviews complete successfully but no comments show on the Changes tab.

**Solutions**:
1. Make sure review comment visibility is not filtered out — check the comment filter at the top of the Changes tab.
2. Verify you haven't hidden all review runs.
3. Some findings may be file-level comments that appear at the top of the file rather than on specific lines.

### Speech Recognition Not Working

**Symptoms**: The microphone button doesn't respond or shows an error in the Ask tab.

**Solutions**:
1. Speech recognition uses the Web Speech API, which requires a Chromium-based environment (Electron qualifies).
2. Ensure your microphone is connected and has OS-level permission.
3. Check Windows privacy settings: **Settings → Privacy → Microphone** must be enabled for the app.

### BYOK Provider Test Connection Fails

**Symptoms**: The **Test Connection** button in AI Providers settings returns an error.

**Solutions**:
1. Verify the API key is correct and has not expired or been revoked.
2. Check the endpoint URL — it should be the base URL (e.g., `https://api.deepseek.com`), not the models endpoint directly.
3. Ensure your network allows outbound HTTPS connections to the provider's domain.
4. Try saving again and re-testing — the key may not have been stored properly if protected storage was unavailable.

### DeepSeek Models Don't Appear in the Model Selector

**Symptoms**: The model dropdown only shows Copilot models even though a BYOK provider is configured.

**Solutions**:
1. Open Settings → **AI Providers** and verify the provider is saved and the API key is stored (look for the masked key field).
2. Run **Test Connection** to confirm the API key is valid.
3. Check that model discovery succeeded — the hardcoded fallback models (`deepseek-chat` and `deepseek-reasoner`) should always appear. If they don't, the provider may not be properly saved.
4. Close and reopen the Settings modal, then check the model selector again — the catalog refreshes on save.

### DeepSeek Review Fails with API Key Error

**Symptoms**: A review or chat request fails with an "API key invalid" or authentication error.

**Solutions**:
1. The API key may have been revoked, expired, or changed on the provider's side. Update it in **AI Providers** settings.
2. Existing sessions created with the old key are invalidated — start a new review or new Ask context after updating the key.
3. If the error persists after updating, delete the provider and re-add it with the new key to force a clean state.

### Model Selector Is Grayed Out / Cannot Change Model

**Symptoms**: The model dropdown in an Ask chat or Follow-up tab is disabled (grayed out) and cannot be opened, or only shows a subset of models.

**Solutions**:
1. This is **intentional** — once a conversation uses a BYOK model (e.g., DeepSeek), the model cannot be changed for that context. A tooltip on the disabled selector explains why.
2. If only non-BYOK models are shown (BYOK models are missing), the conversation was started with a non-BYOK model. BYOK models are hidden to prevent provider conflicts.
3. To use a different model, **create a new Ask context** (click the **+** button in the Ask tab) or start a new review run.
4. The model lock does **not** apply to the review launch dialog or the default model setting — you can always change the model before starting a new run.

### Database Errors After Moving the Database Folder

**Symptoms**: App crashes or shows errors after relocating the database.

**Solutions**:
1. Ensure the new folder exists and has write permissions.
2. Do not place the database in a cloud-synced folder (OneDrive, Dropbox) — SQLite doesn't handle concurrent access.
3. If the database is corrupted, delete `app.db` in the target folder and restart the app — a fresh database will be created (you will lose stored data).

## Getting More Help

- Check the **Task Results** view (bug icon in the title bar) for raw model output that might reveal parsing issues.
- Inspect the **executed prompt** from the Reviews tab to verify that your prompt, rules, and diffs were assembled correctly.

## Related

- [Installation](../getting-started/installation.md) — Prerequisites and setup.
- [First-Run Setup](../getting-started/first-run-setup.md) — Initial configuration.
- [Azure DevOps Settings](../settings/azure-devops.md) — Connection settings.
- [AI Providers Settings](../settings/ai-providers.md) — BYOK provider configuration.
- [Data Management Settings](../settings/data-management.md) — Database management.
