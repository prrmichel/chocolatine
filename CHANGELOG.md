# Changelog

All notable changes to Chocolatine are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0]

### Added

- **Quota indicator** in the app header showing Copilot `premium_interactions` usage with a color-coded progress bar (green under 50%, yellow 50-80%, red over 80%), overage visualization via striped bar extension, and a detailed tooltip with usage breakdown. Auto-refreshes every 5 minutes with a manual refresh button.

### Changed

- Copilot SDK upgraded from 1.0.5 to 1.0.6.

## [0.2.0]

### Added

- **BYOK (Bring Your Own Key)** support for third-party model providers such as DeepSeek.
- AI Providers settings tab for configuring BYOK provider endpoints and API keys.
- Model catalog integration — BYOK models are fetched and displayed alongside Copilot models.
- BYOK model lock — prevents accidental model switching during active BYOK sessions.
- `.github/instructions/` — coding standards for TypeScript, CSS, Markdown, and general practices.
- `.github/skills/` — project skills: grill-with-docs, review-changes, review-to-issues, to-issues.

### Changed

- Copilot SDK upgraded from 1.0.3 to 1.0.5.
- Model selector now displays BYOK models with provider labels.
- Session manager supports BYOK provider injection for review and chat sessions.
- Supported models and troubleshooting documentation updated for BYOK.

### Fixed

- Follow-up panel layout gap when resizing the window.
- Skills integration improvements for review runs.

## [0.1.0]

### Added

- Azure DevOps pull request review with GitHub Copilot.
- Multi-organization support with PAT-based authentication.
- Follow-up conversations on review results.
- General-purpose Copilot chat (Ask).
- Skills library for reusable review instruction skills.
- Prompt library for reusable prompt templates.
- Rules library for per-language review rules with auto-injection.
- Task queue with configurable concurrency.
- Task results viewer for raw model outputs.
- Local SQLite persistence with schema migrations.
- Local JSON settings file for app configuration.
