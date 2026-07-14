# Notion Time Tracker v2 — Phase A : socle `core/` + configuration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser le socle testé (`core/` : time, mapping, notion-api, storage) et livrer la page de configuration fonctionnelle (token → bases → mapping des 2 bases → préférences → save), pour obtenir une extension installable et configurable.

**Architecture:** Extension Chrome MV3, JS vanilla + modules ES natifs, zéro build runtime. Toute la logique pure vit dans `src/core/` (sans API Chrome → testée par Vitest). La config est une page unique qui `fetch` directement l'API Notion. Storage = `chrome.storage.local`.

**Tech Stack:** JavaScript ES modules, Vitest (devDependency), API REST Notion `2022-06-28`, `chrome.storage.local`.

Référence design : `docs/superpowers/specs/2026-07-13-notion-timer-v2-design.md`.

---

## Structure des fichiers (Phase A)

- Create: `package.json`, `vitest.config.js`, `.gitignore`, `manifest.json`
- Create: `src/core/time.js` — durées, arrondis, `toNotionDate`, `workedMs`, `startOfDay`, labels FR
- Create: `src/core/mapping.js` — Page Notion ⇄ `Task`/`Session`, extraction projet
- Create: `src/core/notion-api.js` — fetch Notion (auth, pagination, retry 429)
- Create: `src/core/storage.js` — accès typé `chrome.storage.local`
- Create: `src/theme.js` — application + bascule du thème
- Create: `src/config/config.html`, `src/config/config.css`, `src/config/config.js`
- Create: tests `test/time.test.js`, `test/mapping.test.js`, `test/notion-api.test.js`, `test/storage.test.js`

---

## Task 0: Scaffold projet + Vitest + git

**Files:**
- Create: `package.json`, `vitest.config.js`, `.gitignore`, `manifest.json`

- [ ] **Step 1: Initialiser git et le package**

Run:
```bash
cd "C:/_pCloud/Extensions/notion-timer-v2"
git init
npm init -y
npm install -D vitest
```

- [ ] **Step 2: Écrire `package.json`** (remplacer le généré)

```json
{
  "name": "notion-timer-v2",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Écrire `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
});
```

- [ ] **Step 4: Écrire `.gitignore`**

```
node_modules/
*.log
.DS_Store
```

- [ ] **Step 5: Écrire `manifest.json`** (MV3, permissions complètes pour toute l'itération)

```json
{
  "manifest_version": 3,
  "name": "Notion Time Tracker",
  "version": "2.0.0",
  "description": "Chronomètre de temps de travail synchronisé avec Notion.",
  "permissions": ["storage", "notifications", "alarms"],
  "host_permissions": ["https://api.notion.com/*"],
  "action": { "default_popup": "src/popup/popup.html", "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" } },
  "background": { "service_worker": "src/background/service-worker.js", "type": "module" },
  "icons": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
}
```

> Note : `popup.html` et `service-worker.js` sont créés en Phase B. En attendant, l'extension ne se charge pas complètement — c'est normal ; la config se teste en ouvrant `src/config/config.html` (voir Task 8). Créer un stub minimal si besoin de charger l'extension tôt.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold MV3 extension + vitest"
```

---

## Task 1: `core/time.js` — durées, arrondis, fuseau horaire

**Files:**
- Create: `src/core/time.js`
- Test: `test/time.test.js`

- [ ] **Step 1: Écrire les tests qui échouent**

```js
// test/time.test.js
import { describe, it, expect } from 'vitest';
import { formatDuration, roundToNearestFiveMinutes, toNotionDate, workedMs, startOfDay } from '../src/core/time.js';

describe('formatDuration', () => {
  it('formate HH:MM:SS par défaut', () => {
    expect(formatDuration(3661_000)).toBe('01:01:01');
  });
  it('formate HH:MM sans secondes', () => {
    expect(formatDuration(3661_000, { withSeconds: false })).toBe('01:01');
  });
  it('gère plus de 24 h', () => {
    expect(formatDuration(25 * 3600_000, { withSeconds: false })).toBe('25:00');
  });
  it('plancher à 0', () => {
    expect(formatDuration(-5000)).toBe('00:00:00');
  });
});

describe('roundToNearestFiveMinutes', () => {
  it('arrondit au 5 min le plus proche', () => {
    const d = new Date('2026-07-09T09:07:00');
    expect(roundToNearestFiveMinutes(d).getMinutes()).toBe(5);
  });
  it('arrondit vers le haut à 8 min → 10', () => {
    const d = new Date('2026-07-09T09:08:00');
    expect(roundToNearestFiveMinutes(d).getMinutes()).toBe(10);
  });
});

describe('toNotionDate', () => {
  it("produit un ISO avec offset local, jamais 'Z'", () => {
    const iso = toNotionDate(new Date('2026-07-09T09:00:00'));
    expect(iso.endsWith('Z')).toBe(false);
    expect(iso).toMatch(/[+-]\d{2}:\d{2}$/);
  });
  it("préserve l'heure au mur locale", () => {
    const d = new Date(2026, 6, 9, 9, 0, 0); // 9h locales
    const iso = toNotionDate(d);
    expect(iso.startsWith('2026-07-09T09:00:00')).toBe(true);
  });
});

describe('workedMs', () => {
  it('soustrait les pauses', () => {
    const start = new Date('2026-07-09T09:00:00');
    const end = new Date('2026-07-09T11:00:00');
    expect(workedMs(start, end, 30 * 60_000)).toBe(90 * 60_000);
  });
});

describe('startOfDay', () => {
  it('ramène à minuit local', () => {
    const d = startOfDay(new Date(2026, 6, 9, 15, 30));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getDate()).toBe(9);
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm test -- time`
Expected: FAIL (`time.js` introuvable / exports manquants).

- [ ] **Step 3: Écrire `src/core/time.js`**

```js
// src/core/time.js — logique temporelle pure (aucune API Chrome)

const pad = (n) => String(n).padStart(2, '0');

export function formatDuration(ms, { withSeconds = true } = {}) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
}

export function roundToNearestFiveMinutes(date) {
  const d = new Date(date);
  const ms = 5 * 60_000;
  return new Date(Math.round(d.getTime() / ms) * ms);
}

// ISO 8601 AVEC offset local (ex. 2026-07-09T09:00:00+02:00). Jamais 'Z'.
export function toNotionDate(date) {
  const d = new Date(date);
  const off = -d.getTimezoneOffset(); // minutes, positif à l'est de UTC
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${oh}:${om}`;
}

export function workedMs(startTime, end, totalPauseDuration = 0) {
  const start = new Date(startTime).getTime();
  const stop = new Date(end).getTime();
  return Math.max(0, stop - start - totalPauseDuration);
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Labels FR (Intl) — utilisés par l'UI, non testés strictement (dépendants ICU).
export function formatClock(date) {
  const d = new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatStartedLabel(date) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTimeLocalValue(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `npm test -- time`
Expected: PASS (tous les tests `time`).

- [ ] **Step 5: Commit**

```bash
git add src/core/time.js test/time.test.js
git commit -m "feat(core): time utils with local-offset Notion dates"
```

---

## Task 2: `core/mapping.js` — Page Notion ⇄ Task / Session

**Files:**
- Create: `src/core/mapping.js`
- Test: `test/mapping.test.js`

- [ ] **Step 1: Écrire les tests qui échouent**

```js
// test/mapping.test.js
import { describe, it, expect } from 'vitest';
import {
  taskFromPage, extractProject, titleWithProject,
  sessionPropertiesForCreate, sessionPropertiesForUpdate, sessionFromPage,
} from '../src/core/mapping.js';

const tasksFields = {
  title: 'Nom', project: 'Projet_texte', externalId: '#TaskID',
  externalUrl: 'TaskURL', projectsRel: '🎯 Projets',
};
const timeFields = {
  taskName: 'Nom', startDate: 'Début session', endDate: 'Fin session',
  pause: 'Pause', comment: 'Commentaire', externalUrl: 'TaskURL',
  taskId: '#TaskID', projects: '🎯 Projets', tasksRelation: 'Tâches',
};

function textProp(v) { return { type: 'rich_text', rich_text: [{ plain_text: v }] }; }
function titleProp(v) { return { type: 'title', title: [{ plain_text: v }] }; }

describe('extractProject', () => {
  it('extrait le contenu des crochets', () => {
    expect(extractProject('Refonte API [Projet X]')).toBe('Projet X');
  });
  it('retourne "Sans projet" sinon', () => {
    expect(extractProject('Refonte API')).toBe('Sans projet');
  });
});

describe('titleWithProject', () => {
  it('accole le projet', () => {
    expect(titleWithProject('Refonte API', 'Projet X')).toBe('Refonte API [Projet X]');
  });
  it('sans projet, garde le nom seul', () => {
    expect(titleWithProject('Refonte API', '')).toBe('Refonte API');
  });
});

describe('taskFromPage', () => {
  it('mappe les champs configurés', () => {
    const page = {
      id: 'abc-123',
      properties: {
        'Nom': titleProp('Refonte API'),
        'Projet_texte': textProp('Projet X'),
        '#TaskID': textProp('T-42'),
        'TaskURL': { type: 'url', url: 'https://clickup.com/t/42' },
        '🎯 Projets': { type: 'relation', relation: [{ id: 'p1' }] },
      },
    };
    const t = taskFromPage(page, tasksFields);
    expect(t.name).toBe('Refonte API');
    expect(t.project).toBe('Projet X');
    expect(t.externalId).toBe('T-42');
    expect(t.externalUrl).toBe('https://clickup.com/t/42');
    expect(t.projectsRel).toEqual(['p1']);
    expect(t.notionUrl).toBe('https://notion.so/abc123');
  });
});

describe('sessionPropertiesForCreate', () => {
  const task = { id: 'abc-123', name: 'Refonte API', project: 'Projet X', externalId: 'T-42', externalUrl: 'https://c/42', projectsRel: ['p1'] };
  it('inclut toujours titre (avec projet) et date de début sans Z', () => {
    const props = sessionPropertiesForCreate(task, new Date(2026, 6, 9, 9, 0, 0), timeFields);
    expect(props['Nom'].title[0].text.content).toBe('Refonte API [Projet X]');
    expect(props['Début session'].date.start).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(props['Début session'].date.start.endsWith('Z')).toBe(false);
  });
  it('inclut les champs optionnels mappés', () => {
    const props = sessionPropertiesForCreate(task, new Date(), timeFields);
    expect(props['#TaskID'].rich_text[0].text.content).toBe('T-42');
    expect(props['TaskURL'].url).toBe('https://c/42');
    expect(props['🎯 Projets'].relation).toEqual([{ id: 'p1' }]);
    expect(props['Tâches'].relation).toEqual([{ id: 'abc-123' }]);
  });
  it('omet un champ optionnel non mappé (null)', () => {
    const props = sessionPropertiesForCreate(task, new Date(), { ...timeFields, taskId: null });
    expect(props['#TaskID']).toBeUndefined();
  });
});

describe('sessionPropertiesForUpdate', () => {
  it('écrit fin, commentaire et pause quand mappés et présents', () => {
    const props = sessionPropertiesForUpdate({ endTime: new Date(2026, 6, 9, 11, 0, 0), comment: 'fait', pauseMin: 30 }, timeFields);
    expect(props['Fin session'].date.start.endsWith('Z')).toBe(false);
    expect(props['Commentaire'].rich_text[0].text.content).toBe('fait');
    expect(props['Pause'].number).toBe(30);
  });
  it('omet commentaire vide', () => {
    const props = sessionPropertiesForUpdate({ endTime: new Date(), comment: '', pauseMin: 0 }, timeFields);
    expect(props['Commentaire']).toBeUndefined();
  });
});

describe('sessionFromPage', () => {
  it('lit nom, début, fin, pause', () => {
    const page = {
      id: 'sess-1',
      properties: {
        'Nom': titleProp('Refonte API [Projet X]'),
        'Début session': { type: 'date', date: { start: '2026-07-09T09:00:00+02:00' } },
        'Fin session': { type: 'date', date: { start: '2026-07-09T11:00:00+02:00' } },
        'Pause': { type: 'number', number: 30 },
      },
    };
    const s = sessionFromPage(page, timeFields);
    expect(s.name).toBe('Refonte API [Projet X]');
    expect(new Date(s.startTime).getHours()).toBe(9);
    expect(s.pauseMin).toBe(30);
    expect(s.pageId).toBe('sess-1');
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm test -- mapping`
Expected: FAIL (`mapping.js` introuvable).

- [ ] **Step 3: Écrire `src/core/mapping.js`**

```js
// src/core/mapping.js — traduction Notion ⇄ objets métier. Importe time pour les dates.
import { toNotionDate } from './time.js';

const normId = (id) => String(id).replace(/-/g, '');
const plain = (rich) => (rich || []).map((r) => r.plain_text || '').join('');

export function extractProject(name) {
  const m = /\[([^\]]+)\]/.exec(name || '');
  return m ? m[1] : 'Sans projet';
}

export function titleWithProject(name, project) {
  return project ? `${name} [${project}]` : name;
}

export function taskFromPage(page, f) {
  const p = page.properties || {};
  const get = (key) => (key ? p[key] : undefined);
  const titleProp = get(f.title);
  const projProp = get(f.project);
  const idProp = get(f.externalId);
  const urlProp = get(f.externalUrl);
  const relProp = get(f.projectsRel);
  return {
    id: page.id,
    name: titleProp ? plain(titleProp.title) : '(sans nom)',
    project: projProp ? plain(projProp.rich_text) : '',
    externalId: idProp ? plain(idProp.rich_text) : '',
    externalUrl: urlProp ? (urlProp.url || '') : '',
    projectsRel: relProp && relProp.relation ? relProp.relation.map((r) => r.id) : [],
    notionUrl: `https://notion.so/${normId(page.id)}`,
  };
}

function dateProp(date) { return { date: { start: toNotionDate(date) } }; }
function richTextProp(v) { return { rich_text: [{ text: { content: v } }] }; }

export function sessionPropertiesForCreate(task, startTime, f) {
  const props = {
    [f.taskName]: { title: [{ text: { content: titleWithProject(task.name, task.project) } }] },
    [f.startDate]: dateProp(startTime),
  };
  if (f.tasksRelation) props[f.tasksRelation] = { relation: [{ id: task.id }] };
  if (f.taskId && task.externalId) props[f.taskId] = richTextProp(task.externalId);
  if (f.externalUrl && task.externalUrl) props[f.externalUrl] = { url: task.externalUrl };
  if (f.projects && task.projectsRel && task.projectsRel.length) {
    props[f.projects] = { relation: task.projectsRel.map((id) => ({ id })) };
  }
  return props;
}

export function sessionPropertiesForUpdate({ endTime, comment, pauseMin }, f) {
  const props = { [f.endDate]: dateProp(endTime) };
  if (f.comment && comment) props[f.comment] = richTextProp(comment);
  if (f.pause && pauseMin > 0) props[f.pause] = { number: pauseMin };
  return props;
}

export function sessionFromPage(page, f) {
  const p = page.properties || {};
  const name = p[f.taskName] ? plain(p[f.taskName].title) : '';
  const start = p[f.startDate]?.date?.start || null;
  const end = f.endDate && p[f.endDate]?.date?.start ? p[f.endDate].date.start : null;
  const pauseMin = f.pause && p[f.pause] ? (p[f.pause].number || 0) : 0;
  return { pageId: page.id, name, startTime: start, endTime: end, pauseMin };
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `npm test -- mapping`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/mapping.js test/mapping.test.js
git commit -m "feat(core): Notion page <-> Task/Session mapping"
```

---

## Task 3: `core/notion-api.js` — fetch, pagination, retry 429

**Files:**
- Create: `src/core/notion-api.js`
- Test: `test/notion-api.test.js`

- [ ] **Step 1: Écrire les tests qui échouent**

```js
// test/notion-api.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryAll, searchDatabases, createPage } from '../src/core/notion-api.js';

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
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm test -- notion-api`
Expected: FAIL.

- [ ] **Step 3: Écrire `src/core/notion-api.js`**

```js
// src/core/notion-api.js — seul point (avec mapping) qui connaît le format Notion.
const BASE = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';
const normId = (id) => String(id).replace(/-/g, '');

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': VERSION,
    'Content-Type': 'application/json',
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(token, path, { method = 'GET', body } = {}, attempt = 0) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get('retry-after')) || 2 ** attempt;
    await sleep(retryAfter * 1000);
    return request(token, path, { method, body }, attempt + 1);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Notion ${res.status}`);
  }
  return data;
}

export async function testToken(token) {
  const user = await request(token, '/users/me');
  return { ok: true, user };
}

export async function searchDatabases(token) {
  const out = [];
  let cursor;
  do {
    const data = await request(token, '/search', {
      method: 'POST',
      body: { filter: { value: 'database', property: 'object' }, start_cursor: cursor, page_size: 100 },
    });
    for (const r of data.results) {
      out.push({ id: r.id, name: (r.title || []).map((t) => t.plain_text).join('') || '(sans titre)' });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return out;
}

export async function getDatabaseSchema(token, dbId) {
  const data = await request(token, `/databases/${normId(dbId)}`);
  return Object.entries(data.properties).map(([name, prop]) => ({ name, type: prop.type }));
}

export async function queryAll(token, dbId, { filter, sorts, pageSize = 100 } = {}) {
  const out = [];
  let cursor;
  do {
    const body = { page_size: pageSize };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    if (cursor) body.start_cursor = cursor;
    const data = await request(token, `/databases/${normId(dbId)}/query`, { method: 'POST', body });
    out.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return out;
}

// Variante paginée limitée (repos : 1 page) — pour le chargement léger des tâches.
export async function queryPage(token, dbId, { filter, sorts, pageSize = 20 } = {}) {
  const body = { page_size: pageSize };
  if (filter) body.filter = filter;
  if (sorts) body.sorts = sorts;
  const data = await request(token, `/databases/${normId(dbId)}/query`, { method: 'POST', body });
  return data.results;
}

export async function getPage(token, pageId) {
  return request(token, `/pages/${normId(pageId)}`);
}

export async function createPage(token, dbId, properties) {
  const data = await request(token, '/pages', {
    method: 'POST',
    body: { parent: { type: 'database_id', database_id: normId(dbId) }, properties },
  });
  return data.id;
}

export async function updatePage(token, pageId, properties) {
  await request(token, `/pages/${normId(pageId)}`, { method: 'PATCH', body: { properties } });
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `npm test -- notion-api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/notion-api.js test/notion-api.test.js
git commit -m "feat(core): Notion API client with pagination + 429 retry"
```

---

## Task 4: `core/storage.js` — accès typé + historique LRU

**Files:**
- Create: `src/core/storage.js`
- Test: `test/storage.test.js`

- [ ] **Step 1: Écrire les tests qui échouent**

```js
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
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `npm test -- storage`
Expected: FAIL.

- [ ] **Step 3: Écrire `src/core/storage.js`**

```js
// src/core/storage.js — accès typé à chrome.storage.local (seul module UI qui l'utilise directement).
const local = () => chrome.storage.local;

export async function getConfig() {
  const { config } = await local().get('config');
  return config || null;
}
export async function saveConfig(config) {
  await local().set({ config });
}

export async function getCurrentSession() {
  const { currentSession } = await local().get('currentSession');
  return currentSession || null;
}
export async function setCurrentSession(currentSession) {
  await local().set({ currentSession });
}
export async function clearCurrentSession() {
  await local().remove('currentSession');
}

export async function getTaskHistory() {
  const { taskHistory } = await local().get('taskHistory');
  return taskHistory || [];
}
export async function pushTaskHistory(taskId) {
  const current = await getTaskHistory();
  const next = [taskId, ...current.filter((id) => id !== taskId)].slice(0, 20);
  await local().set({ taskHistory: next });
  return next;
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `npm test -- storage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/storage.js test/storage.test.js
git commit -m "feat(core): typed storage + LRU task history"
```

---

## Task 5: `theme.js` — thème clair/sombre partagé

**Files:**
- Create: `src/theme.js`

- [ ] **Step 1: Écrire `src/theme.js`**

```js
// src/theme.js — applique et bascule le thème. Le thème est stocké dans config.theme.
import { getConfig, saveConfig } from './core/storage.js';

export async function applyStoredTheme() {
  const config = await getConfig();
  const theme = (config && config.theme) || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}

export async function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  const config = (await getConfig()) || {};
  config.theme = next;
  await saveConfig(config);
  return next;
}
```

- [ ] **Step 2: Vérification manuelle (différée)**

Le thème sera vérifié visuellement en Task 7 (config) une fois la CSS en place. Pas de test unitaire (dépend du DOM).

- [ ] **Step 3: Commit**

```bash
git add src/theme.js
git commit -m "feat: shared light/dark theme helper"
```

---

## Task 6: Config — HTML + CSS (structure & thème)

**Files:**
- Create: `src/config/config.html`, `src/config/config.css`

- [ ] **Step 1: Écrire `src/config/config.html`**

Structure : header (logo + bascule thème), puis sections `① Connexion`, `② Bases`, `③ Mapping Temps`, `④ Mapping Tâches`, `⑤ Préférences`, bouton Enregistrer. Chaque select de mapping porte `data-mapping` + `data-current` (repris du pattern Captage).

```html
<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Time Tracker · Configuration</title>
  <link rel="stylesheet" href="config.css" />
</head>
<body>
  <div class="wrap">
    <header>
      <div class="logo">⏱️ Time Tracker <span class="sub">Configuration</span></div>
      <button type="button" id="theme-toggle" class="icon-btn" title="Thème">🌙</button>
    </header>

    <div id="flash" class="flash" hidden></div>

    <!-- ① Connexion -->
    <section class="card">
      <div class="card-head">① Connexion Notion</div>
      <div class="row">
        <label>Token d'intégration</label>
        <div class="cell">
          <input type="password" id="token" class="input" placeholder="ntn_…" autocomplete="new-password" />
          <button type="button" id="btn-test" class="btn btn-primary">Tester la connexion</button>
          <span id="token-status" class="status"></span>
        </div>
      </div>
    </section>

    <!-- ② Bases -->
    <section class="card" id="sec-bases">
      <div class="card-head">② Bases de données</div>
      <div class="row">
        <label></label>
        <div class="cell">
          <button type="button" id="btn-load-db" class="btn btn-ghost">Charger mes bases</button>
          <span id="db-status" class="status"></span>
        </div>
      </div>
      <div class="row">
        <label>Base Temps saisis <span class="type">écriture</span></label>
        <div class="cell"><select id="time-db" class="input"></select></div>
      </div>
      <div class="row">
        <label>Base Tâches <span class="type">lecture</span></label>
        <div class="cell"><select id="tasks-db" class="input"></select></div>
      </div>
    </section>

    <!-- ③ Mapping Temps -->
    <section class="card" id="sec-time-map">
      <div class="card-head">③ Mapping — Base Temps</div>
      <div class="row"><label>📝 Nom de session <span class="type">title *</span></label><div class="cell"><select id="m-taskName" class="input" data-mapping></select></div></div>
      <div class="row"><label>🕐 Date de début <span class="type">date *</span></label><div class="cell"><select id="m-startDate" class="input" data-mapping></select></div></div>
      <div class="row"><label>🕑 Date de fin <span class="type">date *</span></label><div class="cell"><select id="m-endDate" class="input" data-mapping></select></div></div>
      <div class="row"><label>🔢 TaskID <span class="type">rich_text</span></label><div class="cell"><select id="m-taskId" class="input" data-mapping></select></div></div>
      <div class="row"><label>🎯 Projets <span class="type">relation</span></label><div class="cell"><select id="m-projects" class="input" data-mapping></select></div></div>
      <div class="row"><label>⏸️ Pause (min) <span class="type">number</span></label><div class="cell"><select id="m-pause" class="input" data-mapping></select></div></div>
      <div class="row"><label>💬 Commentaire <span class="type">rich_text</span></label><div class="cell"><select id="m-comment" class="input" data-mapping></select></div></div>
      <div class="row"><label>🔗 URL application <span class="type">url</span></label><div class="cell"><select id="m-externalUrl" class="input" data-mapping></select></div></div>
      <div class="row"><label>🔗 Relation Tâches <span class="type">relation</span></label><div class="cell"><select id="m-tasksRelation" class="input" data-mapping></select></div></div>
    </section>

    <!-- ④ Mapping Tâches -->
    <section class="card" id="sec-tasks-map">
      <div class="card-head">④ Mapping — Base Tâches</div>
      <div class="row"><label>📝 Titre <span class="type">title</span></label><div class="cell"><select id="t-title" class="input" data-mapping-tasks></select></div></div>
      <div class="row"><label>🏷️ Projet <span class="type">rich_text</span></label><div class="cell"><select id="t-project" class="input" data-mapping-tasks></select></div></div>
      <div class="row"><label>🔢 ID externe <span class="type">rich_text</span></label><div class="cell"><select id="t-externalId" class="input" data-mapping-tasks></select></div></div>
      <div class="row"><label>🔗 URL externe <span class="type">url</span></label><div class="cell"><select id="t-externalUrl" class="input" data-mapping-tasks></select></div></div>
      <div class="row"><label>🎯 Relation Projets <span class="type">relation</span></label><div class="cell"><select id="t-projectsRel" class="input" data-mapping-tasks></select></div></div>
      <div class="row"><label>🚦 Filtre d'état <span class="type">status/select — optionnel</span></label>
        <div class="cell">
          <select id="t-statusFilter" class="input" data-mapping-tasks></select>
          <input type="text" id="t-statusExclude" class="input" style="flex:0 0 180px" placeholder="valeur à exclure (ex : clos)" />
        </div>
      </div>
      <div class="row"><label>↕️ Tri <span class="type">propriété</span></label><div class="cell"><select id="t-sortProperty" class="input" data-mapping-tasks></select></div></div>
    </section>

    <!-- ⑤ Préférences -->
    <section class="card" id="sec-prefs">
      <div class="card-head">⑤ Préférences</div>
      <div class="row"><label>Commentaire obligatoire</label><div class="cell"><input type="checkbox" id="p-requireComment" /></div></div>
      <div class="row"><label>Libellé bouton externe</label><div class="cell"><input type="text" id="p-externalLabel" class="input" maxlength="20" value="CLICKUP" /></div></div>
      <div class="row"><label>Heures / semaine</label><div class="cell"><input type="number" id="p-weeklyHours" class="input" step="0.5" min="0" value="39" /></div></div>
      <div class="row"><label>🏖️ Tâche congés <span class="type">optionnel</span></label><div class="cell"><select id="p-vacationTask" class="input"></select></div></div>
      <div class="row"><label>⭐ Favoris (max 6)</label><div class="cell" style="flex-direction:column;align-items:stretch">
        <div id="fav-list"></div>
        <button type="button" id="btn-add-fav" class="btn btn-ghost">➕ Ajouter un favori</button>
      </div></div>
    </section>

    <div class="save-row">
      <button type="button" id="btn-save" class="btn btn-primary">✅ Enregistrer</button>
      <span id="save-status" class="status"></span>
    </div>
  </div>
  <script type="module" src="config.js"></script>
</body>
</html>
```

- [ ] **Step 2: Écrire `src/config/config.css`**

Palette Captage, avec variables par thème. Reprend `.card`, `.card-head`, `.row` (grid label/champ), `.input`, `.btn`. Fournir au minimum les tokens ci-dessous ; affiner l'espacement pour coller aux captures.

```css
:root, :root[data-theme="dark"] {
  --bg-deep:#030826; --bg-elev:#0a1870; --border:#1c2470; --border-soft:#3a4ba0;
  --text:#DDE3F0; --text-muted:#7D8AAD; --cyan:#2aa6e8; --cyan-deep:#138fdb;
  --orange:#f36100; --green:#34d399; --red:#f87171;
}
:root[data-theme="light"] {
  --bg-deep:#f4f7ff; --bg-elev:#ffffff; --border:#d6ddf2; --border-soft:#b9c4e6;
  --text:#0b1533; --text-muted:#5a6a99; --cyan:#138fdb; --cyan-deep:#0d6fb0;
  --orange:#e05a00; --green:#059669; --red:#dc2626;
}
* { box-sizing:border-box; }
body { margin:0; font-family:"Inter","Segoe UI",system-ui,-apple-system,sans-serif;
  color:var(--text); background:var(--bg-deep); }
.wrap { max-width:820px; margin:0 auto; padding:40px 24px 80px; }
header { display:flex; align-items:center; gap:16px; margin-bottom:24px; }
.logo { font-weight:800; font-size:22px; } .logo .sub { color:var(--text-muted); font-weight:500; font-size:14px; }
.icon-btn { margin-left:auto; background:transparent; border:1px solid var(--border-soft);
  color:var(--text); border-radius:999px; width:38px; height:38px; cursor:pointer; }
.flash { margin-bottom:16px; padding:12px 16px; border-radius:10px;
  background:rgba(52,211,153,.1); border:1px solid rgba(52,211,153,.4); color:var(--green); }
.card { background:linear-gradient(180deg,rgba(10,24,112,.4),rgba(5,12,63,.4));
  border:1px solid var(--border); border-radius:16px; overflow:hidden; margin-bottom:18px; }
.card-head { padding:14px 22px; border-bottom:1px solid var(--border); background:rgba(3,8,38,.35);
  font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted); font-weight:700; }
.row { display:grid; grid-template-columns:210px 1fr; align-items:center; gap:16px;
  padding:14px 22px; border-bottom:1px solid var(--border); }
.row:last-child { border-bottom:none; }
.row label { font-size:13px; color:var(--text-muted); }
.type { font-style:italic; opacity:.7; font-size:11px; }
.cell { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.input { flex:1 1 240px; min-width:0; background:var(--bg-deep); color:var(--text);
  border:1px solid var(--border-soft); border-radius:10px; padding:10px 14px; font-size:14px; outline:none; }
.input:focus { border-color:var(--cyan); box-shadow:0 0 0 3px rgba(42,166,232,.18); }
.btn { border:none; border-radius:10px; padding:10px 18px; font-weight:700; font-size:13px; cursor:pointer; }
.btn-primary { background:linear-gradient(180deg,var(--cyan),var(--cyan-deep)); color:#fff; }
.btn-ghost { background:rgba(42,166,232,.1); color:var(--cyan); border:1px solid var(--border-soft); }
.status { font-size:12.5px; color:var(--text-muted); }
.status.ok { color:var(--green); } .status.err { color:var(--red); }
.save-row { display:flex; align-items:center; gap:12px; justify-content:flex-end; padding:8px 0; }
```

- [ ] **Step 3: Vérification manuelle**

Ouvrir `src/config/config.html` dans le navigateur (double-clic). Attendu : page sombre stylée, 5 sections visibles, bascule 🌙/☀️ change le thème (une fois la JS branchée en Task 7). Aucune erreur console de CSS.

- [ ] **Step 4: Commit**

```bash
git add src/config/config.html src/config/config.css
git commit -m "feat(config): page structure + theme-aware styles"
```

---

## Task 7: Config — logique (`config.js`)

**Files:**
- Create: `src/config/config.js`

Types réutilisés : `testToken`, `searchDatabases`, `getDatabaseSchema`, `queryPage`/`queryAll`, `getPage` (notion-api) ; `getConfig`, `saveConfig` (storage) ; `taskFromPage` (mapping) ; `applyStoredTheme`, `toggleTheme` (theme).

- [ ] **Step 1: Écrire `src/config/config.js`**

```js
// src/config/config.js
import { testToken, searchDatabases, getDatabaseSchema, queryAll } from '../core/notion-api.js';
import { getConfig, saveConfig } from '../core/storage.js';
import { taskFromPage } from '../core/mapping.js';
import { applyStoredTheme, toggleTheme } from '../theme.js';

const $ = (id) => document.getElementById(id);
const state = { token: '', schemaTime: [], schemaTasks: [], tasks: [], favorites: [], config: null };

// Types compatibles par champ logique de la base Temps
const TIME_TYPES = {
  taskName: ['title'], startDate: ['date'], endDate: ['date'],
  taskId: ['rich_text'], projects: ['relation'], pause: ['number'],
  comment: ['rich_text'], externalUrl: ['url'], tasksRelation: ['relation'],
};
const TASKS_TYPES = {
  title: ['title'], project: ['rich_text', 'text'], externalId: ['rich_text'],
  externalUrl: ['url'], projectsRel: ['relation'], statusFilter: ['status', 'select'],
  sortProperty: null, // toute propriété
};
// Auto-mapping par nom connu (souple, insensible casse/accents partiels)
const AUTO_TIME = {
  taskName: ['nom', 'name', 'titre'], startDate: ['début session', 'debut session', 'début', 'start'],
  endDate: ['fin session', 'fin', 'end'], taskId: ['#taskid', 'taskid'],
  projects: ['🎯 projets', 'projets'], pause: ['pause', 'pause (min)'],
  comment: ['commentaire', 'commentaire de session'], externalUrl: ['taskurl', 'url'],
  tasksRelation: ['tâches', 'taches'],
};

function fill(select, props, allowedTypes, current) {
  const opts = ['<option value="">— non mappé —</option>'];
  for (const p of props) {
    if (allowedTypes && !allowedTypes.includes(p.type)) continue;
    opts.push(`<option value="${p.name}" data-type="${p.type}"${p.name === current ? ' selected' : ''}>${p.name} (${p.type})</option>`);
  }
  select.innerHTML = opts.join('');
}

function autoSelect(select, props, names, current) {
  if (current) return;
  const found = props.find((p) => names.includes((p.name || '').toLowerCase()));
  if (found) select.value = found.name;
}

async function onTest() {
  const token = $('token').value.trim();
  const status = $('token-status');
  status.textContent = 'Test…'; status.className = 'status';
  try {
    const { user } = await testToken(token);
    state.token = token;
    status.textContent = `✅ Connecté : ${user.name || user.bot?.owner?.user?.name || 'OK'}`;
    status.className = 'status ok';
  } catch (e) { status.textContent = `Erreur : ${e.message}`; status.className = 'status err'; }
}

async function onLoadDb() {
  const status = $('db-status');
  status.textContent = 'Chargement…'; status.className = 'status';
  try {
    const dbs = await searchDatabases(state.token);
    const opts = ['<option value="">— choisir —</option>',
      ...dbs.map((d) => `<option value="${d.id}" data-name="${d.name}">${d.name}</option>`)];
    $('time-db').innerHTML = opts.join('');
    $('tasks-db').innerHTML = opts.join('');
    if (state.config?.timeDb) $('time-db').value = state.config.timeDb.id;
    if (state.config?.tasksDb) $('tasks-db').value = state.config.tasksDb.id;
    status.textContent = `✓ ${dbs.length} bases`; status.className = 'status ok';
    await loadSchemas();
  } catch (e) { status.textContent = `Erreur : ${e.message}`; status.className = 'status err'; }
}

async function loadSchemas() {
  const timeId = $('time-db').value, tasksId = $('tasks-db').value;
  if (!timeId || !tasksId) return;
  state.schemaTime = await getDatabaseSchema(state.token, timeId);
  state.schemaTasks = await getDatabaseSchema(state.token, tasksId);
  const tf = state.config?.timeDb?.fields || {};
  for (const key of Object.keys(TIME_TYPES)) {
    const sel = $('m-' + key);
    fill(sel, state.schemaTime, TIME_TYPES[key], tf[key] || '');
    autoSelect(sel, state.schemaTime, AUTO_TIME[key] || [], tf[key] || '');
  }
  const kf = state.config?.tasksDb?.fields || {};
  for (const key of Object.keys(TASKS_TYPES)) {
    const sel = $('t-' + key);
    const cur = key === 'statusFilter' ? (kf.statusFilter?.property || '') : (kf[key] || '');
    fill(sel, state.schemaTasks, TASKS_TYPES[key], cur);
  }
  await loadTasksList(tasksId, kf);
}

async function loadTasksList(tasksId, kf) {
  const sortProp = kf.sortProperty;
  const pages = await queryAll(state.token, tasksId, sortProp ? { sorts: [{ property: sortProp, direction: 'descending' }] } : {});
  const fields = collectTasksFields();
  state.tasks = pages.map((p) => taskFromPage(p, fields));
  // Tâche congés
  const vac = state.config?.prefs?.vacationTaskId || '';
  $('p-vacationTask').innerHTML = ['<option value="">— aucune —</option>',
    ...state.tasks.map((t) => `<option value="${t.id}"${t.id === vac ? ' selected' : ''}>${t.name}</option>`)].join('');
  renderFavorites();
}

function collectTimeFields() {
  const f = {};
  for (const key of Object.keys(TIME_TYPES)) f[key] = $('m-' + key).value || null;
  return f;
}
function collectTasksFields() {
  const f = {
    title: $('t-title').value || null, project: $('t-project').value || null,
    externalId: $('t-externalId').value || null, externalUrl: $('t-externalUrl').value || null,
    projectsRel: $('t-projectsRel').value || null, sortProperty: $('t-sortProperty').value || null,
    statusFilter: null,
  };
  const sfProp = $('t-statusFilter').value;
  if (sfProp) {
    const opt = $('t-statusFilter').selectedOptions[0];
    f.statusFilter = { property: sfProp, type: opt?.dataset.type || 'status', excludeValue: $('t-statusExclude').value.trim() };
  }
  return f;
}

// ── Favoris ─────────────────────────────────────────────
function renderFavorites() {
  const list = $('fav-list');
  list.innerHTML = '';
  state.favorites.forEach((fav, i) => {
    const div = document.createElement('div');
    div.className = 'cell';
    div.style.marginBottom = '8px';
    const taskOpts = ['<option value="">— tâche —</option>',
      ...state.tasks.map((t) => `<option value="${t.id}"${t.id === fav.taskId ? ' selected' : ''}>${t.name}</option>`)].join('');
    div.innerHTML =
      `<select class="input fav-task" data-i="${i}">${taskOpts}</select>` +
      `<input class="input fav-label" data-i="${i}" maxlength="20" placeholder="libellé" value="${fav.customLabel || ''}" style="flex:0 0 160px" />` +
      `<button type="button" class="btn btn-ghost fav-del" data-i="${i}">❌</button>`;
    list.appendChild(div);
  });
  $('btn-add-fav').disabled = state.favorites.length >= 6;
}

function wireFavorites() {
  $('btn-add-fav').addEventListener('click', () => {
    if (state.favorites.length >= 6) return;
    state.favorites.push({ taskId: '', customLabel: '' });
    renderFavorites();
  });
  $('fav-list').addEventListener('input', (e) => {
    const i = Number(e.target.dataset.i);
    if (e.target.classList.contains('fav-task')) state.favorites[i].taskId = e.target.value;
    if (e.target.classList.contains('fav-label')) state.favorites[i].customLabel = e.target.value;
  });
  $('fav-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('fav-del')) {
      state.favorites.splice(Number(e.target.dataset.i), 1);
      renderFavorites();
    }
  });
}

async function onSave() {
  const status = $('save-status');
  const timeFields = collectTimeFields();
  if (!timeFields.taskName || !timeFields.startDate || !timeFields.endDate) {
    status.textContent = 'Champs obligatoires manquants (Nom, Début, Fin).'; status.className = 'status err'; return;
  }
  const weeklyHours = parseFloat($('p-weeklyHours').value);
  if (!(weeklyHours > 0)) { status.textContent = 'Heures/semaine doit être > 0.'; status.className = 'status err'; return; }
  const config = {
    notionToken: state.token,
    timeDb: { id: $('time-db').value, name: $('time-db').selectedOptions[0]?.dataset.name || '', fields: timeFields },
    tasksDb: { id: $('tasks-db').value, name: $('tasks-db').selectedOptions[0]?.dataset.name || '', fields: collectTasksFields() },
    prefs: {
      requireComment: $('p-requireComment').checked,
      externalButtonLabel: ($('p-externalLabel').value || 'CLICKUP').toUpperCase().slice(0, 20),
      weeklyHours,
      vacationTaskId: $('p-vacationTask').value || null,
      favorites: state.favorites.filter((f) => f.taskId).slice(0, 6),
    },
    theme: document.documentElement.getAttribute('data-theme') || 'dark',
  };
  await saveConfig(config);
  window.location = '../popup/popup.html';
}

async function init() {
  await applyStoredTheme();
  $('theme-toggle').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '🌙' : '☀️';
  $('theme-toggle').addEventListener('click', async () => {
    const t = await toggleTheme();
    $('theme-toggle').textContent = t === 'dark' ? '🌙' : '☀️';
  });
  state.config = await getConfig();
  if (state.config) {
    state.token = state.config.notionToken || '';
    state.favorites = (state.config.prefs?.favorites || []).map((f) => ({ ...f }));
    if (state.token) { $('token').value = state.token; $('token-status').textContent = 'Token présent — retester si besoin.'; }
    $('p-requireComment').checked = !!state.config.prefs?.requireComment;
    $('p-externalLabel').value = state.config.prefs?.externalButtonLabel || 'CLICKUP';
    $('p-weeklyHours').value = state.config.prefs?.weeklyHours ?? 39;
    if (state.config.tasksDb?.fields?.statusFilter?.excludeValue) $('t-statusExclude').value = state.config.tasksDb.fields.statusFilter.excludeValue;
  }
  $('btn-test').addEventListener('click', onTest);
  $('btn-load-db').addEventListener('click', onLoadDb);
  $('time-db').addEventListener('change', loadSchemas);
  $('tasks-db').addEventListener('change', loadSchemas);
  $('btn-save').addEventListener('click', onSave);
  wireFavorites();
}

init();
```

- [ ] **Step 2: Vérification manuelle (extension chargée)**

1. `chrome://extensions` → activer le mode développeur → « Charger l'extension non empaquetée » → sélectionner le dossier du projet. (Un stub `popup.html`/`service-worker.js` minimal est nécessaire pour que l'extension se charge — créer si absent : un `popup.html` vide et un `service-worker.js` vide, remplacés en Phase B.)
2. Ouvrir `config.html` (via l'action ou directement). Coller un vrai token → **Tester** → nom affiché.
3. **Charger mes bases** → sélectionner Temps + Tâches → les dropdowns de mapping se remplissent, auto-mapping visible.
4. Choisir une tâche congés, ajouter un favori, **Enregistrer** → redirection vers `popup.html`.
5. Rouvrir `config.html` → les valeurs sont pré-remplies (round-trip storage OK).

- [ ] **Step 3: Commit**

```bash
git add src/config/config.js
git commit -m "feat(config): connection, DB discovery, dual mapping, prefs, save"
```

---

## Self-review (Phase A)

- Couverture spec : §2 (core), §3 (modèle données/config), §4 (config page ①–⑤), §7 (thème), §8 (tests core), §9.1 (`toNotionDate`). ✓
- `notion-api.queryPage` est ajouté pour le chargement léger des tâches (utilisé en Phase B) — cohérent avec §7 « chargement léger au repos ».
- Cohérence des noms de champs : `timeDb.fields` = { taskName, startDate, endDate, taskId, projects, pause, comment, externalUrl, tasksRelation } — identiques entre `mapping.js`, `config.js`, spec §3. ✓
- Le thème clair (`config.css`) réutilisera le même bloc de variables en Phase B (`popup.css`).
