# Congés / Planning hebdomadaire — Phase 1 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire de l'objectif Stats une somme d'heures issues d'un **planning hebdomadaire** configurable, afficher les congés **en jours** (fraction d'heures réelles) et remplacer la ligne de cible globale par un **repère par barre**. (La saisie des congés en demi-journées est la **Phase 2**, planifiée séparément.)

**Architecture :** Nouveau module pur `core/schedule.js` (modèle du planning + heures planifiées par jour). `core/stats.js#aggregate` calcule l'objectif à partir du planning (repli forfait `weeklyHours/5` si aucun planning). La config remplace le champ « Heures/semaine » par une grille 7×(matin/aprem). `popup/stats.js` formate le badge en jours et pose un repère de cible par barre (avec un léger restructure du `.day` pour des hauteurs exactes).

**Tech Stack :** JS vanilla + modules ES natifs, Vitest (modules `core/` uniquement), zéro build.

Réf. spec : `docs/superpowers/specs/2026-07-18-conges-demi-journees-design.md`.

---

## File Structure

- **Create** `src/core/schedule.js` — modèle planning : `WEEKDAY_KEYS`, `DEFAULT_SCHEDULE`, `scheduledMsForDate`, `hasAnySchedule`, `weeklyTotalHours`.
- **Create** `test/schedule.test.js` — tests du module ci-dessus.
- **Modify** `src/core/stats.js` — `aggregate` : objectif dérivé du planning, `perDay[].targetMs`, `congeDays` fractionnaire.
- **Modify** `test/stats.test.js` — cas planning + non-régression fallback.
- **Modify** `src/config/config.html` — remplacer la ligne « Heures/semaine » par la grille planning.
- **Modify** `src/config/config.js` — rendu/lecture/écriture de la grille, total dérivé, défaut pré-rempli.
- **Modify** `src/core/config-io.js` + `test/config-io.test.js` — inclure `schedule` dans export/import.
- **Modify** `src/popup/stats.js` — badge en jours, restructure `.day` en track, repère de cible par barre, passage de `schedule` à `aggregate`.
- **Modify** `src/popup/popup.css` — styles du track et du repère de cible.
- **Modify** docs (VERSIONS, AVANCEMENT, EVENEMENTS, documentation-fonctionnelle, documentation-technique) + bump `5.6.0`.

---

## Task 1 : `core/schedule.js` — modèle du planning

**Files:**
- Create: `src/core/schedule.js`
- Test: `test/schedule.test.js`

- [ ] **Step 1 : Écrire les tests (RED)**

```js
// test/schedule.test.js
import { describe, it, expect } from 'vitest';
import { scheduledMsForDate, hasAnySchedule, weeklyTotalHours, DEFAULT_SCHEDULE } from '../src/core/schedule.js';

const H = 3600_000;
const MON = new Date(2026, 6, 13); // lundi 13 juil. 2026
const FRI = new Date(2026, 6, 17); // vendredi
const SAT = new Date(2026, 6, 18); // samedi

describe('scheduledMsForDate', () => {
  it('lundi par défaut = 8 h (matin 4 h + aprem 4 h)', () => {
    expect(scheduledMsForDate(DEFAULT_SCHEDULE, MON)).toBe(8 * H);
  });
  it('vendredi par défaut = 7 h (aprem plus court)', () => {
    expect(scheduledMsForDate(DEFAULT_SCHEDULE, FRI)).toBe(7 * H);
  });
  it('samedi = 0 (non travaillé)', () => {
    expect(scheduledMsForDate(DEFAULT_SCHEDULE, SAT)).toBe(0);
  });
  it('segment après-midi absent = matin seul', () => {
    const s = { ...DEFAULT_SCHEDULE, mon: { am: ['09:00', '13:00'], pm: null } };
    expect(scheduledMsForDate(s, MON)).toBe(4 * H);
  });
  it('planning absent = 0', () => {
    expect(scheduledMsForDate(null, MON)).toBe(0);
    expect(scheduledMsForDate(undefined, MON)).toBe(0);
  });
});

describe('hasAnySchedule', () => {
  it('défaut = vrai', () => { expect(hasAnySchedule(DEFAULT_SCHEDULE)).toBe(true); });
  it('tout vide = faux', () => {
    expect(hasAnySchedule({ mon: { am: null, pm: null } })).toBe(false);
  });
  it('absent = faux', () => { expect(hasAnySchedule(undefined)).toBe(false); });
});

describe('weeklyTotalHours', () => {
  it('planning par défaut = 39 h', () => {
    expect(weeklyTotalHours(DEFAULT_SCHEDULE)).toBeCloseTo(39);
  });
  it('planning vide = 0', () => { expect(weeklyTotalHours({})).toBe(0); });
});
```

- [ ] **Step 2 : Lancer les tests (échec attendu)**

Run: `npx vitest run test/schedule.test.js`
Expected: FAIL — `scheduledMsForDate` etc. introuvables (module inexistant).

- [ ] **Step 3 : Écrire le module (GREEN)**

```js
// src/core/schedule.js — modèle du planning hebdomadaire (logique pure, sans API Chrome ni DOM).

// getDay() : 0=dimanche … 6=samedi → clé du planning.
export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Planning par défaut : lun–jeu 09:00–13:00 / 14:00–18:00 (8 h), ven 14:00–17:00 (7 h), sam/dim off → 39 h.
export const DEFAULT_SCHEDULE = {
  mon: { am: ['09:00', '13:00'], pm: ['14:00', '18:00'] },
  tue: { am: ['09:00', '13:00'], pm: ['14:00', '18:00'] },
  wed: { am: ['09:00', '13:00'], pm: ['14:00', '18:00'] },
  thu: { am: ['09:00', '13:00'], pm: ['14:00', '18:00'] },
  fri: { am: ['09:00', '13:00'], pm: ['14:00', '17:00'] },
  sat: { am: null, pm: null },
  sun: { am: null, pm: null },
};

const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const segMs = (seg) => (seg && seg[0] && seg[1]) ? Math.max(0, toMin(seg[1]) - toMin(seg[0])) * 60_000 : 0;
const dayOf = (schedule, date) => (schedule ? schedule[WEEKDAY_KEYS[date.getDay()]] : null);

export function scheduledMsForDate(schedule, date) {
  const day = dayOf(schedule, date);
  if (!day) return 0;
  return segMs(day.am) + segMs(day.pm);
}

export function hasAnySchedule(schedule) {
  if (!schedule) return false;
  return Object.values(schedule).some((d) => d && (segMs(d.am) > 0 || segMs(d.pm) > 0));
}

export function weeklyTotalHours(schedule) {
  if (!schedule) return 0;
  let ms = 0;
  for (const d of Object.values(schedule)) { if (d) ms += segMs(d.am) + segMs(d.pm); }
  return ms / 3600_000;
}
```

- [ ] **Step 4 : Lancer les tests (succès)**

Run: `npx vitest run test/schedule.test.js`
Expected: PASS (11 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/core/schedule.js test/schedule.test.js
git commit -m "feat(schedule): modele planning hebdo (heures planifiees par jour)"
```

---

## Task 2 : `core/stats.js` — objectif dérivé du planning

**Files:**
- Modify: `src/core/stats.js` (fonction `aggregate`)
- Test: `test/stats.test.js`

- [ ] **Step 1 : Écrire les tests planning (RED)**

Ajouter dans `test/stats.test.js`, en haut : `import { DEFAULT_SCHEDULE } from '../src/core/schedule.js';`
puis, dans `describe('aggregate', …)`, ces cas :

```js
  it('avec planning : objectif = somme des heures planifiées de la période', () => {
    const s = [{ name: 'T [X]', startTime: new Date(2026, 6, 13, 9), endTime: new Date(2026, 6, 13, 17), pauseMin: 0, tasksRelIds: [] }]; // 8h lun
    const a = aggregate(s, { ...range, schedule: DEFAULT_SCHEDULE, weeklyHours: 39 });
    expect(a.objectiveMs).toBeCloseTo(39 * H, -3); // lun-jeu 8h ×4 + ven 7h
    expect(a.workedMs).toBe(8 * H);
    expect(a.remainingMs).toBeCloseTo(31 * H, -3);
  });
  it('avec planning : congé plein jour retire les heures planifiées du jour', () => {
    const s = [
      { name: 'Congés', startTime: new Date(2026, 6, 13, 9), endTime: new Date(2026, 6, 13, 13), pauseMin: 0, tasksRelIds: ['vac'] },  // matin 4h
      { name: 'Congés', startTime: new Date(2026, 6, 13, 14), endTime: new Date(2026, 6, 13, 18), pauseMin: 0, tasksRelIds: ['vac'] }, // aprem 4h
    ];
    const a = aggregate(s, { ...range, isVacation: isVac, schedule: DEFAULT_SCHEDULE, weeklyHours: 39 });
    expect(a.objectiveMs).toBeCloseTo(31 * H, -3); // 39 − 8
    expect(a.congeDays).toBeCloseTo(1);            // 8h / 8h planifiées
  });
  it('avec planning : demi-journée retire ses heures et vaut 0,5 j', () => {
    const s = [{ name: 'Congés', startTime: new Date(2026, 6, 13, 9), endTime: new Date(2026, 6, 13, 13), pauseMin: 0, tasksRelIds: ['vac'] }]; // matin 4h
    const a = aggregate(s, { ...range, isVacation: isVac, schedule: DEFAULT_SCHEDULE, weeklyHours: 39 });
    expect(a.objectiveMs).toBeCloseTo(35 * H, -3); // 39 − 4
    expect(a.congeDays).toBeCloseTo(0.5);          // 4h / 8h
  });
  it('perDay.targetMs reflète le planning', () => {
    const a = aggregate([], { ...range, schedule: DEFAULT_SCHEDULE, weeklyHours: 39 });
    expect(a.perDay[0].targetMs).toBe(8 * H); // lundi
    expect(a.perDay[4].targetMs).toBe(7 * H); // vendredi
    expect(a.perDay[5].targetMs).toBe(0);     // samedi
  });
```

- [ ] **Step 2 : Lancer les tests (échec attendu)**

Run: `npx vitest run test/stats.test.js`
Expected: FAIL — `objectiveMs` faux (planning ignoré), `perDay[].targetMs` undefined.

- [ ] **Step 3 : Modifier `aggregate` (GREEN)**

Dans `src/core/stats.js` :

1. Ajouter en tête : `import { scheduledMsForDate, hasAnySchedule } from './schedule.js';`
2. Étendre la signature : `export function aggregate(sessions, { start, end, isVacation = () => false, weeklyHours = 39, schedule = null }) {`
3. Supprimer `const congeDaySet = new Set();` et la ligne `congeDaySet.add(k);` (plus utilisées).
4. Remplacer le bloc de calcul d'objectif (depuis `const dailyTargetMs = …` jusqu'au `return …`) par :

```js
  // Cible de chaque jour : le planning s'il est défini, sinon le forfait plat des jours ouvrés (rétro-compat).
  const useSchedule = hasAnySchedule(schedule);
  const dailyTargetMs = dailyTargetHours(weeklyHours) * 3600_000;
  const targetMsForDate = (date) => {
    if (useSchedule) return scheduledMsForDate(schedule, date);
    const wd = date.getDay();
    return (wd >= 1 && wd <= 5) ? dailyTargetMs : 0;
  };

  let rawObjectiveMs = 0;
  let congeCappedMs = 0;
  let congeDaysAcc = 0;
  for (const d of perDay) {
    const t = targetMsForDate(d.date);
    d.targetMs = t;                          // exposé pour le repère de cible par barre (rendu)
    rawObjectiveMs += t;
    const capped = Math.min(d.congeMs, t);   // un congé ne peut retirer plus que la cible du jour
    congeCappedMs += capped;
    if (t > 0) congeDaysAcc += capped / t;   // fraction d'heures réelles → jours
  }
  const objectiveMs = Math.max(0, rawObjectiveMs - congeCappedMs);
  const remainingMs = Math.max(0, objectiveMs - workedTotal);
  const progress = objectiveMs > 0 ? workedTotal / objectiveMs : null;

  return { workedMs: workedTotal, congeMs: congeTotal, objectiveMs, remainingMs, progress, congeDays: congeDaysAcc, perDay, perProject };
```

> Note : `objectiveHours` et `weekdaysBetween` restent exportés (API + tests propres) même s'ils ne servent plus dans `aggregate`.

- [ ] **Step 4 : Lancer toute la suite (succès + non-régression)**

Run: `npx vitest run`
Expected: PASS. Les cas fallback existants (sans `schedule`) restent verts : forfait 7,8 h/jour ouvré reproduit à l'identique (objectif 31,2 h, congé plein = 1,0 j, congé week-end sans impact).

- [ ] **Step 5 : Commit**

```bash
git add src/core/stats.js test/stats.test.js
git commit -m "feat(stats): objectif derive du planning + congeDays fractionnaire + perDay.targetMs"
```

---

## Task 3 : Config — grille planning

**Files:**
- Modify: `src/config/config.html` (ligne de la préférence « Heures / semaine », ~ligne 111)
- Modify: `src/config/config.js` (savePrefs ~425-437, loadPrefs ~510-513, + rendu grille)
- Modify: `src/core/config-io.js` + `test/config-io.test.js`

- [ ] **Step 1 : Test config-io (RED)**

Dans `test/config-io.test.js`, ajouter un cas vérifiant que `schedule` fait l'aller-retour et que le token reste exclu :

```js
  it('inclut le planning et exclut le token', () => {
    const cfg = { notionToken: 'secret', timeDb: { id: 't', name: 'T', fields: {} }, tasksDb: { id: 'k', name: 'K', fields: {} },
      prefs: { weeklyHours: 39, schedule: { mon: { am: ['09:00', '13:00'], pm: ['14:00', '18:00'] } } }, theme: 'dark' };
    const exp = buildExport(cfg);
    expect(exp.prefs.schedule.mon.pm).toEqual(['14:00', '18:00']);
    expect(JSON.stringify(exp)).not.toContain('secret');
    expect(parseImport(exp).prefs.schedule.mon.am).toEqual(['09:00', '13:00']);
  });
```

> Adapter les noms d'import (`buildExport`, `parseImport`) à ceux réellement exportés par `config-io.js`.

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `npx vitest run test/config-io.test.js`
Expected: FAIL si `schedule` n'est pas propagé (selon l'implémentation actuelle de `buildExport`, qui copie peut-être déjà tout `prefs` — dans ce cas le test passe direct et sert de garde de non-régression ; le vérifier).

- [ ] **Step 3 : Propager `schedule` dans config-io (si nécessaire)**

Dans `src/core/config-io.js`, s'assurer que `buildExport`/`parseImport` recopient `prefs.schedule` (comme les autres champs de `prefs`). Si `prefs` est copié en bloc, aucun changement — laisser le test comme garde.

- [ ] **Step 4 : Grille planning dans `config.html`**

Remplacer la ligne (~111) :
```html
<div class="row"><label>Heures / semaine</label><div class="cell"><input type="number" id="p-weeklyHours" class="input" step="0.5" min="0" value="39" /></div></div>
```
par :
```html
<div class="row"><label>Planning type <span class="type">horaires matin / après-midi par jour</span></label>
  <div class="cell"><div id="p-schedule"></div><div class="sched-total">Total : <b id="p-weekly-total">—</b> / semaine</div></div>
</div>
```

- [ ] **Step 5 : Rendu + lecture/écriture dans `config.js`**

Ajouter le rendu de la grille (7 lignes × 4 `time`), le recalcul du total, et brancher save/load :

```js
import { WEEKDAY_KEYS, DEFAULT_SCHEDULE, weeklyTotalHours } from '../core/schedule.js';

const SCHED_ROWS = [['mon', 'Lun'], ['tue', 'Mar'], ['wed', 'Mer'], ['thu', 'Jeu'], ['fri', 'Ven'], ['sat', 'Sam'], ['sun', 'Dim']];

function renderSchedule(schedule) {
  const s = schedule && Object.keys(schedule).length ? schedule : DEFAULT_SCHEDULE;
  $('p-schedule').innerHTML = SCHED_ROWS.map(([k, lbl]) => {
    const d = s[k] || { am: null, pm: null };
    const t = (v) => v || '';
    return `<div class="sched-row"><span class="sched-day">${lbl}</span>` +
      `<input type="time" data-k="${k}" data-s="am" data-i="0" value="${t(d.am?.[0])}">` +
      `<input type="time" data-k="${k}" data-s="am" data-i="1" value="${t(d.am?.[1])}">` +
      `<span class="sched-sep">/</span>` +
      `<input type="time" data-k="${k}" data-s="pm" data-i="0" value="${t(d.pm?.[0])}">` +
      `<input type="time" data-k="${k}" data-s="pm" data-i="1" value="${t(d.pm?.[1])}"></div>`;
  }).join('');
  $('p-schedule').oninput = updateWeeklyTotal;
  updateWeeklyTotal();
}

function readSchedule() {
  const out = {};
  for (const [k] of SCHED_ROWS) out[k] = { am: null, pm: null };
  $('p-schedule').querySelectorAll('input[type=time]').forEach((el) => {
    const { k, s, i } = el.dataset;
    if (!out[k][s]) out[k][s] = [null, null];
    out[k][s][+i] = el.value || null;
  });
  // Normalise : un segment incomplet (une seule borne) devient null.
  for (const k of Object.keys(out)) for (const s of ['am', 'pm']) {
    const seg = out[k][s];
    out[k][s] = (seg && seg[0] && seg[1]) ? seg : null;
  }
  return out;
}

function updateWeeklyTotal() {
  const h = weeklyTotalHours(readSchedule());
  $('p-weekly-total').textContent = `${(Math.round(h * 10) / 10).toString().replace('.', ',')} h`;
}
```

- Dans **savePrefs** (~425-437) : retirer la lecture de `p-weeklyHours` ; à la place :
```js
  const schedule = readSchedule();
  const weeklyHours = weeklyTotalHours(schedule);
  if (!(weeklyHours > 0)) { status.textContent = 'Renseigne au moins un créneau dans le planning.'; status.className = 'status err'; return; }
```
puis dans l'objet `prefs` écrit : `weeklyHours, schedule,` (remplace l'ancien `weeklyHours` seul).

- Dans **loadPrefs** (~510-513) : remplacer `$('p-weeklyHours').value = …` par `renderSchedule(state.config.prefs?.schedule);`.

- [ ] **Step 6 : Style de la grille (`config.css`)**

Ajouter :
```css
.sched-row { display:flex; align-items:center; gap:6px; margin:4px 0; }
.sched-day { width:34px; color:var(--text-muted); font-size:13px; }
.sched-row input[type=time] { width:96px; }
.sched-sep { color:var(--text-muted); }
.sched-total { margin-top:8px; color:var(--text-muted); font-size:13px; }
```
(Adapter aux variables réelles de `config.css`.)

- [ ] **Step 7 : Vérif navigateur**

Servir la config via un serveur statique local (`python -m http.server`), ouvrir `config.html` dans Chrome réel, vérifier : grille pré-remplie au défaut, total « 39 h », modification d'un créneau met le total à jour, enregistrement/rechargement conserve les valeurs.

- [ ] **Step 8 : Commit**

```bash
git add src/config/config.html src/config/config.js src/config/config.css src/core/config-io.js test/config-io.test.js
git commit -m "feat(config): grille planning hebdo (remplace heures/semaine) + total derive"
```

---

## Task 4 : Stats popup — badge en jours + repère de cible par barre

**Files:**
- Modify: `src/popup/stats.js` (`fetchAggregate`, `renderObjective`, `renderDays`)
- Modify: `src/popup/popup.css` (structure `.day` + `.day-target`)

- [ ] **Step 1 : Passer le planning à `aggregate`**

Dans `fetchAggregate` (`src/popup/stats.js`), ajouter au bloc d'options d'`aggregate` :
```js
    schedule: S.config.prefs?.schedule || null,
```

- [ ] **Step 2 : Badge en jours (décimale 0 masquée)**

Dans `renderObjective`, remplacer la ligne du badge congés :
```js
  const conge = agg.congeMs > 0
    ? `<span class="conge-badge">🌴 ${fmt(agg.congeMs)}</span>` : '—';
```
par :
```js
  const fmtDays = (n) => {
    const r = Math.round(n * 10) / 10;
    return (Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',')) + ' j';
  };
  const conge = agg.congeDays > 0
    ? `<span class="conge-badge">🌴 ${fmtDays(agg.congeDays)}</span>` : '—';
```

- [ ] **Step 3 : `renderDays` — track à hauteur fixe + repère par barre**

Remplacer la fonction `renderDays` par :
```js
function renderDays(agg) {
  const fmt = (ms) => formatDuration(ms, { withSeconds: false });
  // Référence = plus grand entre (travail+congés) et la cible du jour, pour que le repère de cible tienne dans le cadre.
  const maxMs = Math.max(1, ...agg.perDay.map((d) => Math.max(d.workMs + d.congeMs, d.targetMs || 0)));
  const bars = agg.perDay.map((d) => {
    const total = d.workMs + d.congeMs;
    const h = Math.round((total / maxMs) * 100);
    let segs = '';
    if (total > 0) {
      const workPct = Math.round((d.workMs / total) * 100);
      if (d.congeMs > 0) segs += `<i class="seg conge" style="height:${100 - workPct}%"></i>`;
      if (d.workMs > 0) segs += `<i class="seg work" style="height:${workPct}%"></i>`;
    }
    const cls = total === 0 ? 'bar empty' : 'bar';
    const dur = total === 0 ? 'Aucune session'
      : (d.workMs && d.congeMs) ? `${fmt(d.workMs)} travaillé · ${fmt(d.congeMs)} congés`
        : d.congeMs ? `Congés · ${fmt(d.congeMs)}`
          : fmt(d.workMs);
    const top = d.congeMs > 0 ? '🌴' : (S.kind === 'month' ? '' : (d.workMs ? fmt(d.workMs) : '·'));
    const dn = S.kind === 'month' ? String(d.date.getDate()) : JOURS[d.date.getDay()];
    const mark = d.targetMs > 0
      ? `<div class="day-target" style="bottom:${Math.min(100, Math.round((d.targetMs / maxMs) * 100))}%"></div>` : '';
    return `<div class="day"><div class="dh">${top}</div>` +
      `<div class="track">${mark}<div class="${cls}" style="height:${Math.max(2, h)}%" title="${dur}">${segs}</div></div>` +
      `<div class="dn">${dn}</div></div>`;
  }).join('');
  $('stats-days').innerHTML = bars;
}
```

- [ ] **Step 4 : CSS — track + repère (`popup.css`)**

Remplacer le bloc `.days …` / `.day …` par une structure à track de hauteur fixe (corrige aussi l'écrasement des grandes barres — les libellés ne rognent plus le cadre) :
```css
.days { display:flex; align-items:flex-end; gap:6px; }
.day { flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:4px; }
.day .track { position:relative; width:100%; height:110px; display:flex; align-items:flex-end; justify-content:center; }
.day .bar { width:100%; max-width:34px; border-radius:4px 4px 0 0; min-height:2px; overflow:hidden; }
.day .bar .seg { display:block; width:100%; }
.day .bar .seg.work { background:var(--cyan); }
.day .bar .seg.conge { background:var(--orange); }
.day .bar.empty { background:var(--border); }
.day .day-target { position:absolute; left:0; right:0; border-top:1px dashed var(--border-soft); pointer-events:none; }
.day .dh { font-size:10px; color:var(--text-muted); }
.day .dn { font-size:11px; color:var(--text-muted); }
```
Supprimer l'ancienne règle `.target-line` (la ligne globale n'existe plus).

- [ ] **Step 5 : Vérif navigateur (mesures)**

Reprendre le harnais de mesure (type `test/…` hors extension) avec un `perDay` mock incluant `targetMs` : servir en HTTP local, ouvrir dans Chrome réel, mesurer via `javascript_tool` :
- une barre 8 h atteint bien ~la hauteur du repère de cible 8 h le jour à 8 h ;
- vendredi : repère à 7 h < repère lun–jeu ;
- samedi : aucun repère ;
- badge « 1 j » (pas « 1,0 j »), « 2,5 j », « 0,5 j ».
Attendu : hauteurs de barres désormais **linéaires** (plus d'écrasement à ~96 px), repères alignés.

- [ ] **Step 6 : Commit**

```bash
git add src/popup/stats.js src/popup/popup.css
git commit -m "feat(stats): badge conges en jours + repere de cible par barre (track a hauteur fixe)"
```

---

## Task 5 : Méthode AVEC + D² + bump 5.6.0

**Files:**
- Modify: `manifest.json`, `package.json`, `package-lock.json` → `5.6.0`
- Modify: `docs/VERSIONS.md`, `docs/AVANCEMENT.md`, `docs/EVENEMENTS.md`
- Modify: `docs/documentation-fonctionnelle.md` (§4 Stats + §Config), `docs/documentation-technique.md` (`core/schedule.js`, `aggregate`, `renderDays`, config)

- [ ] **Step 1 : Bump version (feature → mineure)**

`manifest.json` / `package.json` / `package-lock.json` : `5.5.5` → `5.6.0`.

- [ ] **Step 2 : VERSIONS.md** — section `[5.6.0]` : Ajouté (planning hebdo + objectif dérivé, badge congés en jours, repère de cible par barre) ; Modifié (objectif = somme planning ; grille config remplace « Heures/semaine »). Noter la rétro-compat (fallback sans planning) et que la **saisie demi-journées est en Phase 2**.

- [ ] **Step 3 : AVANCEMENT.md** — version `5.6.0`, date, ligne de tableau, section « Faites (v5.6.0) », compte de tests mis à jour (`npx vitest run` → nouveau total).

- [ ] **Step 4 : EVENEMENTS.md** — entrée seulement si un diagnostic non trivial est survenu (ex. calage du repère de cible / restructure du track). Sinon « n/a ».

- [ ] **Step 5 : D²** — `documentation-fonctionnelle.md` : §Config (planning type), §4.2 (badge en jours), §4.3/4.5 (objectif dérivé du planning, repère par barre). `documentation-technique.md` : nouveau `core/schedule.js`, `aggregate` (signature `schedule`, objectif, `perDay.targetMs`, `congeDays` fraction), `renderDays` (track + repère).

- [ ] **Step 6 : Vérification finale**

Run: `npx vitest run`
Expected: PASS (tous fichiers). Plus la vérif navigateur des Tasks 3 & 4.

- [ ] **Step 7 : Rapport de fin de release** (format imposé CLAUDE.md) puis commit `release: v5.6.0 — …` **sur demande de l'utilisateur uniquement**.

---

## Self-review (couverture spec)

- Planning `prefs.schedule` + défaut → Tasks 1, 3. ✅
- Objectif dérivé + fallback → Task 2 (+ non-régression). ✅
- Badge jours (fraction, `.0` masqué) → Tasks 2 (valeur) + 4 (format). ✅
- Config remplace « Heures/semaine » + total dérivé + export/import → Task 3. ✅
- Repère de cible par barre → Task 4. ✅
- Barres empilées (déjà en place v5.5.5) → inchangées, réutilisées. ✅
- **Hors périmètre Phase 1** (→ Phase 2) : `generateLeaveSpans`, `segmentSpan`, UI saisie A + « détailler », écriture multi-lignes Notion. Un plan dédié sera écrit après livraison de la Phase 1.
- Cohérence des noms : `scheduledMsForDate`, `hasAnySchedule`, `weeklyTotalHours`, `DEFAULT_SCHEDULE`, `WEEKDAY_KEYS`, `perDay[].targetMs`, `congeDays` (fractionnaire), `fmtDays`, `.track`, `.day-target` — identiques entre tasks. ✅
