# Rules Library

> Define per-language review rules that are automatically injected into Copilot review prompts.

## Overview

The Rules Library lets you define language-specific review checklists. Each language has a name, a set of file-filter glob patterns (e.g., `*.cs, *.csproj`), and a list of rules. When a PR contains files matching a language's filters, the active rules for that language are automatically appended to the review prompt. This ensures that every review enforces your team's coding standards without manual intervention.

Rules are global (not per-repository) and are persisted in the local SQLite database.

## How to Access

Click **Rules Library** in the main navigation tab bar.

## Key Capabilities

### Language Management

- **Create** new languages (e.g., "C#", "TypeScript", "Python").
- **Edit** language name and glob filter patterns.
- **Delete** languages with all their rules.
- Comma-separated **glob filters** per language (e.g., `*.cs, *.csproj`).

### Rule Management

- **Add** individual rules with an optional short code (e.g., `NO_VAR`) and a description.
- **Edit** rule code, description, and active status.
- **Enable/disable** rules — only active rules are injected into prompts.
- **Delete** individual rules.
- **Filter** displayed rules by code or description.

### Bulk Operations

- **Bulk import** — Paste plain text or CSV-like input. Supports two formats:
  - `CODE,Description` (one rule per line)
  - `Description` only (one rule per line)
- **Copy displayed rules** to the clipboard.
- **Clear all rules** for a selected language (with confirmation).

### Layout

The tab uses a **two-pane layout**: a language list on the left and the selected language's rules on the right.

## Walkthrough

1. Navigate to the **Rules Library** tab.
2. Click **Add Language** and enter a name (e.g., "C#").
3. Set the filter pattern (e.g., `*.cs, *.csproj`).
4. Click **Add Rule** and enter a code (`NULL_CHECK`) and description ("Always check for null before accessing properties").
5. Repeat for all your team's rules, or use **Bulk Import** to paste many at once.
6. Ensure rules are marked as **active** (enabled by default).
7. Go to the Reviews tab on a PR that contains `.cs` files — the rules are automatically injected into the prompt.

## Tips & Best Practices

- Start with a small set of high-value rules and expand over time. Too many rules can dilute the model's focus.
- Use the rule **code** field (e.g., `NO_VAR`, `ASYNC_AWAIT`) for easy reference and filtering.
- The bulk import feature accepts one rule per line — prepare your rules in a text file and paste them in.
- Rules are injected in a checklist-style section (e.g., "As a senior C# developer, verify each rule below against the code:"). The model sees this after the prompt and custom instructions.
- Review the [injected prompt](pull-requests/reviews-tab.md) at least once to see how your rules appear in context.
- Since rules are global, define rules based on technology rather than project-specific conventions.

## Related

- [Reviews Tab](pull-requests/reviews-tab.md) — Where rules take effect during reviews.
- [Rules Injection](../concepts/rules-injection.md) — How matching and injection work.
- [Prompt Library](prompt-library.md) — Prompt templates that precede injected rules.
