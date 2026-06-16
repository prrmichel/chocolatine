import process from 'node:process';
import { rebuild } from '@electron/rebuild';
import { createRequire } from 'node:module';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const electronPackage = require('electron/package.json');

function ensureVscodeJsonrpcNodeShim() {
  const packageDir = join(process.cwd(), 'node_modules', 'vscode-jsonrpc');
  const target = join(packageDir, 'node');

  if (!existsSync(packageDir) || existsSync(target)) {
    return;
  }

  writeFileSync(
    target,
    "module.exports = require('./node.js');\n",
    'utf-8'
  );

  console.log('[postinstall] Added vscode-jsonrpc/node compatibility shim.');
}

async function run() {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (major >= 27) {
    console.warn(
      '[postinstall] Node 27+ detected. Native module rebuild may be unstable with some dependencies; Node 20/22 LTS is recommended.'
    );
  }

  console.log('[postinstall] Rebuilding native modules for Electron...');

  ensureVscodeJsonrpcNodeShim();

  await rebuild({
    buildPath: process.cwd(),
    electronVersion: electronPackage.version,
    force: true,
    onlyModules: ['better-sqlite3']
  });

  console.log('[postinstall] Native module rebuild finished.');
}

run().catch((error) => {
  console.error('[postinstall] Native module rebuild failed.');
  console.error(error);
  process.exit(1);
});
