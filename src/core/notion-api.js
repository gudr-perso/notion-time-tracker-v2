// src/core/notion-api.js — seul point (avec mapping) qui connaît le format Notion.
const BASE = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';
const normId = (id) => String(id).replace(/-/g, '');

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': VERSION,
    'Content-Type': 'application/json',
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(token, path, { method = 'GET', body } = {}, attempt = 0) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get('retry-after')) || 2 ** attempt;
    await sleep(retryAfter * 1000);
    return request(token, path, { method, body }, attempt + 1);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Notion ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function testToken(token) {
  const user = await request(token, '/users/me');
  return { ok: true, user };
}

export async function searchDatabases(token) {
  const out = [];
  let cursor;
  do {
    const data = await request(token, '/search', {
      method: 'POST',
      body: { filter: { value: 'database', property: 'object' }, start_cursor: cursor, page_size: 100 },
    });
    for (const r of data.results) {
      out.push({ id: r.id, name: (r.title || []).map((t) => t.plain_text).join('') || '(sans titre)' });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return out;
}

export async function getDatabaseSchema(token, dbId) {
  const data = await request(token, `/databases/${normId(dbId)}`);
  return Object.entries(data.properties).map(([name, prop]) => {
    const p = { name, type: prop.type };
    // status et select portent la liste de leurs valeurs sous prop[type].options : on l'expose
    // (noms seuls) pour offrir un choix des vrais statuts plutôt qu'une saisie libre.
    const options = prop[prop.type]?.options;
    if (Array.isArray(options)) p.options = options.map((o) => o.name);
    return p;
  });
}

export async function queryAll(token, dbId, { filter, sorts, pageSize = 100 } = {}) {
  const out = [];
  let cursor;
  do {
    const body = { page_size: pageSize };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    if (cursor) body.start_cursor = cursor;
    const data = await request(token, `/databases/${normId(dbId)}/query`, { method: 'POST', body });
    out.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return out;
}

// Variante paginée limitée (repos : 1 page) — pour le chargement léger des tâches.
export async function queryPage(token, dbId, { filter, sorts, pageSize = 20 } = {}) {
  const body = { page_size: pageSize };
  if (filter) body.filter = filter;
  if (sorts) body.sorts = sorts;
  const data = await request(token, `/databases/${normId(dbId)}/query`, { method: 'POST', body });
  return data.results;
}

export async function getPage(token, pageId) {
  return request(token, `/pages/${normId(pageId)}`);
}

export async function createPage(token, dbId, properties) {
  const data = await request(token, '/pages', {
    method: 'POST',
    body: { parent: { type: 'database_id', database_id: normId(dbId) }, properties },
  });
  return data.id;
}

export async function updatePage(token, pageId, properties) {
  await request(token, `/pages/${normId(pageId)}`, { method: 'PATCH', body: { properties } });
}

// Ajoute des propriétés à une base existante (jamais destructif côté appelant).
export async function addDatabaseProperties(token, dbId, properties) {
  try {
    return await request(token, `/databases/${normId(dbId)}`, { method: 'PATCH', body: { properties } });
  } catch (e) {
    if (e.status === 403) {
      throw new Error("L'intégration n'a pas les droits d'édition sur cette base — partage-la en écriture avec l'intégration Notion.");
    }
    throw e;
  }
}
