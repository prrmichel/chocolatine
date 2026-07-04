---
description: "Markdown documentation standards: proper heading hierarchy, fenced code blocks with language tags, descriptive link text, one sentence per line. Applies to .md files."
applyTo: "**/*.md"
---
## Markdown Rules

- **Proper heading hierarchy.** Start with a single `#` title. Do not skip levels (no `#` → `###` without `##`). Each file has exactly one `#` heading.
- **Fenced code blocks with language tags.** Use ` ```typescript ` not ` ``` `. This enables syntax highlighting in rendered output.
- **Descriptive link text.** Avoid "click here" or "here". Link text should describe the target: "see [Supported Models](../reference/supported-models.md)" not "click [here](../reference/supported-models.md)".
- **One sentence per line.** Break long paragraphs at sentence boundaries. This makes diffs readable and review comments precise.
- **Use blockquotes for summaries.** The `> One-line summary` at the top of docs files is the established convention — follow it for new docs pages.
- **Use tables for structured data.** Prefer markdown tables over bullet-point lists of key-value pairs when describing settings, parameters, or options. See `docs/settings/preferences.md` for the established pattern.
- **Keep reference links relative.** Use `[text](./relative-path.md)` not absolute URLs for links within the docs folder. This keeps links working across branches and forks.
- **No trailing whitespace.** Trailing spaces cause unnecessary diff noise. Configure your editor to trim them.
- **End files with a single newline.** Consistent with POSIX convention and avoids spurious diffs at end-of-file.
