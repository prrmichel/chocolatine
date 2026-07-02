# Session Management

> How Copilot sessions are reused or isolated depending on the feature.

## Overview

Chocolatine manages multiple types of Copilot conversations simultaneously: code reviews, work-item summaries, follow-up chats, and Ask conversations. Each feature uses a different session strategy. Some sessions accumulate context across interactions (useful for iterative analysis), while others are intentionally isolated (to avoid context pollution). Understanding this helps explain why some workflows "remember" prior exchanges and others start fresh.

## Session Strategies by Feature

| Feature | Session Strategy | Key |
|---------|-----------------|-----|
| **PR Code Reviews** | Persistent per PR + model | A session is maintained for each (PR, model) pair. BYOK sessions include the provider ID in the key to isolate them from Copilot sessions. Re-reviews reuse the same session, allowing the model to build on prior analysis. |
| **Re-Reviews** | Reuses existing review session | The model receives metadata about the attempt number and reuse status. Prior results are in the session history. |
| **Work Item Summaries** | Isolated (one-off) | A new session is created for each summary request and deleted after completion. Summary results are self-contained. |
| **Follow-up Conversations** | Persistent per follow-up context | Each follow-up context has its own session. The session includes the original review prompt and results as initial context. Persists across restarts. |
| **Ask Conversations** | Persistent per Ask context | Each named chat context in the Ask tab has its own persistent session. All messages in that context share accumulated history. |

## Why It Matters

- **Reviews**: Session reuse means re-reviewing the same PR with the same model builds on the model's memory of prior findings. This is powerful for iterative refinement. Switching between a BYOK provider and Copilot (or vice versa) destroys the old session and creates a new one, preventing cross-provider context leakage.
- **Work Item Summaries**: Isolation ensures that each summary is independent and reproducible. Prior summary attempts don't influence new ones.
- **Follow-up**: Persistence allows you to close the app, reopen it days later, and continue asking questions about a review run with full context intact.
- **Ask**: Each context is a self-contained conversation. Deleting a context clears its session entirely.

## Session Persistence

Sessions are mapped and stored in the SQLite database. The Copilot SDK handles session persistence on its side, and Chocolatine maintains a mapping table (context ID → session ID) to reconnect to the right session on restart.

## Related

- [Review Execution](review-execution.md) — Queue mechanics and re-review workflow.
- [BYOK](byok.md) — How BYOK sessions are isolated.
- [Follow-up Tab](../features/pull-requests/follow-up-tab.md) — Persistent chat on review results.
- [Ask](../features/ask.md) — General-purpose persistent chat.
- [Persistence](persistence.md) — What is stored in the database.
