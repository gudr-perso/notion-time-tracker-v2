# Favoris : couleur et picto paramétrables — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaque favori de l'enregistrement rapide porte une couleur et un picto choisis par l'utilisateur ; le bouton passe d'un aplat orange à un fond bleu élevé avec un liseret coloré de 4 px et un picto blanc.

**Architecture:** Deux nouveaux modules purs dans `core/` — `fav-icons.js` (table de données des 23 pictos) et `fav-presets.js` (palette de 10 couleurs, normalisation, attribution automatique) — testés sous Vitest. Un module partagé `src/fav-icon.js` construit le `<svg>` (le DOM n'a pas sa place dans `core/`, mais popup **et** config ont besoin du même picto, comme pour `theme.js`). Le popup et la config ne font qu'afficher. La couleur est stockée par **clé** et résolue en CSS via `var(--fav-<clé>)`, ce qui laisse le thème clair assombrir chaque teinte sans toucher aux données.

**Tech Stack:** JS vanilla, modules ES natifs, zéro build, zéro dépendance runtime. Vitest (devDependency) pour `core/`. Tracés SVG repris de Tabler Icons (MIT).

**Spec:** `docs/superpowers/specs/2026-07-17-favoris-couleur-picto-design.md`

---

## Prérequis d'environnement

**Node n'est pas dans le PATH sur cette machine** (constaté le 2026-07-17), alors qu'il est installé.
Chaque commande `npm` de ce plan suppose la ligne suivante en préambule de la session PowerShell :

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
```

Vérification (attendu : `v24.18.0` puis `66 passed`) :

```powershell
node --version
npm test
```

`node_modules/` est déjà présent (arrivé par pCloud) et fonctionne : pas de `npm install` nécessaire.

---

## Écarts assumés par rapport à la spec

La spec §5.1 annonçait **un** module `core/fav-presets.js` portant palette + pictos + normalisation, et §5.3
un rendu SVG sans préciser où il vit. Le plan découpe en trois, pour deux raisons non négociables :

1. **`core/` ne doit pas toucher au DOM** (règle CLAUDE.md : logique pure, testable sans navigateur).
   `createElementNS` part donc dans `src/fav-icon.js`, à la racine de `src/`, exactement comme `src/theme.js`
   qui est déjà partagé entre le popup et la config.
2. **Les 197 lignes de tracés sont des données régénérables**, pas de la logique. Les isoler dans
   `core/fav-icons.js` garde `core/fav-presets.js` lisible (~30 lignes).

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/core/fav-icons.js` | **Créé.** Table `clé → { label, paths }` des 23 pictos. Données pures, régénérables. Attribution Tabler/MIT en en-tête. |
| `src/core/fav-presets.js` | **Créé.** `FAV_COLORS` (10 clés ordonnées), `DEFAULT_FAV_COLOR`, `NO_ICON`, `normalizeFavorite()`, `nextFreeColor()`. Logique pure. |
| `src/fav-icon.js` | **Créé.** `favIconSvg(key)` → élément `<svg>` ou `null`. Partagé popup + config. |
| `test/fav-presets.test.js` | **Créé.** Couvre les deux modules `core/`. |
| `src/popup/popup.css` | **Modifié.** Variables `--fav-*` (2 thèmes), refonte de `.fav-buttons .btn`. |
| `src/popup/timer-manual.js` | **Modifié.** `renderFavoriteButtons()` (picto + liseret), `setFavSaving()` (ne plus détruire le picto). |
| `src/config/config.css` | **Modifié.** Variables `--fav-*` (2 thèmes), grille de la ligne favori, déclencheurs, panneaux. |
| `src/config/config.js` | **Modifié.** `renderFavorites()`, `wireFavorites()`, `init()`, `onSave()`. |

---

### Task 1: Table des pictos

**Files:**
- Create: `src/core/fav-icons.js`
- Test: `test/fav-presets.test.js`

- [ ] **Step 1: Write the failing test**

Créer `test/fav-presets.test.js` :

```js
// test/fav-presets.test.js
import { describe, it, expect } from 'vitest';
import { FAV_ICONS } from '../src/core/fav-icons.js';

describe('FAV_ICONS', () => {
  it('expose les 23 pictos', () => {
    expect(Object.keys(FAV_ICONS)).toHaveLength(23);
  });

  it('chaque picto a un label et au moins un tracé exploitable', () => {
    for (const [key, ico] of Object.entries(FAV_ICONS)) {
      expect(ico.label, key).toBeTruthy();
      expect(Array.isArray(ico.paths), key).toBe(true);
      expect(ico.paths.length, key).toBeGreaterThan(0);
      // Un attribut `d` commence toujours par un moveto.
      for (const d of ico.paths) expect(d, key).toMatch(/^[Mm]/);
    }
  });

  it('ne contient pas le cadre transparent de Tabler', () => {
    // Chaque source Tabler ouvre sur <path d="M0 0h24v24H0z" fill="none"/> : inutile ici.
    for (const [key, ico] of Object.entries(FAV_ICONS)) {
      expect(ico.paths, key).not.toContain('M0 0h24v24H0z');
    }
  });

  it('« none » n’est pas un picto — c’est une absence de picto', () => {
    expect(FAV_ICONS.none).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
npm test
```

Attendu : ÉCHEC — `Failed to load ../src/core/fav-icons.js` (le module n'existe pas).

- [ ] **Step 3: Create the module**

Créer `src/core/fav-icons.js` avec **le contenu intégral de l'annexe A** de ce plan (en-tête d'attribution compris). Ne rien retirer, ne rien réordonner : l'ordre des clés pilote l'ordre de la grille dans la config.

- [ ] **Step 4: Run test to verify it passes**

```powershell
npm test
```

Attendu : `Test Files 7 passed (7)`, `Tests 70 passed (70)` (66 existants + 4 nouveaux).

- [ ] **Step 5: Commit**

```powershell
git add src/core/fav-icons.js test/fav-presets.test.js
git commit -m "feat(favoris): table des 23 pictos SVG (Tabler, MIT)"
```

---

### Task 2: Palette et normalisation

**Files:**
- Create: `src/core/fav-presets.js`
- Modify: `test/fav-presets.test.js`

- [ ] **Step 1: Write the failing test**

Ajouter en haut de `test/fav-presets.test.js`, sous l'import existant :

```js
import {
  FAV_COLORS, DEFAULT_FAV_COLOR, NO_ICON, normalizeFavorite, nextFreeColor,
} from '../src/core/fav-presets.js';
```

Puis ajouter à la fin du fichier :

```js
describe('FAV_COLORS', () => {
  it('compte 10 couleurs, toutes distinctes', () => {
    expect(FAV_COLORS).toHaveLength(10);
    expect(new Set(FAV_COLORS).size).toBe(10);
  });

  it('contient la couleur par défaut des favoris historiques', () => {
    expect(FAV_COLORS).toContain(DEFAULT_FAV_COLOR);
  });
});

describe('normalizeFavorite', () => {
  it('applique orange + aucun picto à un favori d’avant la v5.3.0', () => {
    expect(normalizeFavorite({ taskId: 'abc', customLabel: 'Dev' })).toEqual({
      taskId: 'abc', customLabel: 'Dev', color: 'orange', icon: 'none',
    });
  });

  it('conserve une couleur et un picto valides', () => {
    expect(normalizeFavorite({ taskId: 'a', customLabel: 'L', color: 'cyan', icon: 'code' })).toEqual({
      taskId: 'a', customLabel: 'L', color: 'cyan', icon: 'code',
    });
  });

  it('remplace une couleur inconnue par le défaut', () => {
    expect(normalizeFavorite({ color: 'chartreuse' }).color).toBe('orange');
  });

  it('remplace un picto inconnu par « aucun »', () => {
    expect(normalizeFavorite({ icon: 'licorne' }).icon).toBe('none');
  });

  it('ne se laisse pas piéger par une clé héritée d’Object.prototype', () => {
    expect(normalizeFavorite({ icon: 'toString' }).icon).toBe('none');
  });

  it('tolère undefined et rend un favori complet', () => {
    expect(normalizeFavorite(undefined)).toEqual({
      taskId: '', customLabel: '', color: 'orange', icon: 'none',
    });
  });
});

describe('nextFreeColor', () => {
  it('rend la première couleur de la palette sur une liste vide', () => {
    expect(nextFreeColor([])).toBe(FAV_COLORS[0]);
  });

  it('saute les couleurs déjà prises', () => {
    const favs = [{ color: FAV_COLORS[0] }, { color: FAV_COLORS[1] }];
    expect(nextFreeColor(favs)).toBe(FAV_COLORS[2]);
  });

  it('retombe sur la première couleur quand les 10 sont utilisées', () => {
    expect(nextFreeColor(FAV_COLORS.map((color) => ({ color })))).toBe(FAV_COLORS[0]);
  });

  it('tolère undefined', () => {
    expect(nextFreeColor(undefined)).toBe(FAV_COLORS[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
npm test
```

Attendu : ÉCHEC — `Failed to load ../src/core/fav-presets.js`.

- [ ] **Step 3: Write the implementation**

Créer `src/core/fav-presets.js` :

```js
// src/core/fav-presets.js — presets d'un favori : couleur et picto. Logique pure, sans API Chrome ni DOM.
import { FAV_ICONS } from './fav-icons.js';

// Ordre significatif : il pilote la grille de la config ET l'attribution automatique (nextFreeColor).
// Les valeurs vivent en CSS (--fav-<clé>, un jeu par thème) : on ne stocke que la clé.
export const FAV_COLORS = [
  'cyan', 'orange', 'green', 'amber', 'red', 'purple', 'pink', 'teal', 'lime', 'slate',
];

// Défaut des favoris créés avant la v5.3.0 : reproduit leur apparence orange d'origine.
export const DEFAULT_FAV_COLOR = 'orange';
export const NO_ICON = 'none';

// Applique les défauts à la lecture — c'est ce qui dispense de migrer chrome.storage.
export function normalizeFavorite(fav) {
  const f = fav || {};
  return {
    taskId: f.taskId || '',
    customLabel: f.customLabel || '',
    color: FAV_COLORS.includes(f.color) ? f.color : DEFAULT_FAV_COLOR,
    // hasOwn et pas `in` : sinon 'toString' passerait pour un picto valide.
    icon: Object.hasOwn(FAV_ICONS, f.icon) ? f.icon : NO_ICON,
  };
}

export function nextFreeColor(favorites) {
  const used = new Set((favorites || []).map((f) => f?.color));
  return FAV_COLORS.find((c) => !used.has(c)) || FAV_COLORS[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

```powershell
npm test
```

Attendu : `Tests 82 passed (82)` (70 + 12 nouveaux).

- [ ] **Step 5: Commit**

```powershell
git add src/core/fav-presets.js test/fav-presets.test.js
git commit -m "feat(favoris): palette de 10 couleurs, normalisation et attribution auto"
```

---

### Task 3: Constructeur SVG partagé

**Files:**
- Create: `src/fav-icon.js`

Pas de test automatisé : ce module touche le DOM, et le rendu du popup n'est pas couvert par Vitest (comme
le reste de `src/popup/`). Il est vérifié à l'œil en Task 5.

- [ ] **Step 1: Write the module**

Créer `src/fav-icon.js` :

```js
// src/fav-icon.js — construit le picto SVG d'un favori.
// Vit hors de core/ : core/ reste sans DOM. Partagé popup + config, comme theme.js.
import { FAV_ICONS } from './core/fav-icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Rend un <svg> prêt à insérer, ou null si la clé ne désigne aucun picto (dont 'none').
// Construit avec createElementNS et jamais innerHTML.
export function favIconSvg(key, className = 'fav-ico') {
  const ico = FAV_ICONS[key];
  if (!ico) return null;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); // le picto suit la couleur du texte : blanc
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ico.paths) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}
```

- [ ] **Step 2: Verify nothing broke**

```powershell
npm test
```

Attendu : `Tests 82 passed (82)` — inchangé, le module n'est pas encore importé.

- [ ] **Step 3: Commit**

```powershell
git add src/fav-icon.js
git commit -m "feat(favoris): constructeur SVG partagé popup/config"
```

---

### Task 4: Variables CSS de la palette

**Files:**
- Modify: `src/popup/popup.css:1-10`
- Modify: `src/config/config.css:1-10`

Les deux feuilles sont autonomes et dupliquent déjà les variables de thème (`--cyan`, `--orange`…) : on
reproduit cette duplication assumée plutôt que d'introduire une troisième feuille partagée.

- [ ] **Step 1: Add the dark palette to popup.css**

Dans `src/popup/popup.css`, remplacer le bloc `:root, :root[data-theme="dark"]` par :

```css
:root, :root[data-theme="dark"] {
  --bg-deep:#030826; --bg-elev:#0a1870; --border:#1c2470; --border-soft:#3a4ba0;
  --text:#DDE3F0; --text-muted:#7D8AAD; --cyan:#2aa6e8; --cyan-deep:#138fdb;
  --orange:#f36100; --green:#34d399; --red:#f87171;
  /* Palette des favoris — clé stockée côté données, teinte résolue ici (cf. core/fav-presets.js). */
  --fav-cyan:#2aa6e8; --fav-orange:#f36100; --fav-green:#34d399; --fav-amber:#fbbf24;
  --fav-red:#f87171; --fav-purple:#a78bfa; --fav-pink:#f472b6; --fav-teal:#2dd4bf;
  --fav-lime:#a3e635; --fav-slate:#94a3b8;
}
```

- [ ] **Step 2: Add the light palette to popup.css**

Dans `src/popup/popup.css`, remplacer le bloc `:root[data-theme="light"]` par :

```css
:root[data-theme="light"] {
  --bg-deep:#f4f7ff; --bg-elev:#ffffff; --border:#d6ddf2; --border-soft:#b9c4e6;
  --text:#0b1533; --text-muted:#5a6a99; --cyan:#138fdb; --cyan-deep:#0d6fb0;
  --orange:#e05a00; --green:#059669; --red:#dc2626;
  /* Mêmes clés, teintes assombries : c'est tout l'intérêt de stocker la clé et pas l'hexa. */
  --fav-cyan:#138fdb; --fav-orange:#e05a00; --fav-green:#059669; --fav-amber:#d97706;
  --fav-red:#dc2626; --fav-purple:#7c3aed; --fav-pink:#db2777; --fav-teal:#0d9488;
  --fav-lime:#65a30d; --fav-slate:#64748b;
}
```

- [ ] **Step 3: Apply the same two blocks to config.css**

Les blocs `:root, :root[data-theme="dark"]` et `:root[data-theme="light"]` de `src/config/config.css:1-10`
sont **identiques** à ceux de `popup.css`. Y coller exactement les deux blocs des steps 1 et 2.

- [ ] **Step 4: Commit**

```powershell
git add src/popup/popup.css src/config/config.css
git commit -m "feat(favoris): variables CSS de la palette (clair + sombre)"
```

---

### Task 5: Boutons favoris du popup

**Files:**
- Modify: `src/popup/popup.css:51-52`
- Modify: `src/popup/timer-manual.js:1-4` (imports), `:26-36` (`setSaving`), `:66-78` (`renderFavoriteButtons`)

- [ ] **Step 1: Rework the button CSS**

Dans `src/popup/popup.css`, remplacer la ligne :

```css
.fav-buttons .btn { background:linear-gradient(180deg,var(--orange),#c94f00); color:#fff; }
```

par :

```css
/* Liseret par ombre interne et non border-left : sur un bouton arrondi, la bordure
   donne des extrémités biseautées, l'ombre interne épouse l'arrondi. */
.fav-buttons .btn { display:flex; align-items:center; gap:7px; min-width:0; text-align:left;
  padding:12px 12px 12px 14px; background:var(--bg-elev); color:var(--text);
  border:1px solid var(--border);
  box-shadow:inset 4px 0 0 var(--fav-color, var(--fav-orange)); }
.fav-buttons .fav-ico { flex:0 0 auto; width:16px; height:16px; }
.fav-buttons .fav-btn-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
```

- [ ] **Step 2: Add the imports**

Dans `src/popup/timer-manual.js`, sous les imports existants (après la ligne `import { roundToNearestFiveMinutes, formatDateTimeLocalValue } from '../core/time.js';`) :

```js
import { normalizeFavorite } from '../core/fav-presets.js';
import { favIconSvg } from '../fav-icon.js';
```

- [ ] **Step 3: Fix setSaving so it stops destroying the picto**

Dans `src/popup/timer-manual.js`, remplacer intégralement la fonction `setSaving` :

```js
// Gèle les boutons d'enregistrement pendant l'appel Notion (même sensation que « Enregistrer »).
// sourceBtn = le favori cliqué, le cas échéant → on y affiche un « ⏳ … » le temps de la sauvegarde.
function setSaving(on, sourceBtn) {
  $('btn-primary').disabled = on;
  document.querySelectorAll('#fav-buttons .btn').forEach((b) => { b.disabled = on; });
  if (!sourceBtn) return;
  // Ne viser que le libellé : écraser le contenu du bouton effacerait le picto SVG.
  // Repli sur le bouton lui-même pour « Enregistrer », qui n'a pas de libellé séparé.
  const target = sourceBtn.querySelector('.fav-btn-label') || sourceBtn;
  if (on) { target.dataset.label = target.textContent; target.textContent = '⏳ …'; }
  else if (target.dataset.label !== undefined) {
    target.textContent = target.dataset.label;
    delete target.dataset.label;
  }
}
```

- [ ] **Step 4: Rewrite renderFavoriteButtons**

Dans `src/popup/timer-manual.js`, remplacer intégralement la fonction `renderFavoriteButtons` :

```js
function renderFavoriteButtons() {
  const favs = (T.config.prefs?.favorites || []).map(normalizeFavorite);
  $('fav-buttons').innerHTML = '';
  favs.forEach((fav) => {
    const task = T.tasks.find((t) => t.id === fav.taskId);
    const label = fav.customLabel || task?.name || 'Favori';
    const btn = document.createElement('button');
    btn.className = 'btn';
    // La clé est garantie par normalizeFavorite : pas d'injection possible dans le var().
    btn.style.setProperty('--fav-color', `var(--fav-${fav.color})`);
    btn.title = label; // le libellé se tronque en CSS : l'infobulle rend la version entière
    const ico = favIconSvg(fav.icon);
    if (ico) btn.appendChild(ico);
    const span = document.createElement('span');
    span.className = 'fav-btn-label';
    span.textContent = label;
    btn.appendChild(span);
    btn.addEventListener('click', () => saveManualFor(fav.taskId, btn));
    $('fav-buttons').appendChild(btn);
  });
}
```

Note : le `.slice(0, 20)` disparaît — la troncature est désormais visuelle (`text-overflow`), ce qui rend
le libellé entier disponible en infobulle plutôt que coupé à l'aveugle.

- [ ] **Step 5: Verify the suite still passes**

```powershell
npm test
```

Attendu : `Tests 82 passed (82)`.

- [ ] **Step 6: Verify by hand in the browser**

1. `chrome://extensions` → recharger l'extension (↻).
2. Ouvrir le popup, cocher « Saisie manuelle » pour révéler l'encart « Enregistrement rapide ».
3. Attendu : les favoris existants s'affichent sur **fond bleu élevé**, **liseret orange** à gauche,
   **sans picto** — c'est-à-dire l'apparence d'avant, revisitée, sans aucune migration.
4. Basculer le thème (☀️/🌙) : le liseret suit, sans rechargement.
5. Cliquer un favori : « ⏳ … » remplace le libellé, le picto (ici absent) resterait en place ; la ligne
   part dans Notion et le toast « ✅ Ligne créée dans Notion » s'affiche.

- [ ] **Step 7: Commit**

```powershell
git add src/popup/popup.css src/popup/timer-manual.js
git commit -m "feat(favoris): boutons à liseret coloré et picto blanc"
```

---

### Task 6: Ligne de config — les deux déclencheurs

**Files:**
- Modify: `src/config/config.js:1-6` (imports), `:147-163` (`renderFavorites`), `:301` (`init`), `:279` (`onSave`)
- Modify: `src/config/config.css:42-44`

- [ ] **Step 1: Add the imports**

Dans `src/config/config.js`, sous les imports existants (après `import { applyStoredTheme, toggleTheme } from '../theme.js';`) :

```js
import { FAV_COLORS, NO_ICON, normalizeFavorite, nextFreeColor } from '../core/fav-presets.js';
import { FAV_ICONS } from '../core/fav-icons.js';
import { favIconSvg } from '../fav-icon.js';
```

- [ ] **Step 2: Normalize favorites on load**

Dans `src/config/config.js`, fonction `init()`, remplacer :

```js
    state.favorites = (state.config.prefs?.favorites || []).map((f) => ({ ...f }));
```

par :

```js
    state.favorites = (state.config.prefs?.favorites || []).map(normalizeFavorite);
```

- [ ] **Step 3: Persist color and icon on save**

Dans `src/config/config.js`, fonction `onSave()`, remplacer :

```js
      favorites: state.favorites.filter((f) => f.taskId).slice(0, 8),
```

par :

```js
      favorites: state.favorites.filter((f) => f.taskId).slice(0, 8).map(normalizeFavorite),
```

- [ ] **Step 4: Rewrite renderFavorites with the two triggers**

Dans `src/config/config.js`, remplacer intégralement `renderFavorites()` et ajouter `pickCell()` juste
au-dessus (les panneaux `colorPop`/`iconPop` arrivent en Task 7 ; d'ici là `pickCell` ne pose que le
déclencheur) :

```js
// Une cellule = le bouton déclencheur (aperçu de l'état courant) + son panneau (Task 7).
function pickCell(i, fav, kind) {
  const cell = document.createElement('div');
  cell.className = 'fav-pick';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'fav-trigger';
  trigger.dataset.kind = kind;
  trigger.dataset.i = String(i);
  trigger.setAttribute('aria-expanded', 'false');
  if (kind === 'color') {
    trigger.setAttribute('aria-label', 'Couleur du favori');
    const dot = document.createElement('span');
    dot.className = 'fav-dot';
    // Clé garantie par normalizeFavorite : le var() ne peut pas être détourné.
    dot.style.background = `var(--fav-${fav.color})`;
    trigger.appendChild(dot);
  } else {
    trigger.setAttribute('aria-label', 'Picto du favori');
    const svg = favIconSvg(fav.icon);
    if (svg) trigger.appendChild(svg);
    else {
      const none = document.createElement('span');
      none.className = 'fav-none';
      none.textContent = '∅';
      trigger.appendChild(none);
    }
  }
  const caret = document.createElement('span');
  caret.className = 'fav-caret';
  caret.textContent = '▾';
  trigger.appendChild(caret);
  cell.appendChild(trigger);
  return cell;
}

function renderFavorites() {
  const list = $('fav-list');
  list.innerHTML = '';
  state.favorites.forEach((fav, i) => {
    const div = document.createElement('div');
    div.className = 'cell fav-row';
    const taskOpts = ['<option value="">— tâche —</option>',
      ...state.tasks.map((t) => `<option value="${esc(t.id)}"${t.id === fav.taskId ? ' selected' : ''}>${esc(t.name)}</option>`)].join('');
    div.innerHTML =
      `<select class="input fav-task" data-i="${i}">${taskOpts}</select>` +
      `<input class="input fav-label" data-i="${i}" maxlength="20" placeholder="libellé" value="${esc(fav.customLabel || '')}" />`;
    div.appendChild(pickCell(i, fav, 'color'));
    div.appendChild(pickCell(i, fav, 'icon'));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-ghost fav-del';
    del.dataset.i = String(i);
    del.textContent = '❌';
    div.appendChild(del);
    list.appendChild(div);
  });
  $('btn-add-fav').disabled = state.favorites.length >= 8;
}
```

Note : le `style="flex:0 0 160px"` en dur sur l'input disparaît — la grille CSS (step 6) porte les largeurs.

- [ ] **Step 5: Give a new favorite its color**

Dans `src/config/config.js`, fonction `wireFavorites()`, remplacer :

```js
    state.favorites.push({ taskId: '', customLabel: '' });
```

par :

```js
    state.favorites.push(normalizeFavorite({ color: nextFreeColor(state.favorites), icon: NO_ICON }));
```

- [ ] **Step 6: Widen the row grid and style the triggers**

Dans `src/config/config.css`, remplacer le bloc :

```css
#fav-list .cell { display:grid; grid-template-columns:minmax(0, 1fr) 160px auto;
  gap:10px; align-items:center; }
#fav-list .cell .input { flex:none; width:100%; }
```

par :

```css
/* Rangée favori : grid strict pour ne jamais déborder de la carte
   (select extensible → libellé fixe → couleur → picto → suppression). */
#fav-list .cell { display:grid; grid-template-columns:minmax(0, 1fr) 160px auto auto auto;
  gap:10px; align-items:center; margin-bottom:8px; }
#fav-list .cell .input { flex:none; width:100%; }
.fav-pick { position:relative; }
.fav-trigger { display:flex; align-items:center; gap:6px; background:var(--bg-deep); color:var(--text);
  border:1px solid var(--border-soft); border-radius:10px; padding:9px 10px; cursor:pointer; }
.fav-trigger:focus-visible { outline:none; border-color:var(--cyan); box-shadow:0 0 0 3px rgba(42,166,232,.18); }
.fav-dot { display:block; width:16px; height:16px; border-radius:4px; }
.fav-trigger .fav-ico { width:18px; height:18px; }
.fav-none { width:18px; text-align:center; color:var(--text-muted); }
.fav-caret { color:var(--text-muted); font-size:11px; }
```

Le `div.style.marginBottom = '8px'` posé en JS disparaît au profit du `margin-bottom` ci-dessus.

- [ ] **Step 7: Verify by hand**

1. Recharger l'extension, ouvrir la config (les bases se chargent seules si le token est là).
2. Section « ⭐ Favoris » : chaque ligne montre désormais **cinq** contrôles, la pastille reprenant la
   couleur du favori (orange pour les existants) et le picto affichant `∅`.
3. « ➕ Ajouter un favori » : le nouveau favori naît avec la **première couleur libre** — donc `cyan` si
   aucun favori n'est déjà cyan.
4. Les panneaux ne s'ouvrent pas encore : c'est la Task 7.

- [ ] **Step 8: Commit**

```powershell
git add src/config/config.js src/config/config.css
git commit -m "feat(favoris): ligne de config avec déclencheurs couleur et picto"
```

---

### Task 7: Panneaux de sélection

**Files:**
- Modify: `src/config/config.js` (`pickCell`, `wireFavorites`)
- Modify: `src/config/config.css`

- [ ] **Step 1: Build the two panels**

Dans `src/config/config.js`, ajouter ces deux fonctions juste **au-dessus** de `pickCell()` :

```js
function colorPop(i, current) {
  const pop = document.createElement('div');
  pop.className = 'fav-pop fav-pop-color';
  pop.hidden = true;
  for (const c of FAV_COLORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fav-choice fav-swatch' + (c === current ? ' is-current' : '');
    b.dataset.kind = 'color';
    b.dataset.value = c;
    b.dataset.i = String(i);
    b.style.background = `var(--fav-${c})`;
    b.setAttribute('aria-label', c);
    pop.appendChild(b);
  }
  return pop;
}

function iconPop(i, current) {
  const pop = document.createElement('div');
  pop.className = 'fav-pop fav-pop-icon';
  pop.hidden = true;
  // « Aucun » d'abord : c'est le défaut, il doit être le plus facile à retrouver.
  const cells = [[NO_ICON, 'Aucun picto'], ...Object.entries(FAV_ICONS).map(([k, v]) => [k, v.label])];
  for (const [key, label] of cells) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fav-choice fav-icon-cell' + (key === current ? ' is-current' : '');
    b.dataset.kind = 'icon';
    b.dataset.value = key;
    b.dataset.i = String(i);
    b.title = label;
    b.setAttribute('aria-label', label);
    const svg = favIconSvg(key);
    if (svg) b.appendChild(svg);
    else b.textContent = '∅';
    pop.appendChild(b);
  }
  return pop;
}
```

- [ ] **Step 2: Attach the panel to its trigger**

Dans `src/config/config.js`, fonction `pickCell()`, remplacer la ligne :

```js
  cell.appendChild(trigger);
  return cell;
```

par :

```js
  cell.appendChild(trigger);
  cell.appendChild(kind === 'color' ? colorPop(i, fav.color) : iconPop(i, fav.icon));
  return cell;
}
```

⚠️ La ligne `}` finale de `pickCell` existe déjà : après l'édition, vérifier qu'il n'y en a pas deux.

- [ ] **Step 3: Wire opening, choosing and closing**

Dans `src/config/config.js`, ajouter ces deux fonctions au-dessus de `wireFavorites()` :

```js
function closePopovers() {
  document.querySelectorAll('.fav-pop').forEach((p) => { p.hidden = true; });
  document.querySelectorAll('.fav-trigger').forEach((t) => t.setAttribute('aria-expanded', 'false'));
}

// Un seul panneau ouvert à la fois ; re-cliquer le déclencheur referme.
function togglePopover(trigger) {
  const pop = trigger.parentElement.querySelector('.fav-pop');
  const wasOpen = !pop.hidden;
  closePopovers();
  if (!wasOpen) {
    pop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
  }
}
```

Puis remplacer intégralement `wireFavorites()` :

```js
function wireFavorites() {
  $('btn-add-fav').addEventListener('click', () => {
    if (state.favorites.length >= 8) return;
    state.favorites.push(normalizeFavorite({ color: nextFreeColor(state.favorites), icon: NO_ICON }));
    renderFavorites();
  });
  $('fav-list').addEventListener('input', (e) => {
    const i = Number(e.target.dataset.i);
    if (e.target.classList.contains('fav-task')) state.favorites[i].taskId = e.target.value;
    if (e.target.classList.contains('fav-label')) state.favorites[i].customLabel = e.target.value;
  });
  $('fav-list').addEventListener('click', (e) => {
    // closest() et pas e.target : le clic atterrit souvent sur le <svg> ou la pastille interne.
    const del = e.target.closest('.fav-del');
    if (del) { state.favorites.splice(Number(del.dataset.i), 1); renderFavorites(); return; }
    const trigger = e.target.closest('.fav-trigger');
    if (trigger) { togglePopover(trigger); return; }
    const choice = e.target.closest('.fav-choice');
    if (!choice) return;
    const i = Number(choice.dataset.i);
    if (choice.dataset.kind === 'color') state.favorites[i].color = choice.dataset.value;
    else state.favorites[i].icon = choice.dataset.value;
    renderFavorites(); // reconstruit la ligne (aperçu à jour) et referme le panneau au passage
  });
  // Fermeture au clic extérieur : un clic dans .fav-pick est traité par le listener ci-dessus.
  document.addEventListener('click', (e) => { if (!e.target.closest('.fav-pick')) closePopovers(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopovers(); });
}
```

- [ ] **Step 4: Style the panels**

Dans `src/config/config.css`, ajouter à la suite du bloc `.fav-caret` :

```css
.fav-pop { position:absolute; top:calc(100% + 6px); right:0; z-index:20; display:grid; gap:7px;
  padding:10px; border:1px solid var(--border-soft); border-radius:12px; background:var(--bg-deep);
  box-shadow:0 10px 30px rgba(0,0,0,.45); }
.fav-pop-color { grid-template-columns:repeat(5, 26px); }
.fav-pop-icon { grid-template-columns:repeat(8, 30px); }
.fav-choice { padding:0; border:1px solid transparent; border-radius:7px; cursor:pointer; }
.fav-swatch { width:26px; height:26px; }
.fav-swatch.is-current { outline:2px solid var(--text); outline-offset:2px; }
.fav-icon-cell { display:flex; align-items:center; justify-content:center; width:30px; height:30px;
  background:var(--bg-elev); color:var(--text); border-color:var(--border); }
.fav-icon-cell .fav-ico { width:17px; height:17px; }
.fav-icon-cell.is-current { border-color:var(--cyan); }
```

- [ ] **Step 5: Verify the suite still passes**

```powershell
npm test
```

Attendu : `Tests 82 passed (82)`.

- [ ] **Step 6: Verify the whole feature by hand**

1. Recharger l'extension, ouvrir la config.
2. Cliquer la pastille de couleur d'un favori : le panneau de **10 couleurs** s'ouvre (5 × 2), la couleur
   courante cerclée. En choisir une → le panneau se ferme, la pastille change.
3. Cliquer le déclencheur de picto : panneau de **24 cases** (8 × 3), « aucun » en premier. En choisir un
   → le déclencheur affiche le picto.
4. Ouvrir le panneau de couleur, puis celui d'un **autre** favori : le premier se referme (un seul ouvert).
5. Panneau ouvert : cliquer ailleurs dans la page **ou** presser `Échap` → il se referme.
6. **Enregistrer**, rouvrir le popup en saisie manuelle : les favoris portent leur liseret et leur picto.
7. Basculer le thème dans le popup : les liserets s'assombrissent, aucun ne devient illisible.
8. Cliquer un favori doté d'un picto : « ⏳ … » remplace le libellé, **le picto reste affiché**, le toast
   « ✅ Ligne créée dans Notion » apparaît (c'est la régression que la Task 5 step 3 prévient).

- [ ] **Step 7: Commit**

```powershell
git add src/config/config.js src/config/config.css
git commit -m "feat(favoris): panneaux de choix de la couleur et du picto"
```

---

### Task 8: Release v5.3.0

**Files:**
- Modify: `manifest.json`, `package.json`, `package-lock.json`
- Modify: `docs/VERSIONS.md`, `docs/AVANCEMENT.md`
- Modify: `docs/documentation-fonctionnelle.md`, `docs/documentation-technique.md`

- [ ] **Step 1: Bump the version in the three files**

La source de vérité est `manifest.json` ; `package.json` et `package-lock.json` la dupliquent.
Dans `package-lock.json`, la version apparaît **deux fois** : à la racine et dans `packages[""]`.

```powershell
git grep -n '"version": "5.2.0"' -- manifest.json package.json package-lock.json
```

Passer chacune de ces occurrences à `5.3.0`.

- [ ] **Step 2: Verify the bump**

```powershell
git grep -n '5\.2\.0' -- manifest.json package.json package-lock.json
```

Attendu : **aucune sortie**.

- [ ] **Step 3: Add the VERSIONS.md section**

En haut de la liste des versions de `docs/VERSIONS.md`, au format Keep a Changelog déjà en place :

```markdown
## [5.3.0] — 2026-07-17

### Ajouté
- **Couleur et picto par favori** : chaque favori de l'enregistrement rapide se voit attribuer une couleur
  parmi une palette de 10 et un picto parmi 23 (ou aucun), depuis la page de configuration.
- Nouveaux modules purs testés `core/fav-icons.js` (table des pictos) et `core/fav-presets.js` (palette,
  normalisation, attribution automatique de la première couleur libre) — 16 tests.
- Module partagé `src/fav-icon.js` : construction du picto SVG pour le popup et la config.

### Modifié
- **Boutons favoris** : l'aplat orange laisse place au fond bleu élevé avec un liseret de 4 px dans la
  couleur du favori et le picto en blanc. Le libellé se tronque en `…` avec le texte entier en infobulle,
  au lieu d'être coupé à 20 caractères.

### Corrigé
- L'affichage de « ⏳ … » pendant l'enregistrement d'un favori n'efface plus le picto du bouton.

### Notes
- **Aucune migration** : les favoris existants prennent `orange` et aucun picto à la lecture.
- Tracés des pictos repris de [Tabler Icons](https://tabler.io/icons) (licence MIT).
```

- [ ] **Step 4: Update AVANCEMENT.md**

Dans `docs/AVANCEMENT.md` :
- Ligne 6 : `**Version courante : `5.3.0`**`.
- Ligne 4 : date de dernière mise à jour.
- Ligne 27 et le tableau : le compte de tests passe de `66` à `82` (`7 files`).
- Section « ✅ Faites » : ajouter une entrée v5.3.0 renvoyant à `docs/VERSIONS.md` et à la spec
  `docs/superpowers/specs/2026-07-17-favoris-couleur-picto-design.md`.
- Section « Prochaine action » : le point « favoris 1 clic vs commentaire obligatoire » reste ouvert — il
  est explicitement hors périmètre de cette version (spec §7).
- Section « Environnement & reprise » : ajouter que **Node est installé mais hors PATH** sur cette machine
  (`C:\Program Files\nodejs`), avec la ligne `$env:Path = "C:\Program Files\nodejs;$env:Path"`.

- [ ] **Step 5: Apply D² — documentation fonctionnelle**

Dans `docs/documentation-fonctionnelle.md`, section des favoris : décrire le choix de la couleur et du
picto (palette de 10, 23 pictos + « aucun », panneaux dans la ligne de config), et l'apparence du bouton
côté Timer. Aucun code : point de vue utilisateur uniquement.

- [ ] **Step 6: Apply D² — documentation technique**

Dans `docs/documentation-technique.md`, ajouter aux modules décrits :
- `core/fav-icons.js` — table `clé → { label, paths }`, données Tabler (MIT), régénérables.
- `core/fav-presets.js` — `FAV_COLORS`, `normalizeFavorite()` (défauts à la lecture, d'où l'absence de
  migration), `nextFreeColor()`.
- `src/fav-icon.js` — `favIconSvg()`, hors `core/` puisqu'il touche le DOM, partagé popup + config.
- La résolution couleur : clé stockée → `var(--fav-<clé>)` → jeu de variables par thème.

- [ ] **Step 7: Update the code map in CLAUDE.md**

`CLAUDE.md` § « Structure des fichiers » est la **source unique** de la carte du code. Y ajouter les trois
nouveaux modules, dans les blocs `src/core/` et `src/`.

- [ ] **Step 8: Run the full suite one last time**

```powershell
npm test
```

Attendu : `Test Files 7 passed (7)`, `Tests 82 passed (82)`.

- [ ] **Step 9: Commit and push**

pCloud sauvegarde les fichiers mais **pas l'historique** : une version non poussée meurt avec la machine.

```powershell
git add -A
git commit -m "release: v5.3.0 — couleur et picto paramétrables par favori"
git push origin main
```

- [ ] **Step 10: Verify the push**

```powershell
git status
git log --oneline -1 origin/main
```

Attendu : arbre propre, et le commit de release présent sur `origin/main`.

---

## Annexe A — contenu de `src/core/fav-icons.js`

Généré le 2026-07-17 depuis `https://unpkg.com/@tabler/icons@3.31.0/icons/outline/<nom>.svg`, cadre
transparent (`M0 0h24v24H0z`) retiré. 23 pictos, 80 tracés.

```js
// src/core/fav-icons.js — table des pictos des favoris. Données pures, sans API Chrome ni DOM.
//
// Tracés repris de Tabler Icons — https://tabler.io/icons — licence MIT.
// Copyright (c) 2020-2024 Paweł Kuna. https://github.com/tabler/tabler-icons/blob/main/LICENSE
// Extraits des sources `outline` (viewBox 24, stroke currentColor, sans remplissage), cadre
// transparent d'origine (`M0 0h24v24H0z`) retiré. L'ordre des clés pilote la grille de la config.
//
// Régénération : refetch de https://unpkg.com/@tabler/icons@3.31.0/icons/outline/<nom>.svg et
// extraction des attributs `d`. Correspondance des clés → noms Tabler : file → file-text,
// chart → chart-bar, laptop → device-laptop ; les 20 autres portent le même nom.
export const FAV_ICONS = {
  code: {
    label: 'Développement',
    paths: [
      'M7 8l-4 4l4 4',
      'M17 8l4 4l-4 4',
      'M14 4l-4 16',
    ],
  },
  users: {
    label: 'Réunion',
    paths: [
      'M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
      'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
      'M16 3.13a4 4 0 0 1 0 7.75',
      'M21 21v-2a4 4 0 0 0 -3 -3.85',
    ],
  },
  headset: {
    label: 'Support',
    paths: [
      'M4 14v-3a8 8 0 1 1 16 0v3',
      'M18 19c0 1.657 -2.686 3 -6 3',
      'M4 14a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2v-3z',
      'M15 14a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2v-3z',
    ],
  },
  beach: {
    label: 'Congés',
    paths: [
      'M17.553 16.75a7.5 7.5 0 0 0 -10.606 0',
      'M18 3.804a6 6 0 0 0 -8.196 2.196l10.392 6a6 6 0 0 0 -2.196 -8.196z',
      'M16.732 10c1.658 -2.87 2.225 -5.644 1.268 -6.196c-.957 -.552 -3.075 1.326 -4.732 4.196',
      'M15 9l-3 5.196',
      'M3 19.25a2.4 2.4 0 0 1 1 -.25a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 1 .25',
    ],
  },
  bug: {
    label: 'Bug',
    paths: [
      'M9 9v-1a3 3 0 0 1 6 0v1',
      'M8 9h8a6 6 0 0 1 1 3v3a5 5 0 0 1 -10 0v-3a6 6 0 0 1 1 -3',
      'M3 13l4 0',
      'M17 13l4 0',
      'M12 20l0 -6',
      'M4 19l3.35 -2',
      'M20 19l-3.35 -2',
      'M4 7l3.75 2.4',
      'M20 7l-3.75 2.4',
    ],
  },
  file: {
    label: 'Document',
    paths: [
      'M14 3v4a1 1 0 0 0 1 1h4',
      'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z',
      'M9 9l1 0',
      'M9 13l6 0',
      'M9 17l6 0',
    ],
  },
  mail: {
    label: 'Mail',
    paths: [
      'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z',
      'M3 7l9 6l9 -6',
    ],
  },
  phone: {
    label: 'Téléphone',
    paths: [
      'M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2',
    ],
  },
  car: {
    label: 'Déplacement',
    paths: [
      'M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
      'M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
      'M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5',
    ],
  },
  coffee: {
    label: 'Pause',
    paths: [
      'M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1',
      'M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2',
      'M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2',
      'M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5z',
      'M16.746 16.726a3 3 0 1 0 .252 -5.555',
    ],
  },
  school: {
    label: 'Formation',
    paths: [
      'M22 9l-10 -4l-10 4l10 4l10 -4v6',
      'M6 10.6v5.4a6 3 0 0 0 12 0v-5.4',
    ],
  },
  chart: {
    label: 'Analyse',
    paths: [
      'M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
      'M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
      'M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
      'M4 20h14',
    ],
  },
  checklist: {
    label: 'Tâches',
    paths: [
      'M9.615 20h-2.615a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8',
      'M14 19l2 2l4 -4',
      'M9 8h4',
      'M9 12h2',
    ],
  },
  tool: {
    label: 'Maintenance',
    paths: [
      'M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5',
    ],
  },
  cloud: {
    label: 'Infra',
    paths: [
      'M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878',
    ],
  },
  search: {
    label: 'Recherche',
    paths: [
      'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0',
      'M21 21l-6 -6',
    ],
  },
  book: {
    label: 'Documentation',
    paths: [
      'M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0',
      'M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0',
      'M3 6l0 13',
      'M12 6l0 13',
      'M21 6l0 13',
    ],
  },
  star: {
    label: 'Étoile',
    paths: [
      'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z',
    ],
  },
  building: {
    label: 'Client',
    paths: [
      'M3 21l18 0',
      'M9 8l1 0',
      'M9 12l1 0',
      'M9 16l1 0',
      'M14 8l1 0',
      'M14 12l1 0',
      'M14 16l1 0',
      'M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16',
    ],
  },
  clock: {
    label: 'Temps',
    paths: [
      'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0',
      'M12 7v5l3 3',
    ],
  },
  palette: {
    label: 'Design',
    paths: [
      'M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25',
      'M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
      'M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
      'M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    ],
  },
  laptop: {
    label: 'Ordinateur',
    paths: [
      'M3 19l18 0',
      'M5 6m0 1a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1z',
    ],
  },
  message: {
    label: 'Échange',
    paths: [
      'M8 9h8',
      'M8 13h6',
      'M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z',
    ],
  },
};
```
