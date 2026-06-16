# Chocolatine

Windows desktop app for reviewing Azure DevOps pull requests with GitHub Copilot.

## Current scope

- **Platform:** Windows 10/11
- **Linux/macOS:** not supported yet
- **PR source:** Azure DevOps only
- **AI requirement:** GitHub Copilot access
- **Publication posture:** source-first (self-build packaging only, no official signed binaries yet)

## Project status

Chocolatine started as a **side project** with a focus on delivering useful features quickly. The application is stable and actively maintained, but the architecture reflects pragmatic decisions made during that growth phase:

- **Feature-driven** — Core workflows (pull request review, follow-up conversations, persistent history) are solid and well-tested.
- **Organic architecture** — Design decisions prioritized iteration and user value over perfect structure. Some areas could benefit from refactoring.
- **Known technical debt** — We actively improve code quality and welcome contributors interested in both shipping features **and** improving architecture.

Contributors should see this as an **opportunity to improve** alongside delivering new features, not as a sign of poor engineering. See [Contributing](CONTRIBUTING.md) for how to get involved.

## Prerequisites

- Node.js 20, 22, 24, or 26 (includes npm)

## Local setup

```bash
npm install
npm run dev
```

## Publication gate (local)

```bash
npm run gate:publication-local
```

## Build and package

```bash
npm run build
npm run package
```

Packaged artifacts are written to `release/` for local self-build usage.

## Data and credential handling

- App settings are stored locally in `C:\Users\<you>\AppData\Roaming\Chocolatine\config\settings.json`.
- Review data, prompts, rules, and conversations are stored locally in SQLite.
- Azure DevOps PATs are used only for Azure DevOps API calls.
- AI prompts, diffs, and related review context are sent to GitHub Copilot for model processing.

See [Persistence](docs/concepts/persistence.md) for details, including external data flows and the protected-storage fallback contract decision.

## Documentation

Full documentation is available in [docs/README.md](docs/README.md).

## Project policies

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing](CONTRIBUTING.md)
- [Support](SUPPORT.md)
- [Security](SECURITY.md)
