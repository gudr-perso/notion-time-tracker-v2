# Onglet Stats — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un onglet Stats complet (objectif hebdo, rythme quotidien, bilan par projet, congés) sur les périodes Jour/Semaine/Mois/Perso, alimenté par la base des temps Notion.

**Architecture:** Toute la logique d'agrégation vit dans un module pur testé `src/core/stats.js` (aucune API Chrome), réutilisant `time.js` et `mapping.js`. La couche UI `src/popup/stats.js` récupère les sessions via `queryAll`, appelle `stats.aggregate` et rend le tableau de bord. `popup.js` initialise l'onglet en lazy au premier affichage.

**Tech Stack:** JS vanilla + modules ES natifs, zéro build, zéro dépendance runtime. Tests Vitest (`npm test`). Graphiques en SVG/CSS purs (anneau `conic-gradient`, barres CSS).

**Référence spec :** `docs/superpowers/specs/2026-07-16-notion-timer-v2-stats-design.md`.

**Rappels de contexte (déjà vérifiés) :**
- `timeFields` (clés de `config.timeDb.fields`) : `taskName, startDate, endDate, taskId, projects, pause, comment, externalUrl, tasksRelation`.
- `sessionFromPage(page, f)` → `{ pageId, name, startTime, endTime, pauseMin }` (à étendre).
- `queryAll(token, dbId, { filter, sorts })` gère la pagination `has_more`.
- `extractProject(name)` renvoie le contenu entre `[...]`, sinon `'Sans projet'`.
- `workedMs(start, end, pauseMs)`, `startOfDay(date)` dans `time.js`.
- Congés : `config.prefs.vacationTaskId` (id de page). Objectif : `config.prefs.weeklyHours` (défaut 39).
- Variables CSS thème : `--bg-elev, --border, --border-soft, --text, --text-muted, --cyan, --cyan-deep, --orange, --green`.
- Tests Vitest : `import { describe, it, expect } from 'vitest'`, imports depuis `../src/core/...`.

---

## Structure des fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `src/core/mapping.js` | Ajout de `tasksRelIds` à `sessionFromPage` | Modifier |
| `src/core/stats.js` | Logique pure : bornes de période, jours ouvrés, objectif, agrégation, détection congés | Créer |
| `test/stats.test.js` | Tests unitaires de `core/stats.js` | Créer |
| `test/mapping.test.js` | Test de la nouvelle sortie `tasksRelIds` | Modifier |
| `src/popup/stats.js` | UI de l'onglet : périodes, fetch, rendu | Créer |
| `src/popup/popup.html` | Remplace le placeholder `#tab-stats` | Modifier |
| `src/popup/popup.css` | Styles de l'onglet Stats | Modifier |
| `src/popup/popup.js` | Init lazy de l'onglet Stats | Modifier |
| `manifest.json` / `package.json` / `package-lock.json` | Bump `5.2.0` | Modifier |
| `docs/VERSIONS.md`, `docs/AVANCEMENT.md`, `docs/documentation-*.md` | Release + D² | Modifier |

---

## Task 1 : `sessionFromPage` expose les IDs de relation Tâches

**Files:**
- Modify: `src/core/mapping.js:59-66`
- Test: `test/mapping.test.js`

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `test/mapping.test.js` (dans un `describe('sessionFromPage')` — le créer s'il n'existe pas) :

```js
it('expose les IDs de relation Tâches quand le champ est mappé', () => {
  const page = {
    id: 'p1',
    properties: {
      Nom: { title: [{ plain_text: 'Congés' }] },
      Début: { date: { start: '2026-07-15T09:00:00+02:00' } },
      Tâches: { relation: [{ id: 'aaa-bbb' }, { id: 'ccc' }] },
    },
  };
  const f = { taskName: 'Nom', startDate: 'Début', tasksRelation: 'Tâches' };
  const s = sessionFromPage(page, f);
  expect(s.tasksRelIds).toEqual(['aaa-bbb', 'ccc']);
});

it('renvoie tasksRelIds = [] si le champ relation est absent/non mappé', () => {
  const page = { id: 'p2', properties: { Nom: { title: [{ plain_text: 'X' }] } } };
  const s = sessionFromPage(page, { taskName: 'Nom' });
  expect(s.tasksRelIds).toEqual([]);
});
```

Vérifier que `sessionFromPage` est bien importé en haut de `test/mapping.test.js`.

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- mapping`
Expected: FAIL (`tasksRelIds` est `undefined`).

- [ ] **Step 3 : Implémenter**

Dans `src/core/mapping.js`, remplacer le corps de `sessionFromPage` :

```js
export function sessionFromPage(page, f) {
  const p = page.properties || {};
  const name = p[f.taskName] ? plain(p[f.taskName].title) : '';
  const start = p[f.startDate]?.date?.start || null;
  const end = f.endDate && p[f.endDate]?.date?.start ? p[f.endDate].date.start : null;
  const pauseMin = f.pause && p[f.pause] ? (p[f.pause].number || 0) : 0;
  const relProp = f.tasksRelation ? p[f.tasksRelation] : undefined;
  const tasksRelIds = relProp && relProp.relation ? relProp.relation.map((r) => r.id) : [];
  return { pageId: page.id, name, startTime: start, endTime: end, pauseMin, tasksRelIds };
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npm test -- mapping`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/core/mapping.js test/mapping.test.js
git commit -m "feat(core): sessionFromPage expose tasksRelIds (détection congés)"
```

---

## Task 2 : `core/stats.js` — bornes de période

**Files:**
- Create: `src/core/stats.js`
- Test: `test/stats.test.js`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `test/stats.test.js` :

```js
// test/stats.test.js
import { describe, it, expect } from 'vitest';
import { periodRange } from '../src/core/stats.js';

describe('periodRange', () => {
  it("semaine = lundi 00:00 → dimanche 23:59:59.999 (mer. 15 juil. 2026)", () => {
    const { start, end } = periodRange('week', new Date(2026, 6, 15));
    expect(start.getFullYear()).toBe(2026);
    expect([start.getMonth(), start.getDate()]).toEqual([6, 13]); // lundi 13 juil.
    expect(start.getHours()).toBe(0);
    expect([end.getMonth(), end.getDate()]).toEqual([6, 19]);     // dimanche 19 juil.
    expect(end.getHours()).toBe(23);
    expect(end.getMilliseconds()).toBe(999);
  });

  it('semaine à cheval sur deux mois (mer. 1er juil. 2026 → lundi 29 juin)', () => {
    const { start, end } = periodRange('week', new Date(2026, 6, 1));
    expect([start.getMonth(), start.getDate()]).toEqual([5, 29]); // 29 juin
    expect([end.getMonth(), end.getDate()]).toEqual([6, 5]);      // 5 juil.
  });

  it('mois = 1er → dernier jour', () => {
    const { start, end } = periodRange('month', new Date(2026, 6, 15));
    expect([start.getMonth(), start.getDate()]).toEqual([6, 1]);
    expect([end.getMonth(), end.getDate()]).toEqual([6, 31]);
  });

  it('jour = même jour, minuit → 23:59', () => {
    const { start, end } = periodRange('day', new Date(2026, 6, 15, 14, 30));
    expect([start.getDate(), start.getHours()]).toEqual([15, 0]);
    expect([end.getDate(), end.getHours()]).toEqual([15, 23]);
  });

  it('produit un label non vide', () => {
    expect(periodRange('month', new Date(2026, 6, 15)).label).toContain('2026');
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- stats`
Expected: FAIL (module `stats.js` introuvable).

- [ ] **Step 3 : Implémenter**

Créer `src/core/stats.js` :

```js
// src/core/stats.js — agrégations statistiques pures (aucune API Chrome).
import { workedMs, startOfDay } from './time.js';
import { extractProject } from './mapping.js';

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_ABBR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

export function periodRange(kind, refDate) {
  const ref = new Date(refDate);
  if (kind === 'day') {
    return {
      start: startOfDay(ref),
      end: endOfDay(ref),
      label: `${ref.getDate()} ${MOIS_ABBR[ref.getMonth()]}`,
    };
  }
  if (kind === 'week') {
    const day = ref.getDay(); // 0=dim … 6=sam
    const toMonday = day === 0 ? -6 : 1 - day;
    const start = startOfDay(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + toMonday));
    const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
    return {
      start,
      end,
      label: `${start.getDate()} ${MOIS_ABBR[start.getMonth()]} – ${end.getDate()} ${MOIS_ABBR[end.getMonth()]}`,
    };
  }
  if (kind === 'month') {
    const start = startOfDay(new Date(ref.getFullYear(), ref.getMonth(), 1));
    const end = endOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));
    return { start, end, label: `${MOIS_FR[ref.getMonth()]} ${ref.getFullYear()}` };
  }
  throw new Error(`periodRange: kind inconnu « ${kind} »`);
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npm test -- stats`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/core/stats.js test/stats.test.js
git commit -m "feat(core): stats.periodRange (jour/semaine/mois)"
```

---

## Task 3 : jours ouvrés & objectif

**Files:**
- Modify: `src/core/stats.js`
- Test: `test/stats.test.js`

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `test/stats.test.js` :

```js
import { weekdaysBetween, dailyTargetHours, objectiveHours } from '../src/core/stats.js';

describe('weekdaysBetween', () => {
  it('semaine pleine lun→dim = 5', () => {
    expect(weekdaysBetween(new Date(2026, 6, 13), new Date(2026, 6, 19))).toBe(5);
  });
  it('week-end seul = 0', () => {
    expect(weekdaysBetween(new Date(2026, 6, 18), new Date(2026, 6, 19))).toBe(0);
  });
  it('un seul jour ouvré = 1', () => {
    expect(weekdaysBetween(new Date(2026, 6, 15), new Date(2026, 6, 15))).toBe(1);
  });
  it('bornes incluses, insensible à l\'heure', () => {
    expect(weekdaysBetween(new Date(2026, 6, 13, 23), new Date(2026, 6, 17, 1))).toBe(5);
  });
});

describe('objectiveHours', () => {
  it('semaine sans congé = weeklyHours', () => {
    expect(objectiveHours(5, 0, 39)).toBeCloseTo(39);
  });
  it('semaine avec 1 congé', () => {
    expect(objectiveHours(5, 1, 39)).toBeCloseTo(31.2);
  });
  it('période 100 % week-end = 0', () => {
    expect(objectiveHours(0, 0, 39)).toBe(0);
  });
  it('congés > jours ouvrés → clamp à 0', () => {
    expect(objectiveHours(5, 6, 39)).toBe(0);
  });
  it('cible quotidienne = weekly / 5', () => {
    expect(dailyTargetHours(39)).toBeCloseTo(7.8);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- stats`
Expected: FAIL (`weekdaysBetween` non défini).

- [ ] **Step 3 : Implémenter**

Ajouter à `src/core/stats.js` :

```js
export function weekdaysBetween(start, end) {
  let n = 0;
  const d = startOfDay(start);
  const last = startOfDay(end).getTime();
  while (d.getTime() <= last) {
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5) n += 1;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

export function dailyTargetHours(weeklyHours) {
  return weeklyHours / 5;
}

export function objectiveHours(weekdays, congeDays, weeklyHours) {
  return Math.max(0, (weekdays - congeDays) * (weeklyHours / 5));
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npm test -- stats`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/core/stats.js test/stats.test.js
git commit -m "feat(core): stats.weekdaysBetween + objectiveHours"
```

---

## Task 4 : détection des sessions congés

**Files:**
- Modify: `src/core/stats.js`
- Test: `test/stats.test.js`

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `test/stats.test.js` :

```js
import { isVacationSession } from '../src/core/stats.js';

describe('isVacationSession', () => {
  it('match par relation (IDs normalisés, tirets ignorés)', () => {
    const s = { name: 'Congés', tasksRelIds: ['1a2b-3c4d'] };
    expect(isVacationSession(s, { vacationTaskId: '1a2b3c4d' })).toBe(true);
  });
  it('repli par nom quand pas de relation', () => {
    const s = { name: 'Congés [RH]', tasksRelIds: [] };
    expect(isVacationSession(s, { vacationName: 'Congés [RH]' })).toBe(true);
  });
  it('faux si aucune correspondance', () => {
    const s = { name: 'Tâche A', tasksRelIds: ['zzz'] };
    expect(isVacationSession(s, { vacationTaskId: '111', vacationName: 'Congés' })).toBe(false);
  });
  it('faux si aucune config congés', () => {
    expect(isVacationSession({ name: 'X', tasksRelIds: [] }, {})).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- stats`
Expected: FAIL (`isVacationSession` non défini).

- [ ] **Step 3 : Implémenter**

Ajouter à `src/core/stats.js` :

```js
const normId = (id) => String(id || '').replace(/-/g, '');

export function isVacationSession(session, { vacationTaskId, vacationName } = {}) {
  if (!vacationTaskId && !vacationName) return false;
  const rel = session.tasksRelIds || [];
  if (vacationTaskId && rel.some((id) => normId(id) === normId(vacationTaskId))) return true;
  if (vacationName && session.name === vacationName) return true;
  return false;
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npm test -- stats`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/core/stats.js test/stats.test.js
git commit -m "feat(core): stats.isVacationSession (relation ou nom)"
```

---

## Task 5 : `aggregate` — le cœur

**Files:**
- Modify: `src/core/stats.js`
- Test: `test/stats.test.js`

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `test/stats.test.js` :

```js
import { aggregate } from '../src/core/stats.js';

const H = 3600_000;

describe('aggregate', () => {
  const range = { start: new Date(2026, 6, 13), end: new Date(2026, 6, 19, 23, 59, 59, 999) };
  const sessions = [
    { name: 'Tâche A [ClientA]', startTime: new Date(2026, 6, 13, 9), endTime: new Date(2026, 6, 13, 17), pauseMin: 0, tasksRelIds: [] }, // 8h lun
    { name: 'Tâche B [Interne]', startTime: new Date(2026, 6, 14, 9), endTime: new Date(2026, 6, 14, 12), pauseMin: 0, tasksRelIds: [] }, // 3h mar
    { name: 'Congés', startTime: new Date(2026, 6, 15, 9), endTime: new Date(2026, 6, 15, 17), pauseMin: 0, tasksRelIds: ['vac'] },       // congé mer
  ];
  const isVac = (s) => isVacationSession(s, { vacationTaskId: 'vac' });

  it('temps travaillé exclut les congés', () => {
    const a = aggregate(sessions, { ...range, isVacation: isVac, weeklyHours: 39 });
    expect(a.workedMs).toBe(11 * H);
  });
  it('objectif ajusté congés (5 ouvrés − 1 congé) × 7,8 h', () => {
    const a = aggregate(sessions, { ...range, isVacation: isVac, weeklyHours: 39 });
    expect(a.objectiveMs).toBeCloseTo(31.2 * H, -3);
    expect(a.remainingMs).toBeCloseTo(20.2 * H, -3);
    expect(a.congeDays).toBe(1);
  });
  it('perProject trié décroissant avec ratios', () => {
    const a = aggregate(sessions, { ...range, isVacation: isVac, weeklyHours: 39 });
    expect(a.perProject.map((p) => p.project)).toEqual(['ClientA', 'Interne']);
    expect(a.perProject[0].ms).toBe(8 * H);
    expect(a.perProject[0].ratio).toBeCloseTo(8 / 11);
  });
  it('perDay couvre les 7 jours, marque congé et week-end', () => {
    const a = aggregate(sessions, { ...range, isVacation: isVac, weeklyHours: 39 });
    expect(a.perDay).toHaveLength(7);
    expect(a.perDay[0].ms).toBe(8 * H);            // lundi
    expect(a.perDay[2].isVacation).toBe(true);     // mercredi
    expect(a.perDay[2].ms).toBe(0);
    expect(a.perDay[5].isWeekend).toBe(true);      // samedi
  });
  it('déduit les pauses', () => {
    const s = [{ name: 'X', startTime: new Date(2026, 6, 13, 9), endTime: new Date(2026, 6, 13, 11), pauseMin: 30, tasksRelIds: [] }];
    const a = aggregate(s, { ...range, weeklyHours: 39 });
    expect(a.workedMs).toBe(1.5 * H);
  });
  it('ignore les sessions sans fin', () => {
    const s = [{ name: 'X', startTime: new Date(2026, 6, 13, 9), endTime: null, pauseMin: 0, tasksRelIds: [] }];
    expect(aggregate(s, { ...range, weeklyHours: 39 }).workedMs).toBe(0);
  });
  it('période vide : progress défini, perProject vide', () => {
    const a = aggregate([], { ...range, weeklyHours: 39 });
    expect(a.workedMs).toBe(0);
    expect(a.perProject).toEqual([]);
    expect(a.progress).toBe(0);
    expect(a.perDay).toHaveLength(7);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- stats`
Expected: FAIL (`aggregate` non défini).

- [ ] **Step 3 : Implémenter**

Ajouter à `src/core/stats.js` :

```js
export function aggregate(sessions, { start, end, isVacation = () => false, weeklyHours = 39 }) {
  const dayKey = (d) => startOfDay(d).getTime();

  // Amorce toutes les journées de la plage (ordre chronologique).
  const perDayMap = new Map();
  const cursor = startOfDay(start);
  const lastKey = dayKey(end);
  while (cursor.getTime() <= lastKey) {
    const wd = cursor.getDay();
    perDayMap.set(cursor.getTime(), {
      date: new Date(cursor), ms: 0, isVacation: false, isWeekend: wd === 0 || wd === 6,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const projMap = new Map();
  const congeDaySet = new Set();
  let workedTotal = 0;

  for (const s of sessions) {
    if (!s.startTime || !s.endTime) continue;
    const k = dayKey(s.startTime);
    const bucket = perDayMap.get(k);
    if (isVacation(s)) {
      congeDaySet.add(k);
      if (bucket) bucket.isVacation = true;
      continue; // exclu du temps travaillé et des projets
    }
    const dur = workedMs(s.startTime, s.endTime, (s.pauseMin || 0) * 60_000);
    workedTotal += dur;
    if (bucket) bucket.ms += dur;
    const proj = extractProject(s.name);
    projMap.set(proj, (projMap.get(proj) || 0) + dur);
  }

  const perDay = [...perDayMap.values()];
  const perProject = [...projMap.entries()]
    .map(([project, ms]) => ({ project, ms, ratio: workedTotal ? ms / workedTotal : 0 }))
    .sort((a, b) => b.ms - a.ms);

  const weekdays = weekdaysBetween(start, end);
  const congeDays = congeDaySet.size;
  const objectiveMs = objectiveHours(weekdays, congeDays, weeklyHours) * 3600_000;
  const remainingMs = Math.max(0, objectiveMs - workedTotal);
  const progress = objectiveMs > 0 ? workedTotal / objectiveMs : null;

  return { workedMs: workedTotal, objectiveMs, remainingMs, progress, congeDays, perDay, perProject };
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npm test`
Expected: PASS (tous les fichiers, dont les 27 existants).

- [ ] **Step 5 : Commit**

```bash
git add src/core/stats.js test/stats.test.js
git commit -m "feat(core): stats.aggregate (par jour, par projet, congés, objectif)"
```

---

## Task 6 : squelette HTML + styles de l'onglet

**Files:**
- Modify: `src/popup/popup.html:87-89`
- Modify: `src/popup/popup.css` (ajout en fin de fichier)

- [ ] **Step 1 : Remplacer le placeholder dans `popup.html`**

Remplacer le bloc :

```html
      <section id="tab-stats" class="tab-panel" hidden>
        <div class="placeholder">📊 Statistiques — <em>Bientôt</em></div>
      </section>
```

par :

```html
      <section id="tab-stats" class="tab-panel" hidden>
        <div class="stats-bar">
          <div class="seg" id="stats-seg">
            <button type="button" data-kind="day">Jour</button>
            <button type="button" data-kind="week" class="on">Semaine</button>
            <button type="button" data-kind="month">Mois</button>
            <button type="button" data-kind="custom">Perso</button>
          </div>
          <div class="stats-nav">
            <button type="button" id="stats-prev" class="sm-arrow" title="Précédent">‹</button>
            <span id="stats-range" class="stats-range"></span>
            <button type="button" id="stats-next" class="sm-arrow" title="Suivant">›</button>
          </div>
        </div>
        <div id="stats-custom" class="stats-custom" hidden>
          <input type="date" id="stats-from" class="input" />
          <span class="arrow">→</span>
          <input type="date" id="stats-to" class="input" />
          <button type="button" id="stats-apply" class="btn btn-grey">OK</button>
        </div>

        <div id="stats-loading" class="stats-state" hidden>Chargement…</div>
        <div id="stats-error" class="stats-state" hidden></div>
        <div id="stats-empty" class="stats-state" hidden>Aucune session sur cette période.</div>

        <div id="stats-content" hidden>
          <div class="card stats-obj">
            <div class="ring" id="stats-ring">
              <b><span id="stats-ring-worked" class="ring-big">—</span><span id="stats-ring-obj" class="ring-sub"></span></b>
            </div>
            <div class="obj-side" id="stats-obj-side"></div>
          </div>
          <div class="card">
            <h4 class="stats-h">Rythme quotidien</h4>
            <div class="days" id="stats-days"></div>
          </div>
          <div class="card">
            <h4 class="stats-h">Par projet</h4>
            <div id="stats-projects"></div>
          </div>
        </div>
      </section>
```

- [ ] **Step 2 : Ajouter les styles en fin de `popup.css`**

Ajouter à la fin de `src/popup/popup.css` :

```css
/* ===== Onglet Stats ===== */
.stats-bar { display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
.seg { display:flex; background:var(--bg-elev); border:1px solid var(--border); border-radius:8px; padding:3px; gap:2px; }
.seg button { border:0; background:transparent; color:var(--text-muted); padding:5px 11px; border-radius:6px; font-size:12px; cursor:pointer; }
.seg button.on { background:var(--cyan-deep); color:#fff; }
.stats-nav { margin-left:auto; display:flex; align-items:center; gap:8px; color:var(--text); }
.stats-range { font-weight:600; min-width:96px; text-align:center; }
.sm-arrow { background:var(--bg-elev); border:1px solid var(--border); color:var(--text); width:28px; height:28px; border-radius:6px; cursor:pointer; }
.sm-arrow:disabled { opacity:.4; cursor:default; }
.stats-custom { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
.stats-custom .arrow { color:var(--text-muted); }
.stats-state { padding:24px; text-align:center; color:var(--text-muted); }
.stats-h { margin:0 0 10px; font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); }

.stats-obj { display:flex; align-items:center; gap:18px; }
.ring { --p:0; width:108px; height:108px; border-radius:50%; flex:0 0 auto; position:relative;
  background:conic-gradient(var(--cyan) calc(var(--p)*1%), var(--border) 0); display:grid; place-items:center; }
.ring b { width:84px; height:84px; border-radius:50%; background:var(--bg-elev); display:grid; place-items:center; text-align:center; }
.ring-big { font-size:20px; font-weight:700; color:var(--text); }
.ring-sub { font-size:11px; color:var(--text-muted); }
.obj-side { flex:1; }
.obj-side .line { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid var(--border); }
.obj-side .line:last-child { border-bottom:0; }
.obj-side .k { color:var(--text-muted); }
.obj-side .v { font-weight:600; }
.conge-badge { display:inline-block; background:rgba(243,97,0,.15); color:var(--orange); padding:2px 9px; border-radius:999px; font-size:12px; }

.days { display:flex; align-items:flex-end; gap:6px; height:130px; }
.day { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; height:100%; justify-content:flex-end; }
.day .bar { width:100%; max-width:34px; background:var(--cyan); border-radius:4px 4px 0 0; min-height:2px; }
.day .bar.conge { background:var(--orange); }
.day .bar.empty { background:var(--border); }
.day .dh { font-size:10px; color:var(--text-muted); }
.day .dn { font-size:11px; color:var(--text-muted); }

.proj { display:flex; align-items:center; gap:10px; padding:6px 0; }
.proj .pn { width:130px; flex:0 0 auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.proj .ptrack { flex:1; height:14px; background:var(--border); border-radius:4px; overflow:hidden; }
.proj .ptrack > i { display:block; height:100%; background:var(--cyan); }
.proj .pv { width:82px; text-align:right; flex:0 0 auto; color:var(--text-muted); font-variant-numeric:tabular-nums; }
```

- [ ] **Step 3 : Commit**

```bash
git add src/popup/popup.html src/popup/popup.css
git commit -m "feat(popup): squelette HTML + styles de l'onglet Stats"
```

*(Vérification visuelle à l'étape suivante, une fois le JS branché.)*

---

## Task 7 : module UI `popup/stats.js` + wiring

**Files:**
- Create: `src/popup/stats.js`
- Modify: `src/popup/popup.js`

- [ ] **Step 1 : Créer `src/popup/stats.js`**

```js
// src/popup/stats.js — onglet Stats : sélecteur de période, fetch, rendu.
import { queryAll, getPage } from '../core/notion-api.js';
import { sessionFromPage, taskFromPage, titleWithProject } from '../core/mapping.js';
import { formatDuration, toNotionDate } from '../core/time.js';
import { periodRange, aggregate, isVacationSession } from '../core/stats.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const JOURS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const S = {
  config: null, token: '', timeFields: null,
  kind: 'week', ref: new Date(),
  custom: { from: null, to: null },
  vacation: { vacationTaskId: null, vacationName: null },
  cache: new Map(),        // clé de plage → aggregate
  loaded: false,
};

function currentRange() {
  if (S.kind === 'custom') {
    const from = S.custom.from ? new Date(S.custom.from + 'T00:00:00') : new Date();
    const to = S.custom.to ? new Date(S.custom.to + 'T23:59:59') : new Date();
    return { start: from, end: to, label: `${S.custom.from || '?'} → ${S.custom.to || '?'}` };
  }
  return periodRange(S.kind, S.ref);
}

function cacheKey(r) { return `${S.kind}|${r.start.getTime()}|${r.end.getTime()}`; }

function shift(dir) {
  const d = new Date(S.ref);
  if (S.kind === 'day') d.setDate(d.getDate() + dir);
  else if (S.kind === 'week') d.setDate(d.getDate() + 7 * dir);
  else if (S.kind === 'month') d.setMonth(d.getMonth() + dir);
  S.ref = d;
}

function show(which) {
  for (const id of ['stats-loading', 'stats-error', 'stats-empty', 'stats-content']) {
    $(id).hidden = id !== which;
  }
}

async function loadVacationTask() {
  const id = S.config.prefs?.vacationTaskId;
  S.vacation = { vacationTaskId: id || null, vacationName: null };
  if (!id) return;
  try {
    const task = taskFromPage(await getPage(S.token, id), S.config.tasksDb.fields);
    S.vacation.vacationName = titleWithProject(task.name, task.project);
  } catch { /* le repli par nom sera simplement inactif */ }
}

async function fetchAggregate(range) {
  const key = cacheKey(range);
  if (S.cache.has(key)) return S.cache.get(key);
  const filter = {
    and: [
      { property: S.timeFields.startDate, date: { on_or_after: toNotionDate(range.start) } },
      { property: S.timeFields.startDate, date: { on_or_before: toNotionDate(range.end) } },
    ],
  };
  const sorts = [{ property: S.timeFields.startDate, direction: 'ascending' }];
  const pages = await queryAll(S.token, S.config.timeDb.id, { filter, sorts });
  const sessions = pages.map((p) => sessionFromPage(p, S.timeFields));
  const isVacation = (s) => isVacationSession(s, S.vacation);
  const agg = aggregate(sessions, {
    start: range.start, end: range.end, isVacation,
    weeklyHours: S.config.prefs?.weeklyHours ?? 39,
  });
  S.cache.set(key, agg);
  return agg;
}

function renderObjective(agg) {
  const fmt = (ms) => formatDuration(ms, { withSeconds: false });
  const pct = agg.progress === null ? 0 : Math.round(agg.progress * 100);
  $('stats-ring').style.setProperty('--p', Math.min(100, pct));
  $('stats-ring-worked').textContent = fmt(agg.workedMs);
  $('stats-ring-obj').textContent = agg.objectiveMs > 0 ? `/ ${fmt(agg.objectiveMs)}` : 'sans objectif';
  const conge = agg.congeDays > 0
    ? `<span class="conge-badge">🌴 ${agg.congeDays} j</span>` : '—';
  $('stats-obj-side').innerHTML =
    `<div class="line"><span class="k">Objectif</span><span class="v">${agg.objectiveMs > 0 ? fmt(agg.objectiveMs) : '—'}</span></div>` +
    `<div class="line"><span class="k">Travaillé</span><span class="v">${fmt(agg.workedMs)}</span></div>` +
    `<div class="line"><span class="k">Reste</span><span class="v">${fmt(agg.remainingMs)}</span></div>` +
    `<div class="line"><span class="k">Congés</span><span class="v">${conge}</span></div>`;
}

function renderDays(agg) {
  const maxMs = Math.max(1, ...agg.perDay.map((d) => d.ms));
  $('stats-days').innerHTML = agg.perDay.map((d) => {
    const h = Math.round((d.ms / maxMs) * 100);
    const cls = d.isVacation ? 'bar conge' : (d.ms === 0 ? 'bar empty' : 'bar');
    const top = d.isVacation ? '🌴' : (d.ms ? formatDuration(d.ms, { withSeconds: false }) : '·');
    const dn = S.kind === 'month' ? String(d.date.getDate()) : JOURS[d.date.getDay()];
    return `<div class="day"><div class="dh">${top}</div><div class="${cls}" style="height:${Math.max(2, h)}%"></div><div class="dn">${dn}</div></div>`;
  }).join('');
}

function renderProjects(agg) {
  if (!agg.perProject.length) { $('stats-projects').innerHTML = '<div class="stats-state">—</div>'; return; }
  $('stats-projects').innerHTML = agg.perProject.map((p) => {
    const w = Math.round(p.ratio * 100);
    return `<div class="proj"><span class="pn">${esc(p.project)}</span>` +
      `<span class="ptrack"><i style="width:${w}%"></i></span>` +
      `<span class="pv">${formatDuration(p.ms, { withSeconds: false })} · ${w}%</span></div>`;
  }).join('');
}

async function refresh() {
  const range = currentRange();
  $('stats-range').textContent = range.label;
  $('stats-prev').disabled = $('stats-next').disabled = S.kind === 'custom';
  show('stats-loading');
  try {
    const agg = await fetchAggregate(range);
    const empty = agg.workedMs === 0 && agg.congeDays === 0;
    if (empty) { show('stats-empty'); return; }
    renderObjective(agg);
    renderDays(agg);
    renderProjects(agg);
    show('stats-content');
  } catch (e) {
    $('stats-error').textContent = `Erreur : ${e.message}`;
    show('stats-error');
  }
}

let wired = false;
function wireOnce() {
  if (wired) return;
  wired = true;
  $('stats-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-kind]');
    if (!btn) return;
    S.kind = btn.dataset.kind;
    [...$('stats-seg').children].forEach((b) => b.classList.toggle('on', b === btn));
    $('stats-custom').hidden = S.kind !== 'custom';
    if (S.kind !== 'custom') refresh();
  });
  $('stats-prev').addEventListener('click', () => { shift(-1); refresh(); });
  $('stats-next').addEventListener('click', () => { shift(1); refresh(); });
  $('stats-apply').addEventListener('click', () => {
    S.custom.from = $('stats-from').value || null;
    S.custom.to = $('stats-to').value || null;
    if (S.custom.from && S.custom.to) refresh();
  });
}

// Appelé au premier affichage de l'onglet Stats (lazy).
export async function initStats(config) {
  if (S.loaded) { refresh(); return; }
  S.config = config;
  S.token = config.notionToken;
  S.timeFields = config.timeDb.fields;
  S.loaded = true;
  wireOnce();
  await loadVacationTask();
  await refresh();
}

// Invalide le cache (après enregistrement d'une session).
export function invalidateStats() { S.cache.clear(); }
```

- [ ] **Step 2 : Ajouter `titleWithProject` à l'export de `mapping.js` (déjà exporté — vérifier)**

`titleWithProject` est déjà `export function` dans `src/core/mapping.js`. Vérifier via :

Run: `grep -n "export function titleWithProject" src/core/mapping.js`
Expected: une ligne trouvée. Si absente, l'ajouter à l'export.

- [ ] **Step 3 : Brancher l'init lazy dans `popup.js`**

Dans `src/popup/popup.js`, ajouter l'import en tête :

```js
import { initStats } from './stats.js';
```

Puis remplacer le gestionnaire d'onglets (lignes ~30-36) par :

```js
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      $('tab-timer').hidden = tab.dataset.tab !== 'timer';
      $('tab-stats').hidden = tab.dataset.tab !== 'stats';
      if (tab.dataset.tab === 'stats') initStats(config);
    });
  });
```

- [ ] **Step 4 : Vérification manuelle dans l'extension**

1. `chrome://extensions` → recharger l'extension (↻).
2. Ouvrir le popup → onglet **Stats**.
3. Vérifier : la semaine courante s'affiche (anneau + reste + rythme + projets), la navigation ‹ › change de semaine, les segments Jour/Mois fonctionnent, « Perso » déplie les deux dates et « OK » applique la plage.
4. Vérifier le thème clair (bascule ☀️) : lisibilité de l'anneau et des barres.
5. Console du popup : aucune erreur.

Expected: l'onglet affiche des données cohérentes avec la base Notion ; état vide si période sans session.

- [ ] **Step 5 : Commit**

```bash
git add src/popup/stats.js src/popup/popup.js src/core/mapping.js
git commit -m "feat(popup): onglet Stats — périodes, fetch, rendu (anneau, rythme, projets)"
```

---

## Task 8 : release v5.2.0 + documentation (D²)

**Files:**
- Modify: `manifest.json`, `package.json`, `package-lock.json`
- Modify: `docs/VERSIONS.md`, `docs/AVANCEMENT.md`, `docs/documentation-fonctionnelle.md`, `docs/documentation-technique.md`

> **Note de merge :** cette branche part de `main` (avant la release injection 5.1.0). Au merge, s'assurer
> que la section `[5.1.0]` (injection) reste présente dans `VERSIONS.md`, au-dessus de `[5.2.0]`, et que le
> `manifest.json` final porte bien `5.2.0`.

- [ ] **Step 1 : Bump de version**

Dans `manifest.json`, `package.json`, `package-lock.json` (deux occurrences dans lock : `version` racine + `packages[""].version`) : passer la version à `5.2.0`.

Run: `grep -rn "\"version\"" manifest.json package.json package-lock.json`
Expected: toutes à `5.2.0` (hors `lockfileVersion`).

- [ ] **Step 2 : `docs/VERSIONS.md` — nouvelle section en tête**

Ajouter sous le titre / la note de numérotation :

```markdown
## [5.2.0] — 2026-07-16

Onglet Stats : tableau de bord du temps travaillé.

### Ajouté
- **Onglet 📊 Stats** : objectif hebdomadaire (anneau de progression), rythme quotidien (barres),
  bilan par projet, prise en compte des congés.
- **Périodes** Jour / Semaine / Mois / Perso (plage libre) avec navigation précédent/suivant.
- Objectif ajusté aux congés : `(jours ouvrés − jours de congé) × heures-hebdo / 5`.
- Module pur testé `core/stats.js` (bornes de période, jours ouvrés, agrégation, objectif).
```

- [ ] **Step 3 : `docs/AVANCEMENT.md` — refléter Stats livré**

- Passer la version courante reflétée à `5.2.0`.
- Dans le tableau des briques, passer **Onglet Stats** de `⬜ Reporté` à `✅ v5.2.0`.
- Retirer l'onglet Stats de « Prochaine action ».
- Mettre à jour le total de tests (`npm test` affiche désormais plus de 27 tests — relever le nombre réel).

- [ ] **Step 4 : `docs/documentation-fonctionnelle.md` — réécrire le §4**

Remplacer le §4 « Onglet Stats — reporté » par une description livrée : les 4 blocs (objectif hebdo +
anneau ; rythme quotidien ; bilan par projet ; congés), le sélecteur de période (Jour/Semaine/Mois/Perso)
et la navigation, la formule d'objectif ajustée aux congés, l'état vide. Retirer la mention « non livré »
en §1.1. Mettre à jour l'en-tête de version (`5.2.0`).

- [ ] **Step 5 : `docs/documentation-technique.md` — nouveaux modules**

Ajouter la description de `core/stats.js` (fonctions `periodRange`, `weekdaysBetween`, `dailyTargetHours`,
`objectiveHours`, `isVacationSession`, `aggregate`) et de `popup/stats.js` (état `S`, fetch avec cache,
rendu anneau/barres/projets, init lazy). Mettre à jour l'en-tête de version.

- [ ] **Step 6 : Vérifier les tests + lint visuel**

Run: `npm test`
Expected: tous verts (existants + nouveaux `stats`/`mapping`).

- [ ] **Step 7 : Commit de release**

```bash
git add manifest.json package.json package-lock.json docs/
git commit -m "release: v5.2.0 — onglet Stats"
```

---

## Notes de finalisation

- Après la Task 8, l'onglet Stats est livré. Proposer la fusion via la skill
  `superpowers:finishing-a-development-branch`.
- Si un piège non trivial surgit (ex. décalage de fuseau sur les bornes de semaine, ou relation congés
  non détectée), consigner une entrée dans `docs/EVENEMENTS.md` (routine AVEC).
- Idée hors périmètre notée pour plus tard : bouton « rafraîchir » manuel et invalidation auto du cache
  Stats après un enregistrement de session (via `invalidateStats()` déjà exporté).
