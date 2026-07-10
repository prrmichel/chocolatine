import { registerAskIpc } from '@main/ipc/ask';
import { registerFollowUpIpc } from '@main/ipc/followUp';
import { registerPullRequestsIpc } from '@main/ipc/pullRequests';
import { registerReviewsIpc } from '@main/ipc/reviews';
import { registerRulesIpc } from '@main/ipc/rules';
import { registerSettingsIpc } from '@main/ipc/settings';
import { registerSkillsIpc } from '@main/ipc/skills';
import { registerUiPreferencesIpc } from '@main/ipc/uiPreferences';
import { registerQuotaIpc } from '@main/ipc/quota';
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
  registerQuotaIpc(services);
};
