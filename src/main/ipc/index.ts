import { registerAskIpc } from '@main/ipc/ask';
import { registerFollowUpIpc } from '@main/ipc/followUp';
import { registerPullRequestsIpc } from '@main/ipc/pullRequests';
import { registerReviewsIpc } from '@main/ipc/reviews';
import { registerRulesIpc } from '@main/ipc/rules';
import { registerSettingsIpc } from '@main/ipc/settings';
import { registerSkillsIpc } from '@main/ipc/skills';
import { registerUiPreferencesIpc } from '@main/ipc/uiPreferences';
import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/constants/ipcChannels';
import { MainIpcServices, type RegisterIpcArgs } from '@main/ipc/types';

export const registerIpc = (...args: RegisterIpcArgs) => {
  const services = MainIpcServices.fromArgs(...args);

  registerSettingsIpc(services);
  registerRulesIpc(services);
  registerPullRequestsIpc(services);
  registerReviewsIpc(services);
  registerAskIpc(services);
  registerFollowUpIpc(services);
  registerUiPreferencesIpc(services);
  registerSkillsIpc(services);

  ipcMain.handle(IpcChannels.COPILOT_GET_QUOTA, async () => {
    if (!services.copilotSessionManager) {
      return {};
    }
    return services.copilotSessionManager.getQuota();
  });
};
