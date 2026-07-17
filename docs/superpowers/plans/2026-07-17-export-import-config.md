# Export / import de la configuration — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exporter la configuration (favoris compris, token exclu) dans un fichier JSON et la réimporter depuis la page de configuration.

**Architecture:** Un module pur `src/core/config-io.js` produit l'enveloppe JSON (`buildExport`), valide un fichier importé (`parseImport`) et nomme le fichier (`exportFileName`) — sans API Chrome ni DOM, testé sous Vitest. La couche impure (`Blob`, `<a download>`, `<input type=file>`, `saveConfig`, `location.reload`) vit dans `src/config/config.js`. L'import écrit la config en storage puis recharge la page : le chemin de réhydratation déjà présent (`onLoadDb` → `remapTime`/`remapTasks` → `loadTasksList` → `renderFavorites`) fait le reste sans code neuf.

**Tech Stack:** JS vanilla, modules ES natifs, zéro build, Vitest en devDependency. Cible : extension MV3 Chrome/Edge.

**Spec :** `docs/superpowers/specs/2026-07-17-export-import-config-design.md`

**Branche :** `feature/export-import-config` (déjà créée, la spec y est commitée).

---

## Structure des fichiers

| Fichier | Responsabilité | Nature |
|---|---|---|
| `src/core/config-io.js` | Format, `buildExport`, `parseImport`, `exportFileName`. Pur, testable. | **Créer** |
| `test/config-io.test.js` | Tests Vitest du module pur. | **Créer** |
| `src/config/config.js` | `onExport()`, `onImport()`, câblage des deux boutons dans `init()`. | **Modifier** |
| `src/config/config.html` | Section « Sauvegarde & transfert ». | **Modifier** |
| `CLAUDE.md` | Une ligne dans la carte des fichiers. | **Modifier** |
| `manifest.json` · `package.json` · `package-lock.json` | Bump 5.4.0. | **Modifier** |
| `docs/VERSIONS.md` · `docs/AVANCEMENT.md` · docs D² | Release + D². | **Modifier** |

---

## Task 1 : Module `core/config-io.js` — `buildExport` + `exportFileName`

**Files:**
- Create: `src/core/config-io.js`
- Create: `test/config-io.test.js`

- [ ] **Step 1 : Écrire les tests de `buildExport` et `exportFileName`**

Créer `test/config-io.test.js` :

```js
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
  it('nomme avec la date LOCALE (soirée = pas de bascule vers la veille en UTC)', () => {
    // 2026-07-17 23:30 heure locale — toISOString() donnerait peut-être le 18 selon l’offset,
    // mais le nom doit refléter la date vue par l’utilisateur.
    const d = new Date(2026, 6, 17, 23, 30, 0);
    expect(exportFileName(d)).toBe('notion-timer-config-2026-07-17.json');
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier l’échec**

Run: `npx vitest run test/config-io.test.js`
Expected: FAIL — `Failed to resolve import "../src/core/config-io.js"`.

- [ ] **Step 3 : Écrire `buildExport` + `exportFileName`**

Créer `src/core/config-io.js` :

```js
// src/core/config-io.js — export/import de la configuration. Pur : ni API Chrome, ni DOM.
import { toNotionDate } from './time.js';
import { normalizeFavorite } from './fav-presets.js';

export const FORMAT = 'notion-timer-config';
export const FORMAT_VERSION = 1;

const pad = (n) => String(n).padStart(2, '0');

// Construit l’enveloppe exportée. Le token est RETIRÉ (clé absente, jamais null). Ne mute pas `config`.
// `appVersion` et `now` sont fournis par l’appelant : core/ n’appelle ni chrome.runtime ni l’horloge.
export function buildExport(config, appVersion, now = new Date()) {
  const { notionToken, ...rest } = config || {};
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    exportedAt: toNotionDate(now), // ISO avec offset local, jamais 'Z'
    appVersion: appVersion || '',
    config: rest,
  };
}

// Nom de fichier daté en LOCAL (pas toISOString, qui basculerait de jour le soir).
export function exportFileName(now = new Date()) {
  const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${FORMAT}-${d}.json`;
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npx vitest run test/config-io.test.js`
Expected: PASS (les 6 cas `buildExport` + `exportFileName`).

- [ ] **Step 5 : Commit**

```bash
git add src/core/config-io.js test/config-io.test.js
git commit -m "feat(config-io): buildExport et exportFileName (token exclu, date locale)"
```

---

## Task 2 : `parseImport` — validation, rejets, fusion du token

**Files:**
- Modify: `src/core/config-io.js`
- Modify: `test/config-io.test.js`

- [ ] **Step 1 : Ajouter les tests de `parseImport`**

Ajouter dans `test/config-io.test.js` (compléter l’import en tête du fichier et ajouter le bloc) :

```js
// En tête, remplacer la ligne d’import par :
import { FORMAT, FORMAT_VERSION, buildExport, exportFileName, parseImport } from '../src/core/config-io.js';

// Bloc à ajouter en fin de fichier :
const validFile = (over = {}) => JSON.stringify({
  format: FORMAT, formatVersion: FORMAT_VERSION, exportedAt: '2026-07-17T10:00:00+02:00',
  appVersion: '5.4.0',
  config: {
    timeDb: { id: 'time-1', name: 'Temps', fields: {} },
    tasksDb: { id: 'tasks-1', name: 'Tâches', fields: {} },
    prefs: { favorites: [] },
    theme: 'dark',
    ...over,
  },
});

describe('parseImport — rejets', () => {
  it('JSON invalide', () => {
    expect(() => parseImport('{pas du json', null)).toThrow(/illisible/i);
  });
  it('format absent ou étranger', () => {
    expect(() => parseImport(JSON.stringify({ hello: 1 }), null)).toThrow(/pas un export/i);
  });
  it('formatVersion plus récent que le connu', () => {
    const f = JSON.stringify({ format: FORMAT, formatVersion: FORMAT_VERSION + 1, config: {} });
    expect(() => parseImport(f, null)).toThrow(/plus récente/i);
  });
  it('timeDb.id manquant', () => {
    expect(() => parseImport(validFile({ timeDb: { id: '', fields: {} } }), null)).toThrow(/incomplet/i);
  });
  it('tasksDb.id manquant', () => {
    expect(() => parseImport(validFile({ tasksDb: { id: '', fields: {} } }), null)).toThrow(/incomplet/i);
  });
});

describe('parseImport — token', () => {
  it('conserve le token du poste courant', () => {
    const out = parseImport(validFile(), { notionToken: 'local_TOK' });
    expect(out.notionToken).toBe('local_TOK');
  });
  it('vaut chaîne vide sur un poste neuf (currentConfig null)', () => {
    const out = parseImport(validFile(), null);
    expect(out.notionToken).toBe('');
  });
  it('ignore un notionToken présent dans le fichier (bricolage manuel)', () => {
    const out = parseImport(validFile({ notionToken: 'from_FILE' }), { notionToken: 'local_TOK' });
    expect(out.notionToken).toBe('local_TOK');
  });
});

describe('parseImport — favoris', () => {
  it('normalise couleur et picto inconnus vers les défauts', () => {
    const out = parseImport(validFile({ prefs: { favorites: [{ taskId: 't1', color: 'chartreuse', icon: 'wat' }] } }), null);
    expect(out.prefs.favorites[0].color).toBe('orange');
    expect(out.prefs.favorites[0].icon).toBe('none');
  });
  it('cape la liste à 8', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ taskId: `t${i}` }));
    const out = parseImport(validFile({ prefs: { favorites: many } }), null);
    expect(out.prefs.favorites).toHaveLength(8);
  });
  it('supporte prefs.favorites absent', () => {
    const out = parseImport(validFile({ prefs: { requireComment: true } }), null);
    expect(out.prefs.favorites).toEqual([]);
  });
});

describe('aller-retour', () => {
  it('buildExport puis parseImport redonne la config, token mis à part', () => {
    const cfg = {
      notionToken: 'secret', timeDb: { id: 'time-1', name: 'T', fields: { taskName: 'Nom' } },
      tasksDb: { id: 'tasks-1', name: 'K', fields: { title: 'Nom' } }, projetsDb: { id: 'p', name: 'P' },
      prefs: { requireComment: true, weeklyHours: 39, favorites: [{ taskId: 't1', customLabel: 'X', color: 'cyan', icon: 'code' }] },
      theme: 'light',
    };
    const text = JSON.stringify(buildExport(cfg, '5.4.0'));
    const out = parseImport(text, { notionToken: 'local' });
    expect(out.timeDb).toEqual(cfg.timeDb);
    expect(out.tasksDb).toEqual(cfg.tasksDb);
    expect(out.projetsDb).toEqual(cfg.projetsDb);
    expect(out.theme).toBe('light');
    expect(out.prefs.favorites[0]).toEqual({ taskId: 't1', customLabel: 'X', color: 'cyan', icon: 'code' });
    expect(out.notionToken).toBe('local');
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier l’échec**

Run: `npx vitest run test/config-io.test.js`
Expected: FAIL — `parseImport is not a function` (ou import non résolu).

- [ ] **Step 3 : Écrire `parseImport`**

Ajouter dans `src/core/config-io.js`, après `exportFileName` :

```js
// Valide un fichier importé et renvoie la config prête à écrire. Lève une Error au message clair
// (affiché tel quel dans la zone .status err de la page). Le token n’est JAMAIS lu du fichier :
// on garde celui du poste (currentConfig), ou '' sur un poste neuf.
export function parseImport(text, currentConfig) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fichier illisible — ce n’est pas un JSON valide.');
  }
  if (!data || data.format !== FORMAT) {
    throw new Error('Ce fichier n’est pas un export Notion Time Tracker.');
  }
  if (Number(data.formatVersion) > FORMAT_VERSION) {
    throw new Error('Ce fichier vient d’une version plus récente de l’extension. Mets l’extension à jour.');
  }
  const c = data.config || {};
  if (!c.timeDb?.id || !c.tasksDb?.id) {
    throw new Error('Fichier incomplet — la base Temps ou Tâches est manquante.');
  }
  const favorites = Array.isArray(c.prefs?.favorites)
    ? c.prefs.favorites.slice(0, 8).map(normalizeFavorite)
    : [];
  return {
    ...c,
    notionToken: currentConfig?.notionToken || '',
    prefs: { ...(c.prefs || {}), favorites },
  };
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npx vitest run test/config-io.test.js`
Expected: PASS (tous les blocs, y compris l’aller-retour).

- [ ] **Step 5 : Commit**

```bash
git add src/core/config-io.js test/config-io.test.js
git commit -m "feat(config-io): parseImport — validation, rejets et fusion du token local"
```

---

## Task 3 : Section UI dans `config.html`

**Files:**
- Modify: `src/config/config.html` (après la `<section id="sec-prefs">`, avant `<div class="save-row">`)

- [ ] **Step 1 : Insérer la section**

Dans `src/config/config.html`, entre la fermeture `</section>` de la carte ⑤ Préférences et le `<div class="save-row">`, insérer :

```html
    <!-- ⑥ Sauvegarde & transfert -->
    <section class="card" id="sec-backup">
      <div class="card-head">⑥ Sauvegarde &amp; transfert</div>
      <div class="row">
        <label>Exporter</label>
        <div class="cell">
          <button type="button" id="btn-export" class="btn btn-ghost">⬇️ Exporter la config</button>
          <span id="export-status" class="status"></span>
        </div>
      </div>
      <div class="row">
        <label>Importer</label>
        <div class="cell">
          <button type="button" id="btn-import" class="btn btn-ghost">⬆️ Importer une config</button>
          <input type="file" id="import-file" accept="application/json,.json" hidden />
          <span id="import-status" class="status"></span>
        </div>
      </div>
      <p class="help-note">ℹ️ Le <strong>token Notion n’est jamais inclus</strong> dans le fichier exporté — pense à le saisir sur le nouveau poste après l’import. L’import remplace la configuration actuelle et recharge la page.</p>
    </section>

```

- [ ] **Step 2 : Vérifier le rendu (manuel)**

Recharger l’extension (ou ouvrir `config.html`) : la carte ⑥ apparaît sous ⑤, avant le bouton Enregistrer, avec deux boutons. Les boutons ne font encore rien (câblés en Task 4). Aucune erreur console.

- [ ] **Step 3 : Commit**

```bash
git add src/config/config.html
git commit -m "feat(config): section « Sauvegarde & transfert » (UI)"
```

---

## Task 4 : Câblage export/import dans `config.js`

**Files:**
- Modify: `src/config/config.js` (import en tête, deux handlers, câblage dans `init()`)

- [ ] **Step 1 : Ajouter l’import du module**

Dans `src/config/config.js`, après la ligne `import { taskFromPage } from '../core/mapping.js';` (ligne 5), ajouter :

```js
import { buildExport, parseImport, exportFileName } from '../core/config-io.js';
```

- [ ] **Step 2 : Ajouter les deux handlers**

Dans `src/config/config.js`, juste avant `async function init() {` (ligne 405), insérer :

```js
// ── Sauvegarde & transfert ──────────────────────────────
async function onExport() {
  const status = $('export-status');
  const config = await getConfig();
  if (!config) { status.textContent = 'Rien à exporter — configure d’abord l’extension.'; status.className = 'status err'; return; }
  const appVersion = chrome.runtime.getManifest().version;
  const json = JSON.stringify(buildExport(config, appVersion), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName();
  a.click();
  URL.revokeObjectURL(url);
  status.textContent = 'Exporté ✓ (le token n’est pas dans le fichier).'; status.className = 'status ok';
}

async function onImportFile(e) {
  const status = $('import-status');
  const file = e.target.files?.[0];
  e.target.value = ''; // permet de réimporter le même fichier deux fois de suite
  if (!file) return;
  let text;
  try {
    text = await file.text();
  } catch {
    status.textContent = 'Erreur : fichier illisible.'; status.className = 'status err'; return;
  }
  let next;
  try {
    next = parseImport(text, await getConfig());
  } catch (err) {
    status.textContent = `Erreur : ${err.message}`; status.className = 'status err'; return;
  }
  // Relecture pour l’entête d’info affichée dans la confirmation ; le texte est déjà validé par parseImport.
  let when = '?', from = '?';
  try {
    const raw = JSON.parse(text);
    if (raw.exportedAt) when = new Date(raw.exportedAt).toLocaleDateString('fr-FR');
    if (raw.appVersion) from = raw.appVersion;
  } catch { /* ce bloc ne sert qu’à l’affichage ; une erreur ici est sans conséquence */ }
  if (!confirm(`Config exportée le ${when} depuis la v${from}.\n\nRemplacer la configuration actuelle ? (le token du poste est conservé)`)) {
    status.textContent = 'Import annulé.'; status.className = 'status'; return;
  }
  await saveConfig(next);
  location.reload();
}
```

- [ ] **Step 3 : Câbler les boutons dans `init()`**

Dans `src/config/config.js`, dans `init()`, après la ligne `$('btn-inject-tasks').addEventListener('click', () => onInject('tasks'));` (ligne 430), ajouter :

```js
  $('btn-export').addEventListener('click', onExport);
  $('btn-import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', onImportFile);
```

- [ ] **Step 4 : Vérifier que la suite de tests passe toujours**

Run: `npx vitest run`
Expected: PASS — tous les fichiers de test, y compris `config-io.test.js`. `config.js` n’est pas testé (couche DOM), mais aucun test existant ne doit régresser.

- [ ] **Step 5 : Vérification manuelle (aller-retour réel)**

1. Recharger l’extension, ouvrir la config d’une installation déjà configurée.
2. Cliquer **Exporter la config** → un fichier `notion-timer-config-AAAA-MM-JJ.json` se télécharge.
3. **Ouvrir le fichier dans un éditeur** et confirmer de visu : `config` **ne contient pas** `notionToken`.
4. Cliquer **Importer une config**, choisir ce fichier → la confirmation affiche la date et la version → valider → la page se recharge.
5. Saisir le token, **Tester**, **Charger les bases** → bases, champs, congés et favoris se re-sélectionnent seuls.
6. Cas d’erreur : importer un `.json` quelconque → message « Ce fichier n’est pas un export Notion Time Tracker. »

- [ ] **Step 6 : Commit**

```bash
git add src/config/config.js
git commit -m "feat(config): câblage export/import + confirmation datée à l’import"
```

---

## Task 5 : Release v5.4.0 (version, docs AVEC + D², CLAUDE.md)

**Files:**
- Modify: `manifest.json`, `package.json`, `package-lock.json`
- Modify: `docs/VERSIONS.md`, `docs/AVANCEMENT.md`
- Modify: `docs/documentation-fonctionnelle.md`, `docs/documentation-technique.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1 : Bumper la version (source de vérité = `manifest.json`)**

Dans `manifest.json` et `package.json` : `"version": "5.3.2"` → `"version": "5.4.0"`.
Dans `package-lock.json` : les **deux** occurrences `"version": "5.3.2"` (racine + `packages.""`) → `"5.4.0"`.

Vérifier :

Run: `grep -R '"version": "5.4.0"' manifest.json package.json package-lock.json`
Expected: au moins 4 lignes (1 + 1 + 2).

- [ ] **Step 2 : Ajouter la section dans `docs/VERSIONS.md`**

En tête de la liste des versions (après l’intro, avant `## [5.3.2]`), insérer :

```markdown
## [5.4.0] — 2026-07-17

Export et import de la configuration depuis la page de réglages — favoris compris, **sans le token**.

### Ajouté
- **Exporter la config** : télécharge un JSON (`notion-timer-config-AAAA-MM-JJ.json`) contenant bases, mapping
  des champs, préférences, congés et favoris. Le **token Notion n’y figure jamais** : le fichier peut transiter
  par un cloud sans exposer de secret.
- **Importer une config** : recharge un fichier exporté. Une confirmation annonce la date et la version du
  fichier avant de remplacer la configuration. Le **token du poste est conservé** (jamais écrasé), la page se
  recharge, puis bases/champs/congés/favoris se re-sélectionnent via le chargement habituel.
- Nouveau module pur testé `core/config-io.js` (`buildExport` / `parseImport` / `exportFileName`).

### Notes
- Usage visé : transfert entre postes/navigateurs et sauvegarde de sécurité, **au sein du même workspace
  Notion** (les identifiants Notion du fichier y restent valides). Le partage à un tiers et les « profils »
  multi-workspace sont hors périmètre.
```

- [ ] **Step 3 : Refléter la version dans `docs/AVANCEMENT.md`**

Mettre à jour l’entête de version (reflet de `manifest.json`) vers **5.4.0** et déplacer « export/import de config » de « à faire / idées » vers « fait ». Suivre le format déjà en place dans le fichier.

- [ ] **Step 4 : D² — `docs/documentation-fonctionnelle.md`**

Ajouter une sous-section décrivant, côté utilisateur : les deux boutons de la carte ⑥, ce que contient le
fichier, **le fait que le token n’est pas transporté**, et le déroulé d’un import sur un poste neuf (importer →
saisir le token → Tester → Charger les bases → Enregistrer). Aucun code.

- [ ] **Step 5 : D² — `docs/documentation-technique.md`**

Ajouter le module `core/config-io.js` à la description technique : rôle de `buildExport` (enveloppe, token
retiré, date via `toNotionDate`), `parseImport` (validation `format`/`formatVersion`/bases, normalisation des
favoris, fusion du token local), `exportFileName` (date locale). Mentionner que l’import réutilise le chemin de
réhydratation existant de `config.js` plutôt que de le réimplémenter.

- [ ] **Step 6 : Carte des fichiers dans `CLAUDE.md`**

Dans la section « Structure des fichiers », sous `core/`, ajouter une ligne :

```
    config-io.js                 export/import config : buildExport, parseImport, exportFileName (token exclu)
```

- [ ] **Step 7 : Vérifier la suite complète**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 8 : Commit de release**

```bash
git add manifest.json package.json package-lock.json docs/VERSIONS.md docs/AVANCEMENT.md docs/documentation-fonctionnelle.md docs/documentation-technique.md CLAUDE.md
git commit -m "release: v5.4.0 — export/import de la configuration (token exclu)"
```

---

## Task 6 : Intégration sur `main` et push

**Files:** aucun (opérations git). **À faire valider par l’utilisateur avant exécution** — ne pas merger/pousser sans accord.

- [ ] **Step 1 : Vérifier l’état de la branche**

Run: `git log --oneline main..feature/export-import-config`
Expected: la spec + les commits des Tasks 1 à 5.

- [ ] **Step 2 : Merge sur `main` (option, selon accord utilisateur)**

```bash
git checkout main
git merge --no-ff feature/export-import-config -m "merge: v5.4.0 — export/import de la configuration"
```

- [ ] **Step 3 : Push (option, selon accord utilisateur)**

```bash
git push origin main
```

> Rappel spec §8 : pousser sur GitHub, pCloud ne sauvegarde pas l’historique. Ne rien pousser sans le feu vert explicite de l’utilisateur.

---

## Self-review (fait à la rédaction)

- **Couverture spec** : §4 format → Task 1 ; §5.2 `buildExport`/`parseImport`/`exportFileName` → Tasks 1-2 ; §5.3 erreurs → Task 2 (tests de rejet + messages) ; §3 parcours + §5.1 réhydratation → Task 4 (câblage + vérif manuelle) ; §6 tests → Tasks 1-2 ; §8 livraison → Task 5. UI §3.1 → Task 3.
- **Placeholders** : aucun TODO/TBD ; chaque step de code montre le code complet à écrire.
- **Cohérence des noms** : `buildExport(config, appVersion, now)`, `parseImport(text, currentConfig)`, `exportFileName(now)`, `FORMAT`, `FORMAT_VERSION` — identiques entre module, tests et appels dans `config.js`. `normalizeFavorite` et `toNotionDate` réutilisés tels qu’exportés par les modules existants.
- **Point de vigilance** : `chrome.runtime.getManifest().version` n’est pas testé unitairement (API Chrome) — couvert par la vérif manuelle Step 5 de Task 4.
```
