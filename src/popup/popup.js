// src/popup/popup.js
import { getConfig } from '../core/storage.js';
import { applyStoredTheme, toggleTheme } from '../theme.js';
import { initTimer } from './timer.js';

const $ = (id) => document.getElementById(id);

async function main() {
  const config = await getConfig();
  if (!config || !config.notionToken || !config.timeDb?.id || !config.tasksDb?.id) {
    window.location = '../config/config.html';
    return;
  }

  await applyStoredTheme();
  $('theme-toggle').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '🌙' : '☀️';
  $('theme-toggle').addEventListener('click', async () => {
    const t = await toggleTheme();
    $('theme-toggle').textContent = t === 'dark' ? '🌙' : '☀️';
  });
  $('btn-config').addEventListener('click', () => { window.location = '../config/config.html'; });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      $('tab-timer').hidden = tab.dataset.tab !== 'timer';
      $('tab-stats').hidden = tab.dataset.tab !== 'stats';
    });
  });

  await initTimer(config);
}

main();
