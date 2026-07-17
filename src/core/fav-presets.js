// src/core/fav-presets.js — presets d'un favori : couleur et picto. Logique pure, sans API Chrome ni DOM.
import { FAV_ICONS } from './fav-icons.js';

// Ordre significatif : il pilote la grille de la config ET l'attribution automatique (nextFreeColor).
// Les valeurs vivent en CSS (--fav-<clé>, un jeu par thème) : on ne stocke que la clé.
export const FAV_COLORS = [
  'cyan', 'orange', 'green', 'amber', 'red', 'purple', 'pink', 'teal', 'lime', 'slate',
];

// Défaut des favoris créés avant la v5.3.0 : reproduit leur apparence orange d'origine.
export const DEFAULT_FAV_COLOR = 'orange';
export const NO_ICON = 'none';

// Applique les défauts à la lecture — c'est ce qui dispense de migrer chrome.storage.
export function normalizeFavorite(fav) {
  const f = fav || {};
  return {
    taskId: f.taskId || '',
    customLabel: f.customLabel || '',
    color: FAV_COLORS.includes(f.color) ? f.color : DEFAULT_FAV_COLOR,
    // hasOwn et pas `in` : sinon 'toString' passerait pour un picto valide.
    icon: Object.hasOwn(FAV_ICONS, f.icon) ? f.icon : NO_ICON,
  };
}

export function nextFreeColor(favorites) {
  const used = new Set((favorites || []).map((f) => f?.color));
  return FAV_COLORS.find((c) => !used.has(c)) || FAV_COLORS[0];
}
