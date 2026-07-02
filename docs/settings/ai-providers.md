# AI Providers

> Configure third-party AI providers (BYOK — Bring Your Own Key) like DeepSeek to use alongside GitHub Copilot.

## Overview

The AI Providers section in the Settings modal lets you register third-party language model providers that Chocolatine can use for reviews, Ask conversations, and follow-up chats. When a provider is configured, its models appear in the model selector alongside Copilot native models, visually distinguished with a **BYOK** badge and no cost multiplier.

Currently, the only supported provider type is OpenAI-compatible APIs — starting with **DeepSeek**. You provide a label, an API key, and an endpoint URL. The API key is stored in OS-protected storage (the same mechanism used for Azure DevOps PATs), never in plain text.

## How to Access

1. Click the **gear icon** in the application title bar.
2. Switch to the **AI Providers** tab.

## Key Capabilities

### Provider Management

| Field | Description | Required |
|-------|-------------|----------|
| **Label** | A friendly name for the provider (e.g., "My DeepSeek account"). | Yes |
| **Base URL** | The provider's API endpoint. Defaults to `https://api.deepseek.com`. | Yes |
| **API Key** | The provider's API key. Stored in OS-protected storage, never in plain text. | Yes |

- **Add provider** — Register a new BYOK provider with label, endpoint, and API key.
- **Edit** — Update the label or endpoint. Leave the API key field blank to keep the stored key unchanged.
- **Delete** — Remove a provider. Its API key is removed from OS-protected storage and its settings entry is cleaned up.
- **Test Connection** — Verify the API key and endpoint by calling the provider's `/v1/models` endpoint. On success, the list of available models is displayed. On failure, a clear error message is shown.
- **Masked API key** — The key field shows a masked value with a **show/hide toggle** so you can verify it without re-entering.

### Security

API keys follow the same protected-storage contract as Azure DevOps PATs:

- Keys are stored via OS-backed encryption and never written to the settings JSON file in plain text.
- The settings file stores only metadata: label, endpoint, and a `hasStoredApiKey` flag.
- If OS-protected storage is unavailable, saves are **rejected** with a clear error message (fail-closed). The app does not offer a plaintext fallback.
- Deleting a provider removes the key from protected storage entirely.
- For full details on the security contract, see [Persistence](../concepts/persistence.md).

## Walkthrough

1. Open the Settings modal (gear icon).
2. Switch to the **AI Providers** tab.
3. Click **Add provider**.
4. Enter a **Label** (e.g., "My DeepSeek account").
5. The **Base URL** defaults to `https://api.deepseek.com`. Change it only if you use a custom endpoint.
6. Paste your DeepSeek **API key**.
7. Click **Save**. A green confirmation appears if the key was stored securely.
8. Click **Test Connection** to verify — the available models are listed (at minimum `deepseek-chat` and `deepseek-reasoner`).
9. Close the modal. The provider's models now appear in every model selector across the app.

> **Note:** If protected storage is unavailable, the save is rejected. Ensure your OS supports credential encryption (Windows Credential Store is required).

## Tips & Best Practices

- Create a dedicated API key for Chocolatine with the minimum required scope rather than reusing a full-access key.
- Test the connection after saving to confirm the key is valid before running reviews.
- If the API key is revoked or expires, update it in the AI Providers settings. Existing BYOK sessions created with the old key will fail with a clear error — start a new review after updating.
- BYOK models show no cost multiplier in the model selector. Cost tracking for BYOK providers is not currently implemented.
- The hardcoded fallback models are `deepseek-chat` and `deepseek-reasoner`. These always appear in the selector even if the live model fetch fails.
- Choose your BYOK model carefully before sending the first message — once a conversation uses a BYOK model, the selector is locked and the model cannot be changed for that context. Create a new Ask context or start a new review run to switch.

## Related

- [BYOK (Bring Your Own Key)](../concepts/byok.md) — How BYOK integrates into Chocolatine's architecture.
- [Supported Models](../reference/supported-models.md) — How BYOK models appear in the catalog.
- [Persistence](../concepts/persistence.md) — API key storage and security contract.
- [Preferences Settings](preferences.md) — Default model selection (includes BYOK models).
- [Troubleshooting](../reference/troubleshooting.md) — BYOK-specific issues and solutions.
