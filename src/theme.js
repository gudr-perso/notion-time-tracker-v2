// src/theme.js — applique et bascule le thème. Le thème est stocké dans config.theme.
import { getConfig, saveConfig } from './core/storage.js';

export async function applyStoredTheme() {
  const config = await getConfig();
  const theme = (config && config.theme) || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}

export async function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  const config = (await getConfig()) || {};
  config.theme = next;
  await saveConfig(config);
  return next;
}
