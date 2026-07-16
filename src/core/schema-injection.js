// src/core/schema-injection.js — logique pure de planification d'injection de propriétés Notion.
// Aucune API Chrome, aucun fetch → testable comme le reste de core/.

const dateProp = () => ({ date: {} });
const numberProp = () => ({ number: { format: 'number' } });
const richTextProp = () => ({ rich_text: {} });
const urlProp = () => ({ url: {} });
const relationProp = (databaseId) => ({
  relation: { database_id: databaseId, type: 'dual_property', dual_property: {} },
});

// Champs injectables — base Temps. Le titre natif (title) n'est jamais injecté.
export const FIELD_SPECS_TIME = [
  { key: 'startDate', name: 'Début session', type: 'date', build: dateProp },
  { key: 'endDate', name: 'Fin session', type: 'date', build: dateProp },
  { key: 'taskId', name: '#TaskId', type: 'rich_text', build: richTextProp },
  { key: 'pause', name: 'Pause (min)', type: 'number', build: numberProp },
  { key: 'comment', name: 'Commentaire', type: 'rich_text', build: richTextProp },
  { key: 'externalUrl', name: 'TaskUrl', type: 'url', build: urlProp },
  { key: 'tasksRelation', name: 'Tâches', type: 'relation', targetKey: 'tasksDbId' },
  { key: 'projects', name: '🎯 Projets', type: 'relation', targetKey: 'projetsDbId' },
];

// Champs injectables — base Tâches. Ni statusFilter (type status non créable via API)
// ni sortProperty (pointeur vers une propriété existante).
export const FIELD_SPECS_TASKS = [
  { key: 'project', name: 'Projet_texte', type: 'rich_text', build: richTextProp },
  { key: 'externalId', name: '#TaskId', type: 'rich_text', build: richTextProp },
  { key: 'externalUrl', name: 'TaskUrl', type: 'url', build: urlProp },
  { key: 'projectsRel', name: '🎯 Projets', type: 'relation', targetKey: 'projetsDbId' },
];

// planInjection : décide quoi créer sans jamais modifier l'existant.
// currentSchema = [{ name, type }] ; targets = { tasksDbId, projetsDbId }.
export function planInjection(specs, currentSchema, targets = {}) {
  const byName = new Map((currentSchema || []).map((p) => [p.name.toLowerCase(), p]));
  const toCreate = [];
  const conflicts = [];
  const skippedNoTarget = [];
  const properties = {};

  for (const spec of specs) {
    const existing = byName.get(spec.name.toLowerCase());
    if (existing) {
      if (existing.type !== spec.type) {
        conflicts.push({ name: spec.name, expectedType: spec.type, actualType: existing.type });
      }
      continue; // additif strict : jamais de rename / retype / delete
    }
    if (spec.targetKey) {
      const targetId = targets[spec.targetKey];
      if (!targetId) { skippedNoTarget.push({ key: spec.key, name: spec.name }); continue; }
      properties[spec.name] = relationProp(targetId);
    } else {
      properties[spec.name] = spec.build();
    }
    toCreate.push({ key: spec.key, name: spec.name, type: spec.type });
  }

  return { toCreate, conflicts, skippedNoTarget, properties };
}
