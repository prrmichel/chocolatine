# Rules Injection

> How language rules are matched against PR files and injected into review prompts.

## Overview

The Rules Library doesn't just store rules — it actively participates in the review pipeline. When a review is triggered, the app inspects the PR's changed files, matches them against each language's glob filters, selects the active rules for matching languages, and appends them to the prompt. This happens automatically and transparently.

## Injection Pipeline

### Step 1: Collect Changed Files

When a review job starts, the app gathers all file paths from the PR diff (e.g., `src/Services/OrderService.cs`, `tests/OrderTests.cs`, `README.md`).

### Step 2: Match Languages

Each language in the Rules Library defines one or more glob filters (e.g., `*.cs, *.csproj` for C#). The app matches every changed file path against every language's filters. A language matches if at least one file in the PR matches its glob pattern.

### Step 3: Select Active Rules

For each matching language, only **active (enabled)** rules are selected. Disabled rules are skipped.

### Step 4: Build the Injected Section

The selected rules are formatted into a checklist-style section. For example:

```
## As a senior C# developer, verify each rule below against the code:

- [ ] NULL_CHECK: Always check for null before accessing properties
- [ ] ASYNC_AWAIT: Use async/await consistently, never mix with .Result or .Wait()
- [ ] NO_VAR: Use explicit types instead of var for public API signatures
```

### Step 5: Append to Prompt

The injected section is placed after:

1. The **prompt template** content (from Prompt Library).
2. Any **custom instructions** (entered per review run).

And before:

3. The **code diffs**.

So the model sees: `Prompt → Custom instructions → Rules → Diffs`.

## Key Behaviors

- **Global scope** — Rules are not per-repository. They apply to any PR that contains matching files.
- **Automatic** — No manual action needed. If rules exist and files match, injection happens.
- **Applies to all review types** — Both standard reviews and quick reviews trigger rule injection.
- **Multiple languages** — If a PR touches `.cs` and `.ts` files, both C# and TypeScript rules are injected (assuming both languages exist in the library).
- **No injection if no match** — If no changed files match any language filter, no rules section is added.

## Verifying Injection

You can verify that rules were injected by inspecting the **exact executed prompt** on the [Reviews Tab](../features/pull-requests/reviews-tab.md). Click "Inspect prompt" on any completed review run to see the full prompt including injected rules.

## Related

- [Rules Library](../features/rules-library.md) — Define languages and rules.
- [Reviews Tab](../features/pull-requests/reviews-tab.md) — Where injection takes effect.
- [Prompt Library](../features/prompt-library.md) — Prompt templates that precede rules.
- [Review Execution](review-execution.md) — The full review pipeline.
