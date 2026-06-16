# Summary Tab

> Quick overview of PR metadata and a consolidated table of all review runs.

## Overview

The Summary tab is the first subtab in the PR detail workspace. It provides essential PR metadata — author, branches, reviewers — and a consolidated review summary table. This is the fastest place to understand the current state of a PR and the outcome of past review runs at a glance.

## How to Access

1. Open the **Pull Requests** tab.
2. Select a PR from the list.
3. Click the **Summary** subtab (selected by default).

## Key Capabilities

### PR Metadata

- Author name.
- Source and target branch names with **copy-to-clipboard** buttons.
- Reviewer groups and individual reviewers.
- Reviewer vote/status visualization (approved, rejected, waiting, etc.).

### Reviews Summary Table

- One row per completed review run.
- Columns: model used, run date, finding counts grouped by severity, total findings.
- Quickly compare outcomes across models or prompt variations.

## Walkthrough

1. Select a PR to open its detail workspace.
2. The Summary tab is shown by default.
3. Check the branch information and reviewer status.
4. Scroll down to the reviews summary table to see findings at a glance.
5. If no reviews have been run yet, the table is empty — head to the [Reviews Tab](reviews-tab.md) to start one.

## Tips & Best Practices

- Use the summary table to decide if a re-review is needed. If finding counts look low relative to the PR size, consider running with a different model or adjusted prompt.
- Copy the source branch name directly from here when you need to check out the code locally.

## Related

- [Pull Requests Overview](overview.md) — PR list and detail workspace.
- [Reviews Tab](reviews-tab.md) — Run and inspect reviews.
- [Changes Tab](changes-tab.md) — View code diffs.
