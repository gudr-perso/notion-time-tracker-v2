// test/schedule.test.js
import { describe, it, expect } from 'vitest';
import { scheduledMsForDate, hasAnySchedule, weeklyTotalHours, DEFAULT_SCHEDULE } from '../src/core/schedule.js';

const H = 3600_000;
const MON = new Date(2026, 6, 13); // lundi 13 juil. 2026
const FRI = new Date(2026, 6, 17); // vendredi
const SAT = new Date(2026, 6, 18); // samedi

describe('scheduledMsForDate', () => {
  it('lundi par défaut = 8 h (matin 4 h + aprem 4 h)', () => {
    expect(scheduledMsForDate(DEFAULT_SCHEDULE, MON)).toBe(8 * H);
  });
  it('vendredi par défaut = 7 h (aprem plus court)', () => {
    expect(scheduledMsForDate(DEFAULT_SCHEDULE, FRI)).toBe(7 * H);
  });
  it('samedi = 0 (non travaillé)', () => {
    expect(scheduledMsForDate(DEFAULT_SCHEDULE, SAT)).toBe(0);
  });
  it('segment après-midi absent = matin seul', () => {
    const s = { ...DEFAULT_SCHEDULE, mon: { am: ['09:00', '13:00'], pm: null } };
    expect(scheduledMsForDate(s, MON)).toBe(4 * H);
  });
  it('planning absent = 0', () => {
    expect(scheduledMsForDate(null, MON)).toBe(0);
    expect(scheduledMsForDate(undefined, MON)).toBe(0);
  });
});

describe('hasAnySchedule', () => {
  it('défaut = vrai', () => { expect(hasAnySchedule(DEFAULT_SCHEDULE)).toBe(true); });
  it('tout vide = faux', () => {
    expect(hasAnySchedule({ mon: { am: null, pm: null } })).toBe(false);
  });
  it('absent = faux', () => { expect(hasAnySchedule(undefined)).toBe(false); });
});

describe('weeklyTotalHours', () => {
  it('planning par défaut = 39 h', () => {
    expect(weeklyTotalHours(DEFAULT_SCHEDULE)).toBeCloseTo(39);
  });
  it('planning vide = 0', () => { expect(weeklyTotalHours({})).toBe(0); });
});
