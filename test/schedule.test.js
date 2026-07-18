// test/schedule.test.js
import { describe, it, expect } from 'vitest';
import { scheduledMsForDate, hasAnySchedule, weeklyTotalHours, DEFAULT_SCHEDULE, segmentSpan, generateLeaveSpans, leaveDays } from '../src/core/schedule.js';

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

describe('segmentSpan', () => {
  it('matin par défaut = 09:00 → 13:00', () => {
    const s = segmentSpan(DEFAULT_SCHEDULE, new Date(2026, 6, 13), 'am');
    expect([s.start.getHours(), s.start.getMinutes()]).toEqual([9, 0]);
    expect([s.end.getHours(), s.end.getMinutes()]).toEqual([13, 0]);
    expect(s.start.getDate()).toBe(13);
  });
  it('après-midi lundi = 14:00 → 18:00', () => {
    const s = segmentSpan(DEFAULT_SCHEDULE, new Date(2026, 6, 13), 'pm');
    expect([s.start.getHours(), s.end.getHours()]).toEqual([14, 18]);
  });
  it('segment absent (samedi) = null', () => {
    expect(segmentSpan(DEFAULT_SCHEDULE, new Date(2026, 6, 18), 'am')).toBeNull();
  });
});

describe('generateLeaveSpans', () => {
  const opt = (o) => ({ fromDate: new Date(2026, 6, 13), toDate: new Date(2026, 6, 13), ...o });
  it('jour unique « journée » = 2 créneaux (matin + aprem)', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, opt({ fromHalf: 'journee' }));
    expect(sp).toHaveLength(2);
    expect([sp[0].start.getHours(), sp[1].start.getHours()]).toEqual([9, 14]);
  });
  it('jour unique « matin » = 1 créneau', () => {
    expect(generateLeaveSpans(DEFAULT_SCHEDULE, opt({ fromHalf: 'matin' }))).toHaveLength(1);
  });
  it('plage lun→mar « journée » = 4 créneaux', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, { fromDate: new Date(2026, 6, 13), toDate: new Date(2026, 6, 14), fromHalf: 'journee', toHalf: 'journee' });
    expect(sp).toHaveLength(4);
  });
  it('bornes : lun aprem → mar matin = 2 créneaux', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, { fromDate: new Date(2026, 6, 13), toDate: new Date(2026, 6, 14), fromHalf: 'aprem', toHalf: 'matin' });
    expect(sp).toHaveLength(2);
    expect(sp[0].start.getHours()).toBe(14);
    expect(sp[1].start.getHours()).toBe(9);
  });
  it('week-ends sautés : ven→lun « journée » = 4 créneaux (ven 2 + lun 2)', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, { fromDate: new Date(2026, 6, 17), toDate: new Date(2026, 6, 20), fromHalf: 'journee', toHalf: 'journee' });
    expect(sp).toHaveLength(4);
  });
  it('override « none » saute un jour', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, { fromDate: new Date(2026, 6, 13), toDate: new Date(2026, 6, 15), fromHalf: 'journee', toHalf: 'journee', overrides: { '2026-07-14': 'none' } });
    expect(sp).toHaveLength(4);
  });
});

describe('leaveDays', () => {
  it('une journée pleine = 1,0 j', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, { fromDate: new Date(2026, 6, 13), toDate: new Date(2026, 6, 13), fromHalf: 'journee' });
    expect(leaveDays(DEFAULT_SCHEDULE, sp)).toBeCloseTo(1);
  });
  it('un matin = 0,5 j (4 h / 8 h)', () => {
    const sp = generateLeaveSpans(DEFAULT_SCHEDULE, { fromDate: new Date(2026, 6, 13), toDate: new Date(2026, 6, 13), fromHalf: 'matin' });
    expect(leaveDays(DEFAULT_SCHEDULE, sp)).toBeCloseTo(0.5);
  });
});
