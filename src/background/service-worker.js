// src/background/service-worker.js — badge + notifications via chrome.alarms (MV3-safe).
import { getConfig, getCurrentSession } from '../core/storage.js';
import { queryAll } from '../core/notion-api.js';
import { sessionFromPage } from '../core/mapping.js';
import { startOfDay, toNotionDate, workedMs } from '../core/time.js';

const LONG_TIMER_H = 3, END_H = 17, END_M = 45, DAILY_GOAL_H = 8;
const flags = { lastLongTimerNotif: 0, endOfDayNotified: false, dailyGoalNotified: false, dayStamp: '' };

function setBadge(state) {
  const map = { running: { text: '🟢', color: '#22c55e' }, paused: { text: '⏸️', color: '#f59e0b' }, idle: { text: '', color: '#000000' } };
  const b = map[state] || map.idle;
  chrome.action.setBadgeText({ text: b.text });
  if (b.text) chrome.action.setBadgeBackgroundColor({ color: b.color });
}

async function refreshBadgeFromStorage() {
  const s = await getCurrentSession();
  setBadge(!s ? 'idle' : (s.isPaused ? 'paused' : 'running'));
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'sessionStarted' || msg.action === 'sessionResumed') setBadge('running');
  else if (msg.action === 'sessionPaused') setBadge('paused');
  else if (msg.action === 'sessionStopped') setBadge('idle');
});

chrome.runtime.onStartup.addListener(refreshBadgeFromStorage);
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('tick', { periodInMinutes: 1 });
  refreshBadgeFromStorage();
});

function resetDailyFlagsIfNeeded() {
  const stamp = new Date().toDateString();
  if (flags.dayStamp !== stamp) { flags.dayStamp = stamp; flags.endOfDayNotified = false; flags.dailyGoalNotified = false; }
}

function notify(id, title, message, buttons) {
  chrome.notifications.create(id, {
    type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title, message, ...(buttons ? { buttons } : {}),
  });
}

async function getTodayTotalMs() {
  const config = await getConfig();
  if (!config?.timeDb?.id) return 0;
  const f = config.timeDb.fields;
  const filter = { property: f.startDate, date: { on_or_after: toNotionDate(startOfDay(new Date())) } };
  const pages = await queryAll(config.notionToken, config.timeDb.id, { filter });
  return pages.map((p) => sessionFromPage(p, f))
    .filter((s) => s.startTime && s.endTime)
    .reduce((a, s) => a + workedMs(s.startTime, s.endTime, (s.pauseMin || 0) * 60_000), 0);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'tick') return;
  resetDailyFlagsIfNeeded();
  const s = await getCurrentSession();
  setBadge(!s ? 'idle' : (s.isPaused ? 'paused' : 'running'));

  const now = new Date();
  if (s && !s.isPaused) {
    const elapsedH = workedMs(s.startTime, Date.now(), s.totalPauseDuration) / 3600_000;
    if (elapsedH >= LONG_TIMER_H && Date.now() - flags.lastLongTimerNotif >= LONG_TIMER_H * 3600_000) {
      flags.lastLongTimerNotif = Date.now();
      notify('long-timer', '⏰ Timer en cours depuis longtemps', `Vous travaillez sur « ${s.taskName} » depuis ${Math.floor(elapsedH)} h.`);
    }
    if (!flags.endOfDayNotified && now.getHours() === END_H && now.getMinutes() >= END_M) {
      flags.endOfDayNotified = true;
      notify('end-of-day', '🏁 Fin de journée — Timer actif', `Timer sur « ${s.taskName} ». N'oubliez pas d'arrêter !`,
        [{ title: 'Arrêter maintenant' }, { title: 'Continuer' }]);
    }
  }
  if (!flags.dailyGoalNotified) {
    const totalH = (await getTodayTotalMs()) / 3600_000;
    if (totalH >= DAILY_GOAL_H) {
      flags.dailyGoalNotified = true;
      notify('daily-goal', '🎯 Objectif quotidien atteint !', `Vous avez travaillé ${totalH.toFixed(1)} h aujourd'hui. Bravo ! 🎉`);
    }
  }
});

chrome.notifications.onButtonClicked.addListener((id, idx) => {
  if (id === 'end-of-day' && idx === 0) chrome.action.openPopup?.();
  chrome.notifications.clear(id);
});
chrome.notifications.onClicked.addListener((id) => { chrome.action.openPopup?.(); chrome.notifications.clear(id); });
