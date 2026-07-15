// test/storage.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pushTaskHistory, getTaskHistory, getConfig, saveConfig } from '../src/core/storage.js';

// Mock minimal de chrome.storage.local
beforeEach(() => {
  const store = {};
  global.chrome = {
    storage: { local: {
      get: vi.fn(async (keys) => {
        if (typeof keys === 'string') return { [keys]: store[keys] };
        const out = {}; for (const k of keys) out[k] = store[k]; return out;
      }),
      set: vi.fn(async (obj) => { Object.assign(store, obj); }),
      remove: vi.fn(async (k) => { delete store[k]; }),
    } },
  };
});

describe('taskHistory LRU', () => {
  it('place la tâche en tête et dédoublonne', async () => {
    await pushTaskHistory('a');
    await pushTaskHistory('b');
    await pushTaskHistory('a');
    expect(await getTaskHistory()).toEqual(['a', 'b']);
  });
  it('plafonne à 20', async () => {
    for (let i = 0; i < 25; i++) await pushTaskHistory('t' + i);
    const h = await getTaskHistory();
    expect(h.length).toBe(20);
    expect(h[0]).toBe('t24');
  });
});

describe('config', () => {
  it('round-trip', async () => {
    await saveConfig({ notionToken: 'x', theme: 'dark' });
    expect((await getConfig()).notionToken).toBe('x');
  });
});
