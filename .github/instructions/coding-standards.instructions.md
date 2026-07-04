---
description: "Always-on general coding standards applicable to all code files: KISS, YAGNI, prefer immutability, fail fast, explicit over implicit, self-documenting code, small focused units, testability. For language-specific rules, see ts-standards, css-standards, and md-standards instructions."
applyTo: "**/*.{ts,tsx,css,mjs,cjs,json,yml,yaml,html}"
---
## General Principles

- **KISS (Keep It Simple, Stupid).** Prefer the simplest solution that meets the requirements. Avoid unnecessary abstraction layers, indirection, or design patterns that aren't solving a real problem today. Complexity must be justified by a concrete need, not by hypothetical futures.
- **YAGNI (You Ain't Gonna Need It).** Don't build features, extension points, configuration options, or generic utilities for hypothetical future needs. Build what's needed now; refactor when the need actually materializes. Code you don't write has zero bugs.
- **Prefer immutability.** Use `const` by default. Avoid mutating arguments. Return new instances instead of modifying in place.
- **Fail fast.** Validate inputs at boundaries. Throw early with descriptive messages. Do not silently swallow errors.
- **Explicit over implicit.** Prefer explicit types, explicit dependency injection, and explicit error propagation. Avoid magic values and hidden side effects.
- **Self-documenting code.** Names should reveal intent without comments. When a comment is necessary, explain *why*, not *what*.
- **Small, focused units.** Functions should do one thing. Files should have a single clear responsibility. Keep cyclomatic complexity low.
- **Testability by default.** Every non-trivial function should be testable in isolation. Avoid hardcoded dependencies on frameworks, file systems, or network calls.

## General Code Rules

- **No commented-out code in committed files.** Delete it. Git history preserves it if needed.
- **No hardcoded values that should be configurable.** Extract magic numbers, URLs, and timeouts into named constants or configuration.
- **Error messages must be actionable.** Include context: what failed, on what input, and what the caller should do about it.
- **Log at the right level.** `debug` for diagnostic detail, `info` for key events, `warn` for recoverable issues, `error` for failures needing attention. Never log secrets.
- **Keep dependencies minimal.** Before adding a library, consider whether the standard library or a few lines of code can achieve the same result.
