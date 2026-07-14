# Prompt Library

> Create and manage reusable prompt templates that drive PR reviews and work-item summaries.

## Overview

The Prompt Library is a dedicated tab for managing the text prompts sent to Copilot. Prompts are organized into two categories: **PR Review** and **Work Item changes summary**. Review and summary runs are blocked when the required category has no prompt. Since every review and summary generation is driven by a prompt template, this tab is central to customizing the quality and focus of AI output.

## How to Access

Click **Prompt Library** in the main navigation tab bar.

## Key Capabilities

### Prompt Management

- **Create** new prompt templates.
- **Edit** prompt name, category, and content.
- **Delete** prompts with confirmation dialog.
- **Save** changes (also via `Ctrl+S` keyboard shortcut).
- **Insert starter templates** for each category. Starters are optional helpers and are only used after you explicitly insert/save them.
- **Open in-app prompt help** from the question-mark icon to see PR prompt-building and parsing guidance.

### Categories

- **PR Review** — Prompts used by the [Reviews Tab](pull-requests/reviews-tab.md) for code analysis.
- **Work Item changes summary** — Prompts used by the [Work Items Tab](pull-requests/work-items-tab.md) for generating summaries.
- **Filter** the prompt list by category or show all.

### Defaults

- Mark a prompt as the **default for its category**.
- The default PR Review prompt is auto-selected when starting a review.
- The default Work Item prompt is auto-selected when generating a summary.
- If a category has no prompt, runs for that category stay disabled until you create one.

## Walkthrough

1. Navigate to the **Prompt Library** tab.
2. Click **Create** to add a new prompt, or click **Insert PR Review starter** / **Insert Work Item starter**.
3. Give it a name (e.g., "Security-focused review").
4. Select the category: **PR Review**.
5. Write or refine the prompt content in the editor. Include placeholders or instructions for the model as needed.
6. Click **Save** (or press `Ctrl+S`).
7. Optionally, mark it as the default for its category.
8. Go to the Reviews or Work Items tab — your prompt appears in the category dropdown.

## Tips & Best Practices

- Keep prompts focused on scope, focus areas, and specific tasks.
  The code-reviewer agent owns methodology and output formatting —
  your prompt should not duplicate JSON schemas or review procedures.
- Run multiple reviews with different prompts for comprehensive
  coverage (e.g., one for security, one for performance).
- The prompt content is sent as-is, followed by any custom instructions,
  injected skills, review execution context, and code diffs.
- Keep at least one prompt in each category you actively use; otherwise
  launch actions for that category are disabled.

## PR Review Prompt Help

### How to Build the Prompt

For PR Review prompts, the code-reviewer agent already owns methodology and JSON
output formatting. Your template only needs to define:

1. **Scope** — what the review should focus on.
2. **Focus areas** — which dimensions to check (Security, Correctness, Performance, Maintainability).
3. **Specific tasks** — title verification, dependency review, work item alignment, etc.
4. **Custom instructions** — any additional context or constraints.

Do not include JSON schemas, output formatting rules, or review methodology
in your prompt — the agent handles that automatically.

### How Result Parsing Works

When a review completes, the app parses the model response into structured findings:

- It extracts top-level JSON object(s) from the raw output.
- It parses JSON into structured fields (title review, comments, summary).
- If multiple JSON objects are present (batch cases), comments are merged.
- If output is not valid JSON (or wrapped with extra markdown/text), structured parsing may fail and findings may not render as expected.

The code-reviewer agent is instructed to output strict JSON wrapped in a markdown code fence. Users do not need to repeat this instruction — the agent enforces the output format automatically.

### Starter Example (PR Review)

```text
You are a senior code reviewer performing a pull request review.

Review only the provided pull request changes.
Focus on Security, Performance, Correctness, and Maintainability.
Prioritize issues directly tied to changed lines.
Include evidence from the changes for each comment.
Do not invent issues without evidence.

Additional tasks:
- Verify the pull request title is written in English.
  If not, propose a corrected English title.
- Verify work-item / development-task alignment when the
  available evidence exposes that linkage. Do not invent
  a mismatch.
- Review dependency additions or changes introduced by
  this PR. Flag unapproved third-party libraries.
```

The code-reviewer agent handles methodology and output formatting.
Your prompt only needs to define scope, focus areas, and specific tasks.

## Skills and Skill Markers

When you run a review with **skills** enabled, Chocolatine injects skill instructions into your prompt. Each skill includes a **skill marker** — a unique identifier that helps you track which skills influenced the model's output.

### What Are Skill Markers?

A skill marker is a unique token automatically generated by Chocolatine for each skill during review runs. It replaces the `{{SKILL_MARKER}}` placeholder in your skill's instructions. For example:

```text
SKILL_MARKER_a3f2e1d9_SECURITY_CHECKS
```

### Why Skills Use Markers

- **Traceability** — When reviewing results, you can see exactly which skills were injected and identify which feedback came from which skill.
- **Analytics** — Chocolatine tracks skill marker usage in review history, letting you measure which skills are most frequently triggered and effective.
- **Debugging** — If a review produces unexpected output, markers help pinpoint which skill instructions may have influenced it.

### Using Skill Markers in Prompts

In your PR Review prompt, include the `"skillMarkerUsage"` field in the JSON schema:

```json
{
  "titleReview": { ... },
  "comments": [ ... ],
  "overallSummary": "...",
  "skillMarkerUsage": "List skill markers used, if any"
}
```

This field asks the model to list which skill markers appeared in its reasoning or were relevant to its findings. When you review the **Results** tab, you can see which skills influenced each comment.

### See Also

- [Skills Library](skills-library.md) — Full guide to creating and managing skills.
- [Review Execution](../concepts/review-execution.md) — How skill injection works during review runs.

## Related

- [Reviews Tab](pull-requests/reviews-tab.md) — Uses PR Review prompts.
- [Work Items Tab](pull-requests/work-items-tab.md) — Uses Work Item summary prompts.
- [Rules Injection](../concepts/rules-injection.md) — Rules are appended after the prompt content.
- [Quick Start](../getting-started/quick-start.md) — Uses the default prompt for first reviews.
