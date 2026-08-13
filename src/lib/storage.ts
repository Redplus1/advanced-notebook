/**
 * storage.ts — one choke point for every localStorage write in the app.
 *
 * Every module used to do `try { localStorage.setItem(...) } catch {}`. That
 * empty catch is why data loss was invisible: once a payload pushed the origin
 * past the ~5 MB quota, setItem threw QuotaExceededError on every subsequent
 * write and the app happily carried on showing "Сохранено". Writes here report
 * failure to the caller and broadcast `an-storage-error` so the UI can say so.
 */

export interface StorageError {
  key: string;
  quotaExceeded: boolean;
  message: string;
}

export const STORAGE_ERROR_EVENT = "an-storage-error";

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Chromium: QuotaExceededError · Firefox: NS_ERROR_DOM_QUOTA_REACHED (code 1014)
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    (err as unknown as { code?: number }).code === 22 ||
    (err as unknown as { code?: number }).code === 1014
  );
}

/** For keys holding a bare string (theme id, view mode, …) rather than JSON. */
export function writeString(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    const quotaExceeded = isQuotaError(err);
    console.error(`[storage] write "${key}" failed:`, err);
    const detail: StorageError = {
      key,
      quotaExceeded,
      message: err instanceof Error ? err.message : String(err),
    };
    window.dispatchEvent(new CustomEvent<StorageError>(STORAGE_ERROR_EVENT, { detail }));
    return false;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch (err) {
    console.error(`[storage] read "${key}" failed:`, err);
    return fallback;
  }
}

/** Returns true when the value actually reached localStorage. */
export function writeJSON(key: string, value: unknown): boolean {
  let payload: string;
  try {
    payload = JSON.stringify(value);
  } catch (err) {
    console.error(`[storage] serialise "${key}" failed:`, err);
    return false;
  }

  try {
    localStorage.setItem(key, payload);
    return true;
  } catch (err) {
    const quotaExceeded = isQuotaError(err);
    console.error(
      `[storage] write "${key}" failed` +
        (quotaExceeded ? ` (quota exceeded, payload ${(payload.length / 1024 / 1024).toFixed(2)} MB)` : ""),
      err
    );
    const detail: StorageError = {
      key,
      quotaExceeded,
      message: err instanceof Error ? err.message : String(err),
    };
    window.dispatchEvent(new CustomEvent<StorageError>(STORAGE_ERROR_EVENT, { detail }));
    return false;
  }
}
