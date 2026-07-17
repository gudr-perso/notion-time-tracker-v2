// test/config-io.test.js
import { describe, it, expect } from 'vitest';
import { FORMAT, FORMAT_VERSION, buildExport, exportFileName, parseImport } from '../src/core/config-io.js';

const sampleConfig = () => ({
  notionToken: 'secret_ABC123',
  timeDb: { id: 'time-1', name: 'Temps', fields: { taskName: 'Nom' } },
  tasksDb: { id: 'tasks-1', name: 'Tâches', fields: { title: 'Nom' } },
  projetsDb: { id: 'proj-1', name: 'Projets' },
  prefs: { requireComment: true, weeklyHours: 39, favorites: [{ taskId: 't1', color: 'cyan', icon: 'code' }] },
  theme: 'dark',
});

describe('buildExport', () => {
  it('ne laisse jamais fuiter le token (clé absente, pas null)', () => {
    const out = buildExport(sampleConfig(), '5.4.0');
    expect('notionToken' in out.config).toBe(false);
    expect(JSON.stringify(out)).not.toContain('secret_ABC123');
  });

  it('ne mute pas la config d’entrée', () => {
    const cfg = sampleConfig();
    buildExport(cfg, '5.4.0');
    expect(cfg.notionToken).toBe('secret_ABC123');
  });

  it('pose l’enveloppe : format, formatVersion, appVersion, config', () => {
    const out = buildExport(sampleConfig(), '5.4.0');
    expect(out.format).toBe(FORMAT);
    expect(out.formatVersion).toBe(FORMAT_VERSION);
    expect(out.appVersion).toBe('5.4.0');
    expect(out.config.timeDb.id).toBe('time-1');
    expect(out.config.prefs.favorites[0].taskId).toBe('t1');
  });

  it('émet exportedAt avec offset local, jamais Z', () => {
    const out = buildExport(sampleConfig(), '5.4.0');
    expect(out.exportedAt).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(out.exportedAt.endsWith('Z')).toBe(false);
  });
});

describe('exportFileName', () => {
  it('nomme avec la date LOCALE — 00:30 le 17/07 reste le 17 (toISOString donnerait le 16 à +02:00)', () => {
    // À 00:30 heure locale (France, +02:00), l'instant UTC est le 16/07 22:30.
    // Un exportFileName basé sur toISOString().slice(0,10) renverrait donc « 2026-07-16 » :
    // ce cas verrouille l'usage des getters LOCAUX (getFullYear/getMonth/getDate).
    const d = new Date(2026, 6, 17, 0, 30, 0);
    expect(exportFileName(d)).toBe('notion-timer-config-2026-07-17.json');
  });
});

const validFile = (over = {}) => JSON.stringify({
  format: FORMAT, formatVersion: FORMAT_VERSION, exportedAt: '2026-07-17T10:00:00+02:00',
  appVersion: '5.4.0',
  config: {
    timeDb: { id: 'time-1', name: 'Temps', fields: {} },
    tasksDb: { id: 'tasks-1', name: 'Tâches', fields: {} },
    prefs: { favorites: [] },
    theme: 'dark',
    ...over,
  },
});

describe('parseImport — rejets', () => {
  it('JSON invalide', () => {
    expect(() => parseImport('{pas du json', null)).toThrow(/illisible/i);
  });
  it('format absent ou étranger', () => {
    expect(() => parseImport(JSON.stringify({ hello: 1 }), null)).toThrow(/pas un export/i);
  });
  it('formatVersion plus récent que le connu', () => {
    const f = JSON.stringify({ format: FORMAT, formatVersion: FORMAT_VERSION + 1, config: {} });
    expect(() => parseImport(f, null)).toThrow(/plus récente/i);
  });
  it('timeDb.id manquant', () => {
    expect(() => parseImport(validFile({ timeDb: { id: '', fields: {} } }), null)).toThrow(/incomplet/i);
  });
  it('tasksDb.id manquant', () => {
    expect(() => parseImport(validFile({ tasksDb: { id: '', fields: {} } }), null)).toThrow(/incomplet/i);
  });
});

describe('parseImport — token', () => {
  it('conserve le token du poste courant', () => {
    const out = parseImport(validFile(), { notionToken: 'local_TOK' });
    expect(out.notionToken).toBe('local_TOK');
  });
  it('vaut chaîne vide sur un poste neuf (currentConfig null)', () => {
    const out = parseImport(validFile(), null);
    expect(out.notionToken).toBe('');
  });
  it('ignore un notionToken présent dans le fichier (bricolage manuel)', () => {
    const out = parseImport(validFile({ notionToken: 'from_FILE' }), { notionToken: 'local_TOK' });
    expect(out.notionToken).toBe('local_TOK');
  });
});

describe('parseImport — favoris', () => {
  it('normalise couleur et picto inconnus vers les défauts', () => {
    const out = parseImport(validFile({ prefs: { favorites: [{ taskId: 't1', color: 'chartreuse', icon: 'wat' }] } }), null);
    expect(out.prefs.favorites[0].color).toBe('orange');
    expect(out.prefs.favorites[0].icon).toBe('none');
  });
  it('cape la liste à 8', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ taskId: `t${i}` }));
    const out = parseImport(validFile({ prefs: { favorites: many } }), null);
    expect(out.prefs.favorites).toHaveLength(8);
  });
  it('supporte prefs.favorites absent', () => {
    const out = parseImport(validFile({ prefs: { requireComment: true } }), null);
    expect(out.prefs.favorites).toEqual([]);
  });
});

describe('aller-retour', () => {
  it('buildExport puis parseImport redonne la config, token mis à part', () => {
    const cfg = {
      notionToken: 'secret', timeDb: { id: 'time-1', name: 'T', fields: { taskName: 'Nom' } },
      tasksDb: { id: 'tasks-1', name: 'K', fields: { title: 'Nom' } }, projetsDb: { id: 'p', name: 'P' },
      prefs: { requireComment: true, weeklyHours: 39, favorites: [{ taskId: 't1', customLabel: 'X', color: 'cyan', icon: 'code' }] },
      theme: 'light',
    };
    const text = JSON.stringify(buildExport(cfg, '5.4.0'));
    const out = parseImport(text, { notionToken: 'local' });
    expect(out.timeDb).toEqual(cfg.timeDb);
    expect(out.tasksDb).toEqual(cfg.tasksDb);
    expect(out.projetsDb).toEqual(cfg.projetsDb);
    expect(out.theme).toBe('light');
    expect(out.prefs.favorites[0]).toEqual({ taskId: 't1', customLabel: 'X', color: 'cyan', icon: 'code' });
    expect(out.notionToken).toBe('local');
  });
});
