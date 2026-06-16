# Skills Library

A **skill** is a reusable set of code review instructions that Chocolatine injects into your Copilot prompts during review runs. Skills let you standardize review practices across your team by encoding domain knowledge, architectural constraints, or coding standards once, then applying them consistently to every review.

## Overview

Skills work in two scopes:

- **Global skills** — Created and stored locally in Chocolatine, available for all pull requests and organizations.
- **Project skills** — Synced from Azure DevOps repositories under `.github/skills/` folder, scoped to specific projects.

When you run a code review, Chocolatine automatically matches applicable skills based on the file types in the PR, then injects the matched skills' instructions into the Copilot prompt. You don't need to manually select skills; Chocolatine handles this automatically.

## Creating a Global Skill

To create a skill stored locally in Chocolatine:

1. Open **Skills** tab.
2. Click **Add Global Skill**.
3. Enter your skill content as a **Markdown file with YAML frontmatter**:

```markdown
---
name: TypeScript Type Safety
description: Review TypeScript code for type safety and strict null checks.
---

## Instructions

When reviewing TypeScript code:

1. Ensure all variables and function parameters have explicit types (no implicit `any`).
2. Check that strict null checks (`strictNullChecks: true`) are enforced.
3. Verify that generics are used appropriately for type-safe data structures.
4. Look for unsafe type assertions (`as Type`) — question their necessity.

{{SKILL_MARKER}}
```

**Required elements:**

- **YAML frontmatter** with `name:` and `description:` fields (enclosed in `---`)
- **Skill instructions** in Markdown below the frontmatter
- **Skill marker placeholder** (`{{SKILL_MARKER}}`) placed naturally in the instructions

The skill marker is a required token that Chocolatine automatically replaces with a unique marker during reviews. This helps track which skills influenced which reviews. See [Skill Markers](#skill-markers) for details.

4. Click **Save**.

### Skill Marker Placeholder

When creating a skill, you **must** include the exact text `{{SKILL_MARKER}}` somewhere in your instructions. This placeholder is replaced by Chocolatine at review time with an auto-generated marker that tracks skill usage in your review results.

**Example placement:**

```markdown
## Code Quality Checks

Check for logging statements and error handling. {{SKILL_MARKER}}
```

The marker appears naturally in the output; you don't need to format it specially.

## Managing Skills

### View and Edit Skills

- Click a skill in the **Skills** sidebar to view its content.
- Click **Edit** to modify the skill's SKILL.md file.
- Changes are saved automatically to Chocolatine's local storage.

### Save All Skills to Disk

Click **Save all skills to hard disk** to export all skills to your file system. This is useful for:

- **Backup** — Keep a local copy of all your skills.
- **Version control** — Check skills into your repository for team collaboration.
- **External editing** — Open skills in your text editor to make bulk changes.

Skills are saved to the Chocolatine data folder. After editing, click **Load** to reload them from disk.

### Hide and Show Skills

- Click **Hide** on a skill to temporarily disable it without deleting.
- Hidden skills are not injected into prompts.
- Click **Show** to re-enable a hidden skill.
- Use **Show hidden skills** checkbox to view hidden items in the sidebar.

### Delete Skills

- Click **Delete** on a skill (or **Delete skill** from the context menu).
- Confirm the deletion in the dialog.
- Deletion is permanent and cannot be undone.

## Syncing Project Skills from Azure DevOps

Project skills are stored in your Azure DevOps repositories under `.github/skills/` and synced into Chocolatine on demand.

### Setup: Add Skills to Your Repository

1. In your Azure DevOps repository, create a `.github/skills/` folder.
2. Add a `SKILL.md` file for each skill using the same format as global skills:

```markdown
---
name: API Contract Validation
description: Ensure REST API changes maintain backward compatibility.
---

## Guidelines

When reviewing API endpoint changes:
- Check for breaking changes (removed endpoints, changed parameters, changed response types).
- Verify deprecation notices are added for upcoming breaking changes.
- Ensure API versioning follows semantic versioning.

{{SKILL_MARKER}}
```

### Sync Skills into Chocolatine

1. Open **Skills** tab.
2. Click **Sync skills from repository**.
3. Select an organization (if multiple are configured).
4. Select a repository from the dropdown.
5. Click **Sync**.

Chocolatine fetches all `.github/skills/SKILL.md` files from the repository and imports them as **project skills** scoped to that organization/project.

### Viewing Synced Projects

The **Synced projects** panel shows:

- Which projects have skills synced
- How many skills per project
- When each project was last synced

Click on a project to filter the skills sidebar to show only skills from that project.

## How Skills Are Applied During Reviews

When you run a review:

1. Chocolatine examines the file types in the pull request diff (e.g., `.ts`, `.py`, `.md`).
2. It looks for skills whose **file patterns** match those types.
3. All matching skills' instructions are gathered and injected into the Copilot prompt.
4. Copilot processes the skill instructions along with the code review instructions.
5. The skill marker in each skill's instructions is replaced with a unique auto-generated marker.

**Example:** If your PR contains `.ts` files and you have skills for TypeScript and general JavaScript, both skills' instructions are injected.

## Skill File Structure

While most skills consist of a single `SKILL.md` file, a skill can contain multiple supporting files:

```
my-skill/
├── SKILL.md           (required; frontmatter + instructions)
├── examples.md        (optional; supporting documentation)
├── patterns.json      (optional; reference data)
└── ...
```

All files in a skill's folder are preserved and available when viewing the skill. Only `SKILL.md` is injected into prompts.

## Checking Skill Integrity

Click **Validate all skills** to scan for:

- Missing or corrupted `SKILL.md` files
- Invalid or missing YAML frontmatter
- Missing skill marker placeholder (`{{SKILL_MARKER}}`)

Chocolatine highlights any issues so you can fix them before they affect reviews.

## Skill Markers and Review Results

Every skill includes a **skill marker** — a unique identifier automatically injected by Chocolatine during reviews. When you review your **Reviews** tab results or **Task Results**, the model output includes these markers:

- **Markers help you trace** which skills influenced which parts of the review feedback.
- **In diagnostics**, skill usage is tracked and visible in review run history.
- **For analysis**, you can see which skills are most frequently triggered and whether they're improving your reviews.

## Best Practices

1. **Keep instructions concise** — Skills are injected alongside other review prompt text. Verbose skills bloat the prompt.

2. **Use clear examples** — Include concrete code examples in your skill instructions to illustrate what you're looking for.

3. **Use consistent naming** — Name skills to clearly reflect their domain or purpose (`TypeScript Best Practices`, `Security Review`, etc.).

4. **Organize by team** — If different teams have different review standards, create separate skills or projects for each team.

5. **Version control project skills** — Store `.github/skills/` in your repository's main branch so the whole team can contribute.

6. **Review skill effectiveness** — Periodically check your **Task Results** to see whether skills are providing useful feedback. Refine or remove underutilized skills.

7. **Test changes** — After editing a skill, run a test review on a known PR to verify the skill behaves as expected.

## Troubleshooting

### Skill Not Appearing in Prompts

- **Check file matching** — Ensure the PR contains file types that match your skill's patterns.
- **Check skill status** — Verify the skill is not hidden.
- **Check validity** — Run **Validate all skills** to ensure the skill's `SKILL.md` is valid.

### Missing Skill Marker Error

- **Error message:** "IMPORTANT: You MUST include the exact text `{{SKILL_MARKER}}`"
- **Cause:** The model's output didn't include the required marker token.
- **Fix:** Add the marker placeholder to a natural place in your skill instructions. It should be part of the instructions, not a hidden requirement.

### Sync Failed

- **Check connection** — Verify you have a valid PAT configured in **Settings > Azure DevOps**.
- **Check repository access** — Ensure the PAT has permission to read the repository.
- **Check folder path** — Verify `.github/skills/` exists in the repository and contains `SKILL.md` files.

### Skills Linked to the Wrong Project

- **Cause** — Older synced data may use a legacy internal project key format.
- **Behavior** — Chocolatine now resolves both canonical and legacy keys during review.
- **Fix** — If a project still looks mismatched, run **Sync skills from repository** again for that project.

## See Also

- [Prompt Library](prompt-library.md) — How skill markers integrate with prompt templates
- [Settings > Azure DevOps](../settings/azure-devops.md) — Configuring repositories for skill sync
- [Review Execution](../concepts/review-execution.md) — How Copilot processes skills during reviews
