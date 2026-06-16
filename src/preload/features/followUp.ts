import { ipcRenderer } from 'electron';
import type { FollowUpContext, FollowUpContextSummary, PullRequestSummary, ReviewJob } from '@shared/types/models';
import { IpcChannels } from '@shared/constants/ipcChannels';
import { onIpcPayload } from '@preload/features/events';

export const followUpApi = {
  createFollowUpContext: (job: ReviewJob): Promise<FollowUpContext> =>
    ipcRenderer.invoke(IpcChannels.FOLLOW_UP_CREATE_CONTEXT, job),
  deleteFollowUpContext: (pullRequest: PullRequestSummary, contextId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.FOLLOW_UP_DELETE_CONTEXT, pullRequest, contextId),
  getFollowUpContexts: (pullRequest: PullRequestSummary): Promise<FollowUpContextSummary[]> =>
    ipcRenderer.invoke(IpcChannels.FOLLOW_UP_GET_CONTEXTS, pullRequest),
  getFollowUpContext: (pullRequest: PullRequestSummary, contextId: string): Promise<FollowUpContext | null> =>
    ipcRenderer.invoke(IpcChannels.FOLLOW_UP_GET_CONTEXT, pullRequest, contextId),
  sendFollowUpMessage: (contextId: string, message: string, modelName?: string): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.FOLLOW_UP_SEND, contextId, message, modelName),
  cancelFollowUpMessage: (contextId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.FOLLOW_UP_CANCEL, contextId),
  onFollowUpDelta: (handler: (payload: { contextId: string; delta: string; fullText: string }) => void) =>
    onIpcPayload(IpcChannels.FOLLOW_UP_DELTA, handler),
  onFollowUpMessageComplete: (handler: (payload: { contextId: string }) => void) =>
    onIpcPayload(IpcChannels.FOLLOW_UP_MESSAGE_COMPLETE, handler)
};