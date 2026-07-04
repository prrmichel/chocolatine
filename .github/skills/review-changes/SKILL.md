---
name: review-changes
description: "Language-specific review checklists for TypeScript, CSS, and Markdown, plus a general checklist applicable to any language. Use when reviewing code, auditing changes, or running /review-changes. Provides detailed per-language criteria beyond the core review focus areas."
---

# Review Checklists

This skill provides language-specific checklists that the review agent should apply on top of the six core focus areas (Bugs, Security, Performance, Maintainability, Architecture, Documentation).

## When to Use

- Whenever the `/review-changes` agent is invoked.
- When performing a manual code review and you want a structured checklist.
- When setting up a new project and establishing review standards.

## Checklist Selection

Apply the checklist that matches the language of the changed files. If a PR touches multiple languages, apply all relevant checklists.

---

## TypeScript / JavaScript

- [ ] **No `any` without explicit justification.** Comment must explain why `unknown` or a proper type cannot be used.
- [ ] **Strict null checks pass.** Every nullable value is guarded before use. Optional chaining and nullish coalescing used where appropriate.
- [ ] **No unsafe type assertions.** No `as Type` unless preceded by a runtime check or schema validation. No non-null assertions (`!`) without a comment explaining why the value is guaranteed.
- [ ] **Exhaustive switch/if-else on discriminated unions.** Adding a new variant to a union type would break compilation here.
- [ ] **Promise rejections handled.** Every `await` is inside a try-catch or has a `.catch()`. Floating promises are assigned or awaited.
- [ ] **No sync I/O in async contexts.** `readFileSync`, `writeFileSync`, etc. are not used in request handlers or hot paths.
- [ ] **Imports are organized.** No circular dependencies. Third-party imports precede local imports. No unused imports.
- [ ] **Enums vs union types.** String unions preferred over TypeScript enums unless the enum values are stable and used at runtime.
- [ ] **Array methods used idiomatically.** `map` for transformation, `filter` for selection, `reduce` only when neither fits. No side effects inside `map`/`filter`.
- [ ] **Error subclasses are meaningful.** Custom errors extend `Error` and include a `name` property. Error messages include actionable context.
- [ ] **No default exports.** Named exports for all modules.

## CSS

- [ ] **CSS custom properties used.** Colors and spacing reference `var(--vscode-*)` or `var(--spacing-*)` variables, not hardcoded values. New variables are defined in `variables.css`.
- [ ] **No `!important`.** Specificity issues are resolved by restructuring selectors, not by forcing overrides.
- [ ] **Specificity is low.** Single-class selectors preferred. No more than two chained selectors. No ID selectors for styling.
- [ ] **Component styles use CSS modules.** Styles co-located as `ComponentName.module.css`. Global styles are in `src/renderer/src/styles/`.
- [ ] **Kebab-case class names.** Consistent with the existing convention: `.ask-messages`, `.btn-icon`, `.modal-backdrop`.
- [ ] **Sections are commented.** Major groupings use `/* ── Section ── */` headers matching existing style.
- [ ] **Spacing scale is respected.** Values from the `--spacing-2xs` through `--spacing-2xl` scale, no arbitrary pixels.
- [ ] **No deep nesting.** Maximum 3 levels of nesting in any rule.
- [ ] **Dark theme compatible.** All styles work with `color-scheme: dark`. No light-only colors without a dark fallback.

## Markdown

- [ ] **Heading hierarchy is correct.** Single `#` title per file. No skipped levels. No multiple `#` headings in one file.
- [ ] **Code blocks have language tags.** Every fenced code block includes a language identifier.
- [ ] **Link text is descriptive.** No "click here" or bare URLs as link text. Link text describes the target.
- [ ] **One sentence per line.** Paragraphs are broken at sentence boundaries for readable diffs.
- [ ] **Blockquote summaries are present.** New docs pages follow the `> One-line summary` convention.
- [ ] **Reference links are relative.** Intra-docs links use `[text](./relative-path.md)`, not absolute URLs.
- [ ] **No trailing whitespace.** Lines are clean; editor configured to trim on save.
- [ ] **File ends with a single newline.** Consistent with POSIX convention.

## General (All Languages)

- [ ] **KISS — Is this the simplest solution?** No unnecessary abstraction layers, indirection, or design patterns. Every layer of complexity is justified by a concrete, current requirement.
- [ ] **YAGNI — Is there code for hypothetical futures?** No features, extension points, or configurability for needs that don't exist yet. No generic utilities with only one caller.
- [ ] **Functions are small and focused.** No function exceeds ~40 lines. Complex logic is extracted into well-named helpers.
- [ ] **No commented-out code.** Delete it or reference the commit that removed it.
- [ ] **Magic values are named constants.** Numbers, strings, and configuration values are extracted with descriptive names.
- [ ] **Error handling is appropriate.** Errors are caught at the right level. Retry logic exists for transient failures. Circuit breakers for external calls.
- [ ] **Logging is at the correct level.** No secrets in logs. Structured logging where appropriate.
- [ ] **Lint passes.** `npm run lint` exits clean with zero errors and zero warnings. Lint failures are blockers — fix them before anything else.
- [ ] **Tests exist for new behavior.** New logic has corresponding tests. Edge cases and error paths are covered.
- [ ] **Regression test cases provided for each fix.** For every Critical or Warning finding, describe a concrete user scenario to verify the fix doesn't break existing behavior. Include: the action the user takes, the expected outcome, and what would indicate a regression.
- [ ] **Dependencies are verified.**
  - [ ] No known vulnerabilities — `npm audit` is clean for changed or newly added packages. Critical/High CVEs are blockers.
  - [ ] Versions are up-to-date — not pinning an old release when a newer stable exists.
  - [ ] Production deps use exact versions — no `^` or `~` ranges that make builds non-deterministic.
  - [ ] No deprecated or archived packages — npm warns on install for these.
  - [ ] Packages are actively maintained — last publish within the past year.
  - [ ] License is compatible — no GPL/AGPL in an MIT project. Check with `npm ls --json` or the package's npm page.
  - [ ] New library is justified — evaluated against standard-library alternatives and bundle-size impact before adding.
- [ ] **Documentation is updated.** Public APIs, configuration changes, and behavioral changes are reflected in docs.
