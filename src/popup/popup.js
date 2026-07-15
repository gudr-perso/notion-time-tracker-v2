// src/popup/popup.js
import { getConfig } from '../core/storage.js';
import { applyStoredTheme, toggleTheme } from '../theme.js';
import { initTimer } from './timer.js';

const $ = (id) => document.getElementById(id);

// La config est une page large (max-width 820px) : on l'ouvre dans un onglet
// plein écran, pas dans le popup contraint à 440px, puis on ferme le popup.
function openConfig() {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/config/config.html') });
  window.close();
}

async function main() {
  const config = await getConfig();
  if (!config || !config.notionToken || !config.timeDb?.id || !config.tasksDb?.id) {
    openConfig();
    return;
  }

  await applyStoredTheme();
  $('theme-toggle').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '🌙' : '☀️';
  $('theme-toggle').addEventListener('click', async () => {
    const t = await toggleTheme();
    $('theme-toggle').textContent = t === 'dark' ? '🌙' : '☀️';
  });
  $('btn-config').addEventListener('click', openConfig);

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
