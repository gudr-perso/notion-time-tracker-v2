// test/mapping.test.js
import { describe, it, expect } from 'vitest';
import {
  taskFromPage, extractProject, titleWithProject,
  sessionPropertiesForCreate, sessionPropertiesForUpdate, sessionFromPage,
} from '../src/core/mapping.js';

const tasksFields = {
  title: 'Nom', project: 'Projet_texte', externalId: '#TaskID',
  externalUrl: 'TaskURL', projectsRel: '🎯 Projets',
};
const timeFields = {
  taskName: 'Nom', startDate: 'Début session', endDate: 'Fin session',
  pause: 'Pause', comment: 'Commentaire', externalUrl: 'TaskURL',
  taskId: '#TaskID', projects: '🎯 Projets', tasksRelation: 'Tâches',
};

function textProp(v) { return { type: 'rich_text', rich_text: [{ plain_text: v }] }; }
function titleProp(v) { return { type: 'title', title: [{ plain_text: v }] }; }

describe('extractProject', () => {
  it('extrait le contenu des crochets', () => {
    expect(extractProject('Refonte API [Projet X]')).toBe('Projet X');
  });
  it('retourne "Sans projet" sinon', () => {
    expect(extractProject('Refonte API')).toBe('Sans projet');
  });
});

describe('titleWithProject', () => {
  it('accole le projet', () => {
    expect(titleWithProject('Refonte API', 'Projet X')).toBe('Refonte API [Projet X]');
  });
  it('sans projet, garde le nom seul', () => {
    expect(titleWithProject('Refonte API', '')).toBe('Refonte API');
  });
});

describe('taskFromPage', () => {
  it('mappe les champs configurés', () => {
    const page = {
      id: 'abc-123',
      properties: {
        'Nom': titleProp('Refonte API'),
        'Projet_texte': textProp('Projet X'),
        '#TaskID': textProp('T-42'),
        'TaskURL': { type: 'url', url: 'https://clickup.com/t/42' },
        '🎯 Projets': { type: 'relation', relation: [{ id: 'p1' }] },
      },
    };
    const t = taskFromPage(page, tasksFields);
    expect(t.name).toBe('Refonte API');
    expect(t.project).toBe('Projet X');
    expect(t.externalId).toBe('T-42');
    expect(t.externalUrl).toBe('https://clickup.com/t/42');
    expect(t.projectsRel).toEqual(['p1']);
    expect(t.notionUrl).toBe('https://notion.so/abc123');
  });
});

describe('sessionPropertiesForCreate', () => {
  const task = { id: 'abc-123', name: 'Refonte API', project: 'Projet X', externalId: 'T-42', externalUrl: 'https://c/42', projectsRel: ['p1'] };
  it('inclut toujours titre (avec projet) et date de début sans Z', () => {
    const props = sessionPropertiesForCreate(task, new Date(2026, 6, 9, 9, 0, 0), timeFields);
    expect(props['Nom'].title[0].text.content).toBe('Refonte API [Projet X]');
    expect(props['Début session'].date.start).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(props['Début session'].date.start.endsWith('Z')).toBe(false);
  });
  it('inclut les champs optionnels mappés', () => {
    const props = sessionPropertiesForCreate(task, new Date(), timeFields);
    expect(props['#TaskID'].rich_text[0].text.content).toBe('T-42');
    expect(props['TaskURL'].url).toBe('https://c/42');
    expect(props['🎯 Projets'].relation).toEqual([{ id: 'p1' }]);
    expect(props['Tâches'].relation).toEqual([{ id: 'abc-123' }]);
  });
  it('omet un champ optionnel non mappé (null)', () => {
    const props = sessionPropertiesForCreate(task, new Date(), { ...timeFields, taskId: null });
    expect(props['#TaskID']).toBeUndefined();
  });
});

describe('sessionPropertiesForUpdate', () => {
  it('écrit fin, commentaire et pause quand mappés et présents', () => {
    const props = sessionPropertiesForUpdate({ endTime: new Date(2026, 6, 9, 11, 0, 0), comment: 'fait', pauseMin: 30 }, timeFields);
    expect(props['Fin session'].date.start.endsWith('Z')).toBe(false);
    expect(props['Commentaire'].rich_text[0].text.content).toBe('fait');
    expect(props['Pause'].number).toBe(30);
  });
  it('omet commentaire vide', () => {
    const props = sessionPropertiesForUpdate({ endTime: new Date(), comment: '', pauseMin: 0 }, timeFields);
    expect(props['Commentaire']).toBeUndefined();
  });
});

describe('sessionFromPage', () => {
  it('lit nom, début, fin, pause', () => {
    const page = {
      id: 'sess-1',
      properties: {
        'Nom': titleProp('Refonte API [Projet X]'),
        'Début session': { type: 'date', date: { start: '2026-07-09T09:00:00+02:00' } },
        'Fin session': { type: 'date', date: { start: '2026-07-09T11:00:00+02:00' } },
        'Pause': { type: 'number', number: 30 },
      },
    };
    const s = sessionFromPage(page, timeFields);
    expect(s.name).toBe('Refonte API [Projet X]');
    expect(new Date(s.startTime).getHours()).toBe(9);
    expect(s.pauseMin).toBe(30);
    expect(s.pageId).toBe('sess-1');
  });
});
