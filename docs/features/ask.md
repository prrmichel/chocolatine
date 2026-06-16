# Ask

> General-purpose Copilot chat, independent of any pull request.

## Overview

The Ask tab provides a standalone chat interface with GitHub Copilot. Unlike the Follow-up feature (which is tied to a specific review run), Ask is not PR-specific. Use it for general coding questions, brainstorming, or any conversation that doesn't need PR context. Conversations persist across sessions, and you can maintain multiple named chat contexts.

## How to Access

Click **Ask** in the main navigation tab bar.

## Key Capabilities

### Context Management

- **Create** multiple named chat contexts (e.g., "Architecture questions", "Debugging help").
- **Rename** contexts.
- **Delete** contexts.
- **Switch** between contexts — each maintains its own message history and model selection.

### Chat

- **Send messages** with streaming output (answers appear incrementally).
- **Cancel** an in-flight response.
- **Select the model** per context — change it at any time.
- **Resize** the input text area.
- **Seed from other workflows** — Other parts of the app can pre-fill the Ask input with an initial message.

### Speech Input

- **Microphone input** — Use speech recognition (Web Speech API) to dictate messages instead of typing.
- Supported in Chromium-based environments (which Electron uses).

## Walkthrough

1. Navigate to the **Ask** tab.
2. Click **New Context** and give it a name.
3. Select a model from the dropdown.
4. Type a question or click the microphone icon to dictate.
5. The model responds with streaming text.
6. Continue the conversation — context accumulates across messages.
7. Create additional contexts for different topics.

## Tips & Best Practices

- Each context maintains a persistent Copilot session, so the model remembers all prior exchanges in that context.
- Use separate contexts for unrelated topics to avoid context pollution.
- If a conversation becomes unproductive, delete the context and start fresh — the session is cleared with it.
- The Ask tab is a good place to pre-test prompt wording before saving it as a template in the [Prompt Library](prompt-library.md).

## Related

- [Follow-up Tab](pull-requests/follow-up-tab.md) — PR-specific chat (different from Ask).
- [Prompt Library](prompt-library.md) — Save reusable prompts.
- [Session Management](../concepts/session-management.md) — How Ask sessions persist.
- [Supported Models](../reference/supported-models.md) — Available models.
