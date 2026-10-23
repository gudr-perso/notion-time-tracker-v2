// test/changelog.test.js — invariants du contenu de src/core/changelog.js et de ses deux fonctions.
// Le test « tête = version du manifeste » est le garde-fou de release : il rougit si une version est
// bumpée sans que l'entrée utilisateur ait été écrite.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { CHANGELOG, MAX_ENTREES, dixDernieres, estNouvelleVersion } from '../src/core/changelog.js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(RACINE, 'manifest.json'), 'utf8'));
const versions = readFileSync(path.join(RACINE, 'docs/VERSIONS.md'), 'utf8');

const enNombres = (version) => version.split('.').map(Number);

// a strictement après b, au sens sémantique (5.10.0 après 5.9.0, ce qu'une comparaison de chaînes
// rendrait faux).
function strictementApres(a, b) {
  const [ga, ma, pa] = enNombres(a);
  const [gb, mb, pb] = enNombres(b);
  if (ga !== gb) return ga > gb;
  if (ma !== mb) return ma > mb;
  return pa > pb;
}

describe('CHANGELOG', () => {
  it('n’est pas vide', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
  });

  it('est trié du plus récent au plus ancien, sans doublon', () => {
    for (let i = 1; i < CHANGELOG.length; i += 1) {
      expect(strictementApres(CHANGELOG[i - 1].version, CHANGELOG[i].version)).toBe(true);
    }
  });

  it('ne descend pas sous la 5.0.0 : la v1 est un autre dépôt', () => {
    for (const entree of CHANGELOG) {
      expect(strictementApres(entree.version, '4.999.999')).toBe(true);
    }
  });

  it('chaque entrée porte une version, un résumé et une date ISO', () => {
    for (const entree of CHANGELOG) {
      expect(entree.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(entree.resume.length).toBeGreaterThan(0);
      expect(entree.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('chaque puce des trois groupes porte un texte, et au moins un groupe est rempli', () => {
    for (const entree of CHANGELOG) {
      const groupes = [entree.ajoute, entree.modifie, entree.corrige];
      for (const groupe of groupes) {
        expect(Array.isArray(groupe)).toBe(true);
        for (const puce of groupe) expect(puce.texte.length).toBeGreaterThan(0);
      }
      expect(groupes.flat().length).toBeGreaterThan(0);
    }
  });

  it('ne cite aucun chemin de fichier : c’est du texte pour l’utilisateur final', () => {
    for (const entree of CHANGELOG) {
      const tout = [entree.resume, ...[entree.ajoute, entree.modifie, entree.corrige]
        .flat().map((puce) => `${puce.titre ?? ''} ${puce.texte}`)].join(' ');
      expect(tout).not.toMatch(/src\/|\.js\b|docs\//);
    }
  });

  it('a pour tête la version du manifeste (garde-fou de release)', () => {
    expect(CHANGELOG[0].version).toBe(manifest.version);
  });

  it('donne à chaque entrée la date de sa section dans VERSIONS.md', () => {
    for (const entree of CHANGELOG) {
      expect(versions).toContain(`## [${entree.version}] — ${entree.date}`);
    }
  });
});

describe('strictementApres', () => {
  it('compare au sens sémantique, pas lexical (5.10.0 après 5.9.0)', () => {
    expect(strictementApres('5.10.0', '5.9.0')).toBe(true);
    expect(strictementApres('5.9.0', '5.10.0')).toBe(false);
  });
});

describe('dixDernieres', () => {
  it('MAX_ENTREES vaut dix', () => {
    expect(MAX_ENTREES).toBe(10);
  });

  it('tronque à MAX_ENTREES', () => {
    const douze = Array.from({ length: 12 }, (_, i) => ({ version: `9.0.${i}` }));
    expect(dixDernieres(douze)).toHaveLength(10);
    expect(dixDernieres(douze)[9].version).toBe('9.0.9');
  });

  it('rend la liste entière quand elle est plus courte', () => {
    expect(dixDernieres([{ version: '9.0.0' }])).toHaveLength(1);
  });

  it('rend un tableau vide sur une entrée qui n’en est pas une', () => {
    expect(dixDernieres(null)).toEqual([]);
    expect(dixDernieres('5.0.0')).toEqual([]);
  });

  it('sans argument, prend le CHANGELOG du module', () => {
    expect(dixDernieres()[0].version).toBe(CHANGELOG[0].version);
  });
});

describe('estNouvelleVersion', () => {
  it('est vraie quand la version lue diffère de l’installée', () => {
    expect(estNouvelleVersion('5.7.7', '5.8.0')).toBe(true);
  });

  it('est vraie au premier lancement, quand rien n’a été lu', () => {
    expect(estNouvelleVersion('', '5.8.0')).toBe(true);
  });

  it('est fausse quand l’installée a déjà été lue', () => {
    expect(estNouvelleVersion('5.8.0', '5.8.0')).toBe(false);
  });

  it('est fausse quand on ne sait pas nommer la version installée', () => {
    expect(estNouvelleVersion('5.7.7', '')).toBe(false);
    expect(estNouvelleVersion('5.7.7', undefined)).toBe(false);
  });
});
