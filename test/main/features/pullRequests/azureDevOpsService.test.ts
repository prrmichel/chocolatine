import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCreatePullRequestThreadError, mapUpdatePullRequestThreadStatusError } from '../../../../src/main/features/pullRequests/azureDevOpsErrors.ts';

test('maps Azure DevOps permission errors to a safe message', () => {
  assert.equal(
    mapCreatePullRequestThreadError(403),
    'You do not have permission to send comments to this pull request.'
  );
});

test('maps Azure DevOps auth errors to a safe message', () => {
  assert.equal(
    mapCreatePullRequestThreadError(401),
    'Azure DevOps authentication failed. Check the configured token and try again.'
  );
});

test('maps unknown failures to a generic safe message', () => {
  assert.equal(
    mapCreatePullRequestThreadError(418),
    'Unable to send the comment to Azure DevOps.'
  );
});

test('maps thread status permission errors to a safe message', () => {
  assert.equal(
    mapUpdatePullRequestThreadStatusError(403),
    'You do not have permission to update this pull request comment.'
  );
});

test('maps unknown thread status failures to a generic safe message', () => {
  assert.equal(
    mapUpdatePullRequestThreadStatusError(418),
    'Unable to update the pull request comment.'
  );
});
