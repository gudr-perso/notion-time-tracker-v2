// test/schema-injection.test.js
import { describe, it, expect } from 'vitest';
import { planInjection, FIELD_SPECS_TIME, FIELD_SPECS_TASKS } from '../src/core/schema-injection.js';

const targets = { tasksDbId: 'TASKS_DB', projetsDbId: 'PROJ_DB' };

describe('planInjection — base Temps', () => {
  it('planifie tous les champs manquants sur une base vide (titre seul)', () => {
    const schema = [{ name: 'Nom', type: 'title' }];
    const plan = planInjection(FIELD_SPECS_TIME, schema, targets);
    const names = plan.toCreate.map((c) => c.name);
    expect(names).toEqual([
      'Début session', 'Fin session', '#TaskId', 'Pause (min)',
      'Commentaire', 'TaskUrl', 'Tâches', '🎯 Projets',
    ]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.skippedNoTarget).toEqual([]);
  });

  it('ne recrée jamais le titre natif', () => {
    const plan = planInjection(FIELD_SPECS_TIME, [{ name: 'Nom', type: 'title' }], targets);
    expect(plan.toCreate.some((c) => c.type === 'title')).toBe(false);
  });

  it('additif strict : un champ de même nom est ignoré, jamais recréé', () => {
    const schema = [{ name: 'Nom', type: 'title' }, { name: 'Commentaire', type: 'rich_text' }];
    const plan = planInjection(FIELD_SPECS_TIME, schema, targets);
    expect(plan.toCreate.map((c) => c.name)).not.toContain('Commentaire');
    expect(plan.properties.Commentaire).toBeUndefined();
  });

  it('signale un conflit de type sans le corriger', () => {
    const schema = [{ name: 'TaskUrl', type: 'rich_text' }];
    const plan = planInjection(FIELD_SPECS_TIME, schema, targets);
    expect(plan.conflicts).toContainEqual({ name: 'TaskUrl', expectedType: 'url', actualType: 'rich_text' });
    expect(plan.properties.TaskUrl).toBeUndefined();
  });

  it('crée les relations en dual_property avec la bonne cible', () => {
    const plan = planInjection(FIELD_SPECS_TIME, [], targets);
    expect(plan.properties['Tâches']).toEqual({
      relation: { database_id: 'TASKS_DB', type: 'dual_property', dual_property: {} },
    });
    expect(plan.properties['🎯 Projets']).toEqual({
      relation: { database_id: 'PROJ_DB', type: 'dual_property', dual_property: {} },
    });
  });

  it('saute la relation Projets si aucune base Projets', () => {
    const plan = planInjection(FIELD_SPECS_TIME, [], { tasksDbId: 'TASKS_DB', projetsDbId: null });
    expect(plan.skippedNoTarget).toContainEqual({ key: 'projects', name: '🎯 Projets' });
    expect(plan.properties['🎯 Projets']).toBeUndefined();
    expect(plan.properties['Tâches']).toBeDefined();
  });

  it('idempotence : re-planifier sur le schéma post-injection donne toCreate vide', () => {
    const first = planInjection(FIELD_SPECS_TIME, [{ name: 'Nom', type: 'title' }], targets);
    const post = [{ name: 'Nom', type: 'title' }, ...first.toCreate.map((c) => ({ name: c.name, type: c.type }))];
    const second = planInjection(FIELD_SPECS_TIME, post, targets);
    expect(second.toCreate).toEqual([]);
  });
});

describe('planInjection — base Tâches', () => {
  it('planifie les champs Tâches manquants, sans statusFilter ni sortProperty', () => {
    const plan = planInjection(FIELD_SPECS_TASKS, [{ name: 'Nom', type: 'title' }], targets);
    expect(plan.toCreate.map((c) => c.name)).toEqual([
      'Projet_texte', '#TaskId', 'TaskUrl', '🎯 Projets',
    ]);
  });

  it('les specs Tâches ne contiennent ni statusFilter ni sortProperty', () => {
    const keys = FIELD_SPECS_TASKS.map((s) => s.key);
    expect(keys).not.toContain('statusFilter');
    expect(keys).not.toContain('sortProperty');
  });
});
