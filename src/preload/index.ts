import { contextBridge } from 'electron';
import { askApi } from '@preload/features/ask';
import { followUpApi } from '@preload/features/followUp';
import { pullRequestsApi } from '@preload/features/pullRequests';
import { reviewsApi } from '@preload/features/reviews';
import { rulesApi } from '@preload/features/rules';
import { settingsApi } from '@preload/features/settings';
import { skillsApi } from '@preload/features/skills';
import { uiPreferencesApi } from '@preload/features/uiPreferences';

const api = {
  ...settingsApi,
  ...rulesApi,
  ...pullRequestsApi,
  ...reviewsApi,
  ...askApi,
  ...followUpApi,
  ...skillsApi,
  ...uiPreferencesApi
};

try {
  contextBridge.exposeInMainWorld('epullrequest', api);
} catch (error) {
  console.error('[preload] Failed to expose API via contextBridge', error);
}
