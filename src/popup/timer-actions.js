// src/popup/timer-actions.js — actions de session (démarrage, pause, arrêt, modale « arrêter à… »).
import { createPage, updatePage } from '../core/notion-api.js';
import { sessionPropertiesForCreate, sessionPropertiesForUpdate } from '../core/mapping.js';
import { workedMs, formatDuration, formatStartedLabel, formatClock, formatDateTimeLocalValue } from '../core/time.js';
import { getCurrentSession, setCurrentSession, clearCurrentSession, pushTaskHistory } from '../core/storage.js';

const $ = (id) => document.getElementById(id);
const MAX_PAUSE_MS = 60 * 60_000;
let tickInterval = null;
let CTX = null; // { T, helpers }

function notifyWorker(action) { try { chrome.runtime.sendMessage({ action }); } catch { /* worker absent */ } }

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

function enterRunning(session, task) {
  CTX.T.session = session;
  $('current-task-name').textContent = task ? task.name + (task.project ? ` [${task.project}]` : '') : session.taskName;
  $('current-task-name').dataset.notionUrl = task ? task.notionUrl : '';
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
  $('session-comment').value = '';
  enterRunning(session, task);
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

// ── Modale « Arrêter à… » ─────────────────────────────
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
  if (Number.isNaN(dur) || dur < 0) {
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
  $('btn-stop-at').addEventListener('click', openStopAt);
  $('stop-cancel').addEventListener('click', closeStopAt);
  $('stop-at-modal').addEventListener('click', (e) => { if (e.target.id === 'stop-at-modal') closeStopAt(); });
  ['stop-hour', 'stop-min', 'stop-date'].forEach((id) => $(id).addEventListener('input', refreshStopDuration));
  $('stop-confirm').addEventListener('click', async () => { if (await finishSession(stopAtChosenDate())) closeStopAt(); });

  helpers.enterRunning = enterRunning;
  helpers.finishSession = finishSession;

  // Restauration d'une session en cours à l'ouverture du popup.
  getCurrentSession().then((s) => { if (s) { const task = T.tasks.find((t) => t.id === s.taskId); enterRunning(s, task); } });
}
