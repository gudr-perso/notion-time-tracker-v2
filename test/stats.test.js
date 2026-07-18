// test/stats.test.js
import { describe, it, expect } from 'vitest';
import { periodRange, weekdaysBetween, dailyTargetHours, objectiveHours, isVacationSession, aggregate } from '../src/core/stats.js';

describe('periodRange', () => {
  it("semaine = lundi 00:00 → dimanche 23:59:59.999 (mer. 15 juil. 2026)", () => {
    const { start, end } = periodRange('week', new Date(2026, 6, 15));
    expect(start.getFullYear()).toBe(2026);
    expect([start.getMonth(), start.getDate()]).toEqual([6, 13]); // lundi 13 juil.
    expect(start.getHours()).toBe(0);
    expect([end.getMonth(), end.getDate()]).toEqual([6, 19]);     // dimanche 19 juil.
    expect(end.getHours()).toBe(23);
    expect(end.getMilliseconds()).toBe(999);
  });

  it('semaine à cheval sur deux mois (mer. 1er juil. 2026 → lundi 29 juin)', () => {
    const { start, end } = periodRange('week', new Date(2026, 6, 1));
    expect([start.getMonth(), start.getDate()]).toEqual([5, 29]); // 29 juin
    expect([end.getMonth(), end.getDate()]).toEqual([6, 5]);      // 5 juil.
  });

  it('mois = 1er → dernier jour', () => {
    const { start, end } = periodRange('month', new Date(2026, 6, 15));
    expect([start.getMonth(), start.getDate()]).toEqual([6, 1]);
    expect([end.getMonth(), end.getDate()]).toEqual([6, 31]);
  });

  it('jour = même jour, minuit → 23:59', () => {
    const { start, end } = periodRange('day', new Date(2026, 6, 15, 14, 30));
    expect([start.getDate(), start.getHours()]).toEqual([15, 0]);
    expect([end.getDate(), end.getHours()]).toEqual([15, 23]);
  });

  it('produit un label non vide', () => {
    expect(periodRange('month', new Date(2026, 6, 15)).label).toContain('2026');
  });
});

describe('weekdaysBetween', () => {
  it('semaine pleine lun→dim = 5', () => {
    expect(weekdaysBetween(new Date(2026, 6, 13), new Date(2026, 6, 19))).toBe(5);
  });
  it('week-end seul = 0', () => {
    expect(weekdaysBetween(new Date(2026, 6, 18), new Date(2026, 6, 19))).toBe(0);
  });
  it('un seul jour ouvré = 1', () => {
    expect(weekdaysBetween(new Date(2026, 6, 15), new Date(2026, 6, 15))).toBe(1);
  });
  it('bornes incluses, insensible à l\'heure', () => {
    expect(weekdaysBetween(new Date(2026, 6, 13, 23), new Date(2026, 6, 17, 1))).toBe(5);
  });
});

describe('objectiveHours', () => {
  it('semaine sans congé = weeklyHours', () => {
    expect(objectiveHours(5, 0, 39)).toBeCloseTo(39);
  });
  it('semaine avec 1 congé', () => {
    expect(objectiveHours(5, 1, 39)).toBeCloseTo(31.2);
  });
  it('période 100 % week-end = 0', () => {
    expect(objectiveHours(0, 0, 39)).toBe(0);
  });
  it('congés > jours ouvrés → clamp à 0', () => {
    expect(objectiveHours(5, 6, 39)).toBe(0);
  });
  it('congé fractionnaire (demi-journée)', () => {
    expect(objectiveHours(5, 0.5, 40)).toBeCloseTo(36); // (5 − 0,5) × 8 h
  });
  it('cible quotidienne = weekly / 5', () => {
    expect(dailyTargetHours(39)).toBeCloseTo(7.8);
  });
});

describe('isVacationSession', () => {
  it('match par relation (IDs normalisés, tirets ignorés)', () => {
    const s = { name: 'Congés', tasksRelIds: ['1a2b-3c4d'] };
    expect(isVacationSession(s, { vacationTaskId: '1a2b3c4d' })).toBe(true);
  });
  it('repli par nom quand pas de relation', () => {
    const s = { name: 'Congés [RH]', tasksRelIds: [] };
    expect(isVacationSession(s, { vacationName: 'Congés [RH]' })).toBe(true);
  });
  it('faux si aucune correspondance', () => {
    const s = { name: 'Tâche A', tasksRelIds: ['zzz'] };
    expect(isVacationSession(s, { vacationTaskId: '111', vacationName: 'Congés' })).toBe(false);
  });
  it('faux si aucune config congés', () => {
    expect(isVacationSession({ name: 'X', tasksRelIds: [] }, {})).toBe(false);
  });
});

const H = 3600_000;

describe('aggregate', () => {
  const range = { start: new Date(2026, 6, 13), end: new Date(2026, 6, 19, 23, 59, 59, 999) };
  const sessions = [
    { name: 'Tâche A [ClientA]', startTime: new Date(2026, 6, 13, 9), endTime: new Date(2026, 6, 13, 17), pauseMin: 0, tasksRelIds: [] }, // 8h lun
    { name: 'Tâche B [Interne]', startTime: new Date(2026, 6, 14, 9), endTime: new Date(2026, 6, 14, 12), pauseMin: 0, tasksRelIds: [] }, // 3h mar
    { name: 'Congés', startTime: new Date(2026, 6, 15, 9), endTime: new Date(2026, 6, 15, 17), pauseMin: 0, tasksRelIds: ['vac'] },       // congé mer
  ];
  const isVac = (s) => isVacationSession(s, { vacationTaskId: 'vac' });

  it('temps travaillé exclut les congés', () => {
    const a = aggregate(sessions, { ...range, isVacation: isVac, weeklyHours: 39 });
    expect(a.workedMs).toBe(11 * H);
  });
  it('objectif ajusté congés (5 ouvrés − 1 congé plein) × 7,8 h', () => {
    const a = aggregate(sessions, { ...range, isVacation: isVac, weeklyHours: 39 });
    // Congé mer = 8 h, plafonné à la cible quotidienne (7,8 h) → retire exactement 1 journée.
    expect(a.objectiveMs).toBeCloseTo(31.2 * H, -3);
    expect(a.remainingMs).toBeCloseTo(20.2 * H, -3);
    expect(a.congeDays).toBe(1);
  });
  it('congeMs = total des heures de congé de la période', () => {
    const a = aggregate(sessions, { ...range, isVacation: isVac, weeklyHours: 39 });
    expect(a.congeMs).toBe(8 * H); // congé mer 9→17
  });
  it('perProject trié décroissant avec ratios', () => {
    const a = aggregate(sessions, { ...range, isVacation: isVac, weeklyHours: 39 });
    expect(a.perProject.map((p) => p.project)).toEqual(['ClientA', 'Interne']);
    expect(a.perProject[0].ms).toBe(8 * H);
    expect(a.perProject[0].ratio).toBeCloseTo(8 / 11);
  });
  it('perDay couvre les 7 jours : workMs / congeMs / week-end séparés', () => {
    const a = aggregate(sessions, { ...range, isVacation: isVac, weeklyHours: 39 });
    expect(a.perDay).toHaveLength(7);
    expect(a.perDay[0].workMs).toBe(8 * H);        // lundi : 8 h travail
    expect(a.perDay[0].congeMs).toBe(0);
    expect(a.perDay[2].congeMs).toBe(8 * H);       // mercredi : 8 h congé…
    expect(a.perDay[2].workMs).toBe(0);            // …et aucun travail
    expect(a.perDay[5].isWeekend).toBe(true);      // samedi
  });
  it('jour mixte : travail et congés le même jour cohabitent', () => {
    const mixed = [
      { name: 'Tâche [X]', startTime: new Date(2026, 6, 13, 9), endTime: new Date(2026, 6, 13, 13), pauseMin: 0, tasksRelIds: [] },   // 4 h travail lun
      { name: 'Congés', startTime: new Date(2026, 6, 13, 14), endTime: new Date(2026, 6, 13, 18), pauseMin: 0, tasksRelIds: ['vac'] }, // 4 h congé lun
    ];
    const a = aggregate(mixed, { ...range, isVacation: isVac, weeklyHours: 39 });
    expect(a.perDay[0].workMs).toBe(4 * H);
    expect(a.perDay[0].congeMs).toBe(4 * H);
    expect(a.workedMs).toBe(4 * H);                 // congé exclu du travaillé
    expect(a.congeMs).toBe(4 * H);
    // Objectif : 5 × 7,8 h − 4 h (la demi-journée ne retire que ses heures) = 35 h.
    expect(a.objectiveMs).toBeCloseTo(35 * H, -3);
  });
  it('congé le week-end n\'ampute pas l\'objectif', () => {
    const wk = [
      { name: 'Congés', startTime: new Date(2026, 6, 18, 9), endTime: new Date(2026, 6, 18, 17), pauseMin: 0, tasksRelIds: ['vac'] }, // 8 h congé samedi
    ];
    const a = aggregate(wk, { ...range, isVacation: isVac, weeklyHours: 39 });
    expect(a.perDay[5].isWeekend).toBe(true);
    expect(a.perDay[5].congeMs).toBe(8 * H);
    expect(a.objectiveMs).toBeCloseTo(39 * H, -3);  // 5 jours ouvrés pleins
  });
  it('déduit les pauses', () => {
    const s = [{ name: 'X', startTime: new Date(2026, 6, 13, 9), endTime: new Date(2026, 6, 13, 11), pauseMin: 30, tasksRelIds: [] }];
    const a = aggregate(s, { ...range, weeklyHours: 39 });
    expect(a.workedMs).toBe(1.5 * H);
  });
  it('ignore les sessions sans fin', () => {
    const s = [{ name: 'X', startTime: new Date(2026, 6, 13, 9), endTime: null, pauseMin: 0, tasksRelIds: [] }];
    expect(aggregate(s, { ...range, weeklyHours: 39 }).workedMs).toBe(0);
  });
  it('période vide : progress défini, perProject vide', () => {
    const a = aggregate([], { ...range, weeklyHours: 39 });
    expect(a.workedMs).toBe(0);
    expect(a.perProject).toEqual([]);
    expect(a.progress).toBe(0);
    expect(a.perDay).toHaveLength(7);
  });
  it('somme les sessions d\'un même projet', () => {
    const s = [
      { name: 'T1 [ClientA]', startTime: new Date(2026, 6, 13, 9), endTime: new Date(2026, 6, 13, 11), pauseMin: 0, tasksRelIds: [] },
      { name: 'T2 [ClientA]', startTime: new Date(2026, 6, 14, 9), endTime: new Date(2026, 6, 14, 12), pauseMin: 0, tasksRelIds: [] },
    ];
    const a = aggregate(s, { start: new Date(2026, 6, 13), end: new Date(2026, 6, 19, 23, 59, 59, 999), weeklyHours: 39 });
    expect(a.perProject).toHaveLength(1);
    expect(a.perProject[0].project).toBe('ClientA');
    expect(a.perProject[0].ms).toBe(5 * 3600_000);
  });
});
