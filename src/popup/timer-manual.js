// src/popup/timer-manual.js — mode saisie manuelle, congés, favoris (enregistrement rapide).
import { createPage, updatePage } from '../core/notion-api.js';
import { sessionPropertiesForCreate, sessionPropertiesForUpdate } from '../core/mapping.js';
import { roundToNearestFiveMinutes, formatDateTimeLocalValue } from '../core/time.js';
import { normalizeFavorite } from '../core/fav-presets.js';
import { favIconSvg } from '../fav-icon.js';
import { hasAnySchedule, generateLeaveSpans, leaveDays } from '../core/schedule.js';

const $ = (id) => document.getElementById(id);
let T = null, helpers = null;

// État de la sélection de plage congés (demi-journées), tant que le popup reste ouvert.
const VAC = { from: null, to: null, fromHalf: 'journee', toHalf: 'journee', overrides: {} };
const fmtDays = (n) => { const r = Math.round(n * 10) / 10; return (Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',')) + ' j'; };
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (v) => (v ? new Date(v + 'T00:00:00') : null);
function vacSchedule() { return T.config.prefs?.schedule || null; }
function currentSpans() {
  return generateLeaveSpans(vacSchedule(), { fromDate: parseDay(VAC.from), fromHalf: VAC.fromHalf, toDate: parseDay(VAC.to), toHalf: VAC.toHalf, overrides: VAC.overrides });
}
function updateVacRecap() {
  const spans = currentSpans();
  const days = leaveDays(vacSchedule(), spans);
  $('vac-recap').textContent = spans.length ? `🌴 ${fmtDays(days)} · ${spans.length} ligne${spans.length > 1 ? 's' : ''}` : 'Aucune demi-journée sélectionnée';
}
function syncHalfButtons() {
  for (const [grp, key] of [['vac-from-half', 'fromHalf'], ['vac-to-half', 'toHalf']]) {
    [...$(grp).children].forEach((b) => b.classList.toggle('on', b.dataset.h === VAC[key]));
  }
}
// Masque/rétablit les champs début/fin ET leurs libellés : chacun vit dans son propre `.field`
// (deux `.field` côte à côte dans `#manual-fields .field-row` — cf. popup.html) ; les masquer
// individuellement fait s'effondrer la ligne (grid sans piste à dimensionner).
function setStartEndHidden(hidden) {
  for (const id of ['manual-start', 'manual-end']) {
    const el = $(id); if (!el) continue;
    const wrap = el.closest('.field') || el.parentElement;
    if (wrap) wrap.hidden = hidden;
  }
}

let toastTimer = null;
// Petit message de confirmation en bas de popup, qui s'efface tout seul.
function showToast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  void el.offsetWidth; // force un reflow pour rejouer la transition si un toast est déjà là
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 220); // laisse le fondu se terminer avant de masquer
  }, 2000);
}

// Gèle les boutons d'enregistrement pendant l'appel Notion (même sensation que « Enregistrer »).
// sourceBtn = le favori cliqué, le cas échéant → on y affiche un « ⏳ … » le temps de la sauvegarde.
function setSaving(on, sourceBtn) {
  $('btn-primary').disabled = on;
  document.querySelectorAll('#fav-buttons .btn').forEach((b) => { b.disabled = on; });
  if (!sourceBtn) return;
  // Ne viser que le libellé : écraser le contenu du bouton effacerait le picto SVG.
  // Repli sur le bouton lui-même pour « Enregistrer », qui n'a pas de libellé séparé.
  const target = sourceBtn.querySelector('.fav-btn-label') || sourceBtn;
  if (on) { target.dataset.label = target.textContent; target.textContent = '⏳ …'; }
  else if (target.dataset.label !== undefined) {
    target.textContent = target.dataset.label;
    delete target.dataset.label;
  }
}

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
    T.selectedTaskId = T.config.prefs.vacationTaskId;
    const sel = $('task-select');
    if ([...sel.options].some((o) => o.value === T.selectedTaskId)) sel.value = T.selectedTaskId;
    $('vacation-hint').hidden = false;
    const withSchedule = hasAnySchedule(vacSchedule());
    $('vac-range').hidden = !withSchedule; // sans planning configuré : on garde le début/fin classique
    setStartEndHidden(withSchedule);
    if (withSchedule) {
      VAC.from = VAC.to = isoDay(new Date());
      $('vac-from').value = $('vac-to').value = VAC.from;
      VAC.fromHalf = VAC.toHalf = 'journee'; VAC.overrides = {};
      syncHalfButtons(); updateVacRecap();
    }
  } else {
    $('vacation-hint').hidden = true;
    $('vac-range').hidden = true;
    setStartEndHidden(false);
  }
}

function renderFavoriteButtons() {
  const favs = (T.config.prefs?.favorites || []).map(normalizeFavorite);
  $('fav-buttons').innerHTML = '';
  favs.forEach((fav) => {
    const task = T.tasks.find((t) => t.id === fav.taskId);
    const label = fav.customLabel || task?.name || 'Favori';
    const btn = document.createElement('button');
    btn.className = 'btn';
    // Un re-rendu pendant un enregistrement recréerait des boutons actifs : le clic serait
    // avalé par la garde `saving` sans rien faire. On rejoue l'état plutôt que d'y renoncer.
    btn.disabled = saving;
    // La clé est garantie par normalizeFavorite : pas d'injection possible dans le var().
    btn.style.setProperty('--fav-color', `var(--fav-${fav.color})`);
    btn.title = label; // le libellé se tronque en CSS : l'infobulle rend la version entière
    const ico = favIconSvg(fav.icon);
    if (ico) btn.appendChild(ico);
    const span = document.createElement('span');
    span.className = 'fav-btn-label';
    span.textContent = label;
    btn.appendChild(span);
    btn.addEventListener('click', () => saveManualFor(fav.taskId, btn));
    $('fav-buttons').appendChild(btn);
  });
}

let saving = false; // garde anti double-enregistrement

async function saveManualFor(taskId, sourceBtn) {
  if (saving) return;
  const task = T.tasks.find((t) => t.id === taskId);
  if (!task) { alert('Tâche du favori introuvable.'); return; }
  if (!$('manual-start').value || !$('manual-end').value) { alert('Renseigne le début et la fin.'); return; }
  const start = new Date($('manual-start').value);
  const end = new Date($('manual-end').value);
  if (end <= start) { alert('La fin doit être après le début.'); return; }
  const comment = $('manual-comment').value.trim();
  if (T.config.prefs?.requireComment && !comment) { alert('Le commentaire est obligatoire.'); $('manual-comment').focus(); return; }
  saving = true;
  setSaving(true, sourceBtn);
  try {
    const pageId = await createPage(T.token, T.config.timeDb.id, sessionPropertiesForCreate(task, start, T.timeFields));
    await updatePage(T.token, pageId, sessionPropertiesForUpdate({ endTime: end, comment, pauseMin: 0 }, T.timeFields));
    resetManual();
    await helpers.reloadRecent();
    showToast('✅ Ligne créée dans Notion');
  } catch (e) {
    alert(`Impossible d'enregistrer la session : ${e.message}`);
  } finally {
    saving = false;
    setSaving(false, sourceBtn);
  }
}

async function onManualSave() {
  const task = helpers.currentTask();
  if (!task) { alert('Sélectionne une tâche.'); return; }
  await saveManualFor(task.id, $('btn-primary'));
}

function resetManual() {
  $('manual-comment').value = '';
  $('manual-vacation').checked = false;
  $('vacation-hint').hidden = true;
  $('vac-range').hidden = true;
  setStartEndHidden(false);
  prefillManual();
}

export function wireManual(sharedT, sharedHelpers) {
  T = sharedT; helpers = sharedHelpers;
  helpers.onManualSave = onManualSave;
  // Exposé pour un second rendu une fois T.tasks chargé : au premier passage la liste est
  // encore vide, les libellés issus des noms de tâches sortiraient tous en « Favori ».
  helpers.renderFavorites = renderFavoriteButtons;
  $('manual-comment-label').textContent = T.config.prefs?.requireComment
    ? 'COMMENTAIRE (OBLIGATOIRE)' : 'COMMENTAIRE (OPTIONNEL)';
  $('manual-mode').addEventListener('change', (e) => toggleManual(e.target.checked));
  $('manual-vacation').addEventListener('change', onVacationToggle);
  $('vacation-hint').hidden = true;
  $('vac-from').addEventListener('change', () => {
    VAC.from = $('vac-from').value || null;
    if (VAC.to && VAC.from && parseDay(VAC.to) < parseDay(VAC.from)) { VAC.to = VAC.from; $('vac-to').value = VAC.to; }
    VAC.overrides = {}; updateVacRecap();
  });
  $('vac-to').addEventListener('change', () => { VAC.to = $('vac-to').value || null; VAC.overrides = {}; updateVacRecap(); });
  for (const [grp, key] of [['vac-from-half', 'fromHalf'], ['vac-to-half', 'toHalf']]) {
    $(grp).addEventListener('click', (e) => { const b = e.target.closest('button[data-h]'); if (!b) return; VAC[key] = b.dataset.h; syncHalfButtons(); updateVacRecap(); });
  }
  renderFavoriteButtons();
  // Ouverture directe en mode saisie manuelle si l'option est activée en config.
  if (T.config.prefs?.manualByDefault) {
    $('manual-mode').checked = true;
    toggleManual(true);
  }
}
