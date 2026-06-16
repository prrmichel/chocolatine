# Follow-up Tab

> Persistent chat conversations attached to completed review runs for deeper investigation.

## Overview

The Follow-up tab turns one-off review results into an iterative investigation workflow. After a Copilot review run completes, you can open a follow-up conversation that reuses the review's context — the original prompt, the accumulated results, and the Copilot session. Conversations persist across app restarts, so you can pick up where you left off.

## How to Access

There are two ways to start a follow-up conversation:

1. **From the Follow-up subtab** — Open a PR, click the **Follow-up** subtab, and select or create a context for a review run.
2. **From the Changes tab** — Select code in the diff view and click the follow-up action. This prefills the input with context about the selected code.
3. **From the Reviews tab** — Click the **Follow-up** button on a specific review run.

## Key Capabilities

### Conversation Management

- **Create** a new follow-up context for a specific review run.
- **Reopen** an existing conversation to continue where you left off.
- **Delete** a follow-up conversation.
- **Multiple conversations** — You can have separate follow-up conversations for different review runs on the same PR.

### Chat

- Ask questions that automatically include the original review prompt and results as context.
- **Streaming responses** — Answers appear incrementally as the model generates them.
- **Switch model** — Change the model used for follow-up exchanges mid-conversation.
- **Cancel** an in-flight response.
- **Prefill from code selection** — When started from the Changes tab, the prompt is pre-populated with the selected code context.

### Layout Modes

- **Sidebar list** — Follow-up sessions are shown as a vertical button list. Used in the PR Detail view.
- **Run tabs** — Follow-up sessions are shown as horizontal tabs. Used when embedded in the Changes tab full view.

## Walkthrough

1. Run a review from the [Reviews Tab](reviews-tab.md).
2. Once the review completes, click **Follow-up** on that run.
3. The Follow-up tab opens with a new (or existing) context for that run.
4. Type your question (e.g., "Can you explain finding #3 in more detail?" or "Is this a false positive?").
5. The model responds using the full review context. Continue the conversation as needed.
6. Close the app and reopen — the conversation is still there.

## Tips & Best Practices

- Follow-up conversations reuse the Copilot session from the review run. This means the model has the full accumulated context (prompt, rules, code diffs, prior findings, and any previous exchanges).
- Use follow-up to validate questionable findings before acting on them.
- Switching models mid-conversation can provide a second opinion on the same context.
- The code-selection shortcut from the Changes tab is the fastest way to ask about a specific piece of code.

## Related

- [Pull Requests Overview](overview.md) — PR list and detail workspace.
- [Reviews Tab](reviews-tab.md) — Run reviews that produce follow-up context.
- [Changes Tab](changes-tab.md) — Start follow-up from code selection.
- [Session Management](../../concepts/session-management.md) — How follow-up sessions persist and reuse context.
