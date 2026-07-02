# BYOK (Bring Your Own Key)

> How third-party AI model providers integrate with Chocolatine through the Copilot SDK's BYOK mode.

## Overview

BYOK lets you use models from providers like DeepSeek alongside GitHub Copilot models. When a BYOK provider is configured in [AI Providers Settings](../settings/ai-providers.md), its models are discovered, merged into the unified model catalog, and routed to the provider's API via the Copilot SDK. This page explains how the integration works end-to-end.

## Model Discovery

### Live Fetch with Hardcoded Fallback

When a BYOK provider is saved, Chocolatine attempts to fetch the provider's model list from `GET {baseUrl}/models` using the configured API key. The response is parsed and cached for **1 hour**.

If the fetch fails (auth error, network error, timeout), a **hardcoded fallback list** is used:

- `deepseek-chat` — DeepSeek Chat (general-purpose)
- `deepseek-reasoner` — DeepSeek Reasoner (reasoning-focused)

These fallback models ensure the model selector always shows usable options even if the provider's API is temporarily unreachable.

### Catalog Merge

BYOK models are merged into the existing Copilot model catalog with duplicate prevention (case-insensitive ID matching). Each BYOK model has:

| Property | Value |
|----------|-------|
| `providerId` | The configured provider's ID |
| `multiplier` | `null` (no cost indicator) |
| Visual badge | "BYOK" in the model selector |

BYOK models are **first-class options** — they can be used for reviews, Ask conversations, follow-up chats, and as the default model.

## How Sessions Work with BYOK

### Provider-Aware Session Keys

Copilot sessions are keyed to prevent collisions. For Copilot models, the key format is:

```
review:{repo}:{prId}:{model}
```

For BYOK models, the provider ID is included:

```
review:{repo}:{prId}:{providerId}:{model}
```

This means:
- A DeepSeek review and a Copilot review for the same PR use **separate sessions**.
- Each BYOK provider gets its own session namespace.
- The Copilot SDK resolves the full session to a concrete session ID automatically.

### Cross-Provider Switching

Switching between Copilot and BYOK models within the same context is restricted to prevent provider configuration conflicts. The backend detects BYOK↔non-BYOK transitions and recreates sessions transparently when a context is still in its initial (pre-message) state.

Once messages have been exchanged, the model selector enforces a lock (see [Model Lock](#model-lock) below).

### Model Lock

To prevent runtime errors when switching between incompatible providers, the model selector locks under specific conditions:

| Context | State | Behavior |
|---------|-------|----------|
| **Ask** — no messages sent | Free | All models selectable, including BYOK |
| **Ask** — messages sent with non-BYOK | Partial lock | Only non-BYOK models shown; BYOK models are hidden |
| **Ask** — messages sent with BYOK | Full lock | Selector disabled with tooltip: *"This chat uses a BYOK model. The model cannot be changed."* |
| **Follow-up** — review ran with non-BYOK | Partial lock | Only non-BYOK models shown |
| **Follow-up** — review ran with BYOK | Full lock | Selector disabled with tooltip |
| **Reviews / Settings** | Free | No restriction — the model can be changed before each run |

> **Workaround**: To use a different model, create a new Ask context or start a new review. The lock applies per-context, not globally.

### Provider Injection

When a BYOK model is selected, the resolved provider config `{ type: "openai", baseUrl, apiKey }` is injected into the Copilot SDK's `createSession` / `resumeSession` options. This routes the model's requests to the BYOK provider's API instead of Copilot's servers. The injection happens at the session layer, so any SDK consumer (review, Ask, follow-up) automatically uses the correct provider.

## Graceful Degradation

### Copilot Unauthenticated + BYOK Configured

If GitHub Copilot is not authenticated but a BYOK provider is configured, the app works with BYOK models only:

- `listModels()` returns only BYOK models (no error, no crash).
- The user can select DeepSeek models and run reviews, Ask conversations, and follow-ups.
- No Copilot-specific features are available, but the core workflows are unaffected.

### API Key Revoked Mid-Session

If the DeepSeek API key is revoked or expires while a session is active:

- The next request fails with a clear "API key invalid" error message in the UI.
- The app does **not** crash or hang.
- The user must update the API key in [AI Providers Settings](../settings/ai-providers.md), then start a new session.
- Existing sessions created with the old key are not migrated — they fail explicitly on next use.

### API Key Changed

When the user changes their API key in settings:

- The `DeepSeekModelFetcher` **cache is cleared** immediately.
- The next model list request uses the new key.
- Existing BYOK sessions created with the old key are invalidated and fail with a clear message.
- New sessions are created with the updated key.

### Provider Deleted While Session Active

If the BYOK provider configuration is deleted while a DeepSeek session is active:

- The next request fails with a clear error (no crash, no hang).
- The user sees a message indicating the provider is no longer available.

## Architecture

All components are wired in `src/main/index.ts`:

1. **`DeepSeekModelFetcher`** — Cached model discovery with 1-hour TTL and hardcoded fallback.
2. **`onListModels` handler** — Passed to `buildCopilotClientOptions()`. The handler calls the Copilot SDK's default `listModels()` then appends BYOK `ModelInfo` entries. Works even when Copilot is unavailable.
3. **`toSdkProvider(modelId)`** — Resolves a model ID to a BYOK provider config or returns `undefined` for Copilot models.
4. **Provider injection** — The resolved provider config is threaded to `CopilotSessionManager` and `CopilotReviewService` for session creation.
5. **IPC handlers** — `byok:save-provider`, `byok:delete-provider`, `byok:test-connection` are registered and exposed to the renderer via the preload context bridge.

## Related

- [AI Providers Settings](../settings/ai-providers.md) — Configure BYOK providers.
- [Supported Models](../reference/supported-models.md) — How BYOK models appear in the catalog.
- [Session Management](session-management.md) — Session isolation and reuse strategies.
- [Persistence](persistence.md) — API key storage and security contract.
- [Troubleshooting](../reference/troubleshooting.md) — BYOK-specific issues and solutions.
