import { BrowserWindow } from 'electron';
import { ReviewQueueService } from '@main/features/reviewQueue/reviewQueueService';
import { ReviewWorktreeService } from '@main/features/reviewWorktree/reviewWorktreeService';
import { AskService } from '@main/features/ask/askService';
import { FollowUpService } from '@main/features/followUp/followUpService';
import { IpcChannels } from '@shared/constants/ipcChannels';

/** Throttle interval for high-frequency review-queue events (streaming deltas). */
const REVIEW_QUEUE_THROTTLE_MS = 200;

export const wireReviewQueueEvents = (window: BrowserWindow, reviewQueue: ReviewQueueService) => {
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    pending = false;
    timer = null;
    if (!window.isDestroyed()) {
      window.webContents.send(IpcChannels.REVIEW_QUEUE_CHANGED);
    }
  };

  const send = () => {
    if (timer) {
      pending = true;
      return;
    }
    flush();
    timer = setTimeout(() => {
      if (pending) flush();
      else timer = null;
    }, REVIEW_QUEUE_THROTTLE_MS);
  };

  reviewQueue.on('changed', send);
  window.on('closed', () => {
    reviewQueue.off('changed', send);
    if (timer) { clearTimeout(timer); timer = null; }
  });
};

export const wireReviewWorktreeEvents = (window: BrowserWindow, reviewWorktreeService: ReviewWorktreeService) => {
  const send = (status: unknown) => {
    if (!window.isDestroyed()) {
      window.webContents.send(IpcChannels.REVIEW_WORKTREE_CHANGED, status);
    }
  };

  reviewWorktreeService.on('changed', send);
  window.on('closed', () => {
    reviewWorktreeService.off('changed', send);
  });
};

/** Throttle interval for streaming delta events (ask / follow-up). */
const STREAMING_DELTA_THROTTLE_MS = 100;

export const wireAskEvents = (window: BrowserWindow, askService: AskService) => {
  // Buffer the latest delta payload and flush at most once per interval
  let latestDelta: { contextId: string; delta: string; fullText: string } | null = null;
  let deltaTimer: ReturnType<typeof setTimeout> | null = null;

  const flushDelta = () => {
    deltaTimer = null;
    if (latestDelta && !window.isDestroyed()) {
      window.webContents.send(IpcChannels.ASK_DELTA, latestDelta);
      latestDelta = null;
    }
  };

  const onDelta = (payload: { contextId: string; delta: string; fullText: string }) => {
    latestDelta = payload;
    if (!deltaTimer) {
      flushDelta();
      deltaTimer = setTimeout(flushDelta, STREAMING_DELTA_THROTTLE_MS);
    }
  };

  const onComplete = (payload: { contextId: string }) => {
    // Flush any pending delta before the completion event
    if (deltaTimer) { clearTimeout(deltaTimer); deltaTimer = null; }
    if (latestDelta && !window.isDestroyed()) {
      window.webContents.send(IpcChannels.ASK_DELTA, latestDelta);
      latestDelta = null;
    }
    if (!window.isDestroyed()) {
      window.webContents.send(IpcChannels.ASK_MESSAGE_COMPLETE, payload);
    }
  };

  askService.on(IpcChannels.ASK_DELTA, onDelta);
  askService.on(IpcChannels.ASK_MESSAGE_COMPLETE, onComplete);
  window.on('closed', () => {
    askService.off(IpcChannels.ASK_DELTA, onDelta);
    askService.off(IpcChannels.ASK_MESSAGE_COMPLETE, onComplete);
    if (deltaTimer) { clearTimeout(deltaTimer); deltaTimer = null; }
  });
};

export const wireFollowUpEvents = (window: BrowserWindow, followUpService: FollowUpService) => {
  let latestDelta: { contextId: string; delta: string; fullText: string } | null = null;
  let deltaTimer: ReturnType<typeof setTimeout> | null = null;

  const flushDelta = () => {
    deltaTimer = null;
    if (latestDelta && !window.isDestroyed()) {
      window.webContents.send(IpcChannels.FOLLOW_UP_DELTA, latestDelta);
      latestDelta = null;
    }
  };

  const onDelta = (payload: { contextId: string; delta: string; fullText: string }) => {
    latestDelta = payload;
    if (!deltaTimer) {
      flushDelta();
      deltaTimer = setTimeout(flushDelta, STREAMING_DELTA_THROTTLE_MS);
    }
  };

  const onComplete = (payload: { contextId: string }) => {
    if (deltaTimer) { clearTimeout(deltaTimer); deltaTimer = null; }
    if (latestDelta && !window.isDestroyed()) {
      window.webContents.send(IpcChannels.FOLLOW_UP_DELTA, latestDelta);
      latestDelta = null;
    }
    if (!window.isDestroyed()) {
      window.webContents.send(IpcChannels.FOLLOW_UP_MESSAGE_COMPLETE, payload);
    }
  };

  followUpService.on(IpcChannels.FOLLOW_UP_DELTA, onDelta);
  followUpService.on(IpcChannels.FOLLOW_UP_MESSAGE_COMPLETE, onComplete);
  window.on('closed', () => {
    followUpService.off(IpcChannels.FOLLOW_UP_DELTA, onDelta);
    followUpService.off(IpcChannels.FOLLOW_UP_MESSAGE_COMPLETE, onComplete);
    if (deltaTimer) { clearTimeout(deltaTimer); deltaTimer = null; }
  });
};
