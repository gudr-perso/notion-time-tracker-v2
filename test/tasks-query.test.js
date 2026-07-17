// test/tasks-query.test.js
import { describe, it, expect } from 'vitest';
import { buildStatusFilter, readExcludeValues } from '../src/core/tasks-query.js';

describe('buildStatusFilter', () => {
  it('sans propriété mappée : pas de filtre', () => {
    expect(buildStatusFilter(null)).toBeUndefined();
    expect(buildStatusFilter({ excludeValues: ['Terminé'] })).toBeUndefined();
  });

  it('propriété mappée mais aucune valeur à exclure : pas de filtre', () => {
    expect(buildStatusFilter({ property: 'Statut', type: 'status', excludeValues: [] })).toBeUndefined();
  });

  it('une seule valeur, type status : does_not_equal simple', () => {
    expect(buildStatusFilter({ property: 'Statut', type: 'status', excludeValues: ['Terminé'] }))
      .toEqual({ property: 'Statut', status: { does_not_equal: 'Terminé' } });
  });

  it('type select : la clé devient select', () => {
    expect(buildStatusFilter({ property: 'État', type: 'select', excludeValues: ['Clos'] }))
      .toEqual({ property: 'État', select: { does_not_equal: 'Clos' } });
  });

  it('plusieurs valeurs : un ET de does_not_equal', () => {
    expect(buildStatusFilter({ property: 'Statut', type: 'status', excludeValues: ['Terminé', 'Clos'] }))
      .toEqual({
        and: [
          { property: 'Statut', status: { does_not_equal: 'Terminé' } },
          { property: 'Statut', status: { does_not_equal: 'Clos' } },
        ],
      });
  });

  it('conserve un nom de statut contenant une virgule ou un point-virgule', () => {
    // Le cœur de la correction : aucun séparateur, la valeur exacte passe telle quelle.
    expect(buildStatusFilter({ property: 'Statut', type: 'status', excludeValues: ['Fini, archivé; validé'] }))
      .toEqual({ property: 'Statut', status: { does_not_equal: 'Fini, archivé; validé' } });
  });

  it('ignore les valeurs vides ou en espaces', () => {
    expect(buildStatusFilter({ property: 'Statut', type: 'status', excludeValues: ['Terminé', '', '   '] }))
      .toEqual({ property: 'Statut', status: { does_not_equal: 'Terminé' } });
  });

  it('rétro-compat : ancien champ chaîne excludeValue séparé par ;', () => {
    expect(buildStatusFilter({ property: 'Statut', type: 'status', excludeValue: 'termine;clos' }))
      .toEqual({
        and: [
          { property: 'Statut', status: { does_not_equal: 'termine' } },
          { property: 'Statut', status: { does_not_equal: 'clos' } },
        ],
      });
  });

  it('excludeValues (tableau) prime sur l’ancien excludeValue (chaîne) si les deux sont présents', () => {
    expect(buildStatusFilter({ property: 'Statut', type: 'status', excludeValues: ['Terminé'], excludeValue: 'clos' }))
      .toEqual({ property: 'Statut', status: { does_not_equal: 'Terminé' } });
  });
});

describe('readExcludeValues', () => {
  it('objet absent ou vide : tableau vide', () => {
    expect(readExcludeValues(null)).toEqual([]);
    expect(readExcludeValues({})).toEqual([]);
  });

  it('lit le tableau excludeValues en priorité', () => {
    expect(readExcludeValues({ excludeValues: ['Terminé', 'Clos'] })).toEqual(['Terminé', 'Clos']);
  });

  it('rétro-compat : découpe l’ancienne chaîne excludeValue sur ;', () => {
    expect(readExcludeValues({ excludeValue: 'termine;clos' })).toEqual(['termine', 'clos']);
  });

  it('taille et élague les valeurs vides', () => {
    expect(readExcludeValues({ excludeValues: [' Terminé ', '', '  '] })).toEqual(['Terminé']);
  });
});
