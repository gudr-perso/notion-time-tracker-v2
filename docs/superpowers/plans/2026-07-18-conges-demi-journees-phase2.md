# Congés en demi-journées — Phase 2 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saisir les congés en **demi-journées** (matin / après-midi / journée) sur une **plage de dates**, avec récap live et « détailler les jours », et écrire **une ligne Notion par demi-journée** aux horaires du planning.

**Architecture :** La logique pure (génération des créneaux depuis le planning) va dans `core/schedule.js` (testée). L'UI vit dans le mode saisie manuelle du popup : quand « congés » est coché **et** qu'un planning existe, on remplace début/fin par un bloc plage + demi-journées (variante A), avec un lien dépliant une liste éditable jour par jour (variante C → `overrides`). L'enregistrement génère N créneaux et crée N pages Notion liées à la tâche Congés.

**Tech Stack :** JS vanilla + modules ES natifs, Vitest (core uniquement), zéro build. Réf. spec : `docs/superpowers/specs/2026-07-18-conges-demi-journees-design.md` (§5). Prérequis : Phase 1 livrée (v5.6.0 — `prefs.schedule`, `scheduledMsForDate`, `hasAnySchedule`).

---

## File Structure

- **Modify** `src/core/schedule.js` — ajoute `segmentSpan`, `generateLeaveSpans`, `leaveDays` (pur).
- **Modify** `test/schedule.test.js` — tests des trois fonctions.
- **Modify** `src/popup/popup.html` — bloc `#vac-range` (Du/Au + demi-journées + récap + détailler + liste).
- **Modify** `src/popup/popup.css` — styles du segmenté demi-journée, du récap, de la liste.
- **Modify** `src/popup/timer-manual.js` — bascule congés (montre le bloc, masque début/fin), segmentés, dates, récap live, écriture multi-lignes, liste « détailler ».
- **Modify** docs (VERSIONS/AVANCEMENT/EVENEMENTS + D²) + bump `5.7.0`.

Rappel comportement congés existant (`timer-manual.js`) : la coche `#manual-vacation` (`onVacationToggle`) sélectionne la tâche Congés (`prefs.vacationTaskId`) et préremplit le commentaire « En congés ». Début/fin = `#manual-start`/`#manual-end`. Sauvegarde = `saveManualFor(taskId, btn)` → `createPage` + `updatePage`. On **ne casse pas** le mode manuel normal (non-congé) ni le repli congés quand **aucun planning** n'est configuré (dans ce cas : ancien mode début/fin conservé).

---

## Task 1 : `core/schedule.js` — génération des créneaux de congé (pur)

**Files:**
- Modify: `src/core/schedule.js`
- Test: `test/schedule.test.js`

- [ ] **Step 1 : Écrire les tests (RED)** — ajouter dans `test/schedule.test.js` :

```js
import { scheduledMsForDate, hasAnySchedule, weeklyTotalHours, DEFAULT_SCHEDULE,
  segmentSpan, generateLeaveSpans, leaveDays } from '../src/core/schedule.js';

// MON = lundi 13 juil. 2026 ; TUE = 14 ; WED = 15 ; FRI = 17 ; SAT = 18 (déjà utilisés plus haut : réutiliser).
describe('segmentSpan', () => {
  it('matin par défaut = 09:00 → 13:00', () => {
    const s = segmentSpan(DEFAULT_SCHEDULE, new Date(2026, 6, 13), 'am');
    expect([s.start.getHours(), s.start.getMinutes()]).toEqual([9, 0]);
    expect([s.end.getHours(), s.end.getMinutes()]).toEqual([13, 0]);
    expect(s.start.getDate()).toBe(13);
  });
  it('après-midi lundi = 14:00 → 18:00', () => {
    const s = segmentSpan(DEFAULT_SCHEDULE, new Date(2026, 6, 13), 'pm');
    expect([s.start.getHours(), s.end.getHours()]).toEqual([14, 18]);
  });
  it('segment absent (samedi) = null', () => {
    expect(segmentSpan(DEFAULT_SCHEDULE, new Date(2026, 6, 18), 'am')).toBeNull();
  });
});

describe('generateLeaveSpans', () => {
  const opt = (o) => ({ fromDate: new Date(2026, 6, 13), toDate: new Date(2026, 6, 13), ...o });
  it('jour unique « journée » = 2 créneaux (matin + aprem)', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, opt({ fromHalf: 'journee' }));
    expect(sp).toHaveLength(2);
    expect([sp[0].start.getHours(), sp[1].start.getHours()]).toEqual([9, 14]);
  });
  it('jour unique « matin » = 1 créneau', () => {
    expect(generateLeaveSpans(DEFAULT_SCHEDULE, opt({ fromHalf: 'matin' }))).toHaveLength(1);
  });
  it('plage lun→mar « journée » = 4 créneaux', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, { fromDate: new Date(2026, 6, 13), toDate: new Date(2026, 6, 14), fromHalf: 'journee', toHalf: 'journee' });
    expect(sp).toHaveLength(4);
  });
  it('bornes : lun aprem → mar matin = 2 créneaux', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, { fromDate: new Date(2026, 6, 13), toDate: new Date(2026, 6, 14), fromHalf: 'aprem', toHalf: 'matin' });
    expect(sp).toHaveLength(2);
    expect(sp[0].start.getHours()).toBe(14); // lun aprem
    expect(sp[1].start.getHours()).toBe(9);  // mar matin
  });
  it('week-ends sautés : ven→lun « journée » = 4 créneaux (ven 2 + lun 2)', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, { fromDate: new Date(2026, 6, 17), toDate: new Date(2026, 6, 20), fromHalf: 'journee', toHalf: 'journee' });
    expect(sp).toHaveLength(4);
  });
  it('override « none » saute un jour', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, { fromDate: new Date(2026, 6, 13), toDate: new Date(2026, 6, 15), fromHalf: 'journee', toHalf: 'journee', overrides: { '2026-07-14': 'none' } });
    expect(sp).toHaveLength(4); // lun 2 + mer 2, mar sauté
  });
});

describe('leaveDays', () => {
  it('une journée pleine = 1,0 j', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, { fromDate: new Date(2026, 6, 13), toDate: new Date(2026, 6, 13), fromHalf: 'journee' });
    expect(leaveDays(DEFAULT_SCHEDULE, sp)).toBeCloseTo(1);
  });
  it('un matin = 0,5 j (4 h / 8 h)', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, { fromDate: new Date(2026, 6, 13), toDate: new Date(2026, 6, 13), fromHalf: 'matin' });
    expect(leaveDays(DEFAULT_SCHEDULE, sp)).toBeCloseTo(0.5);
  });
});
```

- [ ] **Step 2 : Lancer, voir l'échec** — `npx vitest run test/schedule.test.js` → FAIL (`segmentSpan`/`generateLeaveSpans`/`leaveDays` non exportés).

- [ ] **Step 3 : Implémenter dans `src/core/schedule.js`** — ajouter `import { startOfDay } from './time.js';` en tête, puis :

```js
const pad2 = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const atTime = (date, hhmm) => { const [h, m] = hhmm.split(':').map(Number); return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0); };

// seg ∈ {'am','pm'} → { start, end } (Date) sur `date`, ou null si le créneau n'existe pas ce jour-là.
export function segmentSpan(schedule, date, seg) {
  const day = schedule ? schedule[WEEKDAY_KEYS[date.getDay()]] : null;
  const rng = day && day[seg];
  if (!rng || !rng[0] || !rng[1]) return null;
  return { start: atTime(date, rng[0]), end: atTime(date, rng[1]) };
}

const HALF_SEGS = { matin: ['am'], aprem: ['pm'], journee: ['am', 'pm'], none: [] };

// Génère un créneau { start, end } par demi-journée retenue sur [fromDate..toDate].
// half ∈ {'matin','aprem','journee'}. overrides : { 'YYYY-MM-DD': 'matin'|'aprem'|'journee'|'none' }.
export function generateLeaveSpans(schedule, { fromDate, fromHalf = 'journee', toDate, toHalf = 'journee', overrides = {} }) {
  const spans = [];
  if (!fromDate) return spans;
  const from = startOfDay(fromDate);
  const to = startOfDay(toDate || fromDate);
  if (to.getTime() < from.getTime()) return spans;
  const single = from.getTime() === to.getTime();
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    const key = dateKey(cursor);
    let type;
    if (key in overrides) type = overrides[key];
    else if (single || cursor.getTime() === from.getTime()) type = fromHalf;
    else if (cursor.getTime() === to.getTime()) type = toHalf;
    else type = 'journee';
    for (const seg of (HALF_SEGS[type] || [])) {
      const sp = segmentSpan(schedule, cursor, seg);
      if (sp) spans.push(sp);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return spans;
}

// Somme des créneaux en JOURS (fraction d'heures réelles / cible du jour, plafonnée à 1/jour). Pour le récap.
export function leaveDays(schedule, spans) {
  const byDay = new Map();
  for (const s of spans) {
    const k = startOfDay(s.start).getTime();
    byDay.set(k, (byDay.get(k) || 0) + (s.end.getTime() - s.start.getTime()));
  }
  let days = 0;
  for (const [k, ms] of byDay) {
    const target = scheduledMsForDate(schedule, new Date(k));
    if (target > 0) days += Math.min(ms, target) / target;
  }
  return days;
}
```

- [ ] **Step 4 : Lancer** — `npx vitest run` → tout vert (schedule + non-régression).
- [ ] **Step 5 : Commit** — `git add src/core/schedule.js test/schedule.test.js && git commit -m "feat(schedule): generateLeaveSpans + segmentSpan + leaveDays (creneaux de conge)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"`

---

## Task 2 : Markup + styles du bloc congés (variante A)

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.css`

- [ ] **Step 1 : Lire** `src/popup/popup.html` autour des champs `#manual-start`/`#manual-end`/`#manual-comment` et de `#vacation-hint` pour placer le bloc au bon endroit (dans `#manual-fields`, juste après la coche congés / le hint).

- [ ] **Step 2 : Ajouter le bloc** `#vac-range` (masqué par défaut) après `#vacation-hint` :
```html
<div id="vac-range" hidden>
  <div class="vac-row"><span class="vac-lbl">Du</span>
    <input type="date" id="vac-from" class="input">
    <div class="seg-half" id="vac-from-half" role="group">
      <button type="button" data-h="matin">Matin</button><button type="button" data-h="aprem">Après-midi</button><button type="button" data-h="journee" class="on">Journée</button>
    </div>
  </div>
  <div class="vac-row"><span class="vac-lbl">Au</span>
    <input type="date" id="vac-to" class="input">
    <div class="seg-half" id="vac-to-half" role="group">
      <button type="button" data-h="matin">Matin</button><button type="button" data-h="aprem">Après-midi</button><button type="button" data-h="journee" class="on">Journée</button>
    </div>
  </div>
  <div class="vac-recap" id="vac-recap">—</div>
  <button type="button" class="vac-detail-toggle" id="vac-detail-toggle">Détailler les jours</button>
  <div id="vac-detail" hidden></div>
</div>
```

- [ ] **Step 3 : Styles** (`popup.css`, adapter aux variables existantes `--cyan`/`--orange`/`--border`/`--text-muted`) :
```css
#vac-range { margin-top:10px; display:flex; flex-direction:column; gap:10px; }
.vac-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.vac-lbl { width:28px; color:var(--text-muted); font-size:13px; }
.seg-half { display:inline-flex; border:1px solid var(--border-soft); border-radius:8px; overflow:hidden; }
.seg-half button { background:transparent; border:none; color:var(--text-muted); padding:7px 12px; cursor:pointer; font-size:13px; }
.seg-half button.on { background:var(--cyan); color:#031024; font-weight:600; }
.vac-recap { display:inline-flex; align-items:center; gap:8px; align-self:flex-start; background:rgba(243,97,0,.14); color:var(--orange); border-radius:8px; padding:6px 12px; font-size:13px; }
.vac-detail-toggle { align-self:flex-start; background:none; border:none; color:var(--cyan); cursor:pointer; font-size:13px; padding:0; }
#vac-detail { display:flex; flex-direction:column; gap:6px; }
.vac-day { display:flex; align-items:center; justify-content:space-between; border:1px solid var(--border); border-radius:8px; padding:6px 12px; font-size:13px; }
.vac-day.off { border-style:dashed; color:var(--text-muted); }
.vac-day select { background:var(--bg-deep); color:var(--text); border:1px solid var(--border-soft); border-radius:6px; padding:3px 8px; }
```

- [ ] **Step 4 : Vérif visuelle** (contrôleur, harnais navigateur) — rendu du bloc (segmentés, récap, lien) au thème sombre. Pas de test unitaire (markup).
- [ ] **Step 5 : Commit** — `git add src/popup/popup.html src/popup/popup.css && git commit -m "feat(conges): markup + styles du bloc demi-journees (variante A)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"`

---

## Task 3 : Bascule + récap live (variante A) dans `timer-manual.js`

**Files:** Modify `src/popup/timer-manual.js`

- [ ] **Step 1 : Lire** `timer-manual.js` (`onVacationToggle`, `toggleManual`, `prefillManual`, `resetManual`, `wireManual`) pour intégrer proprement.

- [ ] **Step 2 : État + helpers** — en tête du module :
```js
import { hasAnySchedule, generateLeaveSpans, leaveDays } from '../core/schedule.js';
const VAC = { from: null, to: null, fromHalf: 'journee', toHalf: 'journee', overrides: {} };
const fmtDays = (n) => { const r = Math.round(n * 10) / 10; return (Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',')) + ' j'; };
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const parseDate = (v) => (v ? new Date(v + 'T00:00:00') : null);
function vacSchedule() { return T.config.prefs?.schedule || null; }
function vacActive() { return $('manual-vacation').checked && hasAnySchedule(vacSchedule()); }
```

- [ ] **Step 3 : `onVacationToggle`** — quand coché **et** planning présent → afficher `#vac-range`, masquer début/fin ; sinon comportement actuel (repli début/fin). Remplacer la fonction par :
```js
function onVacationToggle(e) {
  if (e.target.checked) {
    if (!T.config.prefs?.vacationTaskId) { alert('Aucune tâche congés configurée.'); e.target.checked = false; return; }
    $('manual-comment').value = 'En congés';
    T.selectedTaskId = T.config.prefs.vacationTaskId;
    const sel = $('task-select');
    if ([...sel.options].some((o) => o.value === T.selectedTaskId)) sel.value = T.selectedTaskId;
    $('vacation-hint').hidden = false;
    const withSchedule = hasAnySchedule(vacSchedule());
    $('vac-range').hidden = !withSchedule;      // pas de planning → on garde début/fin
    setStartEndHidden(withSchedule);
    if (withSchedule) { VAC.from = VAC.to = todayStr(); $('vac-from').value = $('vac-to').value = VAC.from; VAC.overrides = {}; syncHalfButtons(); if (!$('vac-detail').hidden) renderVacDetail(); updateVacRecap(); }
  } else {
    $('vacation-hint').hidden = true;
    $('vac-range').hidden = true;
    setStartEndHidden(false);
  }
}
// Masque/rétablit les champs début/fin (et leurs labels) — cibler les conteneurs réels dans popup.html.
function setStartEndHidden(hidden) {
  for (const id of ['manual-start', 'manual-end']) { const el = $(id); const row = el.closest('.field') || el.parentElement; if (row) row.hidden = hidden; }
}
```
> Adapter `setStartEndHidden` aux conteneurs réels des champs début/fin dans `popup.html` (classe/wrapper). Vérifier au navigateur que les deux champs **et leurs libellés** disparaissent/réapparaissent.

- [ ] **Step 4 : Segmentés + dates + récap** :
```js
function syncHalfButtons() {
  for (const [grp, key] of [['vac-from-half', 'fromHalf'], ['vac-to-half', 'toHalf']]) {
    [...$(grp).children].forEach((b) => b.classList.toggle('on', b.dataset.h === VAC[key]));
  }
}
function currentSpans() {
  return generateLeaveSpans(vacSchedule(), { fromDate: parseDate(VAC.from), fromHalf: VAC.fromHalf, toDate: parseDate(VAC.to), toHalf: VAC.toHalf, overrides: VAC.overrides });
}
function updateVacRecap() {
  const spans = currentSpans();
  const days = leaveDays(vacSchedule(), spans);
  $('vac-recap').textContent = spans.length ? `🌴 ${fmtDays(days)} · ${spans.length} ligne${spans.length > 1 ? 's' : ''}` : 'Aucune demi-journée sélectionnée';
}
```
Câblage dans `wireManual` (à ajouter) :
```js
  $('vac-from').addEventListener('change', () => { VAC.from = $('vac-from').value || null; if (parseDate(VAC.to) < parseDate(VAC.from)) { VAC.to = VAC.from; $('vac-to').value = VAC.to; } VAC.overrides = {}; if (!$('vac-detail').hidden) renderVacDetail(); updateVacRecap(); });
  $('vac-to').addEventListener('change', () => { VAC.to = $('vac-to').value || null; VAC.overrides = {}; if (!$('vac-detail').hidden) renderVacDetail(); updateVacRecap(); });
  for (const [grp, key] of [['vac-from-half', 'fromHalf'], ['vac-to-half', 'toHalf']]) {
    $(grp).addEventListener('click', (e) => { const b = e.target.closest('button[data-h]'); if (!b) return; VAC[key] = b.dataset.h; syncHalfButtons(); updateVacRecap(); });
  }
```
- [ ] **Step 5 : Vérif navigateur** (contrôleur) : cocher congés (avec planning) masque début/fin et montre le bloc ; changer dates/segmentés met le récap à jour (ex. « 🌴 2,5 j · 4 lignes »).
- [ ] **Step 6 : Commit** — `feat(conges): bascule demi-journees + recap live`.

---

## Task 4 : Enregistrement multi-lignes

**Files:** Modify `src/popup/timer-manual.js`

- [ ] **Step 1 : Écriture** — nouvelle fonction, appelée par `onManualSave` quand `vacActive()` :
```js
async function saveVacation() {
  if (saving) return;
  const spans = currentSpans();
  if (!spans.length) { alert('Aucune demi-journée à poser (vérifie les dates et le planning).'); return; }
  const task = T.tasks.find((t) => t.id === T.config.prefs.vacationTaskId);
  if (!task) { alert('Tâche congés introuvable.'); return; }
  const comment = $('manual-comment').value.trim();
  saving = true; setSaving(true, $('btn-primary'));
  let done = 0;
  try {
    for (const sp of spans) {
      const pageId = await createPage(T.token, T.config.timeDb.id, sessionPropertiesForCreate(task, sp.start, T.timeFields));
      await updatePage(T.token, pageId, sessionPropertiesForUpdate({ endTime: sp.end, comment, pauseMin: 0 }, T.timeFields));
      done += 1;
    }
    resetManual();
    await helpers.reloadRecent();
    showToast(`✅ ${done} ligne${done > 1 ? 's' : ''} de congés créée${done > 1 ? 's' : ''}`);
  } catch (e) {
    alert(`Congés : ${done}/${spans.length} créée(s), échec ensuite : ${e.message}`);
  } finally {
    saving = false; setSaving(false, $('btn-primary'));
  }
}
```
- [ ] **Step 2 : Router** — dans `onManualSave`, en tête : `if (vacActive()) { await saveVacation(); return; }` (le reste = save normal inchangé).
- [ ] **Step 3 : `resetManual`** — décocher congés remet début/fin visibles : après `$('manual-vacation').checked = false;` ajouter `$('vac-range').hidden = true; setStartEndHidden(false);`.
- [ ] **Step 4 : Vérif** — `npx vitest run` (aucun core touché, vert). Vérif navigateur : impossible ici de créer dans Notion — vérifier au minimum que `currentSpans()` produit les bons `{start,end}` (log) pour un cas plage.
- [ ] **Step 5 : Commit** — `feat(conges): ecriture 1 ligne Notion par demi-journee (echec partiel gere)`.

---

## Task 5 : « Détailler les jours » (variante C → overrides)

**Files:** Modify `src/popup/timer-manual.js`

- [ ] **Step 1 : Liste éditable** :
```js
const HALF_LABELS = [['journee', 'Journée'], ['matin', 'Matin'], ['aprem', 'Après-midi'], ['none', '—']];
const WD = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
function defaultTypeFor(dateStr, key) {
  if (key in VAC.overrides) return VAC.overrides[key];
  if (VAC.from === VAC.to) return VAC.fromHalf;
  if (dateStr === VAC.from) return VAC.fromHalf;
  if (dateStr === VAC.to) return VAC.toHalf;
  return 'journee';
}
function renderVacDetail() {
  const from = parseDate(VAC.from), to = parseDate(VAC.to);
  if (!from || !to || to < from) { $('vac-detail').innerHTML = ''; return; }
  const rows = []; const cur = new Date(from);
  while (cur <= to) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    const worked = scheduledMsForDate(vacSchedule(), cur) > 0;
    const label = `${WD[cur.getDay()]} ${cur.getDate()}`;
    if (!worked) rows.push(`<div class="vac-day off"><span>${label}</span><span>non travaillé</span></div>`);
    else {
      const t = defaultTypeFor(key, key);
      const opts = HALF_LABELS.map(([v, l]) => `<option value="${v}"${v === t ? ' selected' : ''}>${l}</option>`).join('');
      rows.push(`<div class="vac-day"><span>${label}</span><select data-key="${key}">${opts}</select></div>`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  $('vac-detail').innerHTML = rows.join('');
}
```
(Ajouter `scheduledMsForDate` à l'import de `../core/schedule.js`.)

- [ ] **Step 2 : Câblage** (`wireManual`) :
```js
  $('vac-detail-toggle').addEventListener('click', () => { const d = $('vac-detail'); d.hidden = !d.hidden; $('vac-detail-toggle').textContent = d.hidden ? 'Détailler les jours' : 'Masquer le détail'; if (!d.hidden) renderVacDetail(); });
  $('vac-detail').addEventListener('change', (e) => { const sel = e.target.closest('select[data-key]'); if (!sel) return; VAC.overrides[sel.dataset.key] = sel.value; updateVacRecap(); });
```
- [ ] **Step 3 : Vérif navigateur** — déplier la liste sur une plage, changer un jour en « Matin » / « — », voir le récap se recalculer ; jours non travaillés grisés.
- [ ] **Step 4 : Commit** — `feat(conges): detailler les jours (override par jour)`.

---

## Task 6 : AVEC + D² + bump 5.7.0

- [ ] **Step 1 : Bump** `manifest.json`/`package.json`/`package-lock.json` → `5.7.0`.
- [ ] **Step 2 : VERSIONS.md** — section `[5.7.0]` : Ajouté (saisie congés en demi-journées + plage + « détailler » ; écriture 1 ligne/demi-journée).
- [ ] **Step 3 : AVANCEMENT.md** — version, tableau, « Faites (v5.7.0) » (clôt la Phase 2 congés), tests.
- [ ] **Step 4 : EVENEMENTS.md** — entrée si diagnostic non trivial, sinon « n/a ».
- [ ] **Step 5 : D²** — `documentation-fonctionnelle.md` §3.8 (mode congés : saisie demi-journées + plage + détailler) ; `documentation-technique.md` (`schedule.js` : `segmentSpan`/`generateLeaveSpans`/`leaveDays` ; `timer-manual.js` : bascule + `saveVacation`).
- [ ] **Step 6 : Vérif finale** — `npx vitest run` vert + vérifs navigateur des Tasks 2–5.
- [ ] **Step 7 : Rapport de fin de release** (format imposé) + commit `release: v5.7.0 — …`.

---

## Self-review (couverture spec §5)

- Génération demi-journées (single/plage/bornes/week-ends/overrides) → Task 1 (`generateLeaveSpans`), testé. ✅
- 1 ligne Notion par demi-journée aux horaires du planning → Task 1 (`segmentSpan`) + Task 4 (écriture). ✅
- UI variante A (Du/Au + demi-journées + récap) → Tasks 2, 3. ✅
- « Détailler les jours » (variante C → overrides) → Task 5. ✅
- Récap en jours (fraction) → Task 1 (`leaveDays`) + Task 3. ✅
- Rétro-compat : sans planning, ancien mode début/fin conservé → Task 3 (`vacActive`/repli). ✅
- Écriture : échec partiel signalé → Task 4. ✅
- Noms cohérents entre tasks : `VAC`, `vacActive`, `vacSchedule`, `currentSpans`, `updateVacRecap`, `renderVacDetail`, `saveVacation`, `#vac-range`/`#vac-from`/`#vac-to`/`#vac-recap`/`#vac-detail`, `generateLeaveSpans`/`segmentSpan`/`leaveDays`. ✅
- **Ambiguïté connue** (à lever en Task 2/3) : conteneurs réels des champs début/fin dans `popup.html` pour `setStartEndHidden` — l'implémenteur lit le HTML et cible le bon wrapper.
