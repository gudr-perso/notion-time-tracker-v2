// src/config/config.js
import { testToken, searchDatabases, getDatabaseSchema, queryAll, addDatabaseProperties } from '../core/notion-api.js';
import { getConfig, saveConfig } from '../core/storage.js';
import { planInjection, FIELD_SPECS_TIME, FIELD_SPECS_TASKS } from '../core/schema-injection.js';
import { taskFromPage } from '../core/mapping.js';
import { readExcludeValues } from '../core/tasks-query.js';
import { buildExport, parseImport, exportFileName } from '../core/config-io.js';
import { applyStoredTheme, toggleTheme } from '../theme.js';
import { FAV_COLORS, FAV_COLOR_LABELS, NO_ICON, normalizeFavorite, nextFreeColor } from '../core/fav-presets.js';
import { FAV_ICONS } from '../core/fav-icons.js';
import { favIconSvg } from '../fav-icon.js';

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
  renderStatusExclude();
}

// Cases à cocher des vrais statuts de la propriété mappée — remplace la saisie libre séparée par
// ';' (source de fautes de frappe et de séparateur). Ne s'affiche que si un filtre d'état est mappé.
function renderStatusExclude() {
  const box = $('t-statusExclude');
  const prop = $('t-statusFilter').value;
  box.innerHTML = '';
  $('row-statusExclude').hidden = !prop;
  if (!prop) return;
  const options = state.schemaTasks.find((p) => p.name === prop)?.options || [];
  // Valeurs déjà exclues, uniquement si elles concernent la propriété actuellement mappée :
  // changer de propriété repart de zéro, les anciennes valeurs appartiennent à l'autre champ.
  const saved = state.config?.tasksDb?.fields?.statusFilter;
  const preset = saved?.property === prop ? readExcludeValues(saved) : [];
  const presetSet = new Set(preset);
  const addBox = (name, absent) => {
    const label = document.createElement('label');
    if (absent) label.className = 'absent';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = name; cb.checked = absent || presetSet.has(name);
    const txt = document.createElement('span');
    txt.textContent = name;
    label.append(cb, txt);
    if (absent) {
      const tag = document.createElement('span');
      tag.className = 'absent-tag'; tag.textContent = '(absent de la base)';
      label.append(tag);
    }
    box.appendChild(label);
  };
  options.forEach((name) => addBox(name, false));
  // Valeur sauvegardée qui n'existe plus comme option (statut renommé/supprimé) : conservée et
  // signalée plutôt que perdue en silence — on ne modifie jamais la config de l'utilisateur sans le dire.
  preset.filter((v) => !options.includes(v)).forEach((name) => addBox(name, true));
  if (!box.children.length) {
    const empty = document.createElement('span');
    empty.className = 'empty';
    empty.textContent = 'Cette propriété n’a aucune valeur définie.';
    box.appendChild(empty);
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
    const excludeValues = [...$('t-statusExclude').querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
    f.statusFilter = { property: sfProp, type: opt?.dataset.type || 'status', excludeValues };
  }
  return f;
}

// ── Favoris ─────────────────────────────────────────────
function colorPop(i, current) {
  const pop = document.createElement('div');
  pop.className = 'fav-pop fav-pop-color';
  pop.hidden = true;
  for (const c of FAV_COLORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fav-choice fav-swatch' + (c === current ? ' is-current' : '');
    b.dataset.kind = 'color';
    b.dataset.value = c;
    b.dataset.i = String(i);
    b.style.background = `var(--fav-${c})`;
    b.title = FAV_COLOR_LABELS[c];
    b.setAttribute('aria-label', FAV_COLOR_LABELS[c]);
    pop.appendChild(b);
  }
  return pop;
}

function iconPop(i, current) {
  const pop = document.createElement('div');
  pop.className = 'fav-pop fav-pop-icon';
  pop.hidden = true;
  // « Aucun » d'abord : c'est le défaut, il doit être le plus facile à retrouver.
  const cells = [[NO_ICON, 'Aucun picto'], ...Object.entries(FAV_ICONS).map(([k, v]) => [k, v.label])];
  for (const [key, label] of cells) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fav-choice fav-icon-cell' + (key === current ? ' is-current' : '');
    b.dataset.kind = 'icon';
    b.dataset.value = key;
    b.dataset.i = String(i);
    b.title = label;
    b.setAttribute('aria-label', label);
    const svg = favIconSvg(key);
    if (svg) b.appendChild(svg);
    else b.textContent = '∅';
    pop.appendChild(b);
  }
  return pop;
}

// Une cellule = le bouton déclencheur (aperçu de l'état courant) + son panneau (Task 7).
function pickCell(i, fav, kind) {
  const cell = document.createElement('div');
  cell.className = 'fav-pick';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'fav-trigger';
  trigger.dataset.kind = kind;
  trigger.dataset.i = String(i);
  trigger.setAttribute('aria-expanded', 'false');
  if (kind === 'color') {
    trigger.setAttribute('aria-label', 'Couleur du favori');
    const dot = document.createElement('span');
    dot.className = 'fav-dot';
    // Clé garantie par normalizeFavorite : le var() ne peut pas être détourné.
    dot.style.background = `var(--fav-${fav.color})`;
    trigger.appendChild(dot);
  } else {
    trigger.setAttribute('aria-label', 'Picto du favori');
    const svg = favIconSvg(fav.icon);
    if (svg) trigger.appendChild(svg);
    else {
      const none = document.createElement('span');
      none.className = 'fav-none';
      none.textContent = '∅';
      trigger.appendChild(none);
    }
  }
  const caret = document.createElement('span');
  caret.className = 'fav-caret';
  caret.textContent = '▾';
  trigger.appendChild(caret);
  cell.appendChild(trigger);
  cell.appendChild(kind === 'color' ? colorPop(i, fav.color) : iconPop(i, fav.icon));
  return cell;
}

function renderFavorites() {
  const list = $('fav-list');
  list.innerHTML = '';
  state.favorites.forEach((fav, i) => {
    const div = document.createElement('div');
    div.className = 'cell';
    const taskOpts = ['<option value="">— tâche —</option>',
      ...state.tasks.map((t) => `<option value="${esc(t.id)}"${t.id === fav.taskId ? ' selected' : ''}>${esc(t.name)}</option>`)].join('');
    div.innerHTML =
      `<select class="input fav-task" data-i="${i}">${taskOpts}</select>` +
      `<input class="input fav-label" data-i="${i}" maxlength="20" placeholder="libellé" value="${esc(fav.customLabel || '')}" />`;
    div.appendChild(pickCell(i, fav, 'color'));
    div.appendChild(pickCell(i, fav, 'icon'));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-ghost fav-del';
    del.dataset.i = String(i);
    del.textContent = '❌';
    div.appendChild(del);
    list.appendChild(div);
  });
  $('btn-add-fav').disabled = state.favorites.length >= 8;
}

function closePopovers() {
  document.querySelectorAll('.fav-pop').forEach((p) => { p.hidden = true; });
  document.querySelectorAll('.fav-trigger').forEach((t) => t.setAttribute('aria-expanded', 'false'));
}

// Un seul panneau ouvert à la fois ; re-cliquer le déclencheur referme.
function togglePopover(trigger) {
  const pop = trigger.parentElement.querySelector('.fav-pop');
  const wasOpen = !pop.hidden;
  closePopovers();
  if (!wasOpen) {
    pop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
  }
}

function wireFavorites() {
  $('btn-add-fav').addEventListener('click', () => {
    if (state.favorites.length >= 8) return;
    state.favorites.push(normalizeFavorite({ color: nextFreeColor(state.favorites), icon: NO_ICON }));
    renderFavorites();
  });
  $('fav-list').addEventListener('input', (e) => {
    const i = Number(e.target.dataset.i);
    if (e.target.classList.contains('fav-task')) state.favorites[i].taskId = e.target.value;
    if (e.target.classList.contains('fav-label')) state.favorites[i].customLabel = e.target.value;
  });
  $('fav-list').addEventListener('click', (e) => {
    // closest() et pas e.target : le clic atterrit souvent sur le <svg> ou la pastille interne.
    const del = e.target.closest('.fav-del');
    if (del) { state.favorites.splice(Number(del.dataset.i), 1); renderFavorites(); return; }
    const trigger = e.target.closest('.fav-trigger');
    if (trigger) { togglePopover(trigger); return; }
    const choice = e.target.closest('.fav-choice');
    if (!choice) return;
    const i = Number(choice.dataset.i);
    if (choice.dataset.kind === 'color') state.favorites[i].color = choice.dataset.value;
    else state.favorites[i].icon = choice.dataset.value;
    renderFavorites(); // reconstruit la ligne (aperçu à jour) et referme le panneau au passage
  });
  // Fermeture au clic extérieur : un clic dans .fav-pick est traité par le listener ci-dessus.
  document.addEventListener('click', (e) => { if (!e.target.closest('.fav-pick')) closePopovers(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopovers(); });
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
  } else if (plan.skippedNoTarget.length) {
    parts.push('<em>Aucune propriété créable en l\'état — voir les relations sautées ci-dessous.</em>');
  } else {
    parts.push('<em>Aucune propriété à créer — tout est déjà en place.</em>');
  }
  if (plan.conflicts.length) {
    parts.push('<strong>⚠️ Ignorées (même nom, type différent) :</strong><ul>' +
      plan.conflicts.map((c) => `<li>${esc(c.name)} — attendu ${esc(c.expectedType)}, présent ${esc(c.actualType)}</li>`).join('') + '</ul>');
  }
  if (plan.skippedNoTarget.length) {
    const labelFor = (tk) => (tk === 'tasksDbId' ? 'base Tâches' : 'base Projets');
    parts.push('<strong>Relations sautées (base cible non sélectionnée) :</strong><ul>' +
      plan.skippedNoTarget.map((c) => `<li>${esc(c.name)} — sélectionne d'abord la ${esc(labelFor(c.targetKey))}</li>`).join('') + '</ul>');
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
  const btn = $(isTime ? 'btn-inject-time' : 'btn-inject-tasks');
  const statusEl = $(isTime ? 'inject-time-status' : 'inject-tasks-status');
  const previewEl = $(isTime ? 'inject-time-preview' : 'inject-tasks-preview');
  if (!state.token || !dbId) {
    statusEl.textContent = 'Sélectionne d\'abord le token et la base concernée.';
    statusEl.className = 'status err';
    return;
  }
  const specs = isTime ? FIELD_SPECS_TIME : FIELD_SPECS_TASKS;
  // Toujours repartir du schéma réel de la base : un plan basé sur un état
  // obsolète/vide risquerait de re-typer des propriétés existantes via le PATCH.
  btn.disabled = true;
  statusEl.textContent = 'Analyse…'; statusEl.className = 'status';
  let schema;
  try {
    schema = await getDatabaseSchema(state.token, dbId);
    if (isTime) state.schemaTime = schema; else state.schemaTasks = schema;
  } catch (e) {
    statusEl.textContent = `Erreur : ${e.message}`; statusEl.className = 'status err';
    btn.disabled = false; return;
  }
  const plan = planInjection(specs, schema, injectTargets());
  statusEl.textContent = ''; statusEl.className = 'status';
  btn.disabled = false;
  renderInjectPreview(previewEl, plan, async () => {
    previewEl.hidden = true;
    btn.disabled = true;
    statusEl.textContent = 'Création…'; statusEl.className = 'status';
    try {
      await addDatabaseProperties(state.token, dbId, plan.properties);
      if (isTime) { state.schemaTime = await getDatabaseSchema(state.token, dbId); remapTime(); }
      else { state.schemaTasks = await getDatabaseSchema(state.token, dbId); remapTasks(); }
      statusEl.textContent = `✓ ${plan.toCreate.length} propriété(s) créée(s). Vérifie le mapping puis Enregistre.`;
      statusEl.className = 'status ok';
    } catch (e) { statusEl.textContent = `Erreur : ${e.message}`; statusEl.className = 'status err'; }
    finally { btn.disabled = false; }
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
      favorites: state.favorites.filter((f) => f.taskId).slice(0, 8).map(normalizeFavorite),
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

// ── Sauvegarde & transfert ──────────────────────────────
async function onExport() {
  const status = $('export-status');
  const config = await getConfig();
  if (!config) { status.textContent = 'Rien à exporter — configure d\'abord l\'extension.'; status.className = 'status err'; return; }
  const appVersion = chrome.runtime.getManifest().version;
  const json = JSON.stringify(buildExport(config, appVersion), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName();
  a.click();
  URL.revokeObjectURL(url);
  status.textContent = 'Exporté ✓ (le token n\'est pas dans le fichier).'; status.className = 'status ok';
}

async function onImportFile(e) {
  const status = $('import-status');
  const file = e.target.files?.[0];
  e.target.value = ''; // permet de réimporter le même fichier deux fois de suite
  if (!file) return;
  let text;
  try {
    text = await file.text();
  } catch {
    status.textContent = 'Erreur : fichier illisible.'; status.className = 'status err'; return;
  }
  let next;
  try {
    next = parseImport(text, await getConfig());
  } catch (err) {
    status.textContent = `Erreur : ${err.message}`; status.className = 'status err'; return;
  }
  // Relecture pour l'entête d'info affichée dans la confirmation ; le texte est déjà validé par parseImport.
  let when = '?', from = '?';
  try {
    const raw = JSON.parse(text);
    if (raw.exportedAt) when = new Date(raw.exportedAt).toLocaleDateString('fr-FR');
    if (raw.appVersion) from = raw.appVersion;
  } catch { /* ce bloc ne sert qu'à l'affichage ; une erreur ici est sans conséquence */ }
  if (!confirm(`Config exportée le ${when} depuis la v${from}.\n\nRemplacer la configuration actuelle ? (le token du poste est conservé)`)) {
    status.textContent = 'Import annulé.'; status.className = 'status'; return;
  }
  await saveConfig(next);
  location.reload();
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
    state.favorites = (state.config.prefs?.favorites || []).map(normalizeFavorite);
    if (state.token) { $('token').value = state.token; $('token-status').textContent = 'Token présent — retester si besoin.'; }
    $('p-requireComment').checked = !!state.config.prefs?.requireComment;
    $('p-manualByDefault').checked = !!state.config.prefs?.manualByDefault;
    $('p-externalLabel').value = state.config.prefs?.externalButtonLabel || 'CLICKUP';
    $('p-weeklyHours').value = state.config.prefs?.weeklyHours ?? 39;
  }
  $('btn-test').addEventListener('click', onTest);
  $('btn-load-db').addEventListener('click', onLoadDb);
  $('time-db').addEventListener('change', loadSchemas);
  $('tasks-db').addEventListener('change', loadSchemas);
  $('t-title').addEventListener('change', () => loadTasksList($('tasks-db').value, state.config?.tasksDb?.fields || {}));
  $('t-statusFilter').addEventListener('change', renderStatusExclude);
  $('btn-save').addEventListener('click', onSave);
  $('btn-inject-time').addEventListener('click', () => onInject('time'));
  $('btn-inject-tasks').addEventListener('click', () => onInject('tasks'));
  $('btn-export').addEventListener('click', onExport);
  $('btn-import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', onImportFile);
  wireFavorites();
  // Charge automatiquement les bases si un token est déjà configuré (évite le clic manuel).
  if (state.token) await onLoadDb();
}

init();
