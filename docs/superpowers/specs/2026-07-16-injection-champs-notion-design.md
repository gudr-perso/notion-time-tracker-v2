# Design — Injection automatique des champs Notion

> Date : 2026-07-16
> Périmètre : **faciliter la liaison aux bases Notion** depuis la page de configuration.
> Deux boutons qui **créent automatiquement les propriétés nécessaires** dans les bases Temps et
> Tâches après que l'utilisateur les a créées (à vide) côté Notion.

Références : `src/config/config.js` (mapping théorique : `TIME_TYPES`, `TASKS_TYPES`, `AUTO_TIME`,
`AUTO_TASKS`), `src/core/notion-api.js`, `src/core/mapping.js`, CLAUDE.md (méthode AVEC + D²).

---

## 1. Problème & objectif

Aujourd'hui, pour lier l'extension, l'utilisateur doit créer **manuellement** dans Notion toutes les
propriétés attendues (dates, relations, texte…) puis les **mapper** une à une. C'est fastidieux et
source d'erreurs (mauvais type, oubli).

Objectif : après avoir créé **deux bases vides** (Temps + Tâches) côté Notion, l'utilisateur clique
**deux boutons** dans la config et l'extension **injecte les propriétés manquantes** avec les bons
types, puis auto-mappe. Le projet **Captage** fait déjà ce genre d'injection ; on s'appuie ici sur le
« mapping théorique » déjà encodé dans `config.js`.

---

## 2. Décisions de cadrage (validées en brainstorming)

| Sujet | Décision |
|-------|----------|
| Périmètre des champs | **Tout** le mapping, relations comprises (option C). |
| Base Projets | **Sélection seule** d'une base existante (pas de création de base). 3ᵉ sélecteur optionnel. Si absente → relations Projets sautées. |
| Champs existants | **Additif strict / idempotent** (option A) : on ne crée que ce qui manque ; jamais de renommage, retype ou suppression. Conflit de type = signalé, non modifié. |
| Garde-fou | **Aperçu + confirmation** avant toute écriture Notion. |
| Relations | Créées en **`dual_property`** (les deux sens) : Notion crée la back-relation synchronisée sur la base cible. |
| `statusFilter` / `sortProperty` | **Exclus** de l'injection + **encart d'aide** pour création manuelle. |

---

## 3. Parcours utilisateur

Dans la page de config, après chargement/sélection des bases :

1. **3ᵉ sélecteur « Base Projets (optionnel) »**, alimenté par la même liste que Temps/Tâches. Cible
   des relations `projects` / `projectsRel`. Persisté dans `config.projetsDb`.
2. **Deux boutons**, un sous chaque bloc de mapping :
   - `⚙️ Créer les champs manquants — base Temps` (`#btn-inject-time`)
   - `⚙️ Créer les champs manquants — base Tâches` (`#btn-inject-tasks`)
   - Actifs seulement si token valide **et** base concernée sélectionnée.
3. **Au clic** → **aperçu** (aucune écriture) : panneau in-page listant les propriétés à créer
   (nom + type + cible de relation) et les ⚠️ conflits ignorés. Boutons **Confirmer / Annuler**.
4. **Confirmer** → écriture Notion (`PATCH`) → compte-rendu (« ✓ N créées, M ignorées ») →
   **rechargement du schéma** de la base → les sélecteurs de mapping se **re-remplissent et
   s'auto-mappent** sur les champs fraîchement créés.
5. L'utilisateur termine par le **Enregistrer** habituel (pas de sauvegarde auto).

**Encart d'aide persistant** (sous le bouton Tâches) :

> ℹ️ **Filtre de statut — à créer manuellement.** L'API Notion ne peut pas créer de propriété de type
> *Status*. Dans ta base Tâches, crée (ou réutilise) une propriété **Statut** (type *Status* ou
> *Select*) avec tes états de workflow, puis reviens ici : mappe-la dans **« Filtre de statut »** et
> indique la valeur à **exclure** (ex. `Terminé`). Idem, **`sortProperty`** (tri) se mappe sur une
> propriété existante — rien à injecter.

---

## 4. Noms & types injectés (le « mapping théorique » concrétisé)

**Base Temps** — le titre natif (propriété *title* que Notion crée d'office) n'est **pas** recréé.

| Champ logique | Nom créé | Type Notion |
|---|---|---|
| startDate | `Début session` | date |
| endDate | `Fin session` | date |
| taskId | `#TaskId` | rich_text |
| pause | `Pause (min)` | number |
| comment | `Commentaire` | rich_text |
| externalUrl | `TaskUrl` | url |
| tasksRelation | `Tâches` | relation → base Tâches (dual_property) |
| projects | `🎯 Projets` | relation → base Projets *(si sélectionnée, sinon sautée)* |

**Base Tâches** — titre natif non recréé.

| Champ logique | Nom créé | Type Notion |
|---|---|---|
| project | `Projet_texte` | rich_text |
| externalId | `#TaskId` | rich_text |
| externalUrl | `TaskUrl` | url |
| projectsRel | `🎯 Projets` | relation → base Projets *(si sélectionnée)* |

**Exclus volontairement :** `statusFilter` (type `status` non créable via l'API ; se mappe sur la
colonne d'état existante) et `sortProperty` (pointeur vers une propriété existante).

**Payload relation** (dual sens) :
```json
{ "relation": { "database_id": "<cible>", "type": "dual_property", "dual_property": {} } }
```
Le nom de la propriété miroir est auto-généré par Notion (renommable ensuite à la main).

---

## 5. Architecture technique

### 5.1 Nouveau module pur `src/core/schema-injection.js`

Aucune API Chrome, aucun `fetch` → **testable** (comme le reste de `core/`).

- `FIELD_SPECS_TIME` / `FIELD_SPECS_TASKS` : déclaration de chaque champ injectable
  `{ key, name, type, build(targets) }` où `build` renvoie le payload de propriété Notion.
  Les champs relation portent un drapeau `targetKey` (`'tasksDbId'` ou `'projetsDbId'`).
- `planInjection(specs, currentSchema, targets)` → **fonction pure** renvoyant :
  - `toCreate: [{ key, name, type }]` — ce qui manque réellement (par nom, insensible casse) ;
  - `conflicts: [{ name, expectedType, actualType }]` — même nom déjà présent (ignoré, signalé) ;
  - `skippedNoTarget: [{ key, name }]` — relations Projets sautées faute de `projetsDbId` ;
  - `properties` — l'objet `{ "<nom>": <payload> }` prêt pour le `PATCH` (uniquement `toCreate`).
  - `targets = { tasksDbId, projetsDbId }`.
  - Un champ relation sans cible disponible va dans `skippedNoTarget` (jamais dans `properties`).

### 5.2 `src/core/notion-api.js` — nouvelle fonction fine

- `addDatabaseProperties(token, dbId, properties)` → `PATCH /databases/{id}` avec `{ properties }`.
  Le `request()` gère déjà 429 (backoff). Le **403** est mappé vers un message clair : « l'intégration
  n'a pas les droits d'édition sur cette base — partage-la en écriture avec l'intégration ».

### 5.3 `src/config/config.js` — câblage

- 3ᵉ `<select id="projets-db">` rempli dans `onLoadDb` (mêmes options que Temps/Tâches), pré-sélection
  depuis `state.config.projetsDb`.
- Boutons `#btn-inject-time` / `#btn-inject-tasks`. Au clic :
  1. `planInjection(FIELD_SPECS_*, state.schemaTime|Tasks, { tasksDbId, projetsDbId })` (schéma déjà en
     mémoire) ;
  2. rendu du **panneau d'aperçu** (liste `toCreate` + `conflicts` + `skippedNoTarget`) ;
  3. **Confirmer** → `addDatabaseProperties(token, dbId, plan.properties)` ;
  4. `getDatabaseSchema` (rechargement) → `fill` + `autoSelect` re-remplissent les mappings de la base ;
  5. compte-rendu de statut (réutilise le pattern `status ok / err`).
- Le sélecteur Projets est intégré à `onSave` : `config.projetsDb = { id, name }`.

### 5.4 Modèle local (`chrome.storage.local`)

- `config` gagne `projetsDb : { id, name }` (cible mémorisée des relations). Documenté dans CLAUDE.md.

---

## 6. Cas limites & sécurité

- **Idempotence** : re-cliquer après injection ⇒ `toCreate` vide, compte-rendu « rien à créer ».
- **Conflit de type** (nom déjà pris, autre type) : listé dans `conflicts`, **jamais modifié**.
- **Base Projets absente** : relations `projects`/`projectsRel` en `skippedNoTarget`, le reste passe.
- **403 (droits)** : message explicite ; aucune écriture partielle silencieuse.
- **Aperçu obligatoire** : aucune écriture Notion sans confirmation explicite de l'utilisateur.
- **Non destructif** : jamais de rename / retype / delete d'une propriété existante.

---

## 7. Tests (TDD, Vitest, `core/` uniquement)

`test/schema-injection.test.js` :
- ne planifie **que les champs manquants** ; un champ de même nom (type différent) → `conflicts`,
  jamais recréé ;
- **idempotence** : `planInjection` sur le schéma post-injection ⇒ `toCreate` vide ;
- les relations portent le bon `database_id` + `type: 'dual_property'` ;
- `projects`/`projectsRel` → `skippedNoTarget` si `projetsDbId` absent ; créés si présent ;
- le **titre** n'apparaît jamais dans `toCreate` ;
- `statusFilter` / `sortProperty` absents des specs injectables.

`addDatabaseProperties` reste une couche fine (effet de bord `fetch`) : non unit-testée ; la logique
testable vit dans `schema-injection.js`.

---

## 8. Impacts documentation (à la release)

- Bump version (`manifest.json` + `package.json` + `package-lock.json`).
- `docs/VERSIONS.md` : section de la nouvelle version.
- `docs/AVANCEMENT.md` : reflet de version + feature livrée.
- **D²** : `documentation-fonctionnelle.md` (nouveau flux d'injection + encart statut) et
  `documentation-technique.md` (module `schema-injection`, `addDatabaseProperties`, champ
  `config.projetsDb`).
- `CLAUDE.md` : ajout de `projetsDb` au modèle de données local + `schema-injection.js` dans la carte
  du code.
