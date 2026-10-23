// test/time.test.js
import { describe, it, expect } from 'vitest';
import { formatDuration, roundToNearestFiveMinutes, toNotionDate, workedMs, startOfDay, endDayDiffersFromStart, endValueForStartChange, manualRangeAfter } from '../src/core/time.js';

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

describe('endValueForStartChange', () => {
  it('aligne le jour de fin sur celui de début, heure de fin conservée', () => {
    expect(endValueForStartChange('2026-07-22T09:50', '2026-07-23T10:50', false))
      .toBe('2026-07-22T10:50');
  });
  it('est idempotente : ré-appliquer sur le même jour ne change rien', () => {
    expect(endValueForStartChange('2026-07-22T09:50', '2026-07-22T10:50', false))
      .toBe('2026-07-22T10:50');
  });
  it('respecte une fin délibérément posée un autre jour (endPinned)', () => {
    expect(endValueForStartChange('2026-07-22T23:50', '2026-07-23T00:50', true))
      .toBe('2026-07-23T00:50');
  });
  it('renvoie la fin inchangée si une valeur est vide', () => {
    expect(endValueForStartChange('', '2026-07-23T10:50', false)).toBe('2026-07-23T10:50');
    expect(endValueForStartChange('2026-07-22T09:50', '', false)).toBe('');
  });

  // Le bug rapporté : 23 → 22 (la fin suit) → 21 (la fin doit encore suivre). On rejoue la logique
  // de câblage (drapeau + report) SANS mémoriser la valeur précédente : chaque édition est traitée
  // indépendamment, donc le 3e changement n'est pas piégé par un état resté sur « 23 ».
  it("suit à CHAQUE changement de jour, y compris le 2e (régression du bug 22→21)", () => {
    let end = '2026-07-23T10:50';
    let pinned = false; // début et fin le même jour au départ
    for (const start of ['2026-07-22T09:50', '2026-07-21T09:50']) {
      end = endValueForStartChange(start, end, pinned);
    }
    expect(end).toBe('2026-07-21T10:50');
  });
});

describe('endDayDiffersFromStart', () => {
  it('faux quand début et fin sont le même jour', () => {
    expect(endDayDiffersFromStart('2026-07-22T09:50', '2026-07-22T10:50')).toBe(false);
  });
  it('vrai quand la fin est un autre jour (session à cheval sur minuit)', () => {
    expect(endDayDiffersFromStart('2026-07-22T23:50', '2026-07-23T00:50')).toBe(true);
  });
  it('faux si une valeur manque', () => {
    expect(endDayDiffersFromStart('', '2026-07-23T00:50')).toBe(false);
  });
});

describe('manualRangeAfter', () => {
  it('repart de la fin de la ligne enregistrée et propose une heure devant', () => {
    expect(manualRangeAfter(new Date(2026, 9, 19, 16, 0))).toEqual({
      start: '2026-10-19T16:00', end: '2026-10-19T17:00',
    });
  });
  it("garde les minutes telles quelles (pas d'arrondi)", () => {
    expect(manualRangeAfter(new Date(2026, 9, 19, 15, 37))).toEqual({
      start: '2026-10-19T15:37', end: '2026-10-19T16:37',
    });
  });
  it('passe au lendemain quand la fin était dans la dernière heure du jour', () => {
    expect(manualRangeAfter(new Date(2026, 9, 19, 23, 30))).toEqual({
      start: '2026-10-19T23:30', end: '2026-10-20T00:30',
    });
  });
  // Changement d'heure : l'heure se compte sur l'horloge, pas en millisecondes. Sinon, le jour du
  // retour à l'heure d'hiver, 02:30 + 1 h de temps réel retombe sur 02:30 (heure répétée) → fin
  // égale au début, et l'enregistrement suivant refusé (`end <= start`).
  it('avance toujours la fin sur l’horloge, même un jour de changement d’heure', () => {
    const r = manualRangeAfter(new Date(2026, 9, 25, 2, 30));
    expect(r.start).toBe('2026-10-25T02:30');
    expect(r.end).toBe('2026-10-25T03:30');
  });
});
