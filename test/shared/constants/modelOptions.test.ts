import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTO_MODEL_ID,
  buildModelOptions,
  resetKnownModels,
  reconcileSelectableModelId,
  toSdkModel,
  updateKnownModels
} from '../../../src/shared/constants/modelOptions.ts';

test('falls back to Auto for unavailable model when catalog is populated', () => {
  resetKnownModels();
  updateKnownModels([
    {
      id: 'gpt-5',
      name: 'GPT-5',
      multiplier: 1,
      aliases: ['gpt-5', 'GPT-5']
    }
  ]);

  const result = reconcileSelectableModelId('old-model-id');
  assert.equal(result.normalizedId, AUTO_MODEL_ID);
  assert.equal(result.didFallbackToAuto, true);
});

test('buildModelOptions is empty until catalog is loaded, then includes Auto and SDK entries', () => {
  resetKnownModels();
  const options = buildModelOptions();
  assert.equal(options.length, 0);

  updateKnownModels([
    {
      id: 'gpt-5',
      name: 'GPT-5',
      multiplier: 1,
      aliases: ['gpt-5', 'GPT-5']
    }
  ]);
  const populatedOptions = buildModelOptions();
  const ids = populatedOptions.map((option) => option.id);

  assert.equal(ids.includes(AUTO_MODEL_ID), true);
  assert.equal(ids.includes('gpt-5'), true);
});

test('converts Auto to undefined SDK model value', () => {
  resetKnownModels();
  updateKnownModels([
    {
      id: 'gpt-5',
      name: 'GPT-5',
      multiplier: 1,
      aliases: ['gpt-5', 'GPT-5']
    }
  ]);
  assert.equal(toSdkModel(AUTO_MODEL_ID), undefined);
  assert.equal(toSdkModel('gpt-5'), 'gpt-5');
});
