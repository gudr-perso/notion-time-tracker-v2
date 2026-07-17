// src/popup/popup.js
import { getConfig } from '../core/storage.js';
import { applyStoredTheme, toggleTheme } from '../theme.js';
import { initTimer } from './timer.js';
import { initStats, invalidateStats } from './stats.js';

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
      if (tab.dataset.tab === 'stats') { invalidateStats(); initStats(config); }
    });
  });

  try {
    await initTimer(config);
  } catch (e) {
    // Sans ce filet, une erreur Notion (token révoqué, base départagée, propriété de filtre
    // renommée…) devenait une unhandled rejection : liste vide et popup muet. On affiche le
    // message brut de Notion, qui dit précisément ce qui cloche.
    const box = $('load-error');
    box.innerHTML = '';
    const title = document.createElement('b');
    title.textContent = 'Impossible de charger les tâches';
    const msg = document.createElement('span');
    msg.textContent = e?.message || String(e);
    box.append(title, msg);
    box.hidden = false;
  }
}

main();
