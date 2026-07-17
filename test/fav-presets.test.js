// test/fav-presets.test.js
import { describe, it, expect } from 'vitest';
import { FAV_ICONS } from '../src/core/fav-icons.js';
import {
  FAV_COLORS, DEFAULT_FAV_COLOR, NO_ICON, normalizeFavorite, nextFreeColor,
} from '../src/core/fav-presets.js';

describe('FAV_ICONS', () => {
  it('expose les 23 pictos, dans un ordre et sous des clés qui font contrat', () => {
    // La clé est persistée dans chrome.storage : la renommer ferait perdre son picto
    // à chaque favori concerné, sans erreur. L'ordre pilote la grille de la config.
    expect(Object.keys(FAV_ICONS)).toEqual([
      'code', 'users', 'headset', 'beach', 'bug', 'file', 'mail', 'phone', 'car', 'coffee',
      'school', 'chart', 'checklist', 'tool', 'cloud', 'search', 'book', 'star', 'building',
      'clock', 'palette', 'laptop', 'message',
    ]);
  });

  it('a des libellés tous distincts — deux cases identiques seraient indiscernables', () => {
    expect(new Set(Object.values(FAV_ICONS).map((i) => i.label)).size).toBe(23);
  });

  it('chaque picto a un label et au moins un tracé exploitable', () => {
    for (const [key, ico] of Object.entries(FAV_ICONS)) {
      expect(ico.label, key).toBeTruthy();
      expect(Array.isArray(ico.paths), key).toBe(true);
      expect(ico.paths.length, key).toBeGreaterThan(0);
      // Un attribut `d` commence toujours par un moveto.
      for (const d of ico.paths) expect(d, key).toMatch(/^[Mm]/);
    }
  });

  it('ne contient pas le cadre transparent de Tabler', () => {
    // Chaque source Tabler ouvre sur <path d="M0 0h24v24H0z" fill="none"/> : inutile ici.
    for (const [key, ico] of Object.entries(FAV_ICONS)) {
      expect(ico.paths, key).not.toContain('M0 0h24v24H0z');
    }
  });

  it('« none » n’est pas un picto — c’est une absence de picto', () => {
    expect(FAV_ICONS.none).toBeUndefined();
  });
});

describe('FAV_COLORS', () => {
  it('compte 10 couleurs, toutes distinctes', () => {
    expect(FAV_COLORS).toHaveLength(10);
    expect(new Set(FAV_COLORS).size).toBe(10);
  });

  it('contient la couleur par défaut des favoris historiques', () => {
    expect(FAV_COLORS).toContain(DEFAULT_FAV_COLOR);
  });
});

describe('normalizeFavorite', () => {
  it('applique orange + aucun picto à un favori d’avant la v5.3.0', () => {
    expect(normalizeFavorite({ taskId: 'abc', customLabel: 'Dev' })).toEqual({
      taskId: 'abc', customLabel: 'Dev', color: 'orange', icon: 'none',
    });
  });

  it('conserve une couleur et un picto valides', () => {
    expect(normalizeFavorite({ taskId: 'a', customLabel: 'L', color: 'cyan', icon: 'code' })).toEqual({
      taskId: 'a', customLabel: 'L', color: 'cyan', icon: 'code',
    });
  });

  it('remplace une couleur inconnue par le défaut', () => {
    expect(normalizeFavorite({ color: 'chartreuse' }).color).toBe('orange');
  });

  it('remplace un picto inconnu par « aucun »', () => {
    expect(normalizeFavorite({ icon: 'licorne' }).icon).toBe('none');
  });

  it('ne se laisse pas piéger par une clé héritée d’Object.prototype', () => {
    expect(normalizeFavorite({ icon: 'toString' }).icon).toBe('none');
  });

  it('tolère undefined et rend un favori complet', () => {
    expect(normalizeFavorite(undefined)).toEqual({
      taskId: '', customLabel: '', color: 'orange', icon: 'none',
    });
  });
});

describe('nextFreeColor', () => {
  it('rend la première couleur de la palette sur une liste vide', () => {
    expect(nextFreeColor([])).toBe(FAV_COLORS[0]);
  });

  it('saute les couleurs déjà prises', () => {
    const favs = [{ color: FAV_COLORS[0] }, { color: FAV_COLORS[1] }];
    expect(nextFreeColor(favs)).toBe(FAV_COLORS[2]);
  });

  it('retombe sur la première couleur quand les 10 sont utilisées', () => {
    expect(nextFreeColor(FAV_COLORS.map((color) => ({ color })))).toBe(FAV_COLORS[0]);
  });

  it('tolère undefined', () => {
    expect(nextFreeColor(undefined)).toBe(FAV_COLORS[0]);
  });
});
