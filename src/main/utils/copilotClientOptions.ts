import { RuntimeConnection } from '@github/copilot-sdk';
import type { CopilotClientOptions } from '@github/copilot-sdk';
import { app } from 'electron';
import { dirname, join } from 'path';
import { accessSync, constants, mkdirSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Isolated working directory for Copilot runtime sessions.
 * Session state is separated by using a Chocolatine-specific working
 * directory while authentication is handled via the global ~/.copilot
 * (so the user's existing Copilot CLI login is reused).
 *
 * Resolved path (Windows): `%APPDATA%/chocolatine/copilot-home`
 */
let _copilotHome: string | null = null;

function getCopilotHome(): string {
  if (!_copilotHome) {
    _copilotHome = join(app.getPath('userData'), 'copilot-home');
    mkdirSync(_copilotHome, { recursive: true });
  }
  return _copilotHome;
}

function resolveNativeCopilotCliPath(): string {
  const nativePackageName = `@github/copilot-${process.platform}-${process.arch}`;

  try {
    const resolvedEntry = require.resolve(nativePackageName);
    const expectedBinaryName = process.platform === 'win32' ? 'copilot.exe' : 'copilot';
    const binaryPath = resolvedEntry.endsWith(expectedBinaryName)
      ? resolvedEntry
      : join(dirname(resolvedEntry), expectedBinaryName);
    accessSync(binaryPath, constants.F_OK);
    return binaryPath;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to resolve native Copilot CLI binary from "${nativePackageName}" for ${process.platform}-${process.arch}. ${reason}`
    );
  }
}

/**
 * Build `CopilotClientOptions` that isolate the Copilot CLI's session
 * storage away from the user's home directory.
 */
export function buildCopilotClientOptions(): CopilotClientOptions {
  const copilotHome = getCopilotHome();
  const cliPath = resolveNativeCopilotCliPath();

  return {
    connection: RuntimeConnection.forStdio({ path: cliPath }),
    workingDirectory: copilotHome,
    logLevel: 'debug',
    env: process.env
  };
}
