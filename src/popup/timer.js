// src/popup/timer.js — logique de l'onglet Timer : état partagé T + helpers, chargement des tâches.
import { queryPage, queryAll, getPage } from '../core/notion-api.js';
import { taskFromPage } from '../core/mapping.js';
import { getTaskHistory } from '../core/storage.js';
import { wireActions } from './timer-actions.js';
import { wireManual } from './timer-manual.js';
import { wireRecent } from './timer-recent.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const T = {
  config: null, token: '', tasksFields: null, timeFields: null,
  tasks: [], allLoaded: false, history: [], selectedTaskId: null, session: null,
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

function onSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  (async () => {
    if (q && !T.allLoaded) await loadAllTasks();
    const list = q
      ? T.tasks.filter((t) => (t.name + ' ' + t.project).toLowerCase().includes(q))
      : T.tasks;
    renderTaskOptions(list);
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

  const helpers = {
    renderTaskOptions, currentTask, buildTasksFilter, buildTasksSorts,
    reloadRecent: async () => {}, onManualSave: async () => {},
  };
  wireActions(T, helpers);
  wireManual(T, helpers);
  wireRecent(T, helpers);

  await loadLightTasks();
  await helpers.reloadRecent();
}
