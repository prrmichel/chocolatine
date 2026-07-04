---
description: "TypeScript and TSX coding standards: KISS, YAGNI, strict nulls, no any, prefer type over interface, readonly data, exhaustive switches, async/await, no default exports. Applies to .ts and .tsx files."
applyTo: "**/*.{ts,tsx}"
---
## TypeScript Rules

- **No `any` without justification.** Use `unknown` for truly dynamic values and narrow with type guards. If `any` is unavoidable, document why.
- **Strict null checks.** Assume `strictNullChecks: true`. Explicitly handle `null` and `undefined`. Prefer optional chaining (`?.`) and nullish coalescing (`??`).
- **Prefer `type` over `interface`** for simple object shapes unless declaration merging is needed.
- **Use `readonly` properties and `ReadonlyArray`** for data that should not be mutated after construction.
- **Exhaustive switch/if-else.** Every discriminated union branch must be handled. Use a `never`-asserting default case to catch missing branches at compile time.
- **Async/await over raw promises.** Never mix `.then()` chains with `async/await` in the same function. Always handle promise rejections.
- **Avoid `as` casts.** Use type guards, `instanceof`, or schema validation instead. Casts bypass the type-checker and hide bugs.
- **Use template literals** over string concatenation for readability.
- **Prefer `for...of` over indexed `for` loops** unless the index is needed for arithmetic.
- **No default exports.** Named exports improve refactoring and discoverability.
- **Don't over-engineer types.** Don't create generic types, abstract base classes, or utility types until you have at least two concrete use cases. A simple function is better than a generic that handles every hypothetical variant.
- **Avoid premature abstraction.** Don't extract a shared interface or base class after the first implementation. Wait until the pattern repeats at least twice before generalizing — the second use case reveals what the abstraction should actually look like.
