// src/core/tasks-query.js — construction pure du filtre Notion de la base Tâches.
// Aucune API Chrome ni DOM → testable comme le reste de core/.

// Valeurs de statut à exclure. Source canonique : le tableau `excludeValues` (noms exacts,
// sans séparateur — un nom de statut peut légitimement contenir ',' ou ';'). Repli sur
// l'ancien champ chaîne `excludeValue` séparé par ';' pour les configs d'avant.
export function readExcludeValues(statusFilter) {
  const sf = statusFilter || {};
  const list = Array.isArray(sf.excludeValues)
    ? sf.excludeValues
    : String(sf.excludeValue ?? '').split(';');
  return list.map((v) => String(v).trim()).filter(Boolean);
}

// buildStatusFilter : { property, type, excludeValues[] | excludeValue } → filtre Notion (ou undefined).
export function buildStatusFilter(statusFilter) {
  const sf = statusFilter;
  if (!sf || !sf.property) return undefined;
  const values = readExcludeValues(sf);
  if (!values.length) return undefined;
  const key = sf.type === 'select' ? 'select' : 'status';
  const clause = (v) => ({ property: sf.property, [key]: { does_not_equal: v } });
  return values.length === 1 ? clause(values[0]) : { and: values.map(clause) };
}
