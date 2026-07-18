// src/core/schedule.js — modèle du planning hebdomadaire (logique pure, sans API Chrome ni DOM).

import { startOfDay } from './time.js';

// getDay() : 0=dimanche … 6=samedi → clé du planning.
export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Planning par défaut : lun–jeu 09:00–13:00 / 14:00–18:00 (8 h), ven 14:00–17:00 (7 h), sam/dim off → 39 h.
export const DEFAULT_SCHEDULE = {
  mon: { am: ['09:00', '13:00'], pm: ['14:00', '18:00'] },
  tue: { am: ['09:00', '13:00'], pm: ['14:00', '18:00'] },
  wed: { am: ['09:00', '13:00'], pm: ['14:00', '18:00'] },
  thu: { am: ['09:00', '13:00'], pm: ['14:00', '18:00'] },
  fri: { am: ['09:00', '13:00'], pm: ['14:00', '17:00'] },
  sat: { am: null, pm: null },
  sun: { am: null, pm: null },
};

const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const segMs = (seg) => (seg && seg[0] && seg[1]) ? Math.max(0, toMin(seg[1]) - toMin(seg[0])) * 60_000 : 0;
const dayOf = (schedule, date) => (schedule ? schedule[WEEKDAY_KEYS[date.getDay()]] : null);

export function scheduledMsForDate(schedule, date) {
  const day = dayOf(schedule, date);
  if (!day) return 0;
  return segMs(day.am) + segMs(day.pm);
}

export function hasAnySchedule(schedule) {
  if (!schedule) return false;
  return Object.values(schedule).some((d) => d && (segMs(d.am) > 0 || segMs(d.pm) > 0));
}

export function weeklyTotalHours(schedule) {
  if (!schedule) return 0;
  let ms = 0;
  for (const d of Object.values(schedule)) { if (d) ms += segMs(d.am) + segMs(d.pm); }
  return ms / 3600_000;
}

const pad2 = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const atTime = (date, hhmm) => { const [h, m] = hhmm.split(':').map(Number); return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0); };

// seg ∈ {'am','pm'} → { start, end } (Date) sur `date`, ou null si le créneau n'existe pas ce jour-là.
export function segmentSpan(schedule, date, seg) {
  const day = schedule ? schedule[WEEKDAY_KEYS[date.getDay()]] : null;
  const rng = day && day[seg];
  if (!rng || !rng[0] || !rng[1]) return null;
  return { start: atTime(date, rng[0]), end: atTime(date, rng[1]) };
}

const HALF_SEGS = { matin: ['am'], aprem: ['pm'], journee: ['am', 'pm'], none: [] };

// Un créneau { start, end } par demi-journée retenue sur [fromDate..toDate].
// half ∈ {'matin','aprem','journee'} ; overrides : { 'YYYY-MM-DD': 'matin'|'aprem'|'journee'|'none' }.
export function generateLeaveSpans(schedule, { fromDate, fromHalf = 'journee', toDate, toHalf = 'journee', overrides = {} }) {
  const spans = [];
  if (!fromDate) return spans;
  const from = startOfDay(fromDate);
  const to = startOfDay(toDate || fromDate);
  if (to.getTime() < from.getTime()) return spans;
  const single = from.getTime() === to.getTime();
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    const key = dateKey(cursor);
    let type;
    if (key in overrides) type = overrides[key];
    else if (single || cursor.getTime() === from.getTime()) type = fromHalf;
    else if (cursor.getTime() === to.getTime()) type = toHalf;
    else type = 'journee';
    for (const seg of (HALF_SEGS[type] || [])) {
      const sp = segmentSpan(schedule, cursor, seg);
      if (sp) spans.push(sp);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return spans;
}

// Somme des créneaux en JOURS (heures réelles / cible du jour, plafonné à 1/jour) — pour le récap.
export function leaveDays(schedule, spans) {
  const byDay = new Map();
  for (const s of spans) {
    const k = startOfDay(s.start).getTime();
    byDay.set(k, (byDay.get(k) || 0) + (s.end.getTime() - s.start.getTime()));
  }
  let days = 0;
  for (const [k, ms] of byDay) {
    const target = scheduledMsForDate(schedule, new Date(k));
    if (target > 0) days += Math.min(ms, target) / target;
  }
  return days;
}
