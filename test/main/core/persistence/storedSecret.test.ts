import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROTECTED_SECRET_PREFIX,
  isPlaintextSecret,
  isProtectedSecret,
  resolveStoredSecret
} from '../../../../src/main/core/persistence/storedSecret.ts';

test('recognizes protected and plaintext secret shapes', () => {
  assert.equal(isProtectedSecret(`${PROTECTED_SECRET_PREFIX}abc`), true);
  assert.equal(isPlaintextSecret('plain-token'), true);
  assert.equal(isPlaintextSecret(`${PROTECTED_SECRET_PREFIX}abc`), false);
});

test('returns missing when no secret is stored', () => {
  const result = resolveStoredSecret('', {
    encryptionAvailable: true,
    isLegacyPlaintext: false,
    decrypt: () => 'unused'
  });

  assert.deepEqual(result, { value: '', state: 'missing' });
});

test('decrypts a protected secret when protected storage is available', () => {
  const result = resolveStoredSecret(`${PROTECTED_SECRET_PREFIX}encoded-secret`, {
    encryptionAvailable: true,
    isLegacyPlaintext: false,
    decrypt: (encodedSecret) => {
      assert.equal(encodedSecret, 'encoded-secret');
      return 'resolved-token';
    }
  });

  assert.deepEqual(result, { value: 'resolved-token', state: 'available' });
});

test('reports protected storage unavailable for protected secrets', () => {
  const result = resolveStoredSecret(`${PROTECTED_SECRET_PREFIX}encoded-secret`, {
    encryptionAvailable: false,
    isLegacyPlaintext: false,
    decrypt: () => 'resolved-token'
  });

  assert.deepEqual(result, { value: '', state: 'protected-storage-unavailable' });
});

test('reports decrypt failures explicitly', () => {
  const result = resolveStoredSecret(`${PROTECTED_SECRET_PREFIX}encoded-secret`, {
    encryptionAvailable: true,
    isLegacyPlaintext: false,
    decrypt: () => {
      throw new Error('boom');
    }
  });

  assert.deepEqual(result, { value: '', state: 'decrypt-failed' });
});

test('blocks legacy plaintext secrets when protected storage is unavailable', () => {
  const result = resolveStoredSecret('legacy-plaintext-token', {
    encryptionAvailable: false,
    isLegacyPlaintext: true,
    decrypt: () => 'unused'
  });

  assert.deepEqual(result, { value: '', state: 'legacy-plaintext-blocked' });
});
