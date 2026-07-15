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
