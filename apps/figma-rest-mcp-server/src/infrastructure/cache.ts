import { AsyncLocalStorage } from "node:async_hooks";

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  private readonly values = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const entry = this.values.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt < Date.now()) {
      this.values.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    if (!this.values.has(key) && this.values.size >= this.maxEntries) {
      const oldestKey = this.values.keys().next().value as string | undefined;
      if (oldestKey) {
        this.values.delete(oldestKey);
      }
    }

    this.values.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }
}

export class RequestCache<T> {
  private readonly values = new Map<string, T>();

  get(key: string): T | undefined {
    return this.values.get(key);
  }

  set(key: string, value: T): void {
    this.values.set(key, value);
  }
}

const requestCacheStorage = new AsyncLocalStorage<Map<string, unknown>>();

export async function withRequestCache<T>(
  task: () => Promise<T> | T,
): Promise<T> {
  return await requestCacheStorage.run(new Map(), task);
}

export async function rememberInRequestCache<T>(
  key: string,
  task: () => Promise<T> | T,
): Promise<T> {
  const store = requestCacheStorage.getStore();
  if (!store) {
    return await task();
  }

  if (store.has(key)) {
    return await store.get(key) as T;
  }

  const pending = Promise.resolve().then(task);
  store.set(key, pending);

  try {
    const value = await pending;
    store.set(key, value);
    return value;
  } catch (error) {
    store.delete(key);
    throw error;
  }
}
