import { app, BrowserWindow, Menu, nativeImage, session, shell } from 'electron';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';
import { join } from 'path';
import { AzureDevOpsService } from '@main/features/pullRequests/azureDevOpsService';
import { DiffService } from '@main/features/pullRequests/diffService';
import { PullRequestChangesService } from '@main/features/pullRequests/pullRequestChangesService';
import { CopilotReviewService } from '@main/core/copilot/copilotReviewService';
import { ReviewQueueService } from '@main/features/reviewQueue/reviewQueueService';
import { ReviewWorktreeService } from '@main/features/reviewWorktree/reviewWorktreeService';
import { SettingsStore } from '@main/core/persistence/settingsStore';
import { PromptLibraryService } from '@main/core/persistence/promptLibraryService';
import { ReviewStorageService } from '@main/core/persistence/reviewStorageService';
import { DatabaseService } from '@main/core/persistence/databaseService';
import { migrateFilesToDatabase } from '@main/core/persistence/migrationService';
import { registerIpc } from './ipc';
import { wireReviewQueueEvents, wireReviewWorktreeEvents, wireAskEvents, wireFollowUpEvents } from '@main/events';
import { AskService } from '@main/features/ask/askService';
import { FollowUpService } from '@main/features/followUp/followUpService';
import { CopilotSessionManager } from '@main/core/copilot/copilotSessionManager';
import { SkillsService } from '@main/features/skills/skillsService';

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);
const APP_RENDERER_URL = process.env.ELECTRON_RENDERER_URL ?? process.env.VITE_DEV_SERVER_URL;

function getAllowedRendererOrigin(): string | null {
  if (!APP_RENDERER_URL) {
    return null;
  }
  try {
    return new URL(APP_RENDERER_URL).origin;
  } catch {
    return null;
  }
}

const ALLOWED_RENDERER_ORIGIN = getAllowedRendererOrigin();

function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const parsedUrl = new URL(rawUrl);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(parsedUrl.protocol);
  } catch {
    return false;
  }
}

function isAllowedAppUrl(rawUrl: string): boolean {
  if (!rawUrl) {
    return false;
  }
  if (rawUrl.startsWith('file://')) {
    return true;
  }
  if (!ALLOWED_RENDERER_ORIGIN) {
    return false;
  }
  try {
    return new URL(rawUrl).origin === ALLOWED_RENDERER_ORIGIN;
  } catch {
    return false;
  }
}

app.commandLine.appendSwitch('enable-features', 'WebSpeechRecognition,OnDeviceSpeechRecognition');

// Suppress Electron security warnings in dev — they are dev-mode only and disappear when packaged
if (!app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

// Core services
const settingsStore = new SettingsStore();
const databaseService = new DatabaseService(settingsStore.getConfiguredDatabaseFolderPath());
settingsStore.setDatabase(databaseService);

// One-time migration from file-based storage → SQLite
migrateFilesToDatabase(settingsStore, databaseService);

const azureService = new AzureDevOpsService(
  () => settingsStore.getAzureDevOpsRuntimeAccess(),
  () => settingsStore.getActivePrSourceRepository()
);
const diffService = new DiffService();
const changesService = new PullRequestChangesService(azureService, diffService);
const copilotReviewService = new CopilotReviewService();
const reviewStorageService = new ReviewStorageService(databaseService);
const copilotSessionManager = new CopilotSessionManager(databaseService);
copilotReviewService.setSessionManager(copilotSessionManager);
// Wire BYOK provider resolution for session injection
copilotReviewService.setByokProviderResolver(
  (modelName) => settingsStore.resolveByokProvider(modelName)
);
const promptLibraryService = new PromptLibraryService(databaseService);
const askService = new AskService(copilotReviewService, copilotSessionManager);
const followUpService = new FollowUpService(copilotReviewService, reviewStorageService, copilotSessionManager);
const skillsService = new SkillsService(databaseService, azureService, settingsStore);
const reviewWorktreeService = new ReviewWorktreeService(azureService, settingsStore);
skillsService.restoreGlobalSkillFiles();
try {
  skillsService.validateAllSkillsIntegrity();
} catch (err) {
  console.warn('[Skills] Startup integrity validation failed:', err);
}
const reviewQueueService = new ReviewQueueService(
  copilotReviewService,
  () => settingsStore.getSettings(),
  reviewStorageService,
  changesService,
  reviewWorktreeService,
  copilotSessionManager,
  skillsService
);

/**
 * ── Icon variant selection ────────────────────────────────────────────────────
 * Change ICON_VARIANT (1–10) to pick your favourite chocolatine icon.
 * All variants are generated into resources/icons/ at first startup so you
 * can preview them before choosing.
 *
 *  1  Classic Gold     — golden gradient, two chocolate bars, lamination lines
 *  2  App Badge        — rounded-square amber bg, cream pastry + bars
 *  3  Dark Rich        — near-black bg, glowing golden pastry
 *  4  Flat Vibrant     — flat solid amber + jet-black bars, zero gradients
 *  5  Cross-Section    — top/end view: layered interior + chocolate bars
 *  6  Flaky Layers     — alternating light/dark horizontal stripes + bars
 *  7  Circle Badge     — warm-brown circle bg, golden pastry inside
 *  8  Bold Pixel       — extra-wide bars, bright yellow, max contrast at 16 px
 *  9  Warm Radial      — radial-gradient circle bg, lighter cream pastry
 * 10  Elegant White    — white bg, dark border, classic internals
 */
export const ICON_VARIANT = 1;

type RGBA = [number, number, number, number];

function buildIconPng(variant: number): Buffer {
  // ── PNG encoder ──────────────────────────────────────────────────────────
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();
  const crc32 = (buf: Buffer) => {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length, 0);
    const tb = Buffer.from(type, 'ascii');
    const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
    return Buffer.concat([lb, tb, data, cb]);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const inRect = (x: number, y: number, rx: number, ry: number, rw: number, rh: number) =>
    x >= rx && x < rx + rw && y >= ry && y < ry + rh;
  const inCircle = (x: number, y: number, ccx: number, ccy: number, r: number) =>
    Math.hypot(x - ccx, y - ccy) <= r;
  const inRR = (x: number, y: number, rx: number, ry: number, rw: number, rh: number, r: number): boolean => {
    if (x < rx || x > rx + rw || y < ry || y > ry + rh) return false;
    const corners: [number, number][] = [[rx+r, ry+r],[rx+rw-r, ry+r],[rx+r, ry+rh-r],[rx+rw-r, ry+rh-r]];
    const nearEdge = x < rx+r || x > rx+rw-r || y < ry+r || y > ry+rh-r;
    if (!nearEdge) return true;
    return corners.some(([cx2, cy2]) => {
      const inCornerZone = x < rx+r === (cx2 === rx+r) && y < ry+r === (cy2 === ry+r);
      return inCornerZone ? Math.hypot(x - cx2, y - cy2) <= r : false;
    }) || (!corners.every(([cx2, cy2]) => Math.hypot(x - cx2, y - cy2) > r)
      && (x >= rx+r && x <= rx+rw-r || y >= ry+r && y <= ry+rh-r));
  };

  // Shared pastry geometry
  const BX = 28, BY = 78, BW = 200, BH = 100;
  const bars = (x: number, y: number, bx: number, by: number, bh: number, bw = 24): boolean => {
    const b1 = x >= bx+50 && x < bx+50+bw;
    const b2 = x >= bx+126 && x < bx+126+bw;
    return (b1 || b2) && y >= by && y < by+bh;
  };

  // ── Per-variant pixel functions ───────────────────────────────────────────
  const getPixel = (x: number, y: number): RGBA => {
    switch (variant) {

      // 1 ── Classic Gold
      case 1: {
        if (!inRect(x, y, BX, BY, BW, BH)) return [0,0,0,0];
        if (bars(x, y, BX, BY, BH)) return [42, 12, 2, 255];
        const relY = y - BY, t = relY / BH;
        const r = clamp(235 - t*65), g = clamp(162 - t*72), b = clamp(30 - t*18);
        if (relY % 11 < 2) return [clamp(r+25), clamp(g+18), b, 255];
        return [r, g, b, 255];
      }

      // 2 ── App Badge (rounded square)
      case 2: {
        const r = 44;
        if (!inRR(x, y, 4, 4, 248, 248, r)) return [0,0,0,0];
        const ppx = 38, ppy = 93, ppw = 180, pph = 70;
        if (!inRect(x, y, ppx, ppy, ppw, pph)) return [210, 115, 18, 255];
        if (bars(x, y, ppx, ppy, pph, 22)) return [40, 12, 2, 255];
        return [242, 192, 48, 255];
      }

      // 3 ── Dark Rich
      case 3: {
        const bg: RGBA = [22, 10, 3, 255];
        if (!inRect(x, y, BX, BY, BW, BH)) return bg;
        if (bars(x, y, BX, BY, BH)) return [32, 10, 2, 255];
        const relY = y - BY, t = relY / BH;
        const glow = Math.max(0, 1 - Math.abs(x - 128) / 90);
        const r = clamp(245 - t*80 + glow*15), g = clamp(170 - t*80 + glow*10), b = clamp(35 - t*20);
        if (relY % 10 < 2) return [clamp(r+20), clamp(g+15), b, 255];
        return [r, g, b, 255];
      }

      // 4 ── Flat Vibrant
      case 4: {
        if (!inRect(x, y, BX, BY, BW, BH)) return [0,0,0,0];
        if (bars(x, y, BX, BY, BH)) return [25, 6, 0, 255];
        return [218, 132, 8, 255];
      }

      // 5 ── Cross-Section (end/top view)
      case 5: {
        const rx = 28, ry = 28, rw = 200, rh = 200;
        if (!inRect(x, y, rx, ry, rw, rh)) return [0,0,0,0];
        const rim = 14;
        const ix = rx+rim, iy = ry+rim, iw = rw-rim*2, ih = rh-rim*2;
        if (!inRect(x, y, ix, iy, iw, ih)) {
          const t = 0.75;
          return [clamp(235*t), clamp(158*t), clamp(28*t), 255];
        }
        // Alternating horizontal layers
        const lh = 20;
        const li = Math.floor((y - iy) / lh);
        const lr = li % 2 === 0 ? 228 : 210, lg = li % 2 === 0 ? 152 : 138, lb = li % 2 === 0 ? 28 : 22;
        // Chocolate bars (cross-section rects)
        const cb1 = x >= 86 && x < 116 && y >= iy+28 && y < iy+ih-28;
        const cb2 = x >= 140 && x < 170 && y >= iy+28 && y < iy+ih-28;
        if (cb1 || cb2) return [42, 12, 2, 255];
        return [lr, lg, lb, 255];
      }

      // 6 ── Flaky Layers
      case 6: {
        if (!inRect(x, y, BX, BY, BW, BH)) return [0,0,0,0];
        if (bars(x, y, BX, BY, BH)) return [42, 12, 2, 255];
        const relY = y - BY, t = relY / BH;
        const li = Math.floor(relY / 9);
        const base = li % 2 === 0 ? 235 : 210;
        const r = clamp(base - t*50), g = clamp((li % 2 === 0 ? 162 : 145) - t*50), b = clamp(30 - t*15);
        return [r, g, b, 255];
      }

      // 7 ── Circle Badge
      case 7: {
        if (!inCircle(x, y, 128, 128, 122)) return [0,0,0,0];
        const ppx = 38, ppy = 96, ppw = 180, pph = 64;
        if (!inRect(x, y, ppx, ppy, ppw, pph)) return [108, 52, 12, 255];
        if (bars(x, y, ppx, ppy, pph, 22)) return [42, 12, 2, 255];
        const t = (y - ppy) / pph;
        return [clamp(242 - t*55), clamp(188 - t*65), clamp(45 - t*22), 255];
      }

      // 8 ── Bold Pixel (great at 16 px)
      case 8: {
        if (!inRect(x, y, BX, BY, BW, BH)) return [0,0,0,0];
        const b1 = x >= BX+40 && x < BX+86;
        const b2 = x >= BX+114 && x < BX+160;
        if (b1 || b2) return [15, 4, 0, 255];
        return [255, 198, 0, 255];
      }

      // 9 ── Warm Radial
      case 9: {
        const d = Math.hypot(x - 128, y - 128);
        if (d > 122) return [0,0,0,0];
        const t = d / 122;
        const bgR = clamp(225 - t*100), bgG = clamp(138 - t*90), bgB = clamp(20 - t*15);
        const ppx = 33, ppy = 85, ppw = 190, pph = 86;
        if (!inRect(x, y, ppx, ppy, ppw, pph)) return [bgR, bgG, bgB, 255];
        if (bars(x, y, ppx, ppy, pph, 24)) return [42, 12, 2, 255];
        const pt = (y - ppy) / pph;
        return [clamp(248 - pt*40), clamp(204 - pt*55), clamp(58 - pt*28), 255];
      }

      // 10 ── Elegant White
      case 10: {
        if (!inRect(x, y, 0, 0, 256, 256)) return [255, 248, 228, 255];
        if (!inRect(x, y, BX, BY, BW, BH)) return [255, 248, 228, 255];
        const bw = 5;
        const onBorder = x < BX+bw || x >= BX+BW-bw || y < BY+bw || y >= BY+BH-bw;
        if (onBorder) return [75, 38, 5, 255];
        if (bars(x, y, BX, BY, BH)) return [42, 12, 2, 255];
        const relY = y - BY, t = relY / BH;
        const r = clamp(242 - t*52), g = clamp(188 - t*62), b = clamp(42 - t*22);
        if (relY % 10 < 2) return [clamp(r+14), clamp(g+10), b, 255];
        return [r, g, b, 255];
      }

      default: return [0, 0, 0, 0];
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const W = 256, H = 256;
  const raw: number[] = [];
  for (let y = 0; y < H; y++) {
    raw.push(0);
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = getPixel(x, y);
      raw.push(r, g, b, a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const compressed = deflateSync(Buffer.from(raw), { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

export function ensureIconVariants(resourcesDir: string): void {
  const dir = join(resourcesDir, 'icons');
  mkdirSync(dir, { recursive: true });
  let generated = 0;
  for (let v = 1; v <= 10; v++) {
    const p = join(dir, `icon-${v}.png`);
    if (!existsSync(p)) {
      try { writeFileSync(p, buildIconPng(v)); generated++; } catch { /* skip */ }
    }
  }
  if (generated > 0) {
    // Leave generated icons on disk; the user can pick one from the folder.
  }
}


const createWindow = () => {
  const preload = join(__dirname, '../preload/index.cjs');

  const resourcesDir = join(__dirname, '../../resources');
  const iconPath = join(resourcesDir, 'icon.png');
  const appIcon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: '#1e1e1e',
    autoHideMenuBar: true,
    icon: appIcon,
    title: 'Chocolatine',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);

  registerIpc(settingsStore, azureService, changesService, promptLibraryService, reviewQueueService, reviewStorageService, askService, followUpService, databaseService, copilotSessionManager, skillsService, reviewWorktreeService);
  wireReviewQueueEvents(mainWindow, reviewQueueService);
  wireReviewWorktreeEvents(mainWindow, reviewWorktreeService);
  wireAskEvents(mainWindow, askService);
  wireFollowUpEvents(mainWindow, followUpService);

  const devServerUrl = process.env.ELECTRON_RENDERER_URL ?? process.env.VITE_DEV_SERVER_URL;

  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error('[main] did-fail-load', { code, desc, url });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main] render-process-gone', details);
  });

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    const openDevTools = process.env.OPEN_DEVTOOLS === '1';
    if (openDevTools) {
      const devToolsMode = process.env.OPEN_DEVTOOLS_MODE === 'right' ? 'right' : 'detach';
      mainWindow.webContents.openDevTools({ mode: devToolsMode });
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedAppUrl(url)) {
      return;
    }
    event.preventDefault();
    console.warn('[security] Blocked navigation to unexpected URL', { url });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    } else {
      console.warn('[security] Blocked external URL with unsupported protocol', { url });
    }
    return { action: 'deny' };
  });
};

app.whenReady().then(() => {
  settingsStore.finalizeProtectedSettingsPersistence();

  const isAllowedPermission = (permission: string) =>
    permission === 'media' || permission === 'clipboard-read' || permission === 'clipboard-sanitized-write';

  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    if (!isAllowedPermission(permission)) {
      return false;
    }
    return isAllowedAppUrl(requestingOrigin);
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (!isAllowedPermission(permission)) {
      callback(false);
      return;
    }
    const origin = details.requestingUrl ?? '';
    const allowed = isAllowedAppUrl(origin);
    callback(allowed);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Gracefully shut down persistent Copilot sessions and the SDK client
  try { await copilotSessionManager.shutdown(); } catch { /* ignore */ }
  try { databaseService.close(); } catch { /* ignore */ }
});
