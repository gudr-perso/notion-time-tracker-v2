# Injection automatique des champs Notion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter dans la page de config deux boutons qui créent automatiquement les propriétés Notion manquantes dans les bases Temps et Tâches (types corrects, relations dans les deux sens), avec aperçu/confirmation, puis auto-mapping.

**Architecture:** La décision « quoi créer » est une **fonction pure** (`core/schema-injection.js`, testée en TDD) qui compare le mapping théorique au schéma courant et renvoie un plan (à créer / conflits / relations sautées). Une fine couche `notion-api.addDatabaseProperties` fait le `PATCH`. `config.js` orchestre : aperçu → confirmation → écriture → rechargement schéma → re-mapping.

**Tech Stack:** JS vanilla + modules ES natifs, zéro build, Vitest (dev) pour `core/`. API Notion `2022-06-28`.

**Référence design :** `docs/superpowers/specs/2026-07-16-injection-champs-notion-design.md`

---

## Structure des fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `src/core/schema-injection.js` | Specs des champs injectables + `planInjection` (pur) | **Créer** |
| `test/schema-injection.test.js` | Tests TDD de `planInjection` | **Créer** |
| `src/core/notion-api.js` | `addDatabaseProperties` (PATCH) + `status` sur les erreurs | **Modifier** |
| `src/config/config.html` | 3ᵉ sélecteur Projets, 2 boutons, panneaux d'aperçu, encart d'aide | **Modifier** |
| `src/config/config.css` | Styles `.inject-preview` / `.help-note` | **Modifier** |
| `src/config/config.js` | Câblage : Projets, injection, aperçu, re-mapping, persistance | **Modifier** |
| `manifest.json` / `package.json` / `package-lock.json` | Bump version | **Modifier** |
| `docs/VERSIONS.md` / `AVANCEMENT.md` / `documentation-*.md` / `CLAUDE.md` | D² + AVEC | **Modifier** |

---

## Task 1 : Module pur `schema-injection.js` (TDD)

**Files:**
- Create: `src/core/schema-injection.js`
- Test: `test/schema-injection.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `test/schema-injection.test.js` :

```js
// test/schema-injection.test.js
import { describe, it, expect } from 'vitest';
import { planInjection, FIELD_SPECS_TIME, FIELD_SPECS_TASKS } from '../src/core/schema-injection.js';

const targets = { tasksDbId: 'TASKS_DB', projetsDbId: 'PROJ_DB' };

describe('planInjection — base Temps', () => {
  it('planifie tous les champs manquants sur une base vide (titre seul)', () => {
    const schema = [{ name: 'Nom', type: 'title' }];
    const plan = planInjection(FIELD_SPECS_TIME, schema, targets);
    const names = plan.toCreate.map((c) => c.name);
    expect(names).toEqual([
      'Début session', 'Fin session', '#TaskId', 'Pause (min)',
      'Commentaire', 'TaskUrl', 'Tâches', '🎯 Projets',
    ]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.skippedNoTarget).toEqual([]);
  });

  it('ne recrée jamais le titre natif', () => {
    const plan = planInjection(FIELD_SPECS_TIME, [{ name: 'Nom', type: 'title' }], targets);
    expect(plan.toCreate.some((c) => c.type === 'title')).toBe(false);
  });

  it('additif strict : un champ de même nom est ignoré, jamais recréé', () => {
    const schema = [{ name: 'Nom', type: 'title' }, { name: 'Commentaire', type: 'rich_text' }];
    const plan = planInjection(FIELD_SPECS_TIME, schema, targets);
    expect(plan.toCreate.map((c) => c.name)).not.toContain('Commentaire');
    expect(plan.properties.Commentaire).toBeUndefined();
  });

  it('signale un conflit de type sans le corriger', () => {
    const schema = [{ name: 'TaskUrl', type: 'rich_text' }];
    const plan = planInjection(FIELD_SPECS_TIME, schema, targets);
    expect(plan.conflicts).toContainEqual({ name: 'TaskUrl', expectedType: 'url', actualType: 'rich_text' });
    expect(plan.properties.TaskUrl).toBeUndefined();
  });

  it('crée les relations en dual_property avec la bonne cible', () => {
    const plan = planInjection(FIELD_SPECS_TIME, [], targets);
    expect(plan.properties['Tâches']).toEqual({
      relation: { database_id: 'TASKS_DB', type: 'dual_property', dual_property: {} },
    });
    expect(plan.properties['🎯 Projets']).toEqual({
      relation: { database_id: 'PROJ_DB', type: 'dual_property', dual_property: {} },
    });
  });

  it('saute la relation Projets si aucune base Projets', () => {
    const plan = planInjection(FIELD_SPECS_TIME, [], { tasksDbId: 'TASKS_DB', projetsDbId: null });
    expect(plan.skippedNoTarget).toContainEqual({ key: 'projects', name: '🎯 Projets' });
    expect(plan.properties['🎯 Projets']).toBeUndefined();
    expect(plan.properties['Tâches']).toBeDefined();
  });

  it('idempotence : re-planifier sur le schéma post-injection donne toCreate vide', () => {
    const first = planInjection(FIELD_SPECS_TIME, [{ name: 'Nom', type: 'title' }], targets);
    const post = [{ name: 'Nom', type: 'title' }, ...first.toCreate.map((c) => ({ name: c.name, type: c.type }))];
    const second = planInjection(FIELD_SPECS_TIME, post, targets);
    expect(second.toCreate).toEqual([]);
  });
});

describe('planInjection — base Tâches', () => {
  it('planifie les champs Tâches manquants, sans statusFilter ni sortProperty', () => {
    const plan = planInjection(FIELD_SPECS_TASKS, [{ name: 'Nom', type: 'title' }], targets);
    expect(plan.toCreate.map((c) => c.name)).toEqual([
      'Projet_texte', '#TaskId', 'TaskUrl', '🎯 Projets',
    ]);
  });

  it('les specs Tâches ne contiennent ni statusFilter ni sortProperty', () => {
    const keys = FIELD_SPECS_TASKS.map((s) => s.key);
    expect(keys).not.toContain('statusFilter');
    expect(keys).not.toContain('sortProperty');
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `npm test -- schema-injection`
Expected: FAIL — `Failed to resolve import '../src/core/schema-injection.js'`.

- [ ] **Step 3 : Écrire l'implémentation minimale**

Create `src/core/schema-injection.js` :

```js
// src/core/schema-injection.js — logique pure de planification d'injection de propriétés Notion.
// Aucune API Chrome, aucun fetch → testable comme le reste de core/.

const dateProp = () => ({ date: {} });
const numberProp = () => ({ number: { format: 'number' } });
const richTextProp = () => ({ rich_text: {} });
const urlProp = () => ({ url: {} });
const relationProp = (databaseId) => ({
  relation: { database_id: databaseId, type: 'dual_property', dual_property: {} },
});

// Champs injectables — base Temps. Le titre natif (title) n'est jamais injecté.
export const FIELD_SPECS_TIME = [
  { key: 'startDate', name: 'Début session', type: 'date', build: dateProp },
  { key: 'endDate', name: 'Fin session', type: 'date', build: dateProp },
  { key: 'taskId', name: '#TaskId', type: 'rich_text', build: richTextProp },
  { key: 'pause', name: 'Pause (min)', type: 'number', build: numberProp },
  { key: 'comment', name: 'Commentaire', type: 'rich_text', build: richTextProp },
  { key: 'externalUrl', name: 'TaskUrl', type: 'url', build: urlProp },
  { key: 'tasksRelation', name: 'Tâches', type: 'relation', targetKey: 'tasksDbId' },
  { key: 'projects', name: '🎯 Projets', type: 'relation', targetKey: 'projetsDbId' },
];

// Champs injectables — base Tâches. Ni statusFilter (type status non créable via API)
// ni sortProperty (pointeur vers une propriété existante).
export const FIELD_SPECS_TASKS = [
  { key: 'project', name: 'Projet_texte', type: 'rich_text', build: richTextProp },
  { key: 'externalId', name: '#TaskId', type: 'rich_text', build: richTextProp },
  { key: 'externalUrl', name: 'TaskUrl', type: 'url', build: urlProp },
  { key: 'projectsRel', name: '🎯 Projets', type: 'relation', targetKey: 'projetsDbId' },
];

// planInjection : décide quoi créer sans jamais modifier l'existant.
// currentSchema = [{ name, type }] ; targets = { tasksDbId, projetsDbId }.
export function planInjection(specs, currentSchema, targets = {}) {
  const byName = new Map((currentSchema || []).map((p) => [p.name.toLowerCase(), p]));
  const toCreate = [];
  const conflicts = [];
  const skippedNoTarget = [];
  const properties = {};

  for (const spec of specs) {
    const existing = byName.get(spec.name.toLowerCase());
    if (existing) {
      if (existing.type !== spec.type) {
        conflicts.push({ name: spec.name, expectedType: spec.type, actualType: existing.type });
      }
      continue; // additif strict : jamais de rename / retype / delete
    }
    if (spec.targetKey) {
      const targetId = targets[spec.targetKey];
      if (!targetId) { skippedNoTarget.push({ key: spec.key, name: spec.name }); continue; }
      properties[spec.name] = relationProp(targetId);
    } else {
      properties[spec.name] = spec.build();
    }
    toCreate.push({ key: spec.key, name: spec.name, type: spec.type });
  }

  return { toCreate, conflicts, skippedNoTarget, properties };
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npm test -- schema-injection`
Expected: PASS (tous les `it`).

- [ ] **Step 5 : Commit**

```bash
git add src/core/schema-injection.js test/schema-injection.test.js
git commit -m "feat(core): planInjection — planification pure de l'injection de champs Notion"
```

---

## Task 2 : `addDatabaseProperties` dans notion-api.js

**Files:**
- Modify: `src/core/notion-api.js`

- [ ] **Step 1 : Attacher le status HTTP aux erreurs de `request`**

Dans `src/core/notion-api.js`, remplacer le bloc d'erreur de `request` (lignes ~28-31) :

```js
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Notion ${res.status}`);
  }
  return data;
```

par :

```js
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Notion ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
```

- [ ] **Step 2 : Ajouter la fonction d'injection**

À la fin de `src/core/notion-api.js`, ajouter :

```js
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
```

- [ ] **Step 3 : Vérifier que la suite existante passe toujours**

Run: `npm test`
Expected: PASS — aucune régression (les tests existants n'asservissent pas la forme de l'erreur).

- [ ] **Step 4 : Commit**

```bash
git add src/core/notion-api.js
git commit -m "feat(core): addDatabaseProperties (PATCH) + status HTTP sur les erreurs"
```

---

## Task 3 : Interface config — HTML + CSS

**Files:**
- Modify: `src/config/config.html`
- Modify: `src/config/config.css`

- [ ] **Step 1 : Ajouter le sélecteur Base Projets**

Dans `src/config/config.html`, section ② (`id="sec-bases"`), après le bloc `Base Tâches` (juste avant `</section>` ligne ~49) :

```html
      <div class="row">
        <label>Base Projets <span class="type">optionnel · cible des relations</span></label>
        <div class="cell"><select id="projets-db" class="input"></select></div>
      </div>
```

- [ ] **Step 2 : Ajouter le bouton d'injection Temps + panneau d'aperçu**

Dans la section ③ (`id="sec-time-map"`), juste avant `</section>` (ligne ~63) :

```html
      <div class="row">
        <label></label>
        <div class="cell">
          <button type="button" id="btn-inject-time" class="btn btn-ghost">⚙️ Créer les champs manquants — base Temps</button>
          <span id="inject-time-status" class="status"></span>
        </div>
      </div>
      <div id="inject-time-preview" class="inject-preview" hidden></div>
```

- [ ] **Step 3 : Ajouter le bouton d'injection Tâches + aperçu + encart d'aide**

Dans la section ④ (`id="sec-tasks-map"`), juste avant `</section>` (ligne ~80) :

```html
      <div class="row">
        <label></label>
        <div class="cell">
          <button type="button" id="btn-inject-tasks" class="btn btn-ghost">⚙️ Créer les champs manquants — base Tâches</button>
          <span id="inject-tasks-status" class="status"></span>
        </div>
      </div>
      <div id="inject-tasks-preview" class="inject-preview" hidden></div>
      <p class="help-note">ℹ️ <strong>Filtre de statut — à créer manuellement.</strong> L'API Notion ne peut pas créer de propriété de type <em>Status</em>. Dans ta base Tâches, crée (ou réutilise) une propriété <strong>Statut</strong> (type <em>Status</em> ou <em>Select</em>) avec tes états de workflow, puis mappe-la dans « Filtre d'état » et indique la valeur à exclure (ex. <code>Terminé</code>). Le <strong>Tri</strong> se mappe aussi sur une propriété existante — rien à injecter.</p>
```

- [ ] **Step 4 : Ajouter les styles**

À la fin de `src/config/config.css`, ajouter :

```css
.inject-preview { margin:8px 22px 14px; padding:12px 14px; border:1px solid var(--border-soft); border-radius:10px; background:rgba(42,166,232,.06); font-size:13px; color:var(--text); }
.inject-preview ul { margin:4px 0 10px 18px; }
.inject-preview .cell { display:flex; gap:8px; }
.help-note { margin:4px 22px 16px; font-size:12px; color:var(--text-muted); line-height:1.55; }
.help-note code { background:rgba(42,166,232,.12); padding:1px 5px; border-radius:5px; }
```

- [ ] **Step 5 : Commit**

```bash
git add src/config/config.html src/config/config.css
git commit -m "feat(config): UI — sélecteur Projets, boutons d'injection, aperçu, encart statut"
```

---

## Task 4 : Câblage config.js — Projets, injection, aperçu, re-mapping

**Files:**
- Modify: `src/config/config.js`

- [ ] **Step 1 : Importer les nouvelles fonctions**

Remplacer les deux premières lignes d'import de `src/config/config.js` :

```js
import { testToken, searchDatabases, getDatabaseSchema, queryAll } from '../core/notion-api.js';
import { getConfig, saveConfig } from '../core/storage.js';
```

par :

```js
import { testToken, searchDatabases, getDatabaseSchema, queryAll, addDatabaseProperties } from '../core/notion-api.js';
import { getConfig, saveConfig } from '../core/storage.js';
import { planInjection, FIELD_SPECS_TIME, FIELD_SPECS_TASKS } from '../core/schema-injection.js';
```

- [ ] **Step 2 : Extraire le re-mapping dans `remapTime` / `remapTasks` et les réutiliser dans `loadSchemas`**

Remplacer la fonction `loadSchemas` (lignes ~82-101) par :

```js
async function loadSchemas() {
  const timeId = $('time-db').value, tasksId = $('tasks-db').value;
  if (!timeId || !tasksId) return;
  state.schemaTime = await getDatabaseSchema(state.token, timeId);
  state.schemaTasks = await getDatabaseSchema(state.token, tasksId);
  remapTime();
  remapTasks();
  await loadTasksList(tasksId, state.config?.tasksDb?.fields || {});
}

function remapTime() {
  const tf = state.config?.timeDb?.fields || {};
  for (const key of Object.keys(TIME_TYPES)) {
    const sel = $('m-' + key);
    fill(sel, state.schemaTime, TIME_TYPES[key], tf[key] || '');
    autoSelect(sel, state.schemaTime, AUTO_TIME[key] || [], tf[key] || '');
  }
}

function remapTasks() {
  const kf = state.config?.tasksDb?.fields || {};
  for (const key of Object.keys(TASKS_TYPES)) {
    const sel = $('t-' + key);
    const cur = key === 'statusFilter' ? (kf.statusFilter?.property || '') : (kf[key] || '');
    fill(sel, state.schemaTasks, TASKS_TYPES[key], cur);
    if (AUTO_TASKS[key]) autoSelect(sel, state.schemaTasks, AUTO_TASKS[key], cur);
  }
}
```

- [ ] **Step 3 : Peupler et présélectionner le sélecteur Projets dans `onLoadDb`**

Dans `onLoadDb`, après la ligne `$('tasks-db').innerHTML = opts.join('');` (ligne ~74), ajouter :

```js
    $('projets-db').innerHTML = ['<option value="">— aucune —</option>', ...opts.slice(1)].join('');
```

puis, juste après le bloc qui présélectionne `tasks-db` (ligne ~76), ajouter :

```js
    if (state.config?.projetsDb) $('projets-db').value = state.config.projetsDb.id;
```

- [ ] **Step 4 : Ajouter les helpers d'injection**

Avant la fonction `onSave` (ligne ~173), ajouter :

```js
// ── Injection de champs Notion ──────────────────────────
function injectTargets() {
  return { tasksDbId: $('tasks-db').value || null, projetsDbId: $('projets-db').value || null };
}

function renderInjectPreview(previewEl, plan, onConfirm) {
  const parts = [];
  if (plan.toCreate.length) {
    parts.push('<strong>À créer :</strong><ul>' +
      plan.toCreate.map((c) => `<li>${esc(c.name)} <span class="type">${esc(c.type)}</span></li>`).join('') + '</ul>');
  } else {
    parts.push('<em>Aucune propriété à créer — tout est déjà en place.</em>');
  }
  if (plan.conflicts.length) {
    parts.push('<strong>⚠️ Ignorées (même nom, type différent) :</strong><ul>' +
      plan.conflicts.map((c) => `<li>${esc(c.name)} — attendu ${esc(c.expectedType)}, présent ${esc(c.actualType)}</li>`).join('') + '</ul>');
  }
  if (plan.skippedNoTarget.length) {
    parts.push('<strong>Relations Projets sautées (aucune base Projets sélectionnée) :</strong><ul>' +
      plan.skippedNoTarget.map((c) => `<li>${esc(c.name)}</li>`).join('') + '</ul>');
  }
  const canApply = plan.toCreate.length > 0;
  parts.push('<div class="cell">' +
    (canApply ? '<button type="button" class="btn btn-primary" id="inject-confirm">Confirmer la création</button>' : '') +
    '<button type="button" class="btn btn-ghost" id="inject-cancel">Fermer</button></div>');
  previewEl.innerHTML = parts.join('');
  previewEl.hidden = false;
  previewEl.querySelector('#inject-cancel').addEventListener('click', () => { previewEl.hidden = true; });
  if (canApply) previewEl.querySelector('#inject-confirm').addEventListener('click', onConfirm);
}

async function onInject(kind) {
  const isTime = kind === 'time';
  const dbId = isTime ? $('time-db').value : $('tasks-db').value;
  const statusEl = $(isTime ? 'inject-time-status' : 'inject-tasks-status');
  const previewEl = $(isTime ? 'inject-time-preview' : 'inject-tasks-preview');
  if (!state.token || !dbId) {
    statusEl.textContent = 'Sélectionne d\'abord le token et la base concernée.';
    statusEl.className = 'status err';
    return;
  }
  const specs = isTime ? FIELD_SPECS_TIME : FIELD_SPECS_TASKS;
  const schema = isTime ? state.schemaTime : state.schemaTasks;
  const plan = planInjection(specs, schema, injectTargets());
  statusEl.textContent = ''; statusEl.className = 'status';
  renderInjectPreview(previewEl, plan, async () => {
    previewEl.hidden = true;
    statusEl.textContent = 'Création…'; statusEl.className = 'status';
    try {
      await addDatabaseProperties(state.token, dbId, plan.properties);
      if (isTime) { state.schemaTime = await getDatabaseSchema(state.token, dbId); remapTime(); }
      else { state.schemaTasks = await getDatabaseSchema(state.token, dbId); remapTasks(); }
      statusEl.textContent = `✓ ${plan.toCreate.length} propriété(s) créée(s). Vérifie le mapping puis Enregistre.`;
      statusEl.className = 'status ok';
    } catch (e) { statusEl.textContent = `Erreur : ${e.message}`; statusEl.className = 'status err'; }
  });
}
```

- [ ] **Step 5 : Persister `projetsDb` dans `onSave`**

Dans `onSave`, dans l'objet `config`, après la ligne `tasksDb: { … },` (ligne ~184), ajouter :

```js
    projetsDb: $('projets-db').value ? { id: $('projets-db').value, name: $('projets-db').selectedOptions[0]?.dataset.name || '' } : null,
```

- [ ] **Step 6 : Brancher les boutons dans `init`**

Dans `init`, après la ligne `$('btn-save').addEventListener('click', onSave);` (ligne ~226), ajouter :

```js
  $('btn-inject-time').addEventListener('click', () => onInject('time'));
  $('btn-inject-tasks').addEventListener('click', () => onInject('tasks'));
```

- [ ] **Step 7 : Vérification manuelle (charger l'extension)**

Charger l'extension dans Chrome (`chrome://extensions` → mode dev → recharger), ouvrir la config :
- le 3ᵉ sélecteur « Base Projets » apparaît et se remplit après « Charger mes bases » ;
- un clic sur « ⚙️ Créer les champs manquants — base Temps » affiche l'aperçu (liste + Confirmer/Fermer) **sans rien écrire** ;
- « Confirmer » crée les propriétés dans Notion, le compte-rendu s'affiche, et les sélecteurs de mapping s'auto-remplissent ;
- re-cliquer affiche « Aucune propriété à créer » (idempotence).

- [ ] **Step 8 : Commit**

```bash
git add src/config/config.js
git commit -m "feat(config): injection de champs — Projets, aperçu/confirmation, re-mapping, persistance"
```

---

## Task 5 : Release — version + documentation (AVEC + D²)

**Files:**
- Modify: `manifest.json`, `package.json`, `package-lock.json`
- Modify: `docs/VERSIONS.md`, `docs/AVANCEMENT.md`, `docs/documentation-fonctionnelle.md`, `docs/documentation-technique.md`, `CLAUDE.md`

- [ ] **Step 1 : Déterminer le numéro de version**

Lire la version courante :

Run: `grep '"version"' manifest.json`
Prendre la version mineure suivante (nouvelle fonctionnalité), p. ex. `5.0.1` → `5.1.0`. Utiliser cette valeur `X.Y.Z` dans les steps suivants.

- [ ] **Step 2 : Bumper les trois sources de version**

Mettre `"version": "X.Y.Z"` dans `manifest.json`, `package.json`, et (champ `version` racine + `packages."".version`) `package-lock.json`.

- [ ] **Step 3 : `docs/VERSIONS.md`**

Ajouter en tête la section :

```markdown
## [X.Y.Z] — 2026-07-16

### Ajouté
- Config : boutons « Créer les champs manquants » pour les bases Temps et Tâches — injection
  automatique des propriétés Notion (types corrects, relations en dual_property), avec aperçu et
  confirmation avant écriture, puis auto-mapping.
- Config : sélecteur « Base Projets » (optionnel) servant de cible aux relations Projets, persisté
  dans `config.projetsDb`.

### Notes
- L'injection est additive (idempotente) : jamais de renommage, retype ou suppression d'une
  propriété existante. Le filtre de statut reste à créer manuellement (type Status non créable via
  l'API Notion).
```

- [ ] **Step 4 : `docs/AVANCEMENT.md`**

Refléter la version `X.Y.Z` et déplacer « injection des champs Notion » de « à faire / idées » vers « fait ». Mettre à jour la prochaine action.

- [ ] **Step 5 : D² — `documentation-fonctionnelle.md`**

Ajouter une sous-section décrivant, côté utilisateur : le sélecteur Base Projets, les deux boutons d'injection, le flux aperçu → confirmation → auto-mapping, et l'encart « Filtre de statut à créer manuellement ».

- [ ] **Step 6 : D² — `documentation-technique.md`**

Ajouter : le module `core/schema-injection.js` (specs + `planInjection`, pur/testé), `addDatabaseProperties` dans `notion-api.js`, et le champ `config.projetsDb` du modèle local.

- [ ] **Step 7 : `CLAUDE.md`**

- Modèle de données local : ajouter `projetsDb{id,name}` à la ligne `config`.
- Carte du code (`src/core/`) : ajouter `schema-injection.js  planInjection (champs à créer, pur)`.

- [ ] **Step 8 : Vérifier la suite de tests**

Run: `npm test`
Expected: PASS (toute la suite, dont `schema-injection`).

- [ ] **Step 9 : Commit de release**

```bash
git add -A
git commit -m "release: vX.Y.Z — injection automatique des champs Notion (config)"
```

---

## Self-Review (fait à la rédaction)

- **Couverture spec** : périmètre C (specs Time+Tasks) ✓ ; sélection Projets ✓ (Task 3/4) ; additif strict + conflits ✓ (Task 1) ; aperçu/confirmation ✓ (Task 4) ; dual_property ✓ (Task 1) ; exclusion statusFilter/sortProperty + encart ✓ (Task 1/3) ; 403 ✓ (Task 2) ; idempotence ✓ (test Task 1) ; `config.projetsDb` ✓ (Task 4) ; D²+AVEC ✓ (Task 5).
- **Placeholders** : aucun — chaque step de code montre le code complet.
- **Cohérence des types** : `planInjection` renvoie `{ toCreate, conflicts, skippedNoTarget, properties }`, consommé tel quel par `renderInjectPreview` et `onInject` ; `FIELD_SPECS_TIME/TASKS` et `addDatabaseProperties` référencés avec les mêmes signatures partout ; `remapTime`/`remapTasks` définis (Task 4 Step 2) avant usage (Step 4).
