# Design — Favoris : couleur et picto paramétrables

> Date : 2026-07-17
> Périmètre : **refonte visuelle des boutons favoris** de l'onglet Timer et **choix d'une couleur et d'un
> picto par favori** dans la page de configuration.

Références : `src/popup/timer-manual.js` (`renderFavoriteButtons`, `setSaving`), `src/popup/popup.css`
(`.fav-buttons`), `src/config/config.js` (`renderFavorites`, `wireFavorites`), `src/config/config.css`,
CLAUDE.md (méthode AVEC + D²).

---

## 1. Problème & objectif

Les huit favoris de l'enregistrement rapide sont aujourd'hui des **aplats orange identiques** portant un
libellé texte (`popup.css` : `.fav-buttons .btn`). Rien ne les distingue au coup d'œil : il faut lire
chaque libellé, tronqué à 20 caractères, pour retrouver le bon. La couleur orange sature par ailleurs le
bas du popup alors qu'elle sert déjà à identifier l'encart lui-même.

Objectif : chaque favori porte une **identité visuelle propre**, choisie par l'utilisateur à la création —
une **couleur** et un **picto** — sur un bouton redevenu sobre.

---

## 2. Décisions de cadrage (validées en brainstorming)

| Sujet | Décision |
|-------|----------|
| Direction visuelle | **Liseret seul** (variante A) : fond bleu élevé uni + bande colorée de 4 px à gauche. Écartées : fond teinté (B, jugé trop présent), pastille d'icône (C). |
| Couleur du picto | **Blanc** (`--text`) en toutes circonstances — le picto ne prend pas la couleur du favori. |
| Nature des pictos | **Jeu SVG monochrome intégré** (23 pictos + « aucun »). Emojis **écartés** : ils portent leurs propres couleurs et ne peuvent pas être blancs. |
| Choix de la couleur | **Palette fermée de 10 couleurs**, toutes validées lisibles sur le fond sombre **et** sur le thème clair. Pas de nuancier libre : aucun favori ne peut devenir illisible. |
| Stockage de la couleur | **Clé** (`'cyan'`, `'orange'`…), **jamais un hexadécimal** — c'est ce qui permet au thème clair d'assombrir chaque teinte sans toucher aux données. |
| Défauts d'un favori existant | `color: 'orange'`, `icon: 'none'` — appliqués **à la lecture**, pas de migration du storage. Reproduit l'apparence actuelle. |
| Défauts d'un nouveau favori | **Première couleur libre** de la palette, **aucun picto** : créer un favori vite fait n'impose aucun choix. |
| Version | **5.3.0**. |

---

## 3. Parcours utilisateur

### 3.1 Onglet Timer (popup)

L'encart « Enregistrement rapide » garde sa bordure et son titre orange. Chaque bouton favori :

- fond **`--bg-elev`** (bleu élevé) au lieu du dégradé orange ;
- **coins arrondis à 10 px** conservés, comme tous les boutons du popup ;
- **bande de 4 px** à gauche dans la couleur du favori. Réalisée par une **ombre interne**
  (`box-shadow: inset 4px 0 0 …`) et non par `border-left` : sur un bouton arrondi, la bordure classique
  produit des extrémités biseautées ; l'ombre interne épouse l'arrondi ;
- **picto SVG 16 px blanc** avant le libellé, absent si `icon: 'none'` ;
- **libellé tronqué en `…`** par CSS (`text-overflow: ellipsis`) plutôt que coupé à l'aveugle en JS.

Aucun changement de comportement : un clic enregistre toujours la session (`saveManualFor`).

### 3.2 Page de configuration

Chaque ligne de favori passe de trois à cinq contrôles :

`[ tâche Notion ▾ ] [ libellé ] [ ● couleur ▾ ] [ ⌘ picto ▾ ] [ 🗑 ]`

- Les deux nouveaux boutons sont **compacts** et affichent l'état courant (la pastille de couleur, le picto).
- Un clic ouvre un **panneau ancré sous le bouton** : grille de 10 couleurs (5 × 2) ou de 24 cases
  (8 × 3 : 23 pictos + « aucun »).
- **Un seul panneau ouvert à la fois** ; fermeture au clic extérieur ou sur `Échap`. La sélection ferme le
  panneau et met à jour l'aperçu du bouton déclencheur.
- La valeur courante est signalée par un **contour** (couleurs) ou une **bordure accentuée** (pictos).

Comme aujourd'hui, rien n'est écrit tant que l'utilisateur n'a pas cliqué **Enregistrer**.

---

## 4. Modèle de données

```js
// config.prefs.favorites — max 8
{
  taskId: '…',            // inchangé
  customLabel: '…',       // inchangé, maxlength 20
  color: 'cyan',          // NOUVEAU — clé de FAV_COLORS, défaut 'orange'
  icon: 'code',           // NOUVEAU — clé de FAV_ICONS ou 'none', défaut 'none'
}
```

**Aucune migration.** Les favoris déjà stockés n'ont ni `color` ni `icon` ; `normalizeFavorite()` applique
les défauts à chaque lecture. Une clé inconnue (palette réduite dans une version future, storage bricolé à
la main) retombe sur le défaut plutôt que de casser le rendu.

---

## 5. Architecture

### 5.1 Nouveau module pur — `src/core/fav-presets.js`

Conforme à la règle « logique pure dans `core/`, testée, sans API Chrome ». Consommé **à la fois** par le
popup et par la config, qui se contentent d'afficher.

| Export | Rôle |
|---|---|
| `FAV_COLORS` | Tableau **ordonné** des 10 clés de couleur. L'ordre pilote la grille de la config **et** l'attribution automatique. |
| `FAV_ICONS` | Table `clé → { label, path }`. `path` = attribut `d` d'un tracé SVG en `viewBox="0 0 24 24"`, `stroke="currentColor"`, sans remplissage. |
| `normalizeFavorite(fav)` | Renvoie `{ taskId, customLabel, color, icon }` : défauts appliqués, clés inconnues remplacées par le défaut. |
| `nextFreeColor(favorites)` | Première clé de `FAV_COLORS` non utilisée par les favoris existants ; si les 10 sont prises, retombe sur `FAV_COLORS[0]`. |

**Palette** (clé → sombre / clair) :

| Clé | Sombre | Clair |
|---|---|---|
| `cyan` | `#2aa6e8` | `#138fdb` |
| `orange` | `#f36100` | `#e05a00` |
| `green` | `#34d399` | `#059669` |
| `amber` | `#fbbf24` | `#d97706` |
| `red` | `#f87171` | `#dc2626` |
| `purple` | `#a78bfa` | `#7c3aed` |
| `pink` | `#f472b6` | `#db2777` |
| `teal` | `#2dd4bf` | `#0d9488` |
| `lime` | `#a3e635` | `#65a30d` |
| `slate` | `#94a3b8` | `#64748b` |

**Pictos** (23 + `none`) : `code`, `users`, `headset`, `beach`, `bug`, `file`, `mail`, `phone`, `car`,
`coffee`, `school`, `chart`, `checklist`, `tool`, `cloud`, `search`, `book`, `star`, `building`, `clock`,
`palette`, `laptop`, `message`.

> **Licence** : les tracés sont repris de **Tabler Icons** (licence MIT). L'en-tête de `fav-presets.js`
> porte l'attribution et le lien vers la licence. Aucune dépendance runtime n'est ajoutée : les tracés sont
> inline dans le module.

### 5.2 Couleurs côté CSS

Dix variables `--fav-<clé>` déclarées dans les deux blocs de thème (`:root` et `:root[data-theme="light"]`),
dans `popup.css` **et** `config.css` — même duplication assumée que les variables de thème existantes
(`--cyan`, `--orange`…), les deux pages ayant chacune leur feuille autonome.

Le rendu ne code aucune couleur en dur : le JS pose
`btn.style.setProperty('--fav-color', 'var(--fav-' + fav.color + ')')`, la clé étant garantie valide par
`normalizeFavorite()`. La CSS consomme `var(--fav-color)`. Le basculement de thème reste donc purement CSS.

### 5.3 Rendu du picto

Le SVG est construit avec `createElementNS` (jamais `innerHTML`) à partir du `path` du preset — cohérent
avec l'échappement systématique déjà pratiqué dans `config.js` (`esc()`).

### 5.4 Point d'attention — `setSaving()`

`setSaving()` (`timer-manual.js:30`) sauvegarde et remplace **`sourceBtn.textContent`** pour afficher
« ⏳ … » pendant l'appel Notion. Avec le nouveau balisage, cela **détruirait le SVG du picto**. La fonction
doit désormais viser le **`<span class="fav-label">`** du bouton et le restaurer à l'identique, le picto
restant en place pendant l'enregistrement.

### 5.5 Fichiers touchés

| Fichier | Nature |
|---|---|
| `src/core/fav-presets.js` | **Nouveau** — palette, pictos, normalisation. |
| `test/fav-presets.test.js` | **Nouveau** — voir §6. |
| `src/popup/timer-manual.js` | `renderFavoriteButtons()` (balisage picto + liseret), `setSaving()` (§5.4). |
| `src/popup/popup.css` | `.fav-buttons .btn` refait, variables `--fav-*`. |
| `src/config/config.js` | `renderFavorites()` (2 contrôles), `wireFavorites()` (panneaux), `onSave()` (persistance de `color`/`icon`). |
| `src/config/config.css` | Boutons déclencheurs, panneaux, grilles. |

---

## 6. Tests

`test/fav-presets.test.js`, sous Vitest, sur le module pur uniquement (le rendu DOM n'est pas testé, comme
le reste du popup) :

- `normalizeFavorite()` : applique `orange` / `none` sur un favori historique ; conserve des valeurs
  valides ; remplace une clé de couleur **inconnue** par `orange` et une clé de picto inconnue par `none` ;
  préserve `taskId` et `customLabel`.
- `nextFreeColor()` : renvoie `FAV_COLORS[0]` sur une liste vide ; saute les couleurs déjà prises ;
  retombe sur `FAV_COLORS[0]` quand les 10 sont utilisées.
- Intégrité des presets : `FAV_COLORS` compte 10 clés **uniques** ; chaque entrée de `FAV_ICONS` a un
  `label` non vide et un `path` non vide ; `none` n'est pas une clé de `FAV_ICONS` (c'est une absence, pas
  un picto).

Vérification manuelle attendue au rechargement de l'extension : les favoris existants s'affichent en orange
sans picto (apparence inchangée), et le liseret suit le basculement de thème.

---

## 7. Hors périmètre

- **Réordonner** les favoris (glisser-déposer) — non demandé, reste hors sujet.
- **Couleur libre** hors palette — écartée en cadrage.
- **Picto sur les autres boutons** (démarrer, congés, sessions récentes) — les favoris seuls sont concernés.
- Le point ouvert « favoris 1 clic vs commentaire obligatoire » (`docs/AVANCEMENT.md`) reste **indépendant**
  et non tranché ici.

---

## 8. Livraison

Release **v5.3.0** : bump `manifest.json` + `package.json` + `package-lock.json`, section dans
`docs/VERSIONS.md`, version reflétée dans `docs/AVANCEMENT.md`, et **D²** — `documentation-fonctionnelle.md`
(choix couleur/picto d'un favori) et `documentation-technique.md` (module `core/fav-presets.js`) mises à
jour dans le commit de release. Poussée sur GitHub dans la foulée (pCloud ne sauvegarde pas l'historique).
