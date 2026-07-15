// src/core/time.js — logique temporelle pure (aucune API Chrome)

const pad = (n) => String(n).padStart(2, '0');

export function formatDuration(ms, { withSeconds = true } = {}) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
}

export function roundToNearestFiveMinutes(date) {
  const d = new Date(date);
  const ms = 5 * 60_000;
  return new Date(Math.round(d.getTime() / ms) * ms);
}

// ISO 8601 AVEC offset local (ex. 2026-07-09T09:00:00+02:00). Jamais 'Z'.
export function toNotionDate(date) {
  const d = new Date(date);
  const off = -d.getTimezoneOffset(); // minutes, positif à l'est de UTC
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${oh}:${om}`;
}

export function workedMs(startTime, end, totalPauseDuration = 0) {
  const start = new Date(startTime).getTime();
  const stop = new Date(end).getTime();
  return Math.max(0, stop - start - totalPauseDuration);
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Labels FR (Intl) — utilisés par l'UI, non testés strictement (dépendants ICU).
export function formatClock(date) {
  const d = new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatStartedLabel(date) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTimeLocalValue(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
