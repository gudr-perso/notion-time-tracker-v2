// src/core/config-io.js — export/import de la configuration. Pur : ni API Chrome, ni DOM.
import { toNotionDate } from './time.js';
import { normalizeFavorite } from './fav-presets.js';

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

// Valide un fichier importé et renvoie la config prête à écrire. Lève une Error au message clair
// (affiché tel quel dans la zone .status err de la page). Le token n’est JAMAIS lu du fichier :
// on garde celui du poste (currentConfig), ou '' sur un poste neuf.
export function parseImport(text, currentConfig) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fichier illisible — ce n’est pas un JSON valide.');
  }
  if (!data || data.format !== FORMAT) {
    throw new Error('Ce fichier n’est pas un export Notion Time Tracker.');
  }
  if (Number(data.formatVersion) > FORMAT_VERSION) {
    throw new Error('Ce fichier vient d’une version plus récente de l’extension. Mets l’extension à jour.');
  }
  const c = data.config || {};
  if (!c.timeDb?.id || !c.tasksDb?.id) {
    throw new Error('Fichier incomplet — la base Temps ou Tâches est manquante.');
  }
  const favorites = Array.isArray(c.prefs?.favorites)
    ? c.prefs.favorites.filter((f) => f && f.taskId).slice(0, 8).map(normalizeFavorite)
    : [];
  return {
    ...c,
    // Après ...c : écrase tout notionToken qui traînerait dans le fichier importé. Ne jamais remonter cette ligne.
    notionToken: currentConfig?.notionToken || '',
    prefs: { ...(c.prefs || {}), favorites },
  };
}
