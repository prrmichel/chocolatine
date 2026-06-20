import { AzureDevOpsSettings, CreatePullRequestThreadInput, CreatePullRequestThreadResult, PullRequestDetails, PullRequestFileChange, PullRequestIteration, PullRequestStatus, PullRequestSummary, PullRequestThread, PullRequestWorkItem, UpdatePullRequestThreadStatusInput, UpdatePullRequestThreadStatusResult } from '@shared/types/models';
import { mapCreatePullRequestThreadError, mapUpdatePullRequestThreadStatusError } from './azureDevOpsErrors';

export class AzureDevOpsService {
  constructor(
    private readonly runtimeAccess: () => { settings: AzureDevOpsSettings; credentialError: string | null },
    private readonly repositoryFilter?: () => string | null
  ) {}
  private static readonly MAX_INLINE_IMAGE_BYTES = 5_000_000;

  private static readonly PAGE_SIZE = 100;
  private static readonly AUTO_EXPAND_THRESHOLD = 50;
  private static readonly AUTO_EXPAND_MAX_PAGES = 5;

  async getPullRequests(status: PullRequestStatus, creatorId?: string): Promise<PullRequestSummary[]> {
    const options = this.ensureConfigured();
    const statusValue = status === 'active' ? 'active' : status === 'completed' ? 'completed' : status === 'abandoned' ? 'abandoned' : 'all';
    const repo = this.repositoryFilter?.()?.trim();
    const basePath = repo
      ? `${this.getBaseUrl(options)}/git/repositories/${encodeURIComponent(repo)}/pullrequests`
      : `${this.getBaseUrl(options)}/git/pullrequests`;

    const creatorParam = creatorId ? `&searchCriteria.creatorId=${encodeURIComponent(creatorId)}` : '';

    const fetchPage = async (skip: number): Promise<any[]> => {
      const url = `${basePath}?searchCriteria.status=${statusValue}&$top=${AzureDevOpsService.PAGE_SIZE}&$skip=${skip}${creatorParam}&api-version=${options.apiVersion}`;
      const doc = await this.getJson(url, options);
      return doc.value ?? [];
    };

    const allItems = await fetchPage(0);

    // When the initial page returns fewer than the threshold, load more pages
    // to surface older pull requests without hurting the common-case performance.
    if (allItems.length < AzureDevOpsService.AUTO_EXPAND_THRESHOLD) {
      const seenIds = new Set(allItems.map((item: any) => item.pullRequestId));
      for (let page = 1; page < AzureDevOpsService.AUTO_EXPAND_MAX_PAGES; page++) {
        const pageItems = await fetchPage(page * AzureDevOpsService.PAGE_SIZE);
        if (pageItems.length === 0) break;
        for (const item of pageItems) {
          if (!seenIds.has(item.pullRequestId)) {
            seenIds.add(item.pullRequestId);
            allItems.push(item);
          }
        }
        if (pageItems.length < AzureDevOpsService.PAGE_SIZE) break;
      }
    }

    return allItems.map((item: any) => this.mapPullRequestSummary(item));
  }

  private mapPullRequestSummary(item: any): PullRequestSummary {
    const reviewers = Array.isArray(item.reviewers) ? item.reviewers : [];
    const reviewerAudiences = reviewers
      .filter((reviewer: any) => Boolean(reviewer?.isContainer))
      .map((reviewer: any) => ({
        name: String(reviewer?.displayName ?? reviewer?.uniqueName ?? '').trim(),
        vote: typeof reviewer?.vote === 'number' ? reviewer.vote : null
      }))
      .filter((reviewer: { name: string }) => reviewer.name.length > 0);
    const individualReviewers: { name: string; vote: number | null }[] = reviewers
      .filter((reviewer: any) => !reviewer?.isContainer)
      .map((reviewer: any) => ({
        name: String(reviewer?.displayName ?? reviewer?.uniqueName ?? '').trim(),
        vote: typeof reviewer?.vote === 'number' ? reviewer.vote : null
      }))
      .filter((r: { name: string }) => r.name.length > 0);
    return {
      reviewerAudiences,
      reviewers: individualReviewers,
      id: item.pullRequestId,
      title: item.title ?? '',
      status: item.status ?? '',
      repository: item.repository?.name ?? '',
      author: item.createdBy?.displayName ?? '',
      authorId: item.createdBy?.id ?? '',
      isDraft: Boolean(item.isDraft),
      sourceRef: item.sourceRefName ?? '',
      targetRef: item.targetRefName ?? '',
      createdDate: item.creationDate ?? new Date().toISOString()
    } as PullRequestSummary;
  }

  async testConnection(overrideSettings?: Partial<AzureDevOpsSettings>): Promise<{ ok: boolean; message: string }> {
    try {
      const { settings: base, credentialError } = this.runtimeAccess();
      const options: AzureDevOpsSettings = { ...base, ...overrideSettings };
      if (!options.organization || !options.project) {
        return { ok: false, message: 'Organization and project are required.' };
      }
      if (!options.pat) {
        return { ok: false, message: credentialError ?? 'Personal Access Token is required.' };
      }
      const url = `https://dev.azure.com/${options.organization}/${options.project}/_apis/git/repositories?api-version=${options.apiVersion ?? '7.1'}`;
      const response = await fetch(url, { headers: this.buildHeaders(options) });
      if (response.ok) {
        const data = await response.json();
        const count = Array.isArray(data?.value) ? data.value.length : '?';
        return { ok: true, message: `Connected — ${count} repositor${count === 1 ? 'y' : 'ies'} found.` };
      }
      if (response.status === 401 || response.status === 403) {
        return { ok: false, message: 'Authentication failed — check your PAT.' };
      }
      const text = await response.text().catch(() => '');
      return { ok: false, message: `HTTP ${response.status}: ${text || response.statusText}` };
    } catch (err: unknown) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getPullRequestDetails(pullRequestId: number): Promise<PullRequestDetails> {
    const options = this.ensureConfigured();
    const url = `${this.getBaseUrl(options)}/git/pullrequests/${pullRequestId}?api-version=${options.apiVersion}`;
    const root = await this.getJson(url, options);
    return {
      id: pullRequestId,
      title: root.title ?? '',
      description: root.description ?? '',
      status: root.status ?? '',
      repositoryId: root.repository?.id ?? '',
      repositoryName: root.repository?.name ?? '',
      author: root.createdBy?.displayName ?? '',
      isDraft: Boolean(root.isDraft),
      sourceBranch: root.sourceRefName ?? '',
      targetBranch: root.targetRefName ?? '',
      createdDate: root.creationDate ?? new Date().toISOString(),
      sourceCommitId: root.lastMergeSourceCommit?.commitId ?? '',
      targetCommitId: root.lastMergeTargetCommit?.commitId ?? '',
      reviewers: (root.reviewers ?? []).map((reviewer: any) => ({
        id: reviewer.id ?? reviewer.uniqueName ?? undefined,
        name: reviewer.displayName ?? reviewer.uniqueName ?? 'Unknown',
        vote: typeof reviewer.vote === 'number' ? reviewer.vote : null,
        isRequired: Boolean(reviewer.isRequired),
        isContainer: Boolean(reviewer.isContainer)
      }))
    };
  }

  async getPullRequestIterations(repositoryId: string, pullRequestId: number): Promise<PullRequestIteration[]> {
    const options = this.ensureConfigured();
    const url = `${this.getBaseUrl(options)}/git/repositories/${repositoryId}/pullRequests/${pullRequestId}/iterations?api-version=${options.apiVersion}`;
    const doc = await this.getJson(url, options);
    return (doc.value ?? []).map((item: any) => ({
      id: item.id,
      sourceCommitId: item.sourceRefCommit?.commitId ?? null,
      targetCommitId: item.targetRefCommit?.commitId ?? null
    }));
  }

  async getChangesForIteration(repositoryId: string, pullRequestId: number, iterationId: number): Promise<PullRequestFileChange[]> {
    const options = this.ensureConfigured();
    const changes: PullRequestFileChange[] = [];
    const seen = new Set<string>();
    const top = 200;
    let skip = 0;

    while (true) {
      const url = `${this.getBaseUrl(options)}/git/repositories/${repositoryId}/pullRequests/${pullRequestId}/iterations/${iterationId}/changes?$top=${top}&$skip=${skip}&api-version=${options.apiVersion}`;
      const root = await this.getJson(url, options);
      const entries = root.changeEntries ?? root.changes ?? [];
      let count = 0;
      for (const change of entries) {
        count++;
        const item = change.item ?? {};
        const path: string = item.path ?? '';

        // Skip folder / tree entries — the API returns parent directories as changes too
        if (item.isFolder || item.gitObjectType === 'tree') {
          continue;
        }

        const changeType = String(change.changeType ?? 'unknown');

        // Skip sourceRename entries (old path of a renamed file)
        if (changeType.toLowerCase().includes('sourcerename')) {
          continue;
        }

        // Deduplicate by path
        if (!path || seen.has(path)) {
          continue;
        }

        seen.add(path);
        changes.push({ path, changeType });
      }
      if (count < top) {
        break;
      }
      skip += top;
    }

    return changes;
  }

  async getPullRequestWorkItems(repositoryId: string, pullRequestId: number): Promise<PullRequestWorkItem[]> {
    const options = this.ensureConfigured();
    const url = `${this.getBaseUrl(options)}/git/repositories/${repositoryId}/pullRequests/${pullRequestId}/workitems?api-version=${options.apiVersion}`;
    const doc = await this.getJson(url, options);
    const items: PullRequestWorkItem[] = [];
    const ids: number[] = [];
    for (const item of doc.value ?? []) {
      const idValue = item.id;
      const id = typeof idValue === 'number' ? idValue : parseInt(idValue ?? '0', 10);
      const urlValue = item.url ?? '';
      if (id > 0 && urlValue) {
        items.push({ id, url: urlValue });
        ids.push(id);
      }
    }

    if (ids.length === 0) {
      return items;
    }

    const detailsById = await this.getWorkItemDetails(ids, options);
    const commentsById = await this.getWorkItemCommentsForIds(ids, options);

    return items.map((item) => {
      const detail = detailsById.get(item.id);
      const comments = commentsById.get(item.id) ?? [];
      return {
        ...item,
        title: detail?.title ?? '',
        description: detail?.description ?? '',
        acceptanceCriteria: detail?.acceptanceCriteria ?? '',
        reproStepsOrNewsletterDescription: detail?.reproStepsOrNewsletterDescription ?? '',
        comments
      };
    });
  }

  async getPullRequestThreads(repositoryId: string, pullRequestId: number): Promise<PullRequestThread[]> {
    const options = this.ensureConfigured();
    const url = `${this.getBaseUrl(options)}/git/repositories/${repositoryId}/pullRequests/${pullRequestId}/threads?api-version=${options.apiVersion}`;
    const doc = await this.getJson(url, options);
    const resolvedStatuses = new Set(['fixed', 'closed', 'bydesign', 'wontfix']);
    const mapped = (doc.value ?? []).map((thread: any) => {
      const status = String(thread.status ?? 'unknown').toLowerCase();
      const threadContext = thread.threadContext ?? {};
      const filePath = threadContext.filePath ?? undefined;
      const line = threadContext.rightFileStart?.line ?? threadContext.leftFileStart?.line ?? undefined;
        const comments = (thread.comments ?? [])
          .filter((c: any) => !c.isDeleted && c.commentType !== 'system')
          .map((c: any) => ({
            id: c.id ?? 0,
            content: String(c.content ?? ''),
            author: c.author?.displayName ?? c.author?.uniqueName ?? 'Unknown',
            publishedDate: c.publishedDate ?? new Date().toISOString(),
            likedBy: Array.isArray(c.usersLiked)
              ? c.usersLiked.map((u: any) => String(u?.displayName ?? u?.uniqueName ?? '').trim()).filter(Boolean)
              : Array.isArray(c.likedBy)
                ? c.likedBy.map((u: any) => String(u?.displayName ?? u?.uniqueName ?? '').trim()).filter(Boolean)
                : []
          }));
      return {
        id: thread.id ?? 0,
        status,
        filePath,
        line,
        comments,
        isResolved: resolvedStatuses.has(status)
      };
    }).filter((t: PullRequestThread) => t.comments.length > 0);
    const mentionCache = new Map<string, string>();
    const hydrated = await Promise.all(mapped.map(async (thread) => ({
      ...thread,
      comments: await Promise.all(thread.comments.map(async (comment) => {
        const withImages = await this.inlineThreadImages(comment.content, options);
        const withMentions = await this.replaceMentions(withImages, options, mentionCache);
        return {
          ...comment,
          content: withMentions
        };
      }))
    })));
    return hydrated;
  }

  async createPullRequestThread(input: CreatePullRequestThreadInput): Promise<CreatePullRequestThreadResult> {
    const options = this.ensureConfigured();
    const repositoryId = String(input.repositoryId ?? '').trim();
    const content = String(input.content ?? '').trim();
    const pullRequestId = Number(input.pullRequestId);

    if (!repositoryId || !Number.isFinite(pullRequestId) || pullRequestId <= 0) {
      throw new Error('The pull request could not be identified for comment publishing.');
    }
    if (!content) {
      throw new Error('The comment is empty. Update the message before sending it to Azure DevOps.');
    }

    const url = `${this.getBaseUrl(options)}/git/repositories/${repositoryId}/pullRequests/${pullRequestId}/threads?api-version=${options.apiVersion}`;
    const line = typeof input.line === 'number' && Number.isFinite(input.line) && input.line > 0
      ? Math.floor(input.line)
      : null;
    const filePath = typeof input.filePath === 'string' && input.filePath.trim()
      ? normalizeThreadFilePath(input.filePath)
      : null;

    const body: Record<string, unknown> = {
      comments: [{
        parentCommentId: 0,
        content,
        commentType: 1
      }],
      status: 1
    };

    if (filePath && line) {
      body.threadContext = {
        filePath,
        leftFileStart: null,
        leftFileEnd: null,
        rightFileStart: { line, offset: 1 },
        rightFileEnd: { line, offset: 1 }
      };
    }

    try {
      const doc = await this.postJson(url, options, body);
      return {
        threadId: Number(doc?.id ?? 0),
        commentId: Number(doc?.comments?.[0]?.id ?? 0),
        publishedDate: String(doc?.publishedDate ?? doc?.comments?.[0]?.publishedDate ?? new Date().toISOString()),
        filePath: typeof doc?.threadContext?.filePath === 'string' ? doc.threadContext.filePath : filePath ?? undefined,
        line: typeof doc?.threadContext?.rightFileStart?.line === 'number' ? doc.threadContext.rightFileStart.line : line ?? undefined
      };
    } catch (error) {
      if (error instanceof AzureDevOpsHttpError) {
        console.warn('[ADO] Failed to create pull request thread', {
          status: error.status,
          statusText: error.statusText,
          body: error.body.slice(0, 500)
        });
        throw new Error(mapCreatePullRequestThreadError(error.status));
      }
      throw error;
    }
  }

  async updatePullRequestThreadStatus(input: UpdatePullRequestThreadStatusInput): Promise<UpdatePullRequestThreadStatusResult> {
    const options = this.ensureConfigured();
    const repositoryId = String(input.repositoryId ?? '').trim();
    const pullRequestId = Number(input.pullRequestId);
    const threadId = Number(input.threadId);
    const requestedStatus = input.status === 'active' ? 'active' : 'resolved';

    if (!repositoryId || !Number.isFinite(pullRequestId) || pullRequestId <= 0 || !Number.isFinite(threadId) || threadId <= 0) {
      throw new Error('The pull request comment could not be identified for status update.');
    }

    const url = `${this.getBaseUrl(options)}/git/repositories/${repositoryId}/pullRequests/${pullRequestId}/threads/${threadId}?api-version=${options.apiVersion}`;
    const body = {
      status: requestedStatus === 'active' ? 1 : 2
    };

    try {
      const doc = await this.patchJson(url, options, body);
      const status = String(doc?.status ?? (requestedStatus === 'active' ? 'active' : 'fixed')).toLowerCase();
      return {
        threadId,
        status,
        isResolved: new Set(['fixed', 'closed', 'bydesign', 'wontfix']).has(status)
      };
    } catch (error) {
      if (error instanceof AzureDevOpsHttpError) {
        console.warn('[ADO] Failed to update pull request thread status', {
          status: error.status,
          statusText: error.statusText,
          body: error.body.slice(0, 500)
        });
        throw new Error(mapUpdatePullRequestThreadStatusError(error.status));
      }
      throw error;
    }
  }

  async assignReviewerToPullRequest(repositoryId: string, pullRequestId: number): Promise<void> {
    const options = this.ensureConfigured();
    const url = `${this.getBaseUrl(options)}/git/repositories/${repositoryId}/pullRequests/${pullRequestId}/reviewers/me?api-version=${options.apiVersion}`;
    await this.putJson(url, options, { id: 'me', vote: 0 });
  }

  async getItemContent(repositoryId: string, path: string, commitId: string): Promise<string> {
    const options = this.ensureConfigured();
    if (!path || !commitId) {
      return '';
    }
    const encodedPath = encodeURIComponent(path);
    const url = `${this.getBaseUrl(options)}/git/repositories/${repositoryId}/items?path=${encodedPath}&versionDescriptor.version=${commitId}&versionDescriptor.versionType=commit&includeContent=true&api-version=${options.apiVersion}`;
    const response = await fetch(url, { headers: this.buildHeaders(options) });
    if (!response.ok) {
      return '';
    }
    const jsonText = await response.text();
    try {
      const json = JSON.parse(jsonText);
      return json.content ?? '';
    } catch {
      return '';
    }
  }

  /**
   * Fetch the folder tree of a repository path using the Items - List endpoint.
   * Returns an array of items with their paths, types, and (for files) content.
   */
  async getRepositoryTree(
    repositoryId: string,
    scopePath: string,
    branch?: string,
    overrideSettings?: AzureDevOpsSettings
  ): Promise<Array<{ path: string; isFolder: boolean; content?: string }>> {
    const options = overrideSettings ?? this.ensureConfigured();
    // ADO expects the scopePath with literal slashes — do NOT encodeURIComponent the whole path.
    // Prefix with '/' if missing (ADO paths are rooted).
    const normalizedScope = scopePath.startsWith('/') ? scopePath : `/${scopePath}`;
    let url = `${this.getBaseUrl(options)}/git/repositories/${repositoryId}/items?scopePath=${encodeURI(normalizedScope)}&recursionLevel=full&includeContentMetadata=true&api-version=${options.apiVersion}`;
    if (branch) {
      url += `&versionDescriptor.version=${encodeURIComponent(branch)}&versionDescriptor.versionType=branch`;
    }
    const response = await fetch(url, { headers: this.buildHeaders(options) });
    if (!response.ok) {
      if (response.status === 404) return [];
      const text = await response.text();
      throw new Error(`Failed to fetch repository tree: ${text || response.statusText}`);
    }
    const json = await response.json();
    const items: Array<{ path: string; gitObjectType: string; url?: string }> = json.value ?? [];
    return items.map((item) => ({
      path: item.path,
      isFolder: item.gitObjectType === 'tree'
    }));
  }

  /**
   * Fetch a single file's content from a branch (not a commit).
   * Used to download SKILL.md files from the default branch.
   */
  async getItemContentFromBranch(
    repositoryId: string,
    path: string,
    branch: string,
    overrideSettings?: AzureDevOpsSettings
  ): Promise<string> {
    const options = overrideSettings ?? this.ensureConfigured();
    if (!path || !branch) return '';
    // Use the raw download endpoint — returns plain text reliably.
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.getBaseUrl(options)}/git/repositories/${repositoryId}/items?path=${encodeURI(normalizedPath)}&versionDescriptor.version=${encodeURIComponent(branch)}&versionDescriptor.versionType=branch&api-version=${options.apiVersion}`;
    const response = await fetch(url, {
      headers: {
        ...this.buildAuthHeaders(options),
        Accept: 'text/plain'
      }
    });
    if (!response.ok) {
      console.warn(`[ADO] getItemContentFromBranch failed for "${normalizedPath}": ${response.status} ${response.statusText}`);
      return '';
    }
    return response.text();
  }

  /**
   * Fetch the default branch name for a repository.
   * Returns the branch name without the "refs/heads/" prefix.
   */
  async getDefaultBranch(repositoryId: string, overrideSettings?: AzureDevOpsSettings): Promise<string> {
    const options = overrideSettings ?? this.ensureConfigured();
    const url = `${this.getBaseUrl(options)}/git/repositories/${repositoryId}?api-version=${options.apiVersion}`;
    const json = await this.getJson(url, options);
    const defaultBranch: string = json.defaultBranch ?? 'refs/heads/main';
    return defaultBranch.replace(/^refs\/heads\//, '');
  }

  /**
   * List all repositories in the current project.
   */
  async getRepositories(overrideSettings?: AzureDevOpsSettings): Promise<Array<{ id: string; name: string; defaultBranch?: string }>> {
    const options = overrideSettings ?? this.ensureConfigured();
    const url = `${this.getBaseUrl(options)}/git/repositories?api-version=${options.apiVersion}`;
    const json = await this.getJson(url, options);
    const repos: any[] = json.value ?? [];
    return repos.map((r) => ({
      id: r.id,
      name: r.name,
      defaultBranch: typeof r.defaultBranch === 'string' ? r.defaultBranch.replace(/^refs\/heads\//, '') : undefined
    }));
  }

  private ensureConfigured(): AzureDevOpsSettings {
    const { settings: options, credentialError } = this.runtimeAccess();
    if (!options.organization || !options.project) {
      throw new Error('Azure DevOps configuration is missing. Update settings.');
    }
    if (!options.pat) {
      throw new Error(credentialError ?? 'Azure DevOps PAT is missing. Update settings.');
    }
    return options;
  }

  private getBaseUrl(options: AzureDevOpsSettings) {
    return `https://dev.azure.com/${options.organization}/${options.project}/_apis`;
  }

  private async inlineThreadImages(html: string, options: AzureDevOpsSettings): Promise<string> {
    if (!html || (!html.includes('<img') && !html.includes('data-src') && !html.includes('!['))) {
      return html;
    }
    const normalizedHtml = html.replace(markdownImageRegex, (_match, altText: string, url: string) => {
      const safeAlt = escapeHtmlAttr(altText);
      return `<img alt="${safeAlt}" src="${url}" />`;
    });
    const formattedHtml = normalizedHtml.replace(codeBlockRegex, (_match, code: string) => {
      const trimmed = code.replace(/\s+$/, '');
      return `<pre><code>${escapeHtmlAttr(trimmed)}</code></pre>`;
    });
    const imgRegex = /(src|data-src)\s*=\s*(?:"([^"]*)"|'([^']*)'|&quot;([\s\S]*?)&quot;|&#34;([\s\S]*?)&#34;|&apos;([\s\S]*?)&apos;|&#39;([\s\S]*?)&#39;)/gi;
    const srcs = new Set<string>();
    for (const match of formattedHtml.matchAll(imgRegex)) {
      const src = match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? match[7];
      if (src) {
        srcs.add(src);
      }
    }
    if (srcs.size === 0) {
      return html;
    }
    const replacements = new Map<string, string>();
    const baseUrl = `https://dev.azure.com/${options.organization}/${options.project}`;
    await Promise.all(
      Array.from(srcs).map(async (src) => {
        if (src.startsWith('data:')) {
          return;
        }
        const normalizedSrc = decodeHtmlEntities(src);
        let url: URL;
        try {
          url = new URL(normalizedSrc, baseUrl);
        } catch {
          return;
        }
        const hostname = url.hostname.toLowerCase();
        if (!hostname.endsWith('dev.azure.com') && !hostname.endsWith('visualstudio.com')) {
          return;
        }
        try {
          const response = await fetch(url.toString(), { headers: this.buildAuthHeaders(options) });
          if (!response.ok) {
            return;
          }
          const rawContentType = response.headers.get('content-type') ?? '';
          const contentType = rawContentType.split(';')[0].trim().toLowerCase();
          const resolvedType = resolveImageContentType(url, response.headers, contentType);
          if (!resolvedType) {
            return;
          }
          const contentLength = response.headers.get('content-length');
          if (contentLength && Number(contentLength) > AzureDevOpsService.MAX_INLINE_IMAGE_BYTES) {
            return;
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.byteLength > AzureDevOpsService.MAX_INLINE_IMAGE_BYTES) {
            return;
          }
          const dataUrl = `data:${resolvedType};base64,${buffer.toString('base64')}`;
          replacements.set(src, dataUrl);
        } catch {
          // Ignore failed inline image fetches
        }
      })
    );
    if (replacements.size === 0) {
      return html;
    }
    let output = formattedHtml;
    for (const [src, dataUrl] of replacements) {
      output = output.split(src).join(dataUrl);
    }
    return output;
  }

  private async replaceMentions(html: string, options: AzureDevOpsSettings, cache: Map<string, string>): Promise<string> {
    const mentionIds = extractMentionIds(html);
    if (mentionIds.length === 0) {
      return html;
    }
    const resolved = await Promise.all(mentionIds.map(async (id) => {
      if (cache.has(id)) {
        return [id, cache.get(id) ?? ''] as const;
      }
      const displayName = await this.getIdentityDisplayName(id, options);
      if (displayName) {
        cache.set(id, displayName);
      }
      return [id, displayName] as const;
    }));
    let output = html;
    for (const [id, displayName] of resolved) {
      const label = displayName || id;
      const replacement = `<span class="ado-mention" data-mention-id="${id}">@${escapeHtmlAttr(label)}</span>`;
      output = output
        .replace(new RegExp(`@<${escapeRegExp(id)}>`, 'g'), replacement)
        .replace(new RegExp(`@&lt;${escapeRegExp(id)}&gt;`, 'g'), replacement)
        .replace(new RegExp(`@&#60;${escapeRegExp(id)}&#62;`, 'g'), replacement);
    }
    return output;
  }

  private async getIdentityDisplayName(id: string, options: AzureDevOpsSettings): Promise<string> {
    const apiVersion = '7.1-preview.1';
    try {
      const directUrl = `https://vssps.dev.azure.com/${options.organization}/_apis/identities?identityIds=${encodeURIComponent(id)}&api-version=${apiVersion}`;
      const directResponse = await fetch(directUrl, { headers: this.buildHeaders(options) });
      if (directResponse.ok) {
        const data = await directResponse.json();
        const first = (data?.value ?? [])[0];
        const displayName = first?.displayName ?? first?.providerDisplayName ?? '';
        const resolved = String(displayName ?? '').trim();
        if (resolved) {
          return resolved;
        }
      }
      const fallbackUrl = `https://vssps.dev.azure.com/${options.organization}/_apis/identities?searchFilter=General&filterValue=${encodeURIComponent(id)}&api-version=${apiVersion}`;
      const fallbackResponse = await fetch(fallbackUrl, { headers: this.buildHeaders(options) });
      if (!fallbackResponse.ok) {
        return await this.getGraphDisplayName(id, options) ?? '';
      }
      const fallbackData = await fallbackResponse.json();
      const fallbackFirst = (fallbackData?.value ?? [])[0];
      const fallbackDisplay = fallbackFirst?.displayName ?? fallbackFirst?.providerDisplayName ?? '';
      const fallbackResolved = String(fallbackDisplay ?? '').trim();
      if (fallbackResolved) {
        return fallbackResolved;
      }
      return await this.getGraphDisplayName(id, options) ?? '';
    } catch {
      return await this.getGraphDisplayName(id, options) ?? '';
    }
  }

  private async getGraphDisplayName(id: string, options: AzureDevOpsSettings): Promise<string | null> {
    const apiVersion = '7.1-preview.1';
    const descriptor = id.startsWith('vssgp.') || id.startsWith('vssps.') ? id : null;
    try {
      const resolvedByDescriptor = await this.getGraphIdentityName(descriptor, options, apiVersion);
      if (resolvedByDescriptor) {
        return resolvedByDescriptor;
      }
      const descriptorFromStorage = descriptor ? null : await this.getGraphDescriptor(id, options, apiVersion);
      const resolvedByStorageDescriptor = await this.getGraphIdentityName(descriptorFromStorage, options, apiVersion);
      if (resolvedByStorageDescriptor) {
        return resolvedByStorageDescriptor;
      }
      return await this.getGraphSubjectLookupName(id, options, apiVersion);
    } catch {
      return null;
    }
  }

  private async getGraphDescriptor(storageKey: string, options: AzureDevOpsSettings, apiVersion: string): Promise<string | null> {
    const url = `https://vssps.dev.azure.com/${options.organization}/_apis/graph/descriptors/${encodeURIComponent(storageKey)}?api-version=${apiVersion}`;
    try {
      const response = await fetch(url, { headers: this.buildHeaders(options) });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      const descriptor = data?.value ?? '';
      return String(descriptor ?? '').trim() || null;
    } catch {
      return null;
    }
  }

  private async getGraphIdentityName(descriptor: string | null, options: AzureDevOpsSettings, apiVersion: string): Promise<string | null> {
    if (!descriptor) {
      return null;
    }
    const url = `https://vssps.dev.azure.com/${options.organization}/_apis/graph/identities/${encodeURIComponent(descriptor)}?api-version=${apiVersion}`;
    try {
      const response = await fetch(url, { headers: this.buildHeaders(options) });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      const name = data?.displayName ?? data?.providerDisplayName ?? '';
      const resolved = String(name ?? '').trim();
      return resolved || null;
    } catch {
      return null;
    }
  }

  private async getGraphSubjectLookupName(storageKey: string, options: AzureDevOpsSettings, apiVersion: string): Promise<string | null> {
    const lookupUrl = `https://vssps.dev.azure.com/${options.organization}/_apis/graph/subjectlookup?api-version=${apiVersion}`;
    const body = { lookupKeys: [{ storageKey }] };
    try {
      const response = await fetch(lookupUrl, {
        method: 'POST',
        headers: {
          ...this.buildHeaders(options),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      const subjects = data?.subjects ?? {};
      const first = Object.values(subjects)[0] as any;
      const name = first?.displayName ?? first?.providerDisplayName ?? '';
      const resolved = String(name ?? '').trim();
      return resolved || null;
    } catch {
      return null;
    }
  }
  private buildAuthHeaders(options: AzureDevOpsSettings) {
    const token = Buffer.from(`:${options.pat}`).toString('base64');
    return {
      Authorization: `Basic ${token}`
    } as Record<string, string>;
  }

  private buildHeaders(options: AzureDevOpsSettings) {
    return {
      ...this.buildAuthHeaders(options),
      Accept: 'application/json'
    } as Record<string, string>;
  }

  private async getJson(url: string, options: AzureDevOpsSettings) {
    const response = await fetch(url, { headers: this.buildHeaders(options) });
    if (!response.ok) {
      throw await createAzureDevOpsHttpError(response);
    }
    return response.json();
  }

  private async postJson(url: string, options: AzureDevOpsSettings, body: unknown) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.buildHeaders(options),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw await createAzureDevOpsHttpError(response);
    }
    return response.json();
  }

  private async putJson(url: string, options: AzureDevOpsSettings, body: unknown) {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this.buildHeaders(options),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw await createAzureDevOpsHttpError(response);
    }
    await response.text();
  }

  private async patchJson(url: string, options: AzureDevOpsSettings, body: unknown) {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.buildHeaders(options),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw await createAzureDevOpsHttpError(response);
    }
    const raw = await response.text();
    return raw ? JSON.parse(raw) : {};
  }

  private async getWorkItemDetails(ids: number[], options: AzureDevOpsSettings) {
    const url = `${this.getBaseUrl(options)}/wit/workitemsbatch?api-version=${options.apiVersion}`;
    const doc = await this.postJson(url, options, {
      ids,
      fields: [
        'System.Title',
        'System.Description',
        'Microsoft.VSTS.Common.AcceptanceCriteria',
        'Microsoft.VSTS.TCM.ReproSteps',
      ]
    });

    const result = new Map<number, { title: string; description: string; acceptanceCriteria: string; reproStepsOrNewsletterDescription: string }>();
    for (const item of doc.value ?? []) {
      const id = Number(item?.id ?? 0);
      if (!id) {
        continue;
      }
      const fields = item?.fields ?? {};
      const reproSteps = String(fields['Microsoft.VSTS.TCM.ReproSteps'] ?? '');
      const newsletterDescription = String(fields['Custom.NewsletterDescription'] ?? '');
      result.set(id, {
        title: String(fields['System.Title'] ?? ''),
        description: String(fields['System.Description'] ?? ''),
        acceptanceCriteria: String(fields['Microsoft.VSTS.Common.AcceptanceCriteria'] ?? ''),
        reproStepsOrNewsletterDescription: reproSteps || newsletterDescription
      });
    }
    return result;
  }

  private async getWorkItemCommentsForIds(ids: number[], options: AzureDevOpsSettings) {
    const result = new Map<number, { text: string; author?: string }[]>();
    const resolveAuthor = (comment: any) => {
      const createdBy = comment?.createdBy ?? {};
      const modifiedBy = comment?.modifiedBy ?? {};
      const value =
        createdBy?.displayName ??
        createdBy?.userDisplayName ??
        createdBy?.['user-display-name'] ??
        modifiedBy?.displayName ??
        modifiedBy?.userDisplayName ??
        modifiedBy?.['user-display-name'] ??
        comment?.userDisplayName ??
        comment?.['user-display-name'] ??
        createdBy?.name ??
        modifiedBy?.name ??
        createdBy?.uniqueName ??
        modifiedBy?.uniqueName ??
        '';

      return String(value).trim();
    };

    await Promise.all(
      ids.map(async (id) => {
        try {
          const url = `${this.getBaseUrl(options)}/wit/workItems/${id}/comments?api-version=7.1-preview.4`;
          const doc = await this.getJson(url, options);
          const comments = (doc.comments ?? [])
            .map((comment: any) => ({
              text: String(comment?.text ?? comment?.renderedText ?? ''),
              author: resolveAuthor(comment)
            }))
            .filter((value: { text: string; author?: string }) => value.text.trim().length > 0);
          result.set(id, comments);
        } catch {
          result.set(id, []);
        }
      })
    );
    return result;
  }
}

const decodeHtmlEntities = (value: string) => value
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#34;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&#39;/g, "'")
  .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_match, num) => String.fromCharCode(parseInt(num, 10)));

class AzureDevOpsHttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: string
  ) {
    super(body || statusText);
    this.name = 'AzureDevOpsHttpError';
  }
}

const createAzureDevOpsHttpError = async (response: Response): Promise<AzureDevOpsHttpError> => {
  const body = await response.text().catch(() => '');
  return new AzureDevOpsHttpError(response.status, response.statusText, body);
};

const normalizeThreadFilePath = (value: string): string => {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized ? `/${normalized}` : '';
};

const resolveImageContentType = (url: URL, headers: Headers, contentType: string) => {
  if (contentType.startsWith('image/')) {
    return contentType;
  }
  const fileNameParam = url.searchParams.get('fileName') || url.searchParams.get('filename');
  const contentDisposition = headers.get('content-disposition') ?? '';
  const dispositionMatch = /filename\*?=(?:UTF-8''|")?([^";]+)"/i.exec(contentDisposition) ?? /filename\*?=(?:UTF-8'')?([^;]+)/i.exec(contentDisposition);
  const fileName = fileNameParam || dispositionMatch?.[1] || '';
  const extension = (fileName.split('.').pop() || url.pathname.split('.').pop() || '').toLowerCase();
  if (!extension) {
    return null;
  }
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'svg':
    case 'svg+xml':
      return 'image/svg+xml';
    default:
      return null;
  }
};

const extractMentionIds = (html: string) => {
  const ids = new Set<string>();
  const patterns = [
    /@<([0-9a-fA-F-]{32,36})>/g,
    /@&lt;([0-9a-fA-F-]{32,36})&gt;/g,
    /@&#60;([0-9a-fA-F-]{32,36})&#62;/g,
    /@<([^>\s]+)>/g,
    /@&lt;([^>\s]+)&gt;/g,
    /@&#60;([^>\s]+)&#62;/g,
    /data-vss-mention\s*=\s*["']([^"']+)["']/g,
    /data-mention-id\s*=\s*["']([^"']+)["']/g
  ];
  for (const regex of patterns) {
    let match = regex.exec(html);
    while (match) {
      ids.add(match[1]);
      match = regex.exec(html);
    }
  }
  return Array.from(ids);
};

const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
const codeBlockRegex = /```[\w-]*\s*([\s\S]*?)```/g;

const escapeHtmlAttr = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
