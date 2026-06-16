import { askApi } from './ask';
import { followUpApi } from './followUp';
import { pullRequestsApi } from './pullRequests';
import { reviewsApi } from './reviews';
import { rulesApi } from './rules';
import { settingsApi } from './settings';
import { skillsApi } from './skills';
import { uiPreferencesApi } from './uiPreferences';

export { type RendererApi } from './base';

export const api = {
  ...settingsApi,
  ...rulesApi,
  ...pullRequestsApi,
  ...reviewsApi,
  ...askApi,
  ...followUpApi,
  ...skillsApi,
  ...uiPreferencesApi
};
