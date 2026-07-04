---
description: "CSS coding standards for this project: prefer custom properties (variables), avoid !important, keep specificity low, use CSS modules for components. Applies to .css files."
applyTo: "**/*.css"
---
## CSS Rules

- **Prefer CSS custom properties.** Use `var(--vscode-*)` for colors and `var(--spacing-*)` for spacing. Define new variables in `variables.css` rather than hardcoding values in component styles.
- **No `!important`.** Restructure selectors or increase specificity deliberately instead. `!important` makes overrides fragile and debugging difficult.
- **Keep specificity low.** Prefer single-class selectors. Avoid chaining more than two selectors. Never use IDs for styling.
- **Use CSS modules for components.** Component styles belong in `ComponentName.module.css` files co-located with the component. Global styles go in `src/renderer/src/styles/`.
- **Kebab-case class names.** `.ask-messages`, `.btn-icon`, `.modal-backdrop`. Consistent with the existing codebase convention.
- **Comment sections with `/* ── Section ── */`** for major groupings, matching the existing style in `variables.css` and layout files.
- **Use the spacing scale.** Reference `--spacing-2xs` through `--spacing-2xl` instead of arbitrary pixel values. Aligns visual rhythm across the app.
- **Avoid deep nesting.** Maximum 3 levels of nesting in preprocessors or CSS nesting. Deep nesting produces overly specific selectors that are hard to override.
- **Minimize layout shifts.** Define explicit dimensions or aspect ratios for images, iframes, and async-loaded content to prevent Cumulative Layout Shift.
- **Use `color-scheme: dark` consistently.** All stylesheets must respect the dark theme. Light-only colors without a dark fallback are a bug.
