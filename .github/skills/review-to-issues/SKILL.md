---
name: review-to-issues
description: "Curate code review findings into a local markdown issues file. Use when you have review output from /review-changes and want to turn findings into a curated, trackable checklist file."
---

# Review to Issues

Takes the output of a `/review-changes` review and helps you curate findings into a structured, local markdown issues file.

## When to Use

- After running `/review-changes` and reviewing the findings.
- When you want a trackable checklist of fixes before committing.
- When you want to share review findings as a structured file with your team.

## Workflow

### Step 1: Collect the review findings

Ask the user to provide the review output (Summary, Critical, Warnings, Suggestions, Praise, Fix Plan). If they don't have it handy, ask them to run `/review-changes` first.

### Step 2: Curate

Present each finding to the user and ask:

- **Include this as an issue?** (yes/no)
- **Edit the title?** (show the current finding summary, let them rewrite)
- **Adjust severity?** (if the user feels a Warning should be Critical, or vice versa)

Present findings grouped by severity (Critical first, then Warnings, then Suggestions). The user can skip entire groups or individual items.

### Step 3: Write the file

Create the file at `.github/issues/review-YYYY-MM-DD.md` (use the current date).

Use this exact format:

```markdown
# Review Issues — YYYY-MM-DD

> Findings from code review of working-tree changes on YYYY-MM-DD.

## Critical

- [ ] **[C1] {File reference}** — {Issue description}
  - _Fix:_ {Suggested fix}

- [ ] **[C2] {File reference}** — {Issue description}
  - _Fix:_ {Suggested fix}

## Warnings

- [ ] **[W1] {File reference}** — {Issue description}
  - _Fix:_ {Suggested fix}

## Suggestions

- [ ] **[S1] {File reference}** — {Issue description}
  - _Fix:_ {Suggested fix}

## Fix Sequence

{Recommended order from the Fix Plan, using item codes: "C1 → W1 → W2 → S1". If no Fix Plan was produced, note "No sequencing dependencies identified."}
```

**Rules:**
- Only include sections that have at least one curated item.
- If a section is empty, omit it entirely.
- **Numbering:** Prefix each item with `[C1]`, `[C2]` (Critical), `[W1]`, `[W2]` (Warning), `[S1]`, `[S2]` (Suggestion). Number sequentially within each severity, starting at 1. This gives every fix a short, unambiguous code.
- Use relative file paths from the workspace root.
- Each item gets exactly one `- [ ]` checkbox line and one `_Fix:_` line. The `_Fix:_` line is indented under its checkbox.
- The Fix Sequence references items by their code (e.g., "C1 before W1 because..."). Preserve the grouping and dependency notes from the review's Fix Plan.

### Step 4: Confirm

Show the user a summary: "Wrote X Critical, Y Warning, Z Suggestion items to `.github/issues/review-YYYY-MM-DD.md`."

## Constraints

- Do NOT create or modify any file other than the `.github/issues/review-YYYY-MM-DD.md` file.
- Do NOT publish to any external issue tracker — this skill writes local files only.
- If the user cancels during curation, do not write the file. Confirm before writing.
- If `.github/issues/` does not exist, create it.
