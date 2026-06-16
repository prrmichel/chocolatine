import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAdoSettingsPolicy } from '../../../../src/main/core/persistence/adoSettingsPolicy.ts';

test('rejects PAT-bearing organization saves when protected storage is unavailable', () => {
  const result = applyAdoSettingsPolicy({
    currentOrganizations: [],
    currentOrganizationTokens: {},
    currentPrSources: [],
    requestedOrganizations: [
      {
        id: 'org-1',
        name: 'Org One',
        pat: 'new-pat'
      }
    ],
    requestedPrSources: [
      {
        id: 'src-1',
        name: 'Primary Source',
        organizationId: 'org-1',
        project: 'Project One',
        repository: null
      }
    ],
    requestedActivePrSourceId: 'src-1',
    protectedStorageAvailable: false
  });

  assert.deepEqual(result.organizations, []);
  assert.deepEqual(result.prSources, []);
  assert.equal(result.activePrSourceId, null);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ['protected-storage-unavailable', 'dependent-pr-source-rejected']
  );
  assert.match(result.message ?? '', /partially saved/i);
});

test('allows metadata-only organization updates when the stored PAT is unchanged', () => {
  const result = applyAdoSettingsPolicy({
    currentOrganizations: [{ id: 'org-1', name: 'Old Name' }],
    currentOrganizationTokens: { 'org-1': 'enc:v1:stored-token' },
    currentPrSources: [],
    requestedOrganizations: [
      {
        id: 'org-1',
        name: 'Renamed Org',
        pat: '',
        hasStoredPat: true
      }
    ],
    requestedPrSources: [],
    requestedActivePrSourceId: null,
    protectedStorageAvailable: false
  });

  assert.deepEqual(result.organizations, [{ id: 'org-1', name: 'Renamed Org' }]);
  assert.deepEqual(result.organizationTokens, { 'org-1': 'enc:v1:stored-token' });
  assert.deepEqual(result.issues, []);
  assert.equal(result.message, null);
});

test('recovers the active PR source when only one source remains after deletion', () => {
  const result = applyAdoSettingsPolicy({
    currentOrganizations: [
      { id: 'org-1', name: 'Org One' },
      { id: 'org-2', name: 'Org Two' }
    ],
    currentOrganizationTokens: {
      'org-1': 'enc:v1:token-one',
      'org-2': 'enc:v1:token-two'
    },
    currentPrSources: [
      {
        id: 'src-1',
        name: 'Source One',
        organizationId: 'org-1',
        project: 'Project One',
        repository: null
      },
      {
        id: 'src-2',
        name: 'Source Two',
        organizationId: 'org-2',
        project: 'Project Two',
        repository: null
      }
    ],
    requestedOrganizations: [
      {
        id: 'org-2',
        name: 'Org Two',
        pat: '',
        hasStoredPat: true
      }
    ],
    requestedPrSources: [
      {
        id: 'src-2',
        name: 'Source Two',
        organizationId: 'org-2',
        project: 'Project Two',
        repository: null
      }
    ],
    requestedActivePrSourceId: 'src-1',
    protectedStorageAvailable: true
  });

  assert.deepEqual(result.organizations, [{ id: 'org-2', name: 'Org Two' }]);
  assert.deepEqual(result.prSources, [
    {
      id: 'src-2',
      name: 'Source Two',
      organizationId: 'org-2',
      project: 'Project Two',
      repository: null
    }
  ]);
  assert.equal(result.activePrSourceId, 'src-2');
  assert.deepEqual(result.issues, []);
});
