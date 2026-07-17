// test/fav-presets.test.js
import { describe, it, expect } from 'vitest';
import { FAV_ICONS } from '../src/core/fav-icons.js';

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
