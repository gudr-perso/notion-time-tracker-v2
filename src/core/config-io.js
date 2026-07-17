// src/core/config-io.js — export/import de la configuration. Pur : ni API Chrome, ni DOM.
import { toNotionDate } from './time.js';

export const FORMAT = 'notion-timer-config';
export const FORMAT_VERSION = 1;

const pad = (n) => String(n).padStart(2, '0');

// Construit l’enveloppe exportée. Le token est RETIRÉ (clé absente, jamais null). Ne mute pas `config`.
// `appVersion` et `now` sont fournis par l’appelant : core/ n’appelle ni chrome.runtime ni l’horloge.
export function buildExport(config, appVersion, now = new Date()) {
  const { notionToken, ...rest } = config || {};
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    exportedAt: toNotionDate(now), // ISO avec offset local, jamais 'Z'
    appVersion: appVersion || '',
    config: rest,
  };
}

// Nom de fichier daté en LOCAL (pas toISOString, qui basculerait de jour le soir).
export function exportFileName(now = new Date()) {
  const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${FORMAT}-${d}.json`;
}
