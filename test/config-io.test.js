// test/config-io.test.js
import { describe, it, expect } from 'vitest';
import { FORMAT, FORMAT_VERSION, buildExport, exportFileName } from '../src/core/config-io.js';

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
