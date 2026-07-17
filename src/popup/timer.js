// src/popup/timer.js — logique de l'onglet Timer : état partagé T + helpers, chargement des tâches.
import { queryPage, queryAll, getPage } from '../core/notion-api.js';
import { buildStatusFilter } from '../core/tasks-query.js';
import { taskFromPage } from '../core/mapping.js';
import { getTaskHistory } from '../core/storage.js';
import { wireActions } from './timer-actions.js';
import { wireManual } from './timer-manual.js';
import { wireRecent } from './timer-recent.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const T = {
  config: null, token: '', tasksFields: null, timeFields: null,
  // allLoaded : la liste complète est publiée dans tasks. allLoading : elle est en cours de
  // chargement (promesse partagée par les appels concurrents, null sinon).
  tasks: [], allLoaded: false, allLoading: null, history: [], selectedTaskId: null, session: null,
};

// Renseigné par initTimer, au niveau module pour que les chargements puissent rejouer les rendus
// dépendant de T.tasks (cf. publishTasks) et pas seulement initTimer.
let helpers = null;

function buildTasksFilter() {
  return buildStatusFilter(T.tasksFields.statusFilter);
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

// Complète une liste avec les tâches épinglées (favoris + congés) qui en sont absentes, et la
// retourne sans jamais toucher à T.tasks : publier reste l'affaire de l'appelant, en un seul geste.
// Écrire ici serait un piège : `T.tasks.push(x)` capture le tableau AVANT d'évaluer `x`, donc si
// `x` contient un await et que T.tasks est réaffecté entre-temps, le push va au tableau orphelin.
async function withPinnedTasks(tasks) {
  const pinned = new Set([
    ...(T.config.prefs?.favorites || []).map((f) => f.taskId),
    T.config.prefs?.vacationTaskId,
  ].filter(Boolean));
  const have = new Set(tasks.map((t) => t.id));
  const extra = [];
  for (const id of pinned) {
    if (!have.has(id)) {
      try { extra.push(taskFromPage(await getPage(T.token, id), T.tasksFields)); } catch { /* ignore */ }
    }
  }
  return extra.length ? [...tasks, ...extra] : tasks;
}

// Point de passage UNIQUE pour écrire T.tasks : publie la liste et rejoue tout ce qui en dépend.
// Dans ce popup, tout ce qui lit T.tasks doit être rejoué à chaque publication, pas seulement câblé
// au démarrage (leçon des favoris affichant « Favori », cf. docs/EVENEMENTS.md 2026-07-17) — et la
// liste peut être publiée deux fois : chargement léger puis liste complète.
// Tout est synchrone ici : un await rouvrirait la fenêtre de course décrite dans loadAllTasks.
function publishTasks(tasks) {
  T.tasks = tasks;
  applyFilter();
  helpers.renderFavorites();
}

// Chargement léger (20 tâches) affiché à l'ouverture, le temps que la liste complète arrive.
async function loadLightTasks() {
  const pages = await queryPage(T.token, T.config.tasksDb.id, {
    filter: buildTasksFilter(), sorts: buildTasksSorts(), pageSize: 20,
  });
  const tasks = await withPinnedTasks(sortTasks(pages.map((p) => taskFromPage(p, T.tasksFields))));
  // La liste complète est arrivée — ou est en route — pendant notre requête : elle prime. Sinon
  // nos 20 tâches l'écrasent alors que allLoaded reste vrai → liste tronquée pour de bon.
  // Le test doit rester ICI, juste avant la publication : à l'entrée de la fonction allLoaded est
  // toujours faux, et chaque await rouvre la fenêtre de course.
  if (T.allLoaded || T.allLoading) return;
  publishTasks(tasks);
}

// Chargement complet, déclenché par la recherche. Les appels concurrents (une frappe = un appel)
// partagent la même promesse : une seule pagination de la base, et T.allLoading signale aux
// autres chargements qu'une liste complète est déjà en route.
async function loadAllTasks() {
  if (T.allLoaded) return;
  if (!T.allLoading) {
    T.allLoading = (async () => {
      const pages = await queryAll(T.token, T.config.tasksDb.id, {
        filter: buildTasksFilter(), sorts: buildTasksSorts(),
      });
      const tasks = await withPinnedTasks(sortTasks(pages.map((p) => taskFromPage(p, T.tasksFields))));
      publishTasks(tasks); // publication atomique : publishTasks est synchrone, donc aucun await
      T.allLoaded = true;  // ici → allLoaded ne peut pas mentir sur le contenu de T.tasks.
    })().finally(() => { T.allLoading = null; }); // échec → on pourra retenter à la frappe suivante
  }
  await T.allLoading;
}

function renderTaskOptions(tasks) {
  const sel = $('task-select');
  sel.innerHTML = ['<option value="">— Sélectionne une tâche —</option>',
    ...tasks.map((t) => {
      const proj = t.project ? ` [${t.project}]` : '';
      return `<option value="${esc(t.id)}">${esc(t.name + proj)}</option>`;
    })].join('');
  if (T.selectedTaskId) sel.value = T.selectedTaskId;
}

function currentTask() {
  return T.tasks.find((t) => t.id === T.selectedTaskId) || null;
}

function updateOpenButtons() {
  const t = currentTask();
  $('btn-external').disabled = !(t && t.externalUrl);
  $('btn-notion').disabled = !t;
}

// Rend la liste en relisant le champ de recherche AU MOMENT du rendu, jamais une valeur capturée
// avant un await : deux frappes rapides lancent deux rendus, et rien ne garantit qu'ils se
// terminent dans l'ordre. En relisant le champ, le dernier rendu affiche toujours la saisie
// réellement à l'écran, quel que soit l'ordre d'arrivée.
function applyFilter() {
  const q = $('task-search').value.trim().toLowerCase();
  renderTaskOptions(q
    ? T.tasks.filter((t) => (t.name + ' ' + t.project).toLowerCase().includes(q))
    : T.tasks);
}

function onSearch() {
  (async () => {
    if ($('task-search').value.trim() && !T.allLoaded) await loadAllTasks();
    applyFilter();
  })();
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

  helpers = {
    renderTaskOptions, currentTask, buildTasksFilter, buildTasksSorts,
    reloadRecent: async () => {}, onManualSave: async () => {}, renderFavorites: () => {},
  };
  wireActions(T, helpers);
  wireManual(T, helpers);
  wireRecent(T, helpers);

  // Le re-rendu des favoris qui suivait cet appel est désormais fait par publishTasks, à chaque
  // publication de T.tasks : le rendu de wireManual tombe sur une liste vide, et loadLightTasks
  // peut s'effacer devant la liste complète sans jamais publier. Un seul rendu ici ne couvrait
  // que le premier cas.
  await loadLightTasks();
  await helpers.reloadRecent();
}
