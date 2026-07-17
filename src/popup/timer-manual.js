// src/popup/timer-manual.js — mode saisie manuelle, congés, favoris (enregistrement rapide).
import { createPage, updatePage } from '../core/notion-api.js';
import { sessionPropertiesForCreate, sessionPropertiesForUpdate } from '../core/mapping.js';
import { roundToNearestFiveMinutes, formatDateTimeLocalValue } from '../core/time.js';
import { normalizeFavorite } from '../core/fav-presets.js';
import { favIconSvg } from '../fav-icon.js';

const $ = (id) => document.getElementById(id);
let T = null, helpers = null;

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
  } else {
    $('vacation-hint').hidden = true;
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
  prefillManual();
}

export function wireManual(sharedT, sharedHelpers) {
  T = sharedT; helpers = sharedHelpers;
  helpers.onManualSave = onManualSave;
  $('manual-comment-label').textContent = T.config.prefs?.requireComment
    ? 'COMMENTAIRE (OBLIGATOIRE)' : 'COMMENTAIRE (OPTIONNEL)';
  $('manual-mode').addEventListener('change', (e) => toggleManual(e.target.checked));
  $('manual-vacation').addEventListener('change', onVacationToggle);
  $('vacation-hint').hidden = true;
  renderFavoriteButtons();
  // Ouverture directe en mode saisie manuelle si l'option est activée en config.
  if (T.config.prefs?.manualByDefault) {
    $('manual-mode').checked = true;
    toggleManual(true);
  }
}
