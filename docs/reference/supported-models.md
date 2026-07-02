# Supported Models

> The model picker uses the Copilot SDK model catalog at runtime.

## Overview

Chocolatine does not ship a fixed supported-model table. Instead, it loads the **model catalog** from the active Copilot SDK environment and uses SDK `ModelInfo` as the catalog contract for model selection in Reviews, Ask, follow-up conversations, and default settings.
For Settings and Review run model pickers, Chocolatine also shows a formatted metadata panel for the currently selected model using `ModelInfo` fields.

Available models can differ by account, organization policy, and current Copilot environment. Because of this, the list you see is authoritative for your runtime and may not match another user.

## Auto model

**Auto** is the canonical safe default. It lets the SDK choose the concrete model for the request.

If a previously saved concrete model is no longer present in the refreshed catalog, Chocolatine falls back to **Auto** and surfaces that change to the user.

## BYOK Models

When a [BYOK provider](../settings/ai-providers.md) (e.g., DeepSeek) is configured, its models are merged into the catalog alongside Copilot models. BYOK models:

- Appear with a **"BYOK" badge** in the model selector to visually distinguish them from Copilot models.
- Have **no cost multiplier** since cost tracking for BYOK providers is not currently implemented.
- Are **first-class options** for reviews, Ask conversations, follow-up chats, and as the default model.

Model discovery calls the provider's `/v1/models` endpoint at save time and on a 1-hour cache cycle. If the live fetch fails, a hardcoded fallback list (`deepseek-chat`, `deepseek-reasoner`) ensures the selector always shows usable options.

Once a BYOK model is used in a chat or review follow-up (messages have been exchanged), the model selector is locked for that context. Create a new Ask context or start a new review run to use a different model. The lock does not apply to the review launch dialog or the default model setting.

See [BYOK](../concepts/byok.md) for the full architectural explanation.

## Cost and usage language

Chocolatine no longer documents fixed model tiers as product contract. Cost-related metadata can still be emitted by the SDK, but it is treated as environment-driven and optional.

For pull request reviews, user-visible consumption diagnostics are **token-first** and shown after a run in debug logs and per-attempt history summaries.

## Related

- [Preferences Settings](../settings/preferences.md) — Set the default model.
- [AI Providers Settings](../settings/ai-providers.md) — Configure BYOK providers.
- [BYOK](../concepts/byok.md) — How BYOK integrates into the architecture.
- [Reviews Tab](../features/pull-requests/reviews-tab.md) — Select a model per review.
- [Ask](../features/ask.md) — Select a model per chat context.
- [Review Execution](../concepts/review-execution.md) — Queue and review execution behavior.
