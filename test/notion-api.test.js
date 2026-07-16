// test/notion-api.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryAll, searchDatabases, createPage, addDatabaseProperties } from '../src/core/notion-api.js';

function jsonResponse(body, ok = true, status = 200, headers = {}) {
  return { ok, status, headers: { get: (k) => headers[k.toLowerCase()] }, json: async () => body };
}

beforeEach(() => { vi.restoreAllMocks(); });

describe('queryAll', () => {
  it('boucle sur has_more et agrège les résultats', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: 'a' }], has_more: true, next_cursor: 'c1' }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: 'b' }], has_more: false, next_cursor: null }));
    global.fetch = fetchMock;
    const pages = await queryAll('tok', 'db1', {});
    expect(pages.map((p) => p.id)).toEqual(['a', 'b']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.start_cursor).toBe('c1');
  });
});

describe('retry 429', () => {
  it('réessaie après un 429 puis réussit', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, false, 429, { 'retry-after': '0' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'created' }));
    global.fetch = fetchMock;
    const id = await createPage('tok', 'db1', {});
    expect(id).toBe('created');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('searchDatabases', () => {
  it('filtre sur database et pagine', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ results: [{ id: 'd1', title: [{ plain_text: 'Time' }] }], has_more: false })
    );
    const dbs = await searchDatabases('tok');
    expect(dbs[0].id).toBe('d1');
    expect(dbs[0].name).toBe('Time');
  });
});

describe('addDatabaseProperties', () => {
  it('mappe un 403 vers un message français explicite', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ message: 'whatever' }, false, 403)
    );
    await expect(addDatabaseProperties('tok', 'db1', {})).rejects.toThrow(/droits d'édition/);
  });
});
