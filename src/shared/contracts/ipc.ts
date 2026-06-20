/**
 * All IPC channel names used between main, preload, and renderer.
 * Single source of truth — import this everywhere instead of using string literals.
 */
export const IpcChannels = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_PICK_REVIEW_STORAGE_FOLDER: 'settings:pickReviewStorageFolder',

  PROMPT_LIBRARY_GET: 'promptLibrary:get',
  PROMPT_LIBRARY_SAVE: 'promptLibrary:save',
  PROMPT_LIBRARY_ADD: 'promptLibrary:add',
  PROMPT_LIBRARY_REMOVE: 'promptLibrary:remove',

  AZURE_GET_PULL_REQUESTS: 'azure:getPullRequests',
  AZURE_GET_PULL_REQUEST_DETAILS: 'azure:getPullRequestDetails',
  AZURE_GET_PULL_REQUEST_WORK_ITEMS: 'azure:getPullRequestWorkItems',
  AZURE_GET_PULL_REQUEST_DIFFS: 'azure:getPullRequestDiffs',
  AZURE_GET_PULL_REQUEST_FILE_CHANGES: 'azure:getPullRequestFileChanges',
  AZURE_GET_SINGLE_FILE_DIFF: 'azure:getSingleFileDiff',
  AZURE_GET_PULL_REQUEST_THREADS: 'azure:getPullRequestThreads',
  AZURE_CREATE_PULL_REQUEST_THREAD: 'azure:createPullRequestThread',
  AZURE_UPDATE_PULL_REQUEST_THREAD_STATUS: 'azure:updatePullRequestThreadStatus',
  AZURE_ASSIGN_REVIEWER_TO_PULL_REQUEST: 'azure:assignReviewerToPullRequest',
  AZURE_TEST_CONNECTION: 'azure:testConnection',
  AZURE_TEST_ORG_CONNECTION: 'azure:testOrgConnection',
  AZURE_TEST_STORED_ORG_CONNECTION: 'azure:testStoredOrgConnection',
  AZURE_GET_FULL_FILE_DIFF: 'azure:getFullFileDiff',
  AZURE_GET_REPOSITORIES: 'azure:getRepositories',

  SETTINGS_SET_ACTIVE_PR_SOURCE: 'settings:setActivePrSource',

  REVIEW_QUEUE_GET_JOBS: 'reviewQueue:getJobs',
  REVIEW_QUEUE_ENQUEUE: 'reviewQueue:enqueue',
  REVIEW_QUEUE_GENERATE_SUMMARY: 'reviewQueue:generateSummary',
  REVIEW_QUEUE_CLEAR_RESULTS: 'reviewQueue:clearResults',
  REVIEW_QUEUE_DELETE_JOB: 'reviewQueue:deleteJob',
  REVIEW_QUEUE_CANCEL: 'reviewQueue:cancel',
  REVIEW_QUEUE_RELOAD_PERSISTED: 'reviewQueue:reloadPersisted',
  REVIEW_QUEUE_HIDE_FINISHED: 'reviewQueue:hideFinished',
  REVIEW_QUEUE_SHOW_ALL: 'reviewQueue:showAll',
  REVIEW_WORKTREE_GET_STATUS: 'reviewWorktree:getStatus',
  REVIEW_WORKTREE_PRELOAD: 'reviewWorktree:preload',

  REVIEW_QUEUE_CHANGED: 'reviewQueue:changed',
  REVIEW_WORKTREE_CHANGED: 'reviewWorktree:changed',

  REVIEW_STORAGE_GET_JOBS: 'reviewStorage:getJobs',
  REVIEW_STORAGE_DELETE_ALL: 'reviewStorage:deleteAll',
  REVIEW_STORAGE_DELETE_FOR_PULL_REQUEST: 'reviewStorage:deleteForPullRequest',
  REVIEW_STORAGE_DELETE_JOB_FOR_PULL_REQUEST: 'reviewStorage:deleteJobForPullRequest',
  REVIEW_STORAGE_LOAD_WORK_ITEMS_SUMMARY_INSTRUCTIONS: 'reviewStorage:loadWorkItemsSummaryInstructions',
  REVIEW_STORAGE_SAVE_WORK_ITEMS_SUMMARY_INSTRUCTIONS: 'reviewStorage:saveWorkItemsSummaryInstructions',

  ASK_CREATE_CONTEXT: 'ask:createContext',
  ASK_DELETE_CONTEXT: 'ask:deleteContext',
  ASK_RENAME_CONTEXT: 'ask:renameContext',
  ASK_GET_CONTEXTS: 'ask:getContexts',
  ASK_GET_MESSAGES: 'ask:getMessages',
  ASK_SEND: 'ask:send',
  ASK_CANCEL: 'ask:cancel',

  ASK_DELTA: 'ask:delta',
  ASK_MESSAGE_COMPLETE: 'ask:messageComplete',

  FOLLOW_UP_CREATE_CONTEXT: 'followUp:createContext',
  FOLLOW_UP_DELETE_CONTEXT: 'followUp:deleteContext',
  FOLLOW_UP_GET_CONTEXTS: 'followUp:getContexts',
  FOLLOW_UP_GET_CONTEXT: 'followUp:getContext',
  FOLLOW_UP_SEND: 'followUp:send',
  FOLLOW_UP_CANCEL: 'followUp:cancel',

  FOLLOW_UP_DELTA: 'followUp:delta',
  FOLLOW_UP_MESSAGE_COMPLETE: 'followUp:messageComplete',

  PURGE_OLD_DATA: 'data:purgeOldData',

  UI_PREF_GET: 'uiPref:get',
  UI_PREF_SET: 'uiPref:set',

  COPILOT_LIST_MODELS: 'copilot:listModels',

  SKILLS_GET_ALL: 'skills:getAll',
  SKILLS_GET_FILES: 'skills:getFiles',
  SKILLS_SYNC_PROJECT: 'skills:syncProject',
  SKILLS_SAVE_GLOBAL: 'skills:saveGlobal',
  SKILLS_DELETE_GLOBAL: 'skills:deleteGlobal',
  SKILLS_DELETE_PROJECT: 'skills:deleteProject',
  SKILLS_TOGGLE_HIDDEN: 'skills:toggleHidden',
  SKILLS_UPDATE_LINKED_ORGS: 'skills:updateLinkedOrgs',
  SKILLS_GET_SYNC_STATUS: 'skills:getSyncStatus',
  SKILLS_RESOLVE_FOR_REVIEW: 'skills:resolveForReview',
  SKILLS_GET_PROJECT_KEYS: 'skills:getProjectKeys',
  SKILLS_OPEN_FOLDER: 'skills:openFolder',
  SKILLS_GET_INTEGRITY_SUMMARY: 'skills:getIntegritySummary',
  SKILLS_VALIDATE_ALL: 'skills:validateAll',
  SKILLS_SAVE_ALL_TO_DISK: 'skills:saveAllToDisk'
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];