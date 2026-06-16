export const PROTECTED_SECRET_PREFIX = 'enc:v1:';

export type StoredSecretState =
  | 'missing'
  | 'available'
  | 'protected-storage-unavailable'
  | 'decrypt-failed'
  | 'legacy-plaintext-blocked';

export interface StoredSecretResolution {
  value: string;
  state: StoredSecretState;
}

export function isProtectedSecret(secret: string | undefined | null): boolean {
  return Boolean(secret && secret.startsWith(PROTECTED_SECRET_PREFIX));
}

export function isPlaintextSecret(secret: string | undefined | null): boolean {
  return Boolean(secret && !isProtectedSecret(secret));
}

interface ResolveStoredSecretOptions {
  encryptionAvailable: boolean;
  isLegacyPlaintext: boolean;
  decrypt: (encodedSecret: string) => string;
}

export function resolveStoredSecret(
  secret: string | undefined | null,
  options: ResolveStoredSecretOptions
): StoredSecretResolution {
  if (!secret) {
    return { value: '', state: 'missing' };
  }

  if (!isProtectedSecret(secret)) {
    if (options.isLegacyPlaintext && !options.encryptionAvailable) {
      return { value: '', state: 'legacy-plaintext-blocked' };
    }
    return { value: secret, state: 'available' };
  }

  if (!options.encryptionAvailable) {
    return { value: '', state: 'protected-storage-unavailable' };
  }

  try {
    return {
      value: options.decrypt(secret.slice(PROTECTED_SECRET_PREFIX.length)),
      state: 'available'
    };
  } catch {
    return { value: '', state: 'decrypt-failed' };
  }
}
