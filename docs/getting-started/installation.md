# Installation

> Install Chocolatine and its dependencies on Windows.

## Overview

Chocolatine is a Windows Electron desktop application. The public launch posture is source-first: you build and package it locally from source.

## Where It Lives in the App

N/A — this is a pre-launch step.

## Prerequisites

- **Windows 10 or 11**
- **Node.js 20, 22, 24, or 26** (includes npm)
- **GitHub Copilot access** — a valid GitHub account with Copilot enabled (Business or Individual)
- **Azure DevOps account** — with access to the target organization and project

## How to Install

### From Source (Development)

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd chocolatine
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the app in development mode:
   ```bash
   npm run dev
   ```
   This launches Electron with hot-reload via `electron-vite`.

### Build a Distributable

1. Build the production bundle:
   ```bash
   npm run build
   ```

2. Package as an installer:
   ```bash
   npm run package
   ```
   Packaged artifacts are written to the `release/` folder.

3. Optionally, preview the production build before packaging:
   ```bash
   npm run preview
   ```

## Tips & Best Practices

- Use Node.js LTS versions only — odd-numbered versions may cause native module issues with `better-sqlite3`.
- If `npm install` fails on native modules, run `npm run postinstall` to rebuild native dependencies for Electron.
- The first launch creates a settings file at `C:\Users\<you>\AppData\Roaming\Chocolatine\config\settings.json`.
- Linux and macOS are roadmap targets, not currently supported platforms.
- `npm run package` is a contributor self-build path, not an official signed release channel.

## Related

- [First-Run Setup](first-run-setup.md) — Configure the app after installation.
- [Quick Start](quick-start.md) — Run your first review.
