import { useEffect, useState } from 'react';

/**
 * Manages a `Record<string, true>` synced to localStorage under `storageKey`.
 * When `storageKey` is `null` the record resets to empty and nothing is persisted.
 */
export function useLocalStorageRecord(storageKey: string | null) {
  const [record, setRecord] = useState<Record<string, true>>({});

  // Load from localStorage when key changes
  useEffect(() => {
    if (!storageKey) {
      setRecord({});
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      setRecord(parsed && typeof parsed === 'object' ? (parsed as Record<string, true>) : {});
    } catch {
      setRecord({});
    }
  }, [storageKey]);

  // Persist to localStorage whenever record changes
  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(record));
    } catch {
      /* no-op */
    }
  }, [record, storageKey]);

  const has = (key: string) => Boolean(record[key]);

  const toggle = (key: string) => {
    setRecord((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const setKeys = (keys: string[]) => {
    setRecord((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = true;
      return next;
    });
  };

  const removeKeys = (keys: string[]) => {
    setRecord((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  };

  return { record, has, toggle, setKeys, removeKeys } as const;
}
