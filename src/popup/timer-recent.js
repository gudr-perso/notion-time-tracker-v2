// src/popup/timer-recent.js — bloc « Sessions récentes » (Aujourd'hui / Hier).
import { queryAll } from '../core/notion-api.js';
import { sessionFromPage } from '../core/mapping.js';
import { startOfDay, formatClock, formatDuration, toNotionDate, workedMs } from '../core/time.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let T = null;

function sessionDurationMs(s) {
  if (!s.startTime || !s.endTime) return 0;
  return workedMs(s.startTime, s.endTime, (s.pauseMin || 0) * 60_000);
}

export async function reloadRecent() {
  const startYesterday = new Date(startOfDay(new Date()).getTime() - 24 * 3600_000);
  const filter = { property: T.timeFields.startDate, date: { on_or_after: toNotionDate(startYesterday) } };
  const sorts = [{ property: T.timeFields.startDate, direction: 'descending' }];
  const pages = await queryAll(T.token, T.config.timeDb.id, { filter, sorts });
  const sessions = pages.map((p) => sessionFromPage(p, T.timeFields)).filter((s) => s.startTime && s.endTime);

  const today0 = startOfDay(new Date()).getTime();
  const groups = { today: [], yesterday: [] };
  for (const s of sessions) {
    const t = new Date(s.startTime).getTime();
    if (t >= today0) groups.today.push(s); else groups.yesterday.push(s);
  }

  const render = (label, list) => {
    if (!list.length) return '';
    const total = list.reduce((a, s) => a + sessionDurationMs(s), 0);
    const head = `<div class="day-head"><span>📅 ${label}</span><span class="day-total">${formatDuration(total)}</span></div>`;
    const rows = list.map((s) => {
      const dur = formatDuration(sessionDurationMs(s));
      const range = `${formatClock(s.startTime)} → ${formatClock(s.endTime)}`;
      const name = s.name.length > 70 ? s.name.slice(0, 70) + '…' : s.name;
      return `<div class="sess"><div><div>${esc(name)}</div><div class="muted">${range}</div></div><span class="dur">${dur}</span></div>`;
    }).join('');
    return head + rows;
  };
  $('recent-sessions').innerHTML = render("Aujourd'hui", groups.today) + render('Hier', groups.yesterday);
}

export function wireRecent(sharedT, helpers) {
  T = sharedT;
  helpers.reloadRecent = reloadRecent;
}
