# Design — Export / import de la configuration

> Date : 2026-07-17
> Périmètre : **exporter la configuration dans un fichier JSON** et **la réimporter**, favoris compris, depuis
> la page de configuration.

Références : `src/config/config.js` (`init`, `onLoadDb`, `loadSchemas`, `remapTime`, `remapTasks`,
`loadTasksList`, `renderFavorites`, `onSave`), `src/core/storage.js` (`getConfig`, `saveConfig`),
`src/core/fav-presets.js` (`normalizeFavorite`), `src/core/time.js` (`toNotionDate`), CLAUDE.md (méthode
AVEC + D²). Inspiration : `configIO.ts` du projet `planner-proto`.

---

## 1. Problème & objectif

La configuration se ressaisit intégralement à la main : token, deux (voire trois) bases Notion, une quinzaine
de champs mappés, les préférences, la tâche congés et jusqu'à huit favoris avec leur libellé, leur couleur et
leur picto. Cette saisie ne vit que dans le `chrome.storage.local` d'un profil de navigateur donné. Elle est
donc **ni transférable ni sauvegardable** : installer l'extension sur un second poste impose de tout refaire, et
un profil Chrome perdu emporte la configuration avec lui.

Objectif : un **fichier JSON** produit en un clic depuis la page de configuration, et rechargeable en un clic
sur une autre installation — **sans jamais transporter le token Notion**.

---

## 2. Décisions de cadrage (validées en brainstorming)

| Sujet | Décision |
|-------|----------|
| Cas d'usage retenus | **Transfert entre postes / navigateurs** (Chrome, Edge, autre machine) et **sauvegarde de sécurité**. Les deux restent dans **le même workspace Notion** et concernent **le même utilisateur**. |
| Cas d'usage écartés | **Partage avec un tiers** et **bascule entre plusieurs configs** (« profils »). Ce dernier serait un design différent, pas une variante de celui-ci. |
| Conséquence directe | Le workspace étant le même, **tous les identifiants Notion du fichier restent valides** (`timeDb.id`, `tasksDb.id`, `projetsDb.id`, `vacationTaskId`, `taskId` de chaque favori). **Aucun remapping**, aucune résolution par nom, aucun appel Notion à l'import. |
| Token Notion | **Jamais exporté.** Absent du fichier (absent, pas `null`). Même choix que `planner-proto`, dont la première ligne de `configIO.ts` est une liste `EXCLUDED_KEYS` écartant ses tokens. Motif : le fichier transitera vraisemblablement par pCloud, et un token Notion qui fuite ne fait aucun bruit. |
| Token à l'import | **Celui du poste est conservé**, jamais écrasé. Sur un poste neuf il vaut `''` et se saisit après l'import. |
| Périmètre exporté | **La clé `config` seule.** `currentSession` (session en cours) n'a aucun sens sur un autre poste ; `taskHistory` n'est qu'un LRU de 20 `taskId` qui se reconstruit tout seul. |
| Mécanisme d'import | **Écriture directe dans le storage puis rechargement de la page** (approche de `planner-proto`, qui termine son `importConfig()` par `window.location.reload()`). |
| Alternatives écartées | **Pré-remplir le formulaire sans écrire** : peupler les `<select>` exige le schéma, donc le token — un poste neuf ne pourrait alors rien importer, ce qui casse le cas d'usage principal. **`chrome.storage.sync`** : ne synchronise pas entre Chrome et Edge, ne couvre pas la sauvegarde (une corruption se réplique), et pousserait le token en clair chez Google. |
| Version | **5.4.0** (feature, depuis 5.3.2). |

---

## 3. Parcours utilisateur

### 3.1 Export

Section « Sauvegarde & transfert », **en bas** de la page de configuration. Un clic sur **Exporter la config**
télécharge `notion-timer-config-2026-07-17.json`. La zone de statut confirme, et rappelle que le token n'est pas
dans le fichier.

Placement en bas assumé : l'import est une action **rare et destructive**, elle n'a pas à se trouver sous la
main à côté du champ token. Sur un poste neuf, on scrolle une fois.

### 3.2 Import sur un poste neuf

1. Ouvrir la configuration, scroller jusqu'à **Importer une config**, choisir le fichier.
2. Une confirmation annonce **la provenance du fichier** — « Config exportée le 17/07/2026 depuis la v5.4.0 » —
   et prévient que la configuration actuelle sera remplacée, token conservé.
3. La page se recharge : bases, mapping, préférences, congés et favoris sont en storage.
4. Saisir le token, **Tester**, **Charger les bases**.
5. Tout se re-sélectionne seul (cf. §5.1), il ne reste qu'à **Enregistrer**.

L'ordre est naturel : on importe **avant** d'avoir un token, ce qui est précisément le cas d'un poste neuf.

### 3.3 Restauration sur un poste déjà configuré

Identique, l'étape 4 en moins : le token est déjà là, on charge les bases et on enregistre.

---

## 4. Format du fichier

```json
{
  "format": "notion-timer-config",
  "formatVersion": 1,
  "exportedAt": "2026-07-17T14:32:00+02:00",
  "appVersion": "5.4.0",
  "config": {
    "timeDb":    { "id": "…", "name": "…", "fields": { } },
    "tasksDb":   { "id": "…", "name": "…", "fields": { } },
    "projetsDb": { "id": "…", "name": "…" },
    "prefs":     { "requireComment": false, "favorites": [] },
    "theme": "dark"
  }
}
```

`notionToken` est **absent** de `config`.

L'enveloppe autour de `config` n'est pas décorative :

- **`format`** — rejeter un JSON étranger avec un message clair plutôt que planter plus loin sur une clé absente.
- **`formatVersion`** — point d'accroche si la forme de la config évolue. Un fichier portant une version
  **supérieure** à celle connue est refusé plutôt qu'interprété de travers.
- **`exportedAt` / `appVersion`** — purement informatifs, mais ils alimentent la confirmation de §3.2 : avec
  plusieurs fichiers dans le dossier de téléchargement, savoir **lequel on charge** est le besoin réel.

`exportedAt` est émis via **`toNotionDate()`** : ISO **avec offset local**, jamais `Z` — même règle que les dates
envoyées à Notion (CLAUDE.md §Contraintes). Le nom du fichier réutilise ces dix premiers caractères, ce qui
donne la **date locale** ; un `toISOString()` afficherait la veille en soirée.

---

## 5. Architecture

### 5.1 Le socle existe déjà

La page de configuration **sait déjà se réhydrater** depuis une config en storage. Ce chemin est aujourd'hui
déclenché par le chargement initial ; l'import se contente de le réamorcer :

| Étape | Ce qui est relu | Effet |
|---|---|---|
| `init()` | `getConfig()` → `state.config`, `state.favorites` | Token, préférences, libellé externe, heures/semaine. |
| `onLoadDb()` | `state.config.timeDb/tasksDb/projetsDb` | Les trois `<select>` de bases se repositionnent (`config.js:80-82`). |
| `remapTime()` / `remapTasks()` | `state.config.*.fields` | Chaque champ mappé se re-sélectionne. |
| `loadTasksList()` | `state.config.prefs.vacationTaskId` | La tâche congés se re-sélectionne. |
| `renderFavorites()` | `state.favorites` | Les favoris se repeignent, couleur et picto compris. |

**Conséquence : l'import n'a rien à réimplémenter.** Il écrit la config et recharge la page ; le flux normal fait
le reste. C'est ce qui rend la fonctionnalité petite.

**Garde-fou déjà en place** : si l'on importait puis cliquait **Enregistrer** sans avoir chargé les bases,
`collectTimeFields()` lirait des `<select>` vides et la validation de `config.js:377` refuserait avec « Champs
obligatoires manquants (Nom, Début, Fin) ». La config fraîchement importée **ne peut donc pas être écrasée
silencieusement**. Aucun code supplémentaire n'est requis pour s'en prémunir.

### 5.2 Nouveau module pur — `src/core/config-io.js`

Conforme à la règle « logique pure dans `core/`, testée, sans API Chrome ni DOM ». Le `Blob`, le
`<a download>` et l'`<input type="file">` restent dans `config/config.js` — même frontière que celle qui a
déjà sorti `fav-icon.js` de `core/`.

| Export | Rôle |
|---|---|
| `FORMAT` / `FORMAT_VERSION` | `'notion-timer-config'` / `1`. |
| `buildExport(config, appVersion)` | Renvoie l'enveloppe §4, **token retiré**, **sans muter** `config`. |
| `parseImport(text, currentConfig)` | Renvoie la config prête à écrire, ou **lève** une erreur explicite (§5.3). |
| `exportFileName(date)` | `notion-timer-config-AAAA-MM-JJ.json`, date **locale**. |

`appVersion` est un **paramètre** de `buildExport()` et non une lecture interne : la version vient de
`chrome.runtime.getManifest().version`, une API Chrome que `core/` n'a pas le droit d'appeler. C'est
`config.js` qui la fournit — au même titre que la date, injectée plutôt que lue, ce qui garde les deux
fonctions pures et testables sans horloge.

`parseImport()` enchaîne : `JSON.parse` → contrôle de `format` → contrôle de `formatVersion` → contrôle de la
présence de `timeDb.id` et `tasksDb.id` → **normalisation** → **fusion**.

- **Normalisation** : chaque favori repasse par `normalizeFavorite()` (`core/fav-presets.js`) et la liste est
  recapée à **8**. Un fichier édité à la main, ou produit par une version à la palette différente, ne peut donc
  pas injecter une couleur ou un picto inconnus dans le storage. Même philosophie que les défauts appliqués à
  la lecture, décidée pour les favoris (spec du 2026-07-17).
- **Fusion** : `{ ...imported.config, notionToken: currentConfig?.notionToken || '' }`. C'est **le seul endroit**
  où le token est traité, et il n'est jamais lu depuis le fichier.

### 5.3 Erreurs

`parseImport()` lève des messages en français, affichés dans la zone `.status err` comme partout ailleurs :

| Cas | Message |
|---|---|
| JSON invalide | « Fichier illisible — ce n'est pas un JSON valide. » |
| `format` absent ou autre | « Ce fichier n'est pas un export Notion Time Tracker. » |
| `formatVersion` > connu | « Ce fichier vient d'une version plus récente de l'extension. Mets l'extension à jour. » |
| `timeDb.id` ou `tasksDb.id` manquant | « Fichier incomplet — la base Temps ou Tâches est manquante. » |

Rien n'est écrit en storage tant qu'une erreur est possible : la validation précède `saveConfig()`.

### 5.4 Fichiers touchés

| Fichier | Nature |
|---|---|
| `src/core/config-io.js` | **Nouveau** — format, `buildExport`, `parseImport`, `exportFileName`. |
| `test/config-io.test.js` | **Nouveau** — voir §6. |
| `src/config/config.js` | `onExport()`, `onImport()`, câblage des deux boutons dans `init()`. |
| `src/config/config.html` | Section « Sauvegarde & transfert ». |
| `src/config/config.css` | Rien de neuf a priori — `.btn`, `.status` et les cartes existent. |
| `CLAUDE.md` | Une ligne dans la carte des fichiers pour `core/config-io.js`. |

---

## 6. Tests

`test/config-io.test.js`, sous Vitest, sur le module pur uniquement (le téléchargement et la lecture de fichier
ne sont pas testés, comme le reste de la couche DOM) :

- `buildExport()` : **ne laisse jamais fuiter le token** (absent de la sortie, même clé absente) ; **ne mute pas**
  la config d'entrée ; pose `format`, `formatVersion`, `appVersion` ; `exportedAt` porte un **offset local**, pas
  un `Z`.
- `parseImport()` — rejets : JSON invalide ; `format` absent ou étranger ; `formatVersion` supérieur au connu ;
  `timeDb.id` manquant ; `tasksDb.id` manquant.
- `parseImport()` — token : **conserve** celui de `currentConfig` ; renvoie `''` si `currentConfig` est `null`
  (poste neuf) ; **ignore** un `notionToken` présent dans le fichier (fichier bricolé à la main).
- `parseImport()` — favoris : normalise une couleur et un picto inconnus vers les défauts ; **cape à 8** une liste
  plus longue ; supporte `prefs.favorites` absent.
- **Aller-retour** : `buildExport()` puis `parseImport()` redonne la config d'origine, token mis à part.
- `exportFileName()` : date **locale** (un cas en soirée, pour verrouiller la non-régression vers `toISOString()`).

Vérification manuelle attendue : exporter, ouvrir le fichier et **constater de visu l'absence du token**, puis
réimporter sur un profil vierge et dérouler §3.2 jusqu'à l'enregistrement.

---

## 7. Hors périmètre

- **Profils multiples** / bascule entre plusieurs configs Notion — écarté en cadrage, design distinct.
- **Remapping des identifiants** vers un autre workspace Notion — sans objet, l'usage reste mono-workspace.
- **Chiffrement du fichier** — sans objet dès lors que le token n'y est pas.
- **Export de `taskHistory` / `currentSession`** — écarté en cadrage (§2).
- **Sauvegarde automatique / planifiée** — non demandé.
- **Import depuis la v1 (`4.9.4`)** — la règle « aucune migration v1 » (CLAUDE.md) reste en vigueur.

---

## 8. Livraison

Release **v5.4.0** : bump `manifest.json` + `package.json` + `package-lock.json`, section dans
`docs/VERSIONS.md`, version reflétée dans `docs/AVANCEMENT.md`, et **D²** — `documentation-fonctionnelle.md`
(section export/import, et la mention explicite que le token n'est pas transporté) et
`documentation-technique.md` (module `core/config-io.js`, format du fichier) mises à jour dans le commit de
release. Poussée sur GitHub dans la foulée (pCloud ne sauvegarde pas l'historique).
