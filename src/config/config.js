// src/config/config.js
import { testToken, searchDatabases, getDatabaseSchema, queryAll, addDatabaseProperties } from '../core/notion-api.js';
import { getConfig, saveConfig } from '../core/storage.js';
import { planInjection, FIELD_SPECS_TIME, FIELD_SPECS_TASKS } from '../core/schema-injection.js';
import { taskFromPage } from '../core/mapping.js';
import { applyStoredTheme, toggleTheme } from '../theme.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
const AUTO_TASKS = {
  title: ['nom', 'name', 'titre'],
  project: ['projet_texte', 'projet', 'project'],
  externalId: ['#taskid', 'taskid'],
  externalUrl: ['taskurl', 'url'],
  projectsRel: ['🎯 projets', 'projets'],
  sortProperty: ['dernière modification', 'derniere modification', 'last edited time'],
};

function fill(select, props, allowedTypes, current) {
  const opts = ['<option value="">— non mappé —</option>'];
  for (const p of props) {
    if (allowedTypes && !allowedTypes.includes(p.type)) continue;
    opts.push(`<option value="${esc(p.name)}" data-type="${esc(p.type)}"${p.name === current ? ' selected' : ''}>${esc(p.name)} (${esc(p.type)})</option>`);
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
      ...dbs.map((d) => `<option value="${esc(d.id)}" data-name="${esc(d.name)}">${esc(d.name)}</option>`)];
    $('time-db').innerHTML = opts.join('');
    $('tasks-db').innerHTML = opts.join('');
    $('projets-db').innerHTML = ['<option value="">— aucune —</option>', ...opts.slice(1)].join('');
    if (state.config?.timeDb) $('time-db').value = state.config.timeDb.id;
    if (state.config?.tasksDb) $('tasks-db').value = state.config.tasksDb.id;
    if (state.config?.projetsDb) $('projets-db').value = state.config.projetsDb.id;
    status.textContent = `✓ ${dbs.length} bases`; status.className = 'status ok';
    await loadSchemas();
  } catch (e) { status.textContent = `Erreur : ${e.message}`; status.className = 'status err'; }
}

async function loadSchemas() {
  const timeId = $('time-db').value, tasksId = $('tasks-db').value;
  if (!timeId || !tasksId) return;
  state.schemaTime = await getDatabaseSchema(state.token, timeId);
  state.schemaTasks = await getDatabaseSchema(state.token, tasksId);
  remapTime();
  remapTasks();
  await loadTasksList(tasksId, state.config?.tasksDb?.fields || {});
}

function remapTime() {
  const tf = state.config?.timeDb?.fields || {};
  for (const key of Object.keys(TIME_TYPES)) {
    const sel = $('m-' + key);
    fill(sel, state.schemaTime, TIME_TYPES[key], tf[key] || '');
    autoSelect(sel, state.schemaTime, AUTO_TIME[key] || [], tf[key] || '');
  }
}

function remapTasks() {
  const kf = state.config?.tasksDb?.fields || {};
  for (const key of Object.keys(TASKS_TYPES)) {
    const sel = $('t-' + key);
    const cur = key === 'statusFilter' ? (kf.statusFilter?.property || '') : (kf[key] || '');
    fill(sel, state.schemaTasks, TASKS_TYPES[key], cur);
    if (AUTO_TASKS[key]) autoSelect(sel, state.schemaTasks, AUTO_TASKS[key], cur);
  }
}

async function loadTasksList(tasksId, kf) {
  const sortProp = kf.sortProperty;
  const pages = await queryAll(state.token, tasksId, sortProp ? { sorts: [{ property: sortProp, direction: 'descending' }] } : {});
  const fields = collectTasksFields();
  state.tasks = pages.map((p) => taskFromPage(p, fields));
  // Tâche congés
  const vac = state.config?.prefs?.vacationTaskId || '';
  $('p-vacationTask').innerHTML = ['<option value="">— aucune —</option>',
    ...state.tasks.map((t) => `<option value="${esc(t.id)}"${t.id === vac ? ' selected' : ''}>${esc(t.name)}</option>`)].join('');
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
      ...state.tasks.map((t) => `<option value="${esc(t.id)}"${t.id === fav.taskId ? ' selected' : ''}>${esc(t.name)}</option>`)].join('');
    div.innerHTML =
      `<select class="input fav-task" data-i="${i}">${taskOpts}</select>` +
      `<input class="input fav-label" data-i="${i}" maxlength="20" placeholder="libellé" value="${esc(fav.customLabel || '')}" style="flex:0 0 160px" />` +
      `<button type="button" class="btn btn-ghost fav-del" data-i="${i}">❌</button>`;
    list.appendChild(div);
  });
  $('btn-add-fav').disabled = state.favorites.length >= 8;
}

function wireFavorites() {
  $('btn-add-fav').addEventListener('click', () => {
    if (state.favorites.length >= 8) return;
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

// ── Injection de champs Notion ──────────────────────────
function injectTargets() {
  return { tasksDbId: $('tasks-db').value || null, projetsDbId: $('projets-db').value || null };
}

function renderInjectPreview(previewEl, plan, onConfirm) {
  const parts = [];
  if (plan.toCreate.length) {
    parts.push('<strong>À créer :</strong><ul>' +
      plan.toCreate.map((c) => `<li>${esc(c.name)} <span class="type">${esc(c.type)}</span></li>`).join('') + '</ul>');
  } else {
    parts.push('<em>Aucune propriété à créer — tout est déjà en place.</em>');
  }
  if (plan.conflicts.length) {
    parts.push('<strong>⚠️ Ignorées (même nom, type différent) :</strong><ul>' +
      plan.conflicts.map((c) => `<li>${esc(c.name)} — attendu ${esc(c.expectedType)}, présent ${esc(c.actualType)}</li>`).join('') + '</ul>');
  }
  if (plan.skippedNoTarget.length) {
    parts.push('<strong>Relations Projets sautées (aucune base Projets sélectionnée) :</strong><ul>' +
      plan.skippedNoTarget.map((c) => `<li>${esc(c.name)}</li>`).join('') + '</ul>');
  }
  const canApply = plan.toCreate.length > 0;
  parts.push('<div class="cell">' +
    (canApply ? '<button type="button" class="btn btn-primary" id="inject-confirm">Confirmer la création</button>' : '') +
    '<button type="button" class="btn btn-ghost" id="inject-cancel">Fermer</button></div>');
  previewEl.innerHTML = parts.join('');
  previewEl.hidden = false;
  previewEl.querySelector('#inject-cancel').addEventListener('click', () => { previewEl.hidden = true; });
  if (canApply) previewEl.querySelector('#inject-confirm').addEventListener('click', onConfirm);
}

async function onInject(kind) {
  const isTime = kind === 'time';
  const dbId = isTime ? $('time-db').value : $('tasks-db').value;
  const statusEl = $(isTime ? 'inject-time-status' : 'inject-tasks-status');
  const previewEl = $(isTime ? 'inject-time-preview' : 'inject-tasks-preview');
  if (!state.token || !dbId) {
    statusEl.textContent = 'Sélectionne d\'abord le token et la base concernée.';
    statusEl.className = 'status err';
    return;
  }
  const specs = isTime ? FIELD_SPECS_TIME : FIELD_SPECS_TASKS;
  const schema = isTime ? state.schemaTime : state.schemaTasks;
  const plan = planInjection(specs, schema, injectTargets());
  statusEl.textContent = ''; statusEl.className = 'status';
  renderInjectPreview(previewEl, plan, async () => {
    previewEl.hidden = true;
    statusEl.textContent = 'Création…'; statusEl.className = 'status';
    try {
      await addDatabaseProperties(state.token, dbId, plan.properties);
      if (isTime) { state.schemaTime = await getDatabaseSchema(state.token, dbId); remapTime(); }
      else { state.schemaTasks = await getDatabaseSchema(state.token, dbId); remapTasks(); }
      statusEl.textContent = `✓ ${plan.toCreate.length} propriété(s) créée(s). Vérifie le mapping puis Enregistre.`;
      statusEl.className = 'status ok';
    } catch (e) { statusEl.textContent = `Erreur : ${e.message}`; statusEl.className = 'status err'; }
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
    projetsDb: $('projets-db').value ? { id: $('projets-db').value, name: $('projets-db').selectedOptions[0]?.dataset.name || '' } : null,
    prefs: {
      requireComment: $('p-requireComment').checked,
      manualByDefault: $('p-manualByDefault').checked,
      externalButtonLabel: ($('p-externalLabel').value || 'CLICKUP').toUpperCase().slice(0, 20),
      weeklyHours,
      vacationTaskId: $('p-vacationTask').value || null,
      favorites: state.favorites.filter((f) => f.taskId).slice(0, 8),
    },
    theme: document.documentElement.getAttribute('data-theme') || 'dark',
  };
  await saveConfig(config);
  status.textContent = 'Configuration enregistrée ✓ — vous pouvez rouvrir l\'extension.';
  status.className = 'status ok';
  // La config vit dans son propre onglet : on le referme après sauvegarde.
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id) setTimeout(() => chrome.tabs.remove(tab.id), 900);
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
    $('p-manualByDefault').checked = !!state.config.prefs?.manualByDefault;
    $('p-externalLabel').value = state.config.prefs?.externalButtonLabel || 'CLICKUP';
    $('p-weeklyHours').value = state.config.prefs?.weeklyHours ?? 39;
    if (state.config.tasksDb?.fields?.statusFilter?.excludeValue) $('t-statusExclude').value = state.config.tasksDb.fields.statusFilter.excludeValue;
  }
  $('btn-test').addEventListener('click', onTest);
  $('btn-load-db').addEventListener('click', onLoadDb);
  $('time-db').addEventListener('change', loadSchemas);
  $('tasks-db').addEventListener('change', loadSchemas);
  $('t-title').addEventListener('change', () => loadTasksList($('tasks-db').value, state.config?.tasksDb?.fields || {}));
  $('btn-save').addEventListener('click', onSave);
  $('btn-inject-time').addEventListener('click', () => onInject('time'));
  $('btn-inject-tasks').addEventListener('click', () => onInject('tasks'));
  wireFavorites();
  // Charge automatiquement les bases si un token est déjà configuré (évite le clic manuel).
  if (state.token) await onLoadDb();
}

init();
