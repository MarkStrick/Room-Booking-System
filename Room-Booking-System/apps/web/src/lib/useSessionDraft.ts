import { useState, type SetStateAction } from 'react';

const prefix = 'kku-draft:';
export function clearSessionDrafts(scope: string) {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(prefix + scope + ':')) sessionStorage.removeItem(key);
    }
  } catch { /* Storage may be disabled; the form still works in memory. */ }
}

export function useSessionDraft<T>(key: string, fallback: T) {
  const storageKey = prefix + key;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (fallback === null && typeof parsed === 'string') return parsed as T;
        if (parsed !== null && typeof parsed === typeof fallback &&
          (typeof fallback !== 'object' || (!Array.isArray(parsed) && Object.entries(fallback as object).every(([field, initial]) => typeof parsed[field] === typeof initial)))) return parsed as T;
        if (parsed === null && fallback === null) return fallback;
      }
    } catch { /* Ignore malformed drafts. */ }
    return fallback;
  });
  const setDraft = (next: SetStateAction<T>) => {
    setValue(previous => {
      const result = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
      try { sessionStorage.setItem(storageKey, JSON.stringify(result)); } catch { /* Keep in-memory edits. */ }
      return result;
    });
  };
  return [value, setDraft] as const;
}
