// src/core/fav-presets.js — presets d'un favori : couleur et picto. Logique pure, sans API Chrome ni DOM.
import { FAV_ICONS } from './fav-icons.js';

// Ordre significatif : il pilote la grille de la config ET l'attribution automatique (nextFreeColor).
// Les valeurs vivent en CSS (--fav-<clé>, un jeu par thème) : on ne stocke que la clé.
export const FAV_COLORS = [
  'cyan', 'orange', 'green', 'amber', 'red', 'purple', 'pink', 'teal', 'lime', 'slate',
];

// Libellés FR, pour les lecteurs d'écran et les infobulles : la clé stockée ('slate', 'teal'…)
// n'est pas du français et n'a pas à être lue à l'utilisateur.
export const FAV_COLOR_LABELS = {
  cyan: 'Cyan', orange: 'Orange', green: 'Vert', amber: 'Ambre', red: 'Rouge',
  purple: 'Violet', pink: 'Rose', teal: 'Turquoise', lime: 'Citron vert', slate: 'Ardoise',
};

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
    // hasOwn et pas `in` : sinon 'toString' passerait pour un picto valide. Le test de type est
    // nécessaire car hasOwn coerce sa clé : sans lui, ['code'] ressortirait tel quel — un tableau
    // là où le contrat promet une clé. (includes ci-dessus est immunisé : SameValueZero, sans coercition.)
    icon: typeof f.icon === 'string' && Object.hasOwn(FAV_ICONS, f.icon) ? f.icon : NO_ICON,
  };
}

export function nextFreeColor(favorites) {
  // La couleur *affichée* et non la couleur brute : un favori d'avant la v5.3.0 n'a pas de
  // champ `color` mais s'affiche en orange — sans ça, orange ne serait jamais réservé et le
  // prochain favori créé serait un sosie des anciens.
  const used = new Set((favorites || []).map((f) => normalizeFavorite(f).color));
  return FAV_COLORS.find((c) => !used.has(c)) || FAV_COLORS[0];
}
