import { RuntimeConnection } from '@github/copilot-sdk';
import type { CopilotClientOptions } from '@github/copilot-sdk';
import { app } from 'electron';
import { dirname, join } from 'path';
import { accessSync, constants, mkdirSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Isolated root directory for Copilot runtime data.
 * We point the SDK baseDirectory to `<userData>/copilot-home/.copilot`
 * so session state is separated from the user's global `~/.copilot`.
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
  const copilotBaseDirectory = join(copilotHome, '.copilot');
  mkdirSync(copilotBaseDirectory, { recursive: true });
  const cliPath = resolveNativeCopilotCliPath();

  return {
    connection: RuntimeConnection.forStdio({ path: cliPath }),
    workingDirectory: copilotHome,
    baseDirectory: copilotBaseDirectory,
    logLevel: 'debug',
    env: process.env
  };
}
