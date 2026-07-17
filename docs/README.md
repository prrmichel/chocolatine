# Chocolatine Documentation

> AI-powered Azure DevOps pull request reviewer, built on GitHub Copilot.

Chocolatine is a Windows desktop application that lets you review Azure DevOps pull requests using GitHub Copilot. It provides persistent review history, follow-up conversations, reusable prompt templates, a rules engine, and a general-purpose AI chat — all stored locally in SQLite.

Current public posture: Windows-only, Azure DevOps-only, source-first. GitHub Releases provide versioned source archives and changelogs; self-build packaging only.

---

## Table of Contents

### Getting Started

- [Installation](getting-started/installation.md) — Prerequisites, install steps, and first launch.
- [First-Run Setup](getting-started/first-run-setup.md) — Configure Azure DevOps and app defaults.
- [Quick Start](getting-started/quick-start.md) — Run your first AI code review in under 5 minutes.

### Features

- **[Pull Requests](features/pull-requests/overview.md)** — The primary workspace for browsing, reviewing, and discussing PRs.
  - [Summary Tab](features/pull-requests/summary-tab.md) — PR metadata and review run overview.
  - [Changes Tab](features/pull-requests/changes-tab.md) — Code diffs with inline AI and human comments.
  - [Work Items Tab](features/pull-requests/work-items-tab.md) — Linked work items and AI-generated summaries.
  - [Reviews Tab](features/pull-requests/reviews-tab.md) — Run, inspect, and manage Copilot code reviews.
  - [Follow-up Tab](features/pull-requests/follow-up-tab.md) — Persistent chat on top of review results.
  - [User Comments Tab](features/pull-requests/user-comments-tab.md) — Azure DevOps discussion threads.
- [Skills Library](features/skills-library.md) — Create and sync reusable review instruction skills from repositories.
- [Prompt Library](features/prompt-library.md) — Create and manage reusable prompt templates.
- [Rules Library](features/rules-library.md) — Define per-language review rules auto-injected into prompts.
- [Ask](features/ask.md) — General-purpose Copilot chat, independent of any PR.
- [Quota Indicator](features/quota-indicator.md) — Monitor Copilot usage quota in the app header.
- [Task Queue](features/task-queue.md) — Monitor and control running/queued review jobs.
- [Task Results](features/task-results.md) — Inspect raw model outputs for completed jobs.

### Settings

- [Azure DevOps](settings/azure-devops.md) — Organizations, PR sources, PAT, and connection test.
- [AI Providers](settings/ai-providers.md) — Configure BYOK providers like DeepSeek.
- [Preferences](settings/preferences.md) — Default model, diff mode, concurrency, panel colors.
- [Data Management](settings/data-management.md) — Database location, purge, and cleanup.

### Concepts

- [Review Execution](concepts/review-execution.md) — Queue mechanics, concurrency, chunking, usage diagnostics.
- [Session Management](concepts/session-management.md) — How Copilot sessions are reused or isolated per feature.
- [BYOK (Bring Your Own Key)](concepts/byok.md) — How third-party model providers integrate via the Copilot SDK.
- [Persistence](concepts/persistence.md) — Local storage, PAT handling, external data flows, and migrations.
- [Rules Injection](concepts/rules-injection.md) — How language rules are matched and injected into prompts.

### Reference

- [Supported Models](reference/supported-models.md) — SDK-driven model-catalog behavior.
- [Keyboard Shortcuts](reference/keyboard-shortcuts.md) — Productivity shortcuts.
- [Troubleshooting](reference/troubleshooting.md) — Common issues and solutions.

### Repository Policies

- [Code of Conduct](../CODE_OF_CONDUCT.md)
- [Contributing](../CONTRIBUTING.md)
- [Support](../SUPPORT.md)
- [Security](../SECURITY.md)
- [Changelog](../CHANGELOG.md)
