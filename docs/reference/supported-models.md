# Supported Models

> The model picker uses the Copilot SDK model catalog at runtime.

## Overview

Chocolatine does not ship a fixed supported-model table. Instead, it loads the **model catalog** from the active Copilot SDK environment and uses SDK `ModelInfo` as the catalog contract for model selection in Reviews, Ask, follow-up conversations, and default settings.
For Settings and Review run model pickers, Chocolatine also shows a formatted metadata panel for the currently selected model using `ModelInfo` fields.

Available models can differ by account, organization policy, and current Copilot environment. Because of this, the list you see is authoritative for your runtime and may not match another user.

## Auto model

**Auto** is the canonical safe default. It lets the SDK choose the concrete model for the request.

If a previously saved concrete model is no longer present in the refreshed catalog, Chocolatine falls back to **Auto** and surfaces that change to the user.

## Cost and usage language

Chocolatine no longer documents fixed model tiers as product contract. Cost-related metadata can still be emitted by the SDK, but it is treated as environment-driven and optional.

For pull request reviews, user-visible consumption diagnostics are **token-first** and shown after a run in debug logs and per-attempt history summaries.

## Related

- [Preferences Settings](../settings/preferences.md) — Set the default model.
- [Reviews Tab](../features/pull-requests/reviews-tab.md) — Select a model per review.
- [Ask](../features/ask.md) — Select a model per chat context.
- [Review Execution](../concepts/review-execution.md) — Queue and review execution behavior.
