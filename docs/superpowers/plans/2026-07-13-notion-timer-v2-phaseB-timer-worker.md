# Notion Time Tracker v2 — Phase B : onglet Timer + service worker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Prérequis : Phase A terminée** (`core/`, `theme.js`, config fonctionnelle).

**Goal:** Livrer l'onglet Timer complet (repos/sélection, démarrage, en cours, pause, arrêt, arrêter-à, saisie manuelle, congés, favoris, sessions récentes) + le service worker (badge + notifications via `chrome.alarms`), fidèle aux captures `doc/screens/`.

**Architecture:** `popup.js` = bootstrap (redirection config, thème, routing d'onglets). `timer.js` = toute la logique de l'onglet Timer, s'appuyant sur `core/`. `service-worker.js` = badge + alarmes. Aucun ID/nom Notion en dur.

**Tech Stack:** JS ES modules, `chrome.storage.local`, `chrome.runtime` messaging, `chrome.alarms`, `chrome.notifications`, `chrome.action` (badge).

Référence design : `docs/superpowers/specs/2026-07-13-notion-timer-v2-design.md` (§5, §6). Captures : `doc/screens/ecran-2a…2d.png`.

---

## Structure des fichiers (Phase B)

- Create: `src/popup/popup.html`, `src/popup/popup.css`, `src/popup/popup.js`, `src/popup/timer.js`
- Create: `src/background/service-worker.js`
- (Modifie éventuellement le stub `popup.html`/`service-worker.js` créé en Phase A.)

Rappel des exports `core/` disponibles (Phase A) :
- `notion-api.js` : `queryAll`, `queryPage`, `getPage`, `createPage`, `updatePage`
- `mapping.js` : `taskFromPage`, `sessionPropertiesForCreate`, `sessionPropertiesForUpdate`, `sessionFromPage`, `titleWithProject`, `extractProject`
- `time.js` : `formatDuration`, `roundToNearestFiveMinutes`, `toNotionDate`, `workedMs`, `startOfDay`, `formatClock`, `formatStartedLabel`, `formatDateTimeLocalValue`
- `storage.js` : `getConfig`, `getCurrentSession`, `setCurrentSession`, `clearCurrentSession`, `getTaskHistory`, `pushTaskHistory`

---

## Task 1: Popup — coquille HTML + CSS + bootstrap

**Files:**
- Create: `src/popup/popup.html`, `src/popup/popup.css`, `src/popup/popup.js`

- [ ] **Step 1: Écrire `src/popup/popup.html`**

```html
<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="popup.css" />
  <title>Time Tracker</title>
</head>
<body>
  <div class="app">
    <header class="app-header">
      <button id="btn-config" class="icon-btn" title="Configuration">⚙️</button>
      <div class="title">⏱️ Time Tracker</div>
      <button id="theme-toggle" class="icon-btn" title="Thème">🌙</button>
    </header>

    <nav class="tabs">
      <button class="tab active" data-tab="timer">Timer</button>
      <button class="tab" data-tab="stats">Stats</button>
    </nav>

    <main>
      <!-- Onglet Timer -->
      <section id="tab-timer" class="tab-panel">
        <!-- État repos -->
        <div id="idle-state">
          <label class="manual-toggle card-lite">
            <input type="checkbox" id="manual-mode" />
            <span><strong>Saisie manuelle</strong> (oubli de timer)</span>
          </label>

          <!-- Champs saisie manuelle -->
          <div id="manual-fields" class="card" hidden>
            <div class="field"><label>DÉBUT</label><input type="datetime-local" id="manual-start" class="input" /></div>
            <div class="field"><label>FIN</label><input type="datetime-local" id="manual-end" class="input" /></div>
            <div class="field"><label>COMMENTAIRE (OPTIONNEL)</label><textarea id="manual-comment" class="input" placeholder="Décris ton travail…"></textarea></div>
            <label class="check-row"><input type="checkbox" id="manual-vacation" /> Marquer comme congés</label>
            <p class="hint" id="vacation-hint">La tâche congés sera utilisée et le commentaire sera « En congés ».</p>
          </div>

          <!-- Favoris (mode manuel) -->
          <div id="favorites-box" class="card fav-box" hidden>
            <div class="fav-title">⭐ ENREGISTREMENT RAPIDE</div>
            <div id="fav-buttons" class="fav-buttons"></div>
            <p class="hint">Un clic sur un favori enregistre directement la session.</p>
          </div>

          <div class="field">
            <label>Rechercher une tâche</label>
            <input type="search" id="task-search" class="input" placeholder="Tape pour filtrer…" />
          </div>
          <div class="field">
            <label id="tasks-label">Tâche</label>
            <select id="task-select" size="6" class="input task-list"></select>
          </div>

          <div class="btn-row">
            <button id="btn-external" class="btn btn-grey" disabled>🔗 CLICKUP</button>
            <button id="btn-notion" class="btn btn-grey" disabled>🔗 Notion</button>
            <button id="btn-primary" class="btn btn-green">▶️ DÉMARRER</button>
          </div>

          <div id="recent-sessions" class="recent"></div>
        </div>

        <!-- État en cours -->
        <div id="running-state" hidden>
          <div class="timer-card">
            <div class="timer-label">TEMPS ÉCOULÉ</div>
            <div id="timer-display" class="timer-display">00:00:00</div>
            <div id="timer-started" class="timer-started"></div>
            <div id="pause-display" class="pause-display" hidden></div>
          </div>
          <div class="card current-task">
            <div id="current-task-name" class="current-task-name"></div>
            <button id="btn-open-current" class="icon-link" title="Ouvrir dans Notion">🔗</button>
            <div class="muted">Session en cours</div>
          </div>
          <div class="field">
            <label>Commentaire de session</label>
            <textarea id="session-comment" class="input" placeholder="Décris ce que tu as fait…"></textarea>
          </div>
          <div class="btn-row">
            <button id="btn-pause" class="btn btn-outline">⏸ PAUSE</button>
            <button id="btn-stop" class="btn btn-orange">⏹ ARRÊTER</button>
            <button id="btn-stop-at" class="btn btn-outline">🕐 ARRÊTER À…</button>
          </div>
        </div>
      </section>

      <!-- Onglet Stats (placeholder) -->
      <section id="tab-stats" class="tab-panel" hidden>
        <div class="placeholder">📊 Statistiques — <em>Bientôt</em></div>
      </section>
    </main>

    <!-- Modale Arrêter à… -->
    <div id="stop-at-modal" class="modal-overlay" hidden>
      <div class="modal">
        <div class="modal-title">⏱️ Arrêter la session à</div>
        <div class="modal-row"><label>Heure</label>
          <input type="number" id="stop-hour" min="0" max="23" class="input num" />
          <span class="colon">:</span>
          <input type="number" id="stop-min" min="0" max="59" class="input num" />
        </div>
        <div class="modal-row"><label>Date</label><input type="date" id="stop-date" class="input" /></div>
        <div id="stop-duration" class="stop-duration"></div>
        <div class="modal-actions">
          <button id="stop-cancel" class="btn btn-outline">✕ Annuler</button>
          <button id="stop-confirm" class="btn btn-primary">✓ Arrêter à cette heure</button>
        </div>
      </div>
    </div>
  </div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Écrire `src/popup/popup.css`**

Reprend les mêmes variables de thème que `config.css` (dupliquer le bloc `:root`/`[data-theme="light"]`). Ajouter les composants popup ci-dessous (largeur ~440 px). Affiner pour coller aux captures `ecran-2a…2d`.

```css
/* Coller ici le même bloc de variables de thème que config.css (dark + light) */
* { box-sizing:border-box; }
body { margin:0; width:440px; font-family:"Inter","Segoe UI",system-ui,sans-serif;
  color:var(--text); background:var(--bg-deep); }
.app-header { display:flex; align-items:center; gap:8px; padding:14px 16px;
  background:linear-gradient(180deg,rgba(10,24,112,.5),transparent); }
.app-header .title { flex:1; text-align:center; font-weight:800; font-size:18px; }
.icon-btn { background:rgba(255,255,255,.06); border:1px solid var(--border-soft);
  color:var(--text); border-radius:999px; width:34px; height:34px; cursor:pointer; }
.tabs { display:flex; border-bottom:1px solid var(--border); }
.tab { flex:1; background:transparent; border:none; color:var(--text-muted);
  padding:12px; font-weight:700; cursor:pointer; border-bottom:2px solid transparent; }
.tab.active { color:var(--cyan); border-bottom-color:var(--cyan); }
main { padding:16px; }
.card, .card-lite { border-radius:14px; border:1px solid var(--border); padding:14px; margin-bottom:14px; }
.card { background:linear-gradient(180deg,rgba(10,24,112,.35),rgba(5,12,63,.35)); }
.card-lite { background:linear-gradient(180deg,rgba(220,235,255,.06),transparent); display:flex; align-items:center; gap:10px; }
.field { margin-bottom:12px; display:flex; flex-direction:column; gap:6px; }
.field > label { font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--text-muted); font-weight:700; }
.input { background:var(--bg-deep); color:var(--text); border:1px solid var(--border-soft);
  border-radius:10px; padding:10px 12px; font-size:14px; outline:none; width:100%; }
.input:focus { border-color:var(--cyan); box-shadow:0 0 0 3px rgba(42,166,232,.18); }
textarea.input { resize:vertical; min-height:56px; }
.task-list { height:auto; }
.btn { border:none; border-radius:10px; padding:12px 14px; font-weight:800; font-size:13px; cursor:pointer; letter-spacing:.4px; }
.btn-row { display:flex; gap:8px; margin-bottom:14px; }
.btn-green { flex:1; background:linear-gradient(180deg,#22c55e,#16a34a); color:#fff; }
.btn-orange { flex:1; background:linear-gradient(180deg,var(--orange),#c94f00); color:#fff; }
.btn-outline { flex:1; background:transparent; border:1px solid var(--border-soft); color:var(--text); }
.btn-grey { background:rgba(255,255,255,.08); border:1px solid var(--border-soft); color:var(--text); }
.btn-primary { background:linear-gradient(180deg,var(--cyan),var(--cyan-deep)); color:#fff; }
.btn:disabled { opacity:.45; cursor:not-allowed; }
.fav-box { border-color:var(--orange); }
.fav-title { color:var(--orange); font-weight:800; font-size:12px; margin-bottom:10px; }
.fav-buttons { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
.fav-buttons .btn { background:linear-gradient(180deg,var(--orange),#c94f00); color:#fff; }
.hint { color:var(--text-muted); font-size:12px; margin:8px 0 0; }
.timer-card { background:linear-gradient(180deg,#eaf4ff,#dbeafe); color:#0b1533; border-radius:16px; padding:20px; text-align:center; margin-bottom:14px; }
.timer-label { font-size:12px; letter-spacing:.1em; color:var(--cyan-deep); font-weight:800; }
.timer-display { font-size:46px; font-weight:800; letter-spacing:2px; }
.timer-started { font-size:12px; color:#334; }
.pause-display { margin-top:6px; color:var(--orange); font-weight:700; }
.current-task { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.current-task-name { flex:1; font-weight:700; }
.icon-link, .icon-link:visited { background:transparent; border:none; cursor:pointer; font-size:16px; color:var(--cyan); }
.muted { color:var(--text-muted); font-size:12px; width:100%; }
.recent { margin-top:8px; }
.recent .day-head { display:flex; justify-content:space-between; background:rgba(10,24,112,.4);
  border:1px solid var(--border); border-radius:10px; padding:10px 12px; font-weight:700; margin:10px 0 6px; }
.recent .day-total { color:var(--cyan); }
.recent .sess { display:flex; justify-content:space-between; align-items:center; gap:8px;
  padding:8px 12px; border:1px solid var(--border); border-radius:10px; margin-bottom:6px; }
.recent .sess .dur { color:var(--cyan); font-weight:700; }
.placeholder { text-align:center; color:var(--text-muted); padding:40px 10px; }
.modal-overlay { position:fixed; inset:0; background:rgba(3,8,38,.7); display:flex; align-items:center; justify-content:center; }
.modal { background:var(--bg-elev); border:1px solid var(--border-soft); border-radius:16px; padding:20px; width:360px; }
.modal-title { text-align:center; font-weight:800; color:var(--cyan); margin-bottom:16px; }
.modal-row { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
.modal-row > label { width:60px; color:var(--text-muted); }
.input.num { width:64px; text-align:center; font-size:18px; font-weight:800; }
.colon { font-size:20px; font-weight:800; }
.stop-duration { background:rgba(255,255,255,.05); border:1px solid var(--border); border-radius:10px; padding:10px 12px; font-size:13px; margin-bottom:14px; }
.stop-duration.err { color:var(--red); }
.modal-actions { display:flex; gap:10px; }
.modal-actions .btn { flex:1; }
```

- [ ] **Step 3: Écrire `src/popup/popup.js` (bootstrap : redirection config, thème, onglets)**

```js
// src/popup/popup.js
import { getConfig } from '../core/storage.js';
import { applyStoredTheme, toggleTheme } from '../theme.js';
import { initTimer } from './timer.js';

const $ = (id) => document.getElementById(id);

async function main() {
  const config = await getConfig();
  // Redirection auto si config incomplète
  if (!config || !config.notionToken || !config.timeDb?.id || !config.tasksDb?.id) {
    window.location = '../config/config.html';
    return;
  }

  await applyStoredTheme();
  $('theme-toggle').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '🌙' : '☀️';
  $('theme-toggle').addEventListener('click', async () => {
    const t = await toggleTheme();
    $('theme-toggle').textContent = t === 'dark' ? '🌙' : '☀️';
  });
  $('btn-config').addEventListener('click', () => { window.location = '../config/config.html'; });

  // Onglets
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      $('tab-timer').hidden = tab.dataset.tab !== 'timer';
      $('tab-stats').hidden = tab.dataset.tab !== 'stats';
    });
  });

  await initTimer(config);
}

main();
```

- [ ] **Step 4: Vérification manuelle**

Recharger l'extension. Ouvrir le popup : header (⚙️ / titre / thème), onglets Timer|Stats. Cliquer Stats → « Bientôt ». Cliquer ⚙️ → va à la config. Bascule thème OK. (Le contenu Timer arrive aux tâches suivantes.)

- [ ] **Step 5: Commit**

```bash
git add src/popup/popup.html src/popup/popup.css src/popup/popup.js
git commit -m "feat(popup): shell, theme, tab routing, config redirect"
```

---

## Task 2: Timer — chargement des tâches, sélection, recherche, ouverture

**Files:**
- Create: `src/popup/timer.js` (module principal de l'onglet ; complété aux tasks 3-6)

- [ ] **Step 1: Écrire la base de `src/popup/timer.js`**

```js
// src/popup/timer.js — logique de l'onglet Timer.
import { queryPage, queryAll, getPage } from '../core/notion-api.js';
import { taskFromPage } from '../core/mapping.js';
import { getTaskHistory } from '../core/storage.js';

const $ = (id) => document.getElementById(id);

const T = {
  config: null, token: '', tasksFields: null, timeFields: null,
  tasks: [],            // Task[] courants (affichés)
  allLoaded: false,     // true après un chargement complet (recherche)
  history: [],
  selectedTaskId: null,
};

function buildTasksFilter() {
  const sf = T.tasksFields.statusFilter;
  if (!sf || !sf.property || !sf.excludeValue) return undefined;
  const key = sf.type === 'select' ? 'select' : 'status';
  return { property: sf.property, [key]: { does_not_equal: sf.excludeValue } };
}
function buildTasksSorts() {
  const p = T.tasksFields.sortProperty;
  return p ? [{ property: p, direction: 'descending' }] : undefined;
}

function sortTasks(tasks) {
  const order = new Map(T.history.map((id, i) => [id, i]));
  const inHist = tasks.filter((t) => order.has(t.id)).sort((a, b) => order.get(a.id) - order.get(b.id));
  const rest = tasks.filter((t) => !order.has(t.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const seen = new Set();
  return [...inHist, ...rest].filter((t) => (seen.has(t.id) ? false : seen.add(t.id)));
}

async function loadLightTasks() {
  const pages = await queryPage(T.token, T.config.tasksDb.id, {
    filter: buildTasksFilter(), sorts: buildTasksSorts(), pageSize: 20,
  });
  T.tasks = sortTasks(pages.map((p) => taskFromPage(p, T.tasksFields)));
  await ensurePinnedTasks();
  renderTaskOptions(T.tasks);
}

async function loadAllTasks() {
  if (T.allLoaded) return;
  const pages = await queryAll(T.token, T.config.tasksDb.id, {
    filter: buildTasksFilter(), sorts: buildTasksSorts(),
  });
  T.tasks = sortTasks(pages.map((p) => taskFromPage(p, T.tasksFields)));
  await ensurePinnedTasks();
  T.allLoaded = true;
}

// Charge individuellement les tâches épinglées (favoris + congés) absentes de la liste courante.
async function ensurePinnedTasks() {
  const pinned = new Set([
    ...(T.config.prefs?.favorites || []).map((f) => f.taskId),
    T.config.prefs?.vacationTaskId,
  ].filter(Boolean));
  const have = new Set(T.tasks.map((t) => t.id));
  for (const id of pinned) {
    if (!have.has(id)) {
      try { T.tasks.push(taskFromPage(await getPage(T.token, id), T.tasksFields)); } catch { /* ignore */ }
    }
  }
}

function renderTaskOptions(tasks) {
  const sel = $('task-select');
  sel.innerHTML = ['<option value="">— Sélectionne une tâche —</option>',
    ...tasks.map((t) => {
      const proj = t.project ? ` [${t.project}]` : '';
      return `<option value="${t.id}">${t.name}${proj}</option>`;
    })].join('');
}

function currentTask() {
  return T.tasks.find((t) => t.id === T.selectedTaskId) || null;
}

function updateOpenButtons() {
  const t = currentTask();
  $('btn-external').disabled = !(t && t.externalUrl);
  $('btn-notion').disabled = !t;
}

function onSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  const run = async () => {
    if (q && !T.allLoaded) await loadAllTasks();
    const list = q
      ? T.tasks.filter((t) => (t.name + ' ' + t.project).toLowerCase().includes(q))
      : T.tasks;
    renderTaskOptions(list);
  };
  run();
}

export async function initTimer(config) {
  T.config = config;
  T.token = config.notionToken;
  T.tasksFields = config.tasksDb.fields;
  T.timeFields = config.timeDb.fields;
  T.history = await getTaskHistory();
  $('tasks-label').textContent = `Tâche ${config.tasksDb.name || ''}`.trim();
  $('btn-external').textContent = `🔗 ${config.prefs?.externalButtonLabel || 'CLICKUP'}`;

  $('task-select').addEventListener('change', (e) => { T.selectedTaskId = e.target.value || null; updateOpenButtons(); });
  $('task-search').addEventListener('input', onSearch);
  $('btn-external').addEventListener('click', () => { const t = currentTask(); if (t?.externalUrl) chrome.tabs.create({ url: t.externalUrl }); });
  $('btn-notion').addEventListener('click', () => { const t = currentTask(); if (t) chrome.tabs.create({ url: t.notionUrl }); });

  await loadLightTasks();
  // les tasks 3-6 branchent : running restore, start/stop, manuel, favoris, récentes
  await import('./timer-actions.js').then((m) => m.wireActions(T, { renderTaskOptions, currentTask, buildTasksFilter, buildTasksSorts }));
}
```

> Note d'architecture : pour garder les fichiers focalisés, la logique d'actions (start/stop/manuel/récentes) est dans un second module `timer-actions.js` (Tasks 3-6), branché via `wireActions(T, helpers)`. `T` est l'état partagé.

- [ ] **Step 2: Vérification manuelle**

Recharger, ouvrir le popup. Attendu : label « Tâche {nom base} », 20 tâches chargées et triées (historique d'abord), la sélection active/désactive 🔗 CLICKUP (selon URL) et 🔗 Notion. Taper dans la recherche → chargement complet + filtrage. Les boutons 🔗 ouvrent l'URL externe / Notion dans un onglet.

> À ce stade `timer-actions.js` n'existe pas encore : commenter temporairement la ligne `await import('./timer-actions.js')…` pour tester, ou créer un stub `export function wireActions(){}`.

- [ ] **Step 3: Commit**

```bash
git add src/popup/timer.js
git commit -m "feat(timer): task loading, sort by history, search, open buttons"
```

---

## Task 3: Timer — démarrage, affichage en cours, pause, arrêt

**Files:**
- Create: `src/popup/timer-actions.js`

Types réutilisés : `createPage`, `updatePage` (notion-api) ; `sessionPropertiesForCreate/Update` (mapping) ; `workedMs`, `formatDuration`, `formatStartedLabel`, `formatClock`, `toNotionDate` (time) ; `getCurrentSession`, `setCurrentSession`, `clearCurrentSession`, `pushTaskHistory` (storage).

- [ ] **Step 1: Écrire `src/popup/timer-actions.js` (démarrage / en cours / pause / arrêt)**

```js
// src/popup/timer-actions.js — actions de session, branché depuis timer.js
import { createPage, updatePage } from '../core/notion-api.js';
import { sessionPropertiesForCreate, sessionPropertiesForUpdate } from '../core/mapping.js';
import { workedMs, formatDuration, formatStartedLabel, formatClock } from '../core/time.js';
import { getCurrentSession, setCurrentSession, clearCurrentSession, pushTaskHistory } from '../core/storage.js';

const $ = (id) => document.getElementById(id);
const MAX_PAUSE_MS = 60 * 60_000;
let tickInterval = null;
let CTX = null; // { T, helpers }

function notifyWorker(action) { chrome.runtime.sendMessage({ action }).catch(() => {}); }

function showRunning(show) {
  $('idle-state').hidden = show;
  $('running-state').hidden = !show;
}

function renderTick() {
  const s = CTX.T.session;
  if (!s) return;
  const pauseNow = s.isPaused && s.pauseStartTime ? Date.now() - new Date(s.pauseStartTime).getTime() : 0;
  const elapsed = workedMs(s.startTime, Date.now(), s.totalPauseDuration + pauseNow);
  $('timer-display').textContent = formatDuration(elapsed);
  $('timer-started').textContent = `Démarré le ${formatStartedLabel(s.startTime)} à ${formatClock(s.startTime)}`;
  if (s.isPaused) {
    $('pause-display').hidden = false;
    $('pause-display').textContent = `⏸️ En pause : ${formatDuration(pauseNow)}`;
  } else {
    $('pause-display').hidden = true;
  }
}

function startTick() { stopTick(); renderTick(); tickInterval = setInterval(renderTick, 1000); }
function stopTick() { if (tickInterval) clearInterval(tickInterval); tickInterval = null; }

async function enterRunning(session, task) {
  CTX.T.session = session;
  $('current-task-name').textContent = task ? task.name + (task.project ? ` [${task.project}]` : '') : session.taskName;
  $('current-task-name').dataset.notionUrl = task ? task.notionUrl : '';
  $('session-comment').value = '';
  $('btn-pause').textContent = session.isPaused ? '▶️ REPRENDRE' : '⏸ PAUSE';
  showRunning(true);
  startTick();
}

async function onStart() {
  const task = CTX.helpers.currentTask();
  if (!task) { alert('Sélectionne une tâche.'); return; }
  const startTime = new Date();
  const props = sessionPropertiesForCreate(task, startTime, CTX.T.timeFields);
  const pageId = await createPage(CTX.T.token, CTX.T.config.timeDb.id, props);
  const session = {
    pageId, taskId: task.id, taskName: task.name,
    startTime: startTime.toISOString(), isPaused: false, pauseStartTime: null, totalPauseDuration: 0,
  };
  await setCurrentSession(session);
  await pushTaskHistory(task.id);
  notifyWorker('sessionStarted');
  await enterRunning(session, task);
}

async function onTogglePause() {
  const s = CTX.T.session;
  if (!s.isPaused) {
    s.isPaused = true; s.pauseStartTime = new Date().toISOString();
    $('btn-pause').textContent = '▶️ REPRENDRE';
    notifyWorker('sessionPaused');
  } else {
    const paused = Date.now() - new Date(s.pauseStartTime).getTime();
    if (s.totalPauseDuration + paused > MAX_PAUSE_MS) { alert('Limite de 1 h de pause atteinte.'); return; }
    s.totalPauseDuration += paused; s.isPaused = false; s.pauseStartTime = null;
    $('btn-pause').textContent = '⏸ PAUSE';
    notifyWorker('sessionResumed');
  }
  await setCurrentSession(s);
  renderTick();
}

async function finishSession(endTime) {
  const s = CTX.T.session;
  const comment = $('session-comment').value.trim();
  if (CTX.T.config.prefs?.requireComment && !comment) { alert('Commentaire obligatoire.'); $('session-comment').focus(); return false; }
  let total = s.totalPauseDuration;
  if (s.isPaused && s.pauseStartTime) total += Date.now() - new Date(s.pauseStartTime).getTime();
  const pauseMin = Math.round(total / 60_000);
  await updatePage(CTX.T.token, s.pageId, sessionPropertiesForUpdate({ endTime, comment, pauseMin }, CTX.T.timeFields));
  await clearCurrentSession();
  CTX.T.session = null;
  stopTick();
  notifyWorker('sessionStopped');
  showRunning(false);
  await CTX.helpers.reloadRecent();
  return true;
}

async function onStop() { await finishSession(new Date()); }

export function wireActions(T, helpers) {
  CTX = { T, helpers };
  $('btn-primary').addEventListener('click', () => {
    if ($('manual-mode').checked) helpers.onManualSave();
    else onStart();
  });
  $('btn-pause').addEventListener('click', onTogglePause);
  $('btn-stop').addEventListener('click', onStop);
  $('btn-open-current').addEventListener('click', () => {
    const url = $('current-task-name').dataset.notionUrl;
    if (url) chrome.tabs.create({ url });
  });
  // Restauration d'une session en cours
  getCurrentSession().then((s) => { if (s) { const task = T.tasks.find((t) => t.id === s.taskId); enterRunning(s, task); } });
  // exposer pour les autres modules
  helpers.enterRunning = enterRunning;
  helpers.finishSession = finishSession;
}
```

> `helpers.reloadRecent`, `helpers.onManualSave` sont fournis par Tasks 5-6. Pour compiler cette task isolément, fournir des stubs no-op dans `timer.js` puis les remplacer.

- [ ] **Step 2: Brancher les helpers manquants (stubs temporaires dans `timer.js`)**

Dans `timer.js`, avant l'`import('./timer-actions.js')`, compléter l'objet `helpers` passé à `wireActions` :
```js
const helpers = {
  renderTaskOptions, currentTask, buildTasksFilter, buildTasksSorts,
  reloadRecent: async () => {},      // remplacé Task 6
  onManualSave: async () => {},      // remplacé Task 5
};
await import('./timer-actions.js').then((m) => m.wireActions(T, helpers));
```

- [ ] **Step 3: Vérification manuelle**

Sélectionner une tâche → **DÉMARRER** : une page apparaît dans Notion (nom + heure de début à la **bonne heure locale**, pas +2 h). Le popup passe en état en cours, chrono qui tourne. **PAUSE**/**REPRENDRE** cumule ; au-delà d'1 h → blocage. **ARRÊTER** : la page Notion reçoit la date de fin (heure locale correcte) + pause en minutes ; retour à l'état repos. Rouvrir le popup pendant que ça tourne → l'état en cours est **restauré**.

- [ ] **Step 4: Commit**

```bash
git add src/popup/timer-actions.js src/popup/timer.js
git commit -m "feat(timer): start/running/pause/stop with correct local timezone"
```

---

## Task 4: Timer — modale « Arrêter à… »

**Files:**
- Modify: `src/popup/timer-actions.js` (ajout de la modale)

- [ ] **Step 1: Ajouter la logique de modale dans `timer-actions.js`**

```js
// À ajouter dans timer-actions.js (importer workedMs, formatDuration déjà présents)
import { formatDateTimeLocalValue } from '../core/time.js'; // ajouter à l'import time existant

function stopAtChosenDate() {
  const h = Number($('stop-hour').value), m = Number($('stop-min').value);
  const [y, mo, d] = $('stop-date').value.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

function refreshStopDuration() {
  const s = CTX.T.session;
  const end = stopAtChosenDate();
  const box = $('stop-duration');
  let total = s.totalPauseDuration;
  if (s.isPaused && s.pauseStartTime) total += Date.now() - new Date(s.pauseStartTime).getTime();
  const dur = end.getTime() - new Date(s.startTime).getTime() - total;
  if (dur < 0) {
    box.className = 'stop-duration err';
    box.innerHTML = '⚠️ Durée réelle : <strong>L\'heure d\'arrêt est avant le début.</strong>';
    $('stop-confirm').disabled = true;
  } else {
    box.className = 'stop-duration';
    box.innerHTML = `⏱️ Durée réelle : <strong>${formatDuration(dur)}</strong>`;
    $('stop-confirm').disabled = false;
  }
}

function openStopAt() {
  const now = new Date();
  $('stop-hour').value = now.getHours();
  $('stop-min').value = now.getMinutes();
  $('stop-date').value = formatDateTimeLocalValue(now).slice(0, 10);
  $('stop-at-modal').hidden = false;
  refreshStopDuration();
}
function closeStopAt() { $('stop-at-modal').hidden = true; }
```

Et dans `wireActions`, ajouter les branchements :
```js
$('btn-stop-at').addEventListener('click', openStopAt);
$('stop-cancel').addEventListener('click', closeStopAt);
$('stop-at-modal').addEventListener('click', (e) => { if (e.target.id === 'stop-at-modal') closeStopAt(); });
['stop-hour', 'stop-min', 'stop-date'].forEach((id) => $(id).addEventListener('input', refreshStopDuration));
$('stop-confirm').addEventListener('click', async () => { if (await finishSession(stopAtChosenDate())) closeStopAt(); });
```

- [ ] **Step 2: Vérification manuelle**

En session : **ARRÊTER À…** ouvre la modale (heure/min/date pré-remplis à maintenant). Changer l'heure → « Durée réelle » se recalcule. Mettre une heure < début → message rouge + bouton désactivé. Confirmer une heure passée → la session Notion reçoit cette **heure de fin locale** exacte. Clic hors modale = fermeture.

- [ ] **Step 3: Commit**

```bash
git add src/popup/timer-actions.js
git commit -m "feat(timer): stop-at modal with live duration and validation"
```

---

## Task 5: Timer — saisie manuelle, congés, favoris (enregistrement rapide)

**Files:**
- Create: `src/popup/timer-manual.js`
- Modify: `src/popup/timer.js` (câblage), `src/popup/timer-actions.js` (`onManualSave`)

- [ ] **Step 1: Écrire `src/popup/timer-manual.js`**

```js
// src/popup/timer-manual.js — mode saisie manuelle, congés, favoris.
import { createPage, updatePage } from '../core/notion-api.js';
import { sessionPropertiesForCreate, sessionPropertiesForUpdate } from '../core/mapping.js';
import { roundToNearestFiveMinutes, formatDateTimeLocalValue } from '../core/time.js';

const $ = (id) => document.getElementById(id);
let T = null, helpers = null;

function prefillManual() {
  const now = roundToNearestFiveMinutes(new Date());
  const start = new Date(now.getTime() - 60 * 60_000);
  $('manual-start').value = formatDateTimeLocalValue(start);
  $('manual-end').value = formatDateTimeLocalValue(now);
}

function toggleManual(on) {
  $('manual-fields').hidden = !on;
  $('favorites-box').hidden = !(on && (T.config.prefs?.favorites || []).length);
  $('btn-primary').textContent = on ? '💾 ENREGISTRER' : '▶️ DÉMARRER';
  $('btn-primary').className = 'btn ' + (on ? 'btn-primary' : 'btn-green');
  if (on) prefillManual();
}

function onVacationToggle(e) {
  if (e.target.checked) {
    if (!T.config.prefs?.vacationTaskId) { alert('Aucune tâche congés configurée.'); e.target.checked = false; return; }
    $('manual-comment').value = 'En congés';
    // sélectionne la tâche congés dans la liste
    T.selectedTaskId = T.config.prefs.vacationTaskId;
    const sel = $('task-select'); if ([...sel.options].some((o) => o.value === T.selectedTaskId)) sel.value = T.selectedTaskId;
  }
}

function renderFavoriteButtons() {
  const favs = T.config.prefs?.favorites || [];
  $('fav-buttons').innerHTML = '';
  favs.forEach((fav) => {
    const task = T.tasks.find((t) => t.id === fav.taskId);
    const label = (fav.customLabel || task?.name || 'Favori').slice(0, 20);
    const btn = document.createElement('button');
    btn.className = 'btn'; btn.textContent = label;
    btn.addEventListener('click', () => saveManualFor(fav.taskId));
    $('fav-buttons').appendChild(btn);
  });
}

async function saveManualFor(taskId) {
  const task = T.tasks.find((t) => t.id === taskId);
  if (!task) { alert('Tâche du favori introuvable.'); return; }
  const start = new Date($('manual-start').value);
  const end = new Date($('manual-end').value);
  if (!$('manual-start').value || !$('manual-end').value || end <= start) { alert('Début/fin invalides.'); return; }
  const comment = $('manual-comment').value.trim();
  const pageId = await createPage(T.token, T.config.timeDb.id, sessionPropertiesForCreate(task, start, T.timeFields));
  await updatePage(T.token, pageId, sessionPropertiesForUpdate({ endTime: end, comment, pauseMin: 0 }, T.timeFields));
  resetManual();
  await helpers.reloadRecent();
}

async function onManualSave() {
  const task = helpers.currentTask();
  if (!task) { alert('Sélectionne une tâche.'); return; }
  await saveManualFor(task.id);
}

function resetManual() {
  $('manual-comment').value = '';
  $('manual-vacation').checked = false;
  prefillManual();
}

export function wireManual(sharedT, sharedHelpers) {
  T = sharedT; helpers = sharedHelpers;
  helpers.onManualSave = onManualSave;
  $('manual-mode').addEventListener('change', (e) => toggleManual(e.target.checked));
  $('manual-vacation').addEventListener('change', onVacationToggle);
  $('vacation-hint').hidden = !T.config.prefs?.vacationTaskId;
  renderFavoriteButtons();
}
```

- [ ] **Step 2: Câbler dans `timer.js`**

Après le chargement des tâches et avant/avec `wireActions`, importer et brancher :
```js
await import('./timer-manual.js').then((m) => m.wireManual(T, helpers));
```
(placer cet import après celui de `timer-actions.js` pour que `helpers.onManualSave` soit bien remplacé.)

- [ ] **Step 3: Vérification manuelle**

Cocher **Saisie manuelle** : champs Début/Fin pré-remplis (−1 h → maintenant, arrondis 5 min), bouton devient **💾 ENREGISTRER**, la carte **⭐ ENREGISTREMENT RAPIDE** apparaît si des favoris existent. Enregistrer une plage sur une tâche sélectionnée → page créée+complétée dans Notion (heures locales correctes), sans chrono. Cliquer un favori → enregistre directement sur la tâche du favori. Cocher **congés** (si tâche congés configurée) → commentaire « En congés » + tâche congés sélectionnée.

- [ ] **Step 4: Commit**

```bash
git add src/popup/timer-manual.js src/popup/timer.js
git commit -m "feat(timer): manual entry, vacation mode, quick-save favorites"
```

---

## Task 6: Timer — sessions récentes

**Files:**
- Create: `src/popup/timer-recent.js`
- Modify: `src/popup/timer.js`

Types réutilisés : `queryAll` (notion-api) ; `sessionFromPage` (mapping) ; `startOfDay`, `formatClock`, `formatDuration`, `toNotionDate`, `workedMs` (time).

- [ ] **Step 1: Écrire `src/popup/timer-recent.js`**

```js
// src/popup/timer-recent.js — bloc « Sessions récentes » (Aujourd'hui / Hier).
import { queryAll } from '../core/notion-api.js';
import { sessionFromPage } from '../core/mapping.js';
import { startOfDay, formatClock, formatDuration, toNotionDate, workedMs } from '../core/time.js';

const $ = (id) => document.getElementById(id);
let T = null;

function sessionDurationMs(s) {
  if (!s.startTime || !s.endTime) return 0;
  return workedMs(s.startTime, s.endTime, (s.pauseMin || 0) * 60_000);
}

export async function reloadRecent() {
  const startYesterday = new Date(startOfDay(new Date()).getTime() - 24 * 3600_000);
  const filter = { property: T.timeFields.startDate, date: { on_or_after: toNotionDate(startYesterday) } };
  const sorts = [{ property: T.timeFields.startDate, direction: 'descending' }];
  const pages = await queryAll(T.token, T.config.timeDb.id, { filter, sorts });
  const sessions = pages.map((p) => sessionFromPage(p, T.timeFields)).filter((s) => s.startTime && s.endTime);

  const today0 = startOfDay(new Date()).getTime();
  const groups = { today: [], yesterday: [] };
  for (const s of sessions) {
    const t = new Date(s.startTime).getTime();
    if (t >= today0) groups.today.push(s); else groups.yesterday.push(s);
  }

  const box = $('recent-sessions');
  box.innerHTML = '';
  const render = (label, list) => {
    if (!list.length) return '';
    const total = list.reduce((a, s) => a + sessionDurationMs(s), 0);
    const head = `<div class="day-head"><span>📅 ${label}</span><span class="day-total">${formatDuration(total)}</span></div>`;
    const rows = list.map((s) => {
      const dur = formatDuration(sessionDurationMs(s));
      const range = `${formatClock(s.startTime)} → ${formatClock(s.endTime)}`;
      const name = s.name.length > 70 ? s.name.slice(0, 70) + '…' : s.name;
      return `<div class="sess"><div><div>${name}</div><div class="muted">${range}</div></div><span class="dur">${dur}</span></div>`;
    }).join('');
    return head + rows;
  };
  box.innerHTML = render("Aujourd'hui", groups.today) + render('Hier', groups.yesterday);
}

export function wireRecent(sharedT, helpers) {
  T = sharedT;
  helpers.reloadRecent = reloadRecent;
}
```

- [ ] **Step 2: Câbler dans `timer.js` et appeler au démarrage**

```js
await import('./timer-recent.js').then((m) => { m.wireRecent(T, helpers); return m.reloadRecent(); });
```
(à placer après le câblage de `helpers`, pour que `helpers.reloadRecent` pointe la vraie fonction, puis charger une première fois.)

- [ ] **Step 3: Vérification manuelle**

En bas de l'onglet Timer : bloc « Sessions récentes » groupé **Aujourd'hui** (avec total) puis **Hier**. Les plages `HH:MM → HH:MM` s'affichent en **heure locale** correcte. Après un ARRÊTER, la liste se rafraîchit.

- [ ] **Step 4: Commit**

```bash
git add src/popup/timer-recent.js src/popup/timer.js
git commit -m "feat(timer): recent sessions grouped by day with totals"
```

---

## Task 7: Service worker — badge + notifications (`chrome.alarms`)

**Files:**
- Create: `src/background/service-worker.js` (remplace le stub Phase A)

Types réutilisés : `queryAll` (notion-api) ; `sessionFromPage` (mapping) ; `getConfig`, `getCurrentSession` (storage) ; `startOfDay`, `toNotionDate`, `workedMs` (time).

- [ ] **Step 1: Écrire `src/background/service-worker.js`**

```js
// src/background/service-worker.js — badge + notifications via chrome.alarms (MV3-safe).
import { getConfig, getCurrentSession } from '../core/storage.js';
import { queryAll } from '../core/notion-api.js';
import { sessionFromPage } from '../core/mapping.js';
import { startOfDay, toNotionDate, workedMs } from '../core/time.js';

const LONG_TIMER_H = 3, END_H = 17, END_M = 45, DAILY_GOAL_H = 8;
const flags = { lastLongTimerNotif: 0, endOfDayNotified: false, dailyGoalNotified: false, dayStamp: '' };

function setBadge(state) {
  const map = { running: { text: '🟢', color: '#22c55e' }, paused: { text: '⏸️', color: '#f59e0b' }, idle: { text: '', color: '#000000' } };
  const b = map[state] || map.idle;
  chrome.action.setBadgeText({ text: b.text });
  if (b.text) chrome.action.setBadgeBackgroundColor({ color: b.color });
}

async function refreshBadgeFromStorage() {
  const s = await getCurrentSession();
  setBadge(!s ? 'idle' : (s.isPaused ? 'paused' : 'running'));
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'sessionStarted' || msg.action === 'sessionResumed') setBadge('running');
  else if (msg.action === 'sessionPaused') setBadge('paused');
  else if (msg.action === 'sessionStopped') setBadge('idle');
});

chrome.runtime.onStartup.addListener(refreshBadgeFromStorage);
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('tick', { periodInMinutes: 1 });
  refreshBadgeFromStorage();
});

function resetDailyFlagsIfNeeded() {
  const stamp = new Date().toDateString();
  if (flags.dayStamp !== stamp) { flags.dayStamp = stamp; flags.endOfDayNotified = false; flags.dailyGoalNotified = false; }
}

function notify(id, title, message, buttons) {
  chrome.notifications.create(id, {
    type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title, message, ...(buttons ? { buttons } : {}),
  });
}

async function getTodayTotalMs() {
  const config = await getConfig();
  if (!config?.timeDb?.id) return 0;
  const f = config.timeDb.fields;
  const filter = { property: f.startDate, date: { on_or_after: toNotionDate(startOfDay(new Date())) } };
  const pages = await queryAll(config.notionToken, config.timeDb.id, { filter });
  return pages.map((p) => sessionFromPage(p, f))
    .filter((s) => s.startTime && s.endTime)
    .reduce((a, s) => a + workedMs(s.startTime, s.endTime, (s.pauseMin || 0) * 60_000), 0);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'tick') return;
  resetDailyFlagsIfNeeded();
  const s = await getCurrentSession();
  setBadge(!s ? 'idle' : (s.isPaused ? 'paused' : 'running'));

  const now = new Date();
  if (s && !s.isPaused) {
    const elapsedH = workedMs(s.startTime, Date.now(), s.totalPauseDuration) / 3600_000;
    // ⏰ Timer long ≥ 3 h, rappel toutes les 3 h
    if (elapsedH >= LONG_TIMER_H && Date.now() - flags.lastLongTimerNotif >= LONG_TIMER_H * 3600_000) {
      flags.lastLongTimerNotif = Date.now();
      notify('long-timer', '⏰ Timer en cours depuis longtemps', `Vous travaillez sur « ${s.taskName} » depuis ${Math.floor(elapsedH)} h.`);
    }
    // 🏁 Fin de journée à 17 h 45
    if (!flags.endOfDayNotified && now.getHours() === END_H && now.getMinutes() >= END_M) {
      flags.endOfDayNotified = true;
      notify('end-of-day', '🏁 Fin de journée — Timer actif', `Timer sur « ${s.taskName} ». N'oubliez pas d'arrêter !`,
        [{ title: 'Arrêter maintenant' }, { title: 'Continuer' }]);
    }
  }
  // 🎯 Objectif quotidien ≥ 8 h
  if (!flags.dailyGoalNotified) {
    const totalH = (await getTodayTotalMs()) / 3600_000;
    if (totalH >= DAILY_GOAL_H) {
      flags.dailyGoalNotified = true;
      notify('daily-goal', '🎯 Objectif quotidien atteint !', `Vous avez travaillé ${totalH.toFixed(1)} h aujourd'hui. Bravo ! 🎉`);
    }
  }
});

chrome.notifications.onButtonClicked.addListener((id, idx) => {
  if (id === 'end-of-day' && idx === 0) chrome.action.openPopup?.();
  chrome.notifications.clear(id);
});
chrome.notifications.onClicked.addListener((id) => { chrome.action.openPopup?.(); chrome.notifications.clear(id); });
```

- [ ] **Step 2: Vérification manuelle**

Recharger l'extension. Démarrer un timer → badge **🟢** ; Pause → **⏸️** ; Arrêter → badge vide. Fermer/rouvrir le navigateur pendant une session → badge restauré. (Pour les notifications : abaisser temporairement les seuils — ex. `LONG_TIMER_H = 0.02` — pour déclencher en ~1 min, vérifier l'apparition, puis rétablir.)

- [ ] **Step 3: Commit**

```bash
git add src/background/service-worker.js
git commit -m "feat(background): badge + alarm-driven notifications, no hardcoded ids"
```

---

## Self-review (Phase B)

**Couverture spec :**
- §5.1 idle (recherche, liste triée, boutons ouverture, label dynamique) → Task 2 ✓
- §5.2 saisie manuelle + congés + favoris quick-save → Task 5 ✓
- §5.3 running (chrono, démarré-le, pause) → Task 3 ✓
- §5.4 démarrer/pause(max 1h)/arrêter(requireComment) → Task 3 ✓
- §5.5 modale arrêter-à (durée live, refus fin<début) → Task 4 ✓
- §5.6 invariants (page créée au démarrage, LRU 20, IDs normalisés, tâches épinglées via getPage) → Tasks 2-3 ✓
- §6 service worker (badge, 3 notifs via alarms, total via timeDb mappé) → Task 7 ✓
- §9.1 fuseau horaire → toutes les écritures passent par `sessionPropertiesForCreate/Update` (donc `toNotionDate`) ✓

**Placeholders :** stubs `helpers.reloadRecent`/`onManualSave` explicitement remplacés (Tasks 5-6). Chaque étape de code montre le code réel.

**Cohérence des types/signatures :**
- État partagé `T` : `{ config, token, tasksFields, timeFields, tasks, allLoaded, history, selectedTaskId, session }`. `session` est ajouté par `timer-actions.js`.
- `helpers` : `{ renderTaskOptions, currentTask, buildTasksFilter, buildTasksSorts, reloadRecent, onManualSave, enterRunning, finishSession }`.
- `notifyWorker` envoie exactement les actions écoutées par le worker : `sessionStarted/Paused/Resumed/Stopped`. ✓
- `queryAll(token, dbId, {filter,sorts})`, `createPage(token, dbId, props)`, `updatePage(token, pageId, props)` : signatures identiques à Phase A. ✓

**Point d'attention :** `chrome.action.openPopup()` a un support navigateur variable (déjà noté en v1) — dégradation silencieuse via `?.`.
