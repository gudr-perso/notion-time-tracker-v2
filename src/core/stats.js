// src/core/stats.js — agrégations statistiques pures (aucune API Chrome).
import { workedMs, startOfDay } from './time.js';
import { extractProject } from './mapping.js';
import { scheduledMsForDate, hasAnySchedule } from './schedule.js';

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_ABBR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

export function periodRange(kind, refDate) {
  const ref = new Date(refDate);
  if (kind === 'day') {
    return {
      start: startOfDay(ref),
      end: endOfDay(ref),
      label: `${ref.getDate()} ${MOIS_ABBR[ref.getMonth()]}`,
    };
  }
  if (kind === 'week') {
    const day = ref.getDay(); // 0=dim … 6=sam
    const toMonday = day === 0 ? -6 : 1 - day;
    const start = startOfDay(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + toMonday));
    const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
    return {
      start,
      end,
      label: `${start.getDate()} ${MOIS_ABBR[start.getMonth()]} – ${end.getDate()} ${MOIS_ABBR[end.getMonth()]}`,
    };
  }
  if (kind === 'month') {
    const start = startOfDay(new Date(ref.getFullYear(), ref.getMonth(), 1));
    const end = endOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));
    return { start, end, label: `${MOIS_FR[ref.getMonth()]} ${ref.getFullYear()}` };
  }
  throw new Error(`periodRange: kind inconnu « ${kind} »`);
}

export function weekdaysBetween(start, end) {
  let n = 0;
  const d = startOfDay(start);
  const last = startOfDay(end).getTime();
  while (d.getTime() <= last) {
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5) n += 1;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

export function dailyTargetHours(weeklyHours) {
  return weeklyHours / 5;
}

export function objectiveHours(weekdays, congeDays, weeklyHours) {
  return Math.max(0, (weekdays - congeDays) * (weeklyHours / 5));
}

const normId = (id) => String(id || '').replace(/-/g, '');

export function isVacationSession(session, { vacationTaskId, vacationName } = {}) {
  if (!vacationTaskId && !vacationName) return false;
  const rel = session.tasksRelIds || [];
  if (vacationTaskId && rel.some((id) => normId(id) === normId(vacationTaskId))) return true;
  if (vacationName && session.name === vacationName) return true;
  return false;
}

export function aggregate(sessions, { start, end, isVacation = () => false, weeklyHours = 39, schedule = null }) {
  const dayKey = (d) => startOfDay(d).getTime();

  // Amorce toutes les journées de la plage (ordre chronologique).
  const perDayMap = new Map();
  const cursor = startOfDay(start);
  const lastKey = dayKey(end);
  while (cursor.getTime() <= lastKey) {
    const wd = cursor.getDay();
    perDayMap.set(cursor.getTime(), {
      date: new Date(cursor), workMs: 0, congeMs: 0, isWeekend: wd === 0 || wd === 6,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const projMap = new Map();
  let workedTotal = 0;
  let congeTotal = 0;

  for (const s of sessions) {
    if (!s.startTime || !s.endTime) continue;
    const k = dayKey(s.startTime);
    const bucket = perDayMap.get(k);
    const dur = workedMs(s.startTime, s.endTime, (s.pauseMin || 0) * 60_000);
    if (isVacation(s)) {
      congeTotal += dur;
      if (bucket) bucket.congeMs += dur; // ← durée conservée (avant : jetée)
      continue; // exclu du temps travaillé et des projets
    }
    workedTotal += dur;
    if (bucket) bucket.workMs += dur;
    const proj = extractProject(s.name);
    projMap.set(proj, (projMap.get(proj) || 0) + dur);
  }

  const perDay = [...perDayMap.values()];
  const perProject = [...projMap.entries()]
    .map(([project, ms]) => ({ project, ms, ratio: workedTotal ? ms / workedTotal : 0 }))
    .sort((a, b) => b.ms - a.ms);

  // Cible de chaque jour : le planning s'il est défini, sinon le forfait plat des jours ouvrés (rétro-compat).
  const useSchedule = hasAnySchedule(schedule);
  const dailyTargetMs = dailyTargetHours(weeklyHours) * 3600_000;
  const targetMsForDate = (date) => {
    if (useSchedule) return scheduledMsForDate(schedule, date);
    const wd = date.getDay();
    return (wd >= 1 && wd <= 5) ? dailyTargetMs : 0;
  };

  let rawObjectiveMs = 0;
  let congeCappedMs = 0;
  let congeDaysAcc = 0;
  for (const d of perDay) {
    const t = targetMsForDate(d.date);
    d.targetMs = t;                          // exposé pour le repère de cible par barre (rendu)
    rawObjectiveMs += t;
    const capped = Math.min(d.congeMs, t);   // un congé ne peut retirer plus que la cible du jour
    congeCappedMs += capped;
    if (t > 0) congeDaysAcc += capped / t;   // fraction d'heures réelles → jours
  }
  const objectiveMs = Math.max(0, rawObjectiveMs - congeCappedMs);
  const remainingMs = Math.max(0, objectiveMs - workedTotal);
  const progress = objectiveMs > 0 ? workedTotal / objectiveMs : null;

  return { workedMs: workedTotal, congeMs: congeTotal, objectiveMs, remainingMs, progress, congeDays: congeDaysAcc, perDay, perProject };
}
