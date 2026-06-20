export const mapCreatePullRequestThreadError = (status: number): string => {
  switch (status) {
    case 400:
      return 'Azure DevOps rejected this comment. Refresh the pull request and try again.';
    case 401:
      return 'Azure DevOps authentication failed. Check the configured token and try again.';
    case 403:
      return 'You do not have permission to send comments to this pull request.';
    case 404:
      return 'The pull request is no longer available from Azure DevOps. Refresh and try again.';
    case 409:
      return 'The pull request changed while the comment was being sent. Refresh and try again.';
    case 429:
      return 'Azure DevOps is rate-limiting comment creation right now. Please wait a moment and try again.';
    default:
      if (status >= 500) {
        return 'Azure DevOps is temporarily unavailable. Please try again later.';
      }
      return 'Unable to send the comment to Azure DevOps.';
  }
};

export const mapUpdatePullRequestThreadStatusError = (status: number): string => {
  switch (status) {
    case 400:
      return 'Azure DevOps rejected the thread status change. Refresh the pull request and try again.';
    case 401:
      return 'Azure DevOps authentication failed. Check the configured token and try again.';
    case 403:
      return 'You do not have permission to update this pull request comment.';
    case 404:
      return 'The pull request comment is no longer available from Azure DevOps. Refresh and try again.';
    case 409:
      return 'The pull request comment changed while it was being updated. Refresh and try again.';
    case 429:
      return 'Azure DevOps is rate-limiting comment updates right now. Please wait a moment and try again.';
    default:
      if (status >= 500) {
        return 'Azure DevOps is temporarily unavailable. Please try again later.';
      }
      return 'Unable to update the pull request comment.';
  }
};
