// test/time.test.js
import { describe, it, expect } from 'vitest';
import { formatDuration, roundToNearestFiveMinutes, toNotionDate, workedMs, startOfDay } from '../src/core/time.js';

describe('formatDuration', () => {
  it('formate HH:MM:SS par défaut', () => {
    expect(formatDuration(3661_000)).toBe('01:01:01');
  });
  it('formate HH:MM sans secondes', () => {
    expect(formatDuration(3661_000, { withSeconds: false })).toBe('01:01');
  });
  it('gère plus de 24 h', () => {
    expect(formatDuration(25 * 3600_000, { withSeconds: false })).toBe('25:00');
  });
  it('plancher à 0', () => {
    expect(formatDuration(-5000)).toBe('00:00:00');
  });
});

describe('roundToNearestFiveMinutes', () => {
  it('arrondit au 5 min le plus proche', () => {
    const d = new Date('2026-07-09T09:07:00');
    expect(roundToNearestFiveMinutes(d).getMinutes()).toBe(5);
  });
  it('arrondit vers le haut à 8 min → 10', () => {
    const d = new Date('2026-07-09T09:08:00');
    expect(roundToNearestFiveMinutes(d).getMinutes()).toBe(10);
  });
});

describe('toNotionDate', () => {
  it("produit un ISO avec offset local, jamais 'Z'", () => {
    const iso = toNotionDate(new Date('2026-07-09T09:00:00'));
    expect(iso.endsWith('Z')).toBe(false);
    expect(iso).toMatch(/[+-]\d{2}:\d{2}$/);
  });
  it("préserve l'heure au mur locale", () => {
    const d = new Date(2026, 6, 9, 9, 0, 0); // 9h locales
    const iso = toNotionDate(d);
    expect(iso.startsWith('2026-07-09T09:00:00')).toBe(true);
  });
});

describe('workedMs', () => {
  it('soustrait les pauses', () => {
    const start = new Date('2026-07-09T09:00:00');
    const end = new Date('2026-07-09T11:00:00');
    expect(workedMs(start, end, 30 * 60_000)).toBe(90 * 60_000);
  });
});

describe('startOfDay', () => {
  it('ramène à minuit local', () => {
    const d = startOfDay(new Date(2026, 6, 9, 15, 30));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getDate()).toBe(9);
  });
});
