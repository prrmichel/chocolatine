import process from 'node:process';
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const electronPackagePath = require.resolve('electron/package.json');
const electronPackageDir = dirname(electronPackagePath);
const electronRequire = createRequire(electronPackagePath);
const { downloadArtifact } = electronRequire('@electron/get');
const electronVersion = electronRequire('./package.json').version;
const platformExecutable = process.platform === 'win32' ? 'electron.exe' : 'electron';
const electronExecutablePath = join(electronPackageDir, 'dist', platformExecutable);
const electronPathFile = join(electronPackageDir, 'path.txt');
const electronVersionFile = join(electronPackageDir, 'dist', 'version');

function hasUsableElectronBinary() {
  if (!existsSync(electronExecutablePath)) {
    return false;
  }

  if (!existsSync(electronPathFile) || !existsSync(electronVersionFile)) {
    return false;
  }

  const executableName = readFileSync(electronPathFile, 'utf-8').trim();
  if (executableName !== platformExecutable) {
    return false;
  }

  const installedVersion = readFileSync(electronVersionFile, 'utf-8').trim().replace(/^v/, '');
  return installedVersion === electronVersion;
}

function escapeForSingleQuotedPowerShellLiteral(text) {
  return text.replaceAll("'", "''");
}

function extractZipWithPowerShell(zipPath, destinationPath) {
  const command = `Expand-Archive -LiteralPath '${escapeForSingleQuotedPowerShellLiteral(zipPath)}' -DestinationPath '${escapeForSingleQuotedPowerShellLiteral(destinationPath)}' -Force`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function installElectronBinary() {
  const downloadedZipPath = await downloadArtifact({
    version: electronVersion,
    artifactName: 'electron',
    platform: process.platform,
    arch: process.arch,
    checksums: electronRequire('./checksums.json'),
    cacheRoot: process.env.electron_config_cache
  });

  const tmpZipPath = join(tmpdir(), `chocolatine-electron-${Date.now()}.zip`);
  copyFileSync(downloadedZipPath, tmpZipPath);
  try {
    extractZipWithPowerShell(tmpZipPath, join(electronPackageDir, 'dist'));
    writeFileSync(electronPathFile, `${platformExecutable}\n`, 'utf-8');
  } finally {
    rmSync(tmpZipPath, { force: true });
  }
}

if (!hasUsableElectronBinary()) {
  console.warn('[predev] Electron binary is missing. Downloading Electron binary...');
  await installElectronBinary();
}

if (!hasUsableElectronBinary()) {
  console.error('[predev] Electron is still not installed correctly.');
  process.exit(1);
}
