// test/fav-presets.test.js
import { describe, it, expect } from 'vitest';
import { FAV_ICONS } from '../src/core/fav-icons.js';
import {
  FAV_COLORS, FAV_COLOR_LABELS, DEFAULT_FAV_COLOR, NO_ICON, normalizeFavorite, nextFreeColor,
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
  it('compte 10 couleurs dont l’ordre et les clés font contrat', () => {
    // Clé persistée dans chrome.storage et liée au CSS --fav-<clé> : la renommer ferait perdre
    // sa couleur à chaque favori concerné. L'ordre pilote la grille de config et nextFreeColor.
    expect(FAV_COLORS).toEqual([
      'cyan', 'orange', 'green', 'amber', 'red', 'purple', 'pink', 'teal', 'lime', 'slate',
    ]);
  });

  it('contient la couleur par défaut des favoris historiques', () => {
    expect(FAV_COLORS).toContain(DEFAULT_FAV_COLOR);
  });

  it('a un libellé FR pour chaque couleur, sans doublon', () => {
    // Une clé sans libellé ferait annoncer « slate » par le lecteur d'écran d'une page en français.
    for (const c of FAV_COLORS) expect(FAV_COLOR_LABELS[c], c).toBeTruthy();
    expect(Object.keys(FAV_COLOR_LABELS)).toHaveLength(FAV_COLORS.length);
    expect(new Set(Object.values(FAV_COLOR_LABELS)).size).toBe(FAV_COLORS.length);
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

  it('remplace un picto qui n’est pas une chaîne par « aucun »', () => {
    // Object.hasOwn coercerait ['code'] en 'code' : sans test de type, un storage bricolé à la
    // main ressortirait tel quel et casserait le contrat « icon est une clé valide ».
    expect(normalizeFavorite({ icon: ['code'] }).icon).toBe('none');
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

  it('réserve la couleur affichée : un favori d’avant la v5.3.0 occupe orange', () => {
    // Sans champ `color`, ce favori s'affiche pourtant en orange (cf. normalizeFavorite). Cyan
    // étant déjà pris, orange serait le prochain candidat de la palette : il doit être sauté,
    // sinon le nouveau favori serait le sosie de l'ancien.
    const favs = [{ taskId: 'a' }, { taskId: 'b', color: 'cyan' }];
    expect(nextFreeColor(favs)).toBe('green');
  });

  it('réserve la couleur affichée : une couleur invalide occupe le défaut', () => {
    // Même raisonnement : 'chartreuse' n'existe pas dans la palette, ce favori s'affiche en orange.
    const favs = [{ taskId: 'a', color: 'chartreuse' }, { taskId: 'b', color: 'cyan' }];
    expect(nextFreeColor(favs)).toBe('green');
  });
});
