// src/popup/stats.js — onglet Stats : sélecteur de période, fetch, rendu.
import { queryAll, getPage } from '../core/notion-api.js';
import { sessionFromPage, taskFromPage, titleWithProject } from '../core/mapping.js';
import { formatDuration, toNotionDate } from '../core/time.js';
import { periodRange, aggregate, isVacationSession } from '../core/stats.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const JOURS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const S = {
  config: null, token: '', timeFields: null,
  kind: 'week', ref: new Date(),
  custom: { from: null, to: null },
  vacation: { vacationTaskId: null, vacationName: null },
  cache: new Map(),        // clé de plage → aggregate
  loaded: false,
};

function currentRange() {
  if (S.kind === 'custom') {
    const from = S.custom.from ? new Date(S.custom.from + 'T00:00:00') : new Date();
    const to = S.custom.to ? new Date(S.custom.to + 'T23:59:59') : new Date();
    return { start: from, end: to, label: `${S.custom.from || '?'} → ${S.custom.to || '?'}` };
  }
  return periodRange(S.kind, S.ref);
}

function cacheKey(r) { return `${S.kind}|${r.start.getTime()}|${r.end.getTime()}`; }

function shift(dir) {
  const d = new Date(S.ref);
  if (S.kind === 'day') d.setDate(d.getDate() + dir);
  else if (S.kind === 'week') d.setDate(d.getDate() + 7 * dir);
  else if (S.kind === 'month') d.setMonth(d.getMonth() + dir);
  S.ref = d;
}

function show(which) {
  for (const id of ['stats-loading', 'stats-error', 'stats-empty', 'stats-content']) {
    $(id).hidden = id !== which;
  }
}

async function loadVacationTask() {
  const id = S.config.prefs?.vacationTaskId;
  S.vacation = { vacationTaskId: id || null, vacationName: null };
  if (!id) return;
  try {
    const task = taskFromPage(await getPage(S.token, id), S.config.tasksDb.fields);
    S.vacation.vacationName = titleWithProject(task.name, task.project);
  } catch { /* le repli par nom sera simplement inactif */ }
}

async function fetchAggregate(range) {
  const key = cacheKey(range);
  if (S.cache.has(key)) return S.cache.get(key);
  const filter = {
    and: [
      { property: S.timeFields.startDate, date: { on_or_after: toNotionDate(range.start) } },
      { property: S.timeFields.startDate, date: { on_or_before: toNotionDate(range.end) } },
    ],
  };
  const sorts = [{ property: S.timeFields.startDate, direction: 'ascending' }];
  const pages = await queryAll(S.token, S.config.timeDb.id, { filter, sorts });
  const sessions = pages.map((p) => sessionFromPage(p, S.timeFields));
  const isVacation = (s) => isVacationSession(s, S.vacation);
  const agg = aggregate(sessions, {
    start: range.start, end: range.end, isVacation,
    weeklyHours: S.config.prefs?.weeklyHours ?? 39,
    schedule: S.config.prefs?.schedule || null,
  });
  S.cache.set(key, agg);
  return agg;
}

function renderObjective(agg) {
  const fmt = (ms) => formatDuration(ms, { withSeconds: false });
  const pct = agg.progress === null ? 0 : Math.round(agg.progress * 100);
  $('stats-ring').style.setProperty('--p', Math.min(100, pct));
  $('stats-ring-worked').textContent = fmt(agg.workedMs);
  $('stats-ring-obj').textContent = agg.objectiveMs > 0 ? `/ ${fmt(agg.objectiveMs)}` : 'sans objectif';
  const fmtDays = (n) => {
    const r = Math.round(n * 10) / 10;
    return (Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',')) + ' j';
  };
  const conge = agg.congeDays > 0
    ? `<span class="conge-badge">🌴 ${fmtDays(agg.congeDays)}</span>` : '—';
  $('stats-obj-side').innerHTML =
    `<div class="line"><span class="k">Objectif</span><span class="v">${agg.objectiveMs > 0 ? fmt(agg.objectiveMs) : '—'}</span></div>` +
    `<div class="line"><span class="k">Travaillé</span><span class="v">${fmt(agg.workedMs)}</span></div>` +
    `<div class="line"><span class="k">Reste</span><span class="v">${fmt(agg.remainingMs)}</span></div>` +
    `<div class="line"><span class="k">Congés</span><span class="v">${conge}</span></div>`;
}

function renderDays(agg) {
  const fmt = (ms) => formatDuration(ms, { withSeconds: false });
  // Référence = plus grand entre (travail+congés) et la cible du jour, pour que le repère de cible tienne dans le cadre.
  const maxMs = Math.max(1, ...agg.perDay.map((d) => Math.max(d.workMs + d.congeMs, d.targetMs || 0)));
  const bars = agg.perDay.map((d) => {
    const total = d.workMs + d.congeMs;
    const h = Math.round((total / maxMs) * 100);
    let segs = '';
    if (total > 0) {
      const workPct = Math.round((d.workMs / total) * 100);
      if (d.congeMs > 0) segs += `<i class="seg conge" style="height:${100 - workPct}%"></i>`;
      if (d.workMs > 0) segs += `<i class="seg work" style="height:${workPct}%"></i>`;
    }
    const cls = total === 0 ? 'bar empty' : 'bar';
    const dur = total === 0 ? 'Aucune session'
      : (d.workMs && d.congeMs) ? `${fmt(d.workMs)} travaillé · ${fmt(d.congeMs)} congés`
        : d.congeMs ? `Congés · ${fmt(d.congeMs)}`
          : fmt(d.workMs);
    const top = d.congeMs > 0 ? '🌴' : (S.kind === 'month' ? '' : (d.workMs ? fmt(d.workMs) : '·'));
    const dn = S.kind === 'month' ? String(d.date.getDate()) : JOURS[d.date.getDay()];
    const mark = d.targetMs > 0
      ? `<div class="day-target" style="bottom:${Math.min(100, Math.round((d.targetMs / maxMs) * 100))}%"></div>` : '';
    return `<div class="day"><div class="dh">${top}</div>` +
      `<div class="track">${mark}<div class="${cls}" style="height:${Math.max(2, h)}%" title="${dur}">${segs}</div></div>` +
      `<div class="dn">${dn}</div></div>`;
  }).join('');
  $('stats-days').innerHTML = bars;
}

function renderProjects(agg) {
  if (!agg.perProject.length) { $('stats-projects').innerHTML = '<div class="stats-state">—</div>'; return; }
  $('stats-projects').innerHTML = agg.perProject.map((p) => {
    const w = Math.round(p.ratio * 100);
    return `<div class="proj"><span class="pn">${esc(p.project)}</span>` +
      `<span class="ptrack"><i style="width:${w}%"></i></span>` +
      `<span class="pv">${formatDuration(p.ms, { withSeconds: false })} · ${w}%</span></div>`;
  }).join('');
}

async function refresh() {
  const range = currentRange();
  $('stats-range').textContent = range.label;
  $('stats-prev').disabled = $('stats-next').disabled = S.kind === 'custom';
  show('stats-loading');
  try {
    const agg = await fetchAggregate(range);
    const empty = agg.workedMs === 0 && agg.congeMs === 0;
    if (empty) { show('stats-empty'); return; }
    renderObjective(agg);
    renderDays(agg);
    renderProjects(agg);
    show('stats-content');
  } catch (e) {
    $('stats-error').textContent = `Erreur : ${e.message}`;
    show('stats-error');
  }
}

let wired = false;
function wireOnce() {
  if (wired) return;
  wired = true;
  $('stats-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-kind]');
    if (!btn) return;
    S.kind = btn.dataset.kind;
    [...$('stats-seg').children].forEach((b) => b.classList.toggle('on', b === btn));
    $('stats-custom').hidden = S.kind !== 'custom';
    $('stats-prev').disabled = $('stats-next').disabled = S.kind === 'custom';
    if (S.kind !== 'custom') refresh();
  });
  $('stats-prev').addEventListener('click', () => { shift(-1); refresh(); });
  $('stats-next').addEventListener('click', () => { shift(1); refresh(); });
  $('stats-apply').addEventListener('click', () => {
    S.custom.from = $('stats-from').value || null;
    S.custom.to = $('stats-to').value || null;
    if (S.custom.from && S.custom.to) refresh();
  });
}

// Appelé au premier affichage de l'onglet Stats (lazy).
export async function initStats(config) {
  if (S.loaded) { refresh(); return; }
  S.config = config;
  S.token = config.notionToken;
  S.timeFields = config.timeDb.fields;
  S.loaded = true;
  wireOnce();
  await loadVacationTask();
  await refresh();
}

// Invalide le cache (après enregistrement d'une session).
export function invalidateStats() { S.cache.clear(); }
