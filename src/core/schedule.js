// src/core/schedule.js — modèle du planning hebdomadaire (logique pure, sans API Chrome ni DOM).

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
