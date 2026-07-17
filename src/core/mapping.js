// src/core/mapping.js — traduction Notion ⇄ objets métier. Importe time pour les dates.
import { toNotionDate } from './time.js';

const normId = (id) => String(id).replace(/-/g, '');
const plain = (rich) => (rich || []).map((r) => r.plain_text || '').join('');

export function extractProject(name) {
  const m = /\[([^\]]+)\]/.exec(name || '');
  return m ? m[1] : 'Sans projet';
}

export function titleWithProject(name, project) {
  return project ? `${name} [${project}]` : name;
}

export function taskFromPage(page, f) {
  const p = page.properties || {};
  const get = (key) => (key ? p[key] : undefined);
  const titleProp = get(f.title);
  const projProp = get(f.project);
  const idProp = get(f.externalId);
  const urlProp = get(f.externalUrl);
  const relProp = get(f.projectsRel);
  return {
    id: page.id,
    name: titleProp ? plain(titleProp.title) : '(sans nom)',
    project: projProp ? plain(projProp.rich_text) : '',
    externalId: idProp ? plain(idProp.rich_text) : '',
    externalUrl: urlProp ? (urlProp.url || '') : '',
    projectsRel: relProp && relProp.relation ? relProp.relation.map((r) => r.id) : [],
    notionUrl: `https://notion.so/${normId(page.id)}`,
  };
}

function dateProp(date) { return { date: { start: toNotionDate(date) } }; }
function richTextProp(v) { return { rich_text: [{ text: { content: v } }] }; }

export function sessionPropertiesForCreate(task, startTime, f) {
  const props = {
    [f.taskName]: { title: [{ text: { content: titleWithProject(task.name, task.project) } }] },
    [f.startDate]: dateProp(startTime),
  };
  if (f.tasksRelation) props[f.tasksRelation] = { relation: [{ id: task.id }] };
  if (f.taskId && task.externalId) props[f.taskId] = richTextProp(task.externalId);
  if (f.externalUrl && task.externalUrl) props[f.externalUrl] = { url: task.externalUrl };
  if (f.projects && task.projectsRel && task.projectsRel.length) {
    props[f.projects] = { relation: task.projectsRel.map((id) => ({ id })) };
  }
  return props;
}

export function sessionPropertiesForUpdate({ endTime, comment, pauseMin }, f) {
  const props = { [f.endDate]: dateProp(endTime) };
  if (f.comment && comment) props[f.comment] = richTextProp(comment);
  if (f.pause && pauseMin > 0) props[f.pause] = { number: pauseMin };
  return props;
}

export function sessionFromPage(page, f) {
  const p = page.properties || {};
  const name = p[f.taskName] ? plain(p[f.taskName].title) : '';
  const start = p[f.startDate]?.date?.start || null;
  const end = f.endDate && p[f.endDate]?.date?.start ? p[f.endDate].date.start : null;
  const pauseMin = f.pause && p[f.pause] ? (p[f.pause].number || 0) : 0;
  const relProp = f.tasksRelation ? p[f.tasksRelation] : undefined;
  const tasksRelIds = relProp && relProp.relation ? relProp.relation.map((r) => r.id) : [];
  return { pageId: page.id, name, startTime: start, endTime: end, pauseMin, tasksRelIds };
}
