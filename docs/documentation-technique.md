# Documentation technique — Notion Time Tracker

Version : `5.2.0` (source de vérité : `manifest.json`). Le **D-technique** du principe D² : décrit *comment
c'est fait*. Pour *ce que fait* l'app côté utilisateur, voir [`documentation-fonctionnelle.md`](documentation-fonctionnelle.md).

---

## 1. Stack technique

| Élément | Choix |
|---|---|
| Type | Extension navigateur **Manifest V3** (Chrome / Edge), client pur, aucun backend. |
| Langage | **JavaScript vanilla**, **modules ES natifs** (`import`/`export`), **aucun build**, **aucune dépendance runtime**. |
| Persistance | `chrome.storage.local` (config, session en cours, historique, flags de notification). |
| Réseau | `fetch` direct vers l'**API REST Notion** (`v2022-06-28`), autorisé par `host_permissions`. |
| Arrière-plan | **Service worker** MV3 (`type: module`) piloté par `chrome.alarms` (pas de `setInterval` côté SW). |
| Permissions | `storage`, `notifications`, `alarms` + host `https://api.notion.com/*`. |
| Tests | **Vitest** (devDependency), TDD sur les modules `core/` (logique pure, sans API Chrome). |
| Langue | FR uniquement (pas d'`_locales`). |

**Aucun content script** : l'extension ne s'injecte dans aucune page. Toute la logique vit dans le popup, la page
de config et le service worker. Les fichiers sont chargés tels quels (zéro transpilation).

## 2. Architecture générale

```
┌──────────────────────────────────────────────────────────────┐
│                     Navigateur (Chrome/Edge, MV3)              │
│                                                                │
│  ┌─────────────────────────┐  msg  ┌───────────────────────┐  │
│  │  POPUP (action)          │◄─────►│ SERVICE WORKER         │  │
│  │  popup.html/.css/.js     │       │ service-worker.js      │  │
│  │   ├─ timer.js            │       │  - badge 🟢/⏸️/vide     │  │
│  │   ├─ timer-actions.js    │       │  - notifications        │  │
│  │   ├─ timer-manual.js     │       │  - chrome.alarms (1 min)│  │
│  │   ├─ timer-recent.js     │       └────────────┬──────────┘  │
│  │   └─ stats.js (onglet 📊)│                    │             │
│  │  config.html/.css/.js    │                    │             │
│  │  theme.js                │                    │             │
│  └───────────┬──────────────┘                    │             │
│   ┌──────────▼────────────────────────────────────▼────────┐  │
│   │              chrome.storage.local                       │  │
│   │   config · currentSession · taskHistory · notifFlags    │  │
│   └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬──────────────────────────────┘
                                 │ HTTPS (fetch)
                                 ▼
        ┌────────────────────────────────────────────────────┐
        │  core/ (logique pure, testée, sans API Chrome)      │
        │   notion-api.js · mapping.js · time.js · storage.js │
        │   · stats.js                                        │
        └───────────────────────────┬────────────────────────┘
                                     │
                                     ▼
                     API REST Notion (v2022-06-28)
```

**Principe d'isolation** : seuls `notion-api.js` et `mapping.js` connaissent le format Notion ; le reste manipule
des objets métier `Task` / `Session`. `core/*` n'importe aucune API Chrome (sauf `storage.js`, qui encapsule
`chrome.storage.local` et n'est utilisé que côté UI/SW).

## 3. Modèle de données local (`chrome.storage.local`)

| Clé | Forme | Rôle |
|---|---|---|
| `config` | `{ notionToken, timeDb{id,name,fields}, tasksDb{id,name,fields}, projetsDb{id,name}?, prefs{…}, theme }` | Toute la configuration (token, mapping des 2 bases, base Projets optionnelle, préférences, thème). |
| `currentSession` | `{ pageId, taskId, taskName, startTime, isPaused, pauseStartTime, totalPauseDuration }` | Le chronomètre actif (ou en pause), persisté pour survivre à la fermeture du popup. |
| `taskHistory` | `[taskId]` (max 20, LRU) | Tâches récemment utilisées, pour trier la liste. |
| `notifFlags` | `{ lastLongTimerNotif, endOfDayNotified, dailyGoalNotified, dayStamp }` | Flags anti-répétition des notifications, persistés car le SW MV3 est recyclé. |

`config.timeDb.fields` (base d'écriture) et `config.tasksDb.fields` (base de lecture) sont les **mappings** entre
champs logiques de l'app et propriétés réelles Notion. Aucun ID ni nom de propriété n'est en dur. `config.projetsDb`
(optionnel) mémorise la base cible des relations « Projets » pour l'injection des champs (voir `schema-injection.js`).

## 4. Modules et grandes fonctions

### `core/time.js` — temps, durées, dates (pur)

- `formatDuration(ms, {withSeconds})` : `ms` → `HH:MM:SS` (ou `HH:MM`). Base de tous les affichages de durée.
- `roundToNearestFiveMinutes(date)` : arrondit au multiple de 5 min le plus proche (préremplissage saisie manuelle).
- **`toNotionDate(date)`** : sérialise en **ISO 8601 avec offset local** (`…+02:00`), **jamais `Z`**. Correction
  centrale de la dette v1 (UTC → décalage d'affichage). Toutes les dates envoyées à Notion passent par ici.
- `workedMs(start, end, totalPause)` : durée travaillée = `end − start − pauses`, bornée à 0.
- `startOfDay(date)` : minuit local (bornes des filtres « aujourd'hui / hier »).
- `formatClock` / `formatStartedLabel` / `formatDateTimeLocalValue` : libellés FR pour l'UI (via `Intl`) et valeur
  pour les `<input type="datetime-local">`.

### `core/notion-api.js` — accès HTTP Notion (pur)

- `request(token, path, opts, attempt)` : cœur `fetch` privé. Ajoute les en-têtes (`Authorization`, `Notion-Version`),
  **retry sur 429** avec backoff (`retry-after` ou `2^attempt`, 3 essais), et lève une `Error` lisible si `!res.ok`.
- `testToken` : `GET /users/me` (validation du token en config).
- `searchDatabases` : `POST /search` filtré `database`, **pagine** via `has_more`/`next_cursor` → `[{id,name}]`.
- `getDatabaseSchema(dbId)` : propriétés d'une base → `[{name,type}]` (alimente les listes de mapping).
- **`queryAll(dbId, {filter,sorts})`** : requête **paginée complète** (tous les résultats). Utilisée pour les
  sessions récentes et les totaux journaliers.
- `queryPage(dbId, {pageSize=20})` : **une seule page** (chargement léger initial de la liste des tâches).
- `getPage` / `createPage` / `updatePage` : lecture d'une page, création (retourne l'`id`), mise à jour de propriétés.
- **`addDatabaseProperties(token, dbId, properties)`** : `PATCH /databases/{id}` — **ajoute des propriétés** à une
  base existante (injection des champs). Traduit un **403** (intégration sans droit d'écriture) en message clair.
- `normId` : retire les `-` des IDs là où l'endpoint l'exige. `request` attache aussi `err.status` (code HTTP) aux
  erreurs, ce qui permet le traitement ciblé du 403 ci-dessus.

### `core/mapping.js` — Notion ⇄ objets métier (pur)

- `taskFromPage(page, f)` : page Notion → objet **Task** (`id, name, project, externalId, externalUrl, projectsRel,
  notionUrl`) selon le mapping `f` de la base tâches.
- **`sessionPropertiesForCreate(task, startTime, f)`** : construit les propriétés Notion pour créer la ligne de
  session (titre = nom + `[projet]`, date de début, relations/ID externe/projets si mappés).
- `sessionPropertiesForUpdate({endTime, comment, pauseMin}, f)` : propriétés de clôture (date de fin, commentaire,
  minutes de pause si > 0).
- `sessionFromPage(page, f)` : page → **Session** (`pageId, name, startTime, endTime, pauseMin, tasksRelIds`) pour
  l'affichage des récents, les totaux et l'onglet Stats (`tasksRelIds` = IDs de la relation Tâches, utilisés par
  `isVacationSession` de `core/stats.js` pour détecter les congés).
- `extractProject` / `titleWithProject` : gestion de la convention `Nom [Projet]`.

### `core/schema-injection.js` — planification de l'injection des champs (pur)

Module **pur et testé** (Vitest, TDD) qui décide **quelles propriétés Notion créer** dans chaque base, sans jamais
toucher à l'existant.

- `FIELD_SPECS_TIME` / `FIELD_SPECS_TASKS` : catalogue des champs injectables `{ key, name, type, build|targetKey }`
  — nom canonique, type Notion et fabrique du *payload* de propriété. Le **titre natif** n'y figure pas. `statusFilter`
  (type `status` non créable via l'API) et la propriété de tri en sont **volontairement absents**. Les relations
  déclarent un `targetKey` (`tasksDbId` ou `projetsDbId`) et sont créées en **`dual_property`** (deux sens).
- **`planInjection(specs, currentSchema, targets)`** : compare le catalogue au schéma réel (`getDatabaseSchema`) et
  renvoie `{ toCreate, conflicts, skippedNoTarget, properties }` — respectivement les champs manquants à créer, les
  **conflits de type** (même nom, type différent → **laissés intacts**), les relations **sautées** faute de base
  cible, et l'objet `properties` prêt pour `addDatabaseProperties`. **Additif et idempotent** : jamais de rename,
  retype ni suppression.

### `core/storage.js` — accès typé `chrome.storage.local`

Encapsule la persistance : `getConfig`/`saveConfig`, `getCurrentSession`/`setCurrentSession`/`clearCurrentSession`,
`getTaskHistory`/`pushTaskHistory` (**LRU** : dédoublonne, préfixe, tronque à 20). Seul module qui touche
directement `chrome.storage.local` côté UI.

### `core/stats.js` — agrégations statistiques (pur)

- **`periodRange(kind, refDate)`** : bornes `{start, end, label}` d'une période autour de `refDate` selon
  `kind` (`'day' | 'week' | 'month'`) — jour calendaire, semaine **Lundi → Dimanche**, mois calendaire — avec un
  libellé FR (ex. « 14 juil. – 20 juil. », « juillet 2026 »). Le mode `'custom'` (plage libre) est géré côté UI
  (`popup/stats.js`), pas ici.
- **`weekdaysBetween(start, end)`** : nombre de jours **ouvrés** (Lundi → Vendredi inclus) entre deux dates.
- **`dailyTargetHours(weeklyHours)`** : `weeklyHours / 5` (objectif journalier théorique, semaine de 5 jours ouvrés).
- **`objectiveHours(weekdays, congeDays, weeklyHours)`** : objectif ajusté aux congés —
  `max(0, (weekdays − congeDays) × weeklyHours / 5)`.
- **`isVacationSession(session, {vacationTaskId, vacationName})`** : détecte une session de congés — priorité à
  la relation Tâches (`session.tasksRelIds` contient l'ID de la tâche congés, IDs normalisés sans tirets), repli
  sur l'égalité du nom (`session.name === vacationName`) si la relation n'est pas mappée ou vide.
- **`aggregate(sessions, {start, end, isVacation, weeklyHours})`** : agrégation centrale de l'onglet Stats.
  Amorce une entrée par jour de la plage (y compris week-ends, marqués `isWeekend`), puis pour chaque session :
  si `isVacation(s)` la marque en congé (jour + compteur) et l'**exclut** du temps travaillé et des projets ;
  sinon cumule `workedMs` (via `workedMs` de `time.js`), le total du jour, et le total du projet
  (`extractProject(s.name)` de `mapping.js`). Retourne
  `{ workedMs, objectiveMs, remainingMs, progress, congeDays, perDay[], perProject[] }` — `objectiveMs` via
  `objectiveHours`, `remainingMs = max(0, objectiveMs − workedMs)`, `progress = workedMs / objectiveMs` (ou
  `null` si aucun objectif), `perProject` trié par durée décroissante avec `ratio` (part du temps total).

### `background/service-worker.js` — badge + notifications

- **Badge** : `setBadge(state)` affiche 🟢 (running) / ⏸️ (paused) / vide (idle). Mis à jour sur messages du popup
  (`onMessage`) **et** au tick (source de vérité = `currentSession`).
- **`chrome.alarms`** : une alarme `tick` toutes les 1 min (créée à l'install). `onAlarm` recalcule le badge et
  déclenche les notifications. Jamais de `setInterval` dans le SW (non fiable en MV3).
- **Notifications** (avec flags anti-répétition persistés) : timer long (≥ 3 h), fin de journée (17 h 45 si timer
  actif, avec boutons), objectif quotidien atteint (≥ 8 h cumulées via `getTodayTotalMs`, qui somme les sessions du
  jour avec `queryAll` + `workedMs`).
- `loadFlags`/`saveFlags` + `resetDailyFlagsIfNeeded` : les flags vivent dans `chrome.storage.local` car le SW MV3
  est recyclé (la mémoire ne survit pas). Reset des flags quotidiens au changement de `dayStamp`.
- Clic notification → `chrome.action.openPopup()`.

### `popup/popup.js` — bootstrap du popup

`main()` : si la config est incomplète (token / bases manquants) → ouvre la config **en onglet** (`chrome.tabs.create`)
et ferme le popup. Sinon applique le thème, câble le bouton thème + config, gère la **navigation par onglets**
(Timer / Stats), puis `initTimer(config)`.

### `popup/timer.js` — état partagé + chargement des tâches

- Objet **`T`** : état partagé de l'onglet Timer (config, tokens, mappings, `tasks`, `history`, `selectedTaskId`,
  `session`).
- `buildTasksFilter` : filtre Notion d'exclusion de statuts, **multi-valeurs** séparées par `;` (→ `and` de
  `does_not_equal`). `buildTasksSorts` : tri par la propriété configurée.
- `sortTasks` : place les tâches récentes (ordre `taskHistory`) en tête, le reste trié alphabétiquement (FR), dédoublonné.
- `loadLightTasks` (20 tâches au démarrage) vs `loadAllTasks` (pagination complète, déclenchée à la 1ʳᵉ recherche).
- `ensurePinnedTasks` : charge à l'unité (`getPage`) les tâches épinglées (favoris + congés) absentes de la liste.
- `initTimer(config)` : remplit l'état, câble la liste/recherche/boutons d'ouverture, puis délègue à
  `wireActions` / `wireManual` / `wireRecent` via un objet `helpers` partagé.

### `popup/timer-actions.js` — cycle de vie d'une session

- `onStart` : crée la page Notion (`createPage` + `sessionPropertiesForCreate`), persiste `currentSession`, pousse
  l'historique, notifie le SW. **Garde anti double-clic** (bouton désactivé pendant l'appel).
- `renderTick` + `startTick`/`stopTick` : rafraîchit l'affichage chaque seconde (durée travaillée en tenant compte
  de la pause en cours). C'est un `setInterval` **côté popup** (autorisé, ≠ service worker).
- `onTogglePause` : bascule pause/reprise, cumule `totalPauseDuration`, **plafond 1 h** de pause.
- **`finishSession(endTime)`** : valide le commentaire si obligatoire, calcule les minutes de pause, `updatePage`
  (date de fin + commentaire + pause). En cas d'échec réseau, **conserve** la session pour réessayer. Puis nettoie
  l'état, notifie le SW, recharge les récents.
- Modale « Arrêter à… » : `openStopAt`/`stopAtChosenDate`/`refreshStopDuration` — choix d'une heure de fin avec
  aperçu de durée en direct (et blocage si fin < début). Confirme via `finishSession`.
- À l'ouverture, restaure une éventuelle `currentSession` en cours (`enterRunning`).

### `popup/timer-manual.js` — saisie manuelle, congés, favoris

- `toggleManual(on)` : bascule le formulaire de saisie a posteriori (préremplit début/fin via
  `roundToNearestFiveMinutes`), transforme le bouton principal en « ENREGISTRER », montre la boîte de favoris.
- **`saveManualFor(taskId, sourceBtn)`** : crée **puis** clôture la ligne en un coup (`createPage` +
  `updatePage`). **Garde anti double-enregistrement** (`saving`) + gel des boutons (`setSaving`, avec « ⏳ … » sur le
  bouton source). Toast de confirmation via `showToast`.
- `onManualSave` : variante depuis la tâche sélectionnée (bouton bleu). Les favoris appellent directement `saveManualFor`.
- `onVacationToggle` : coche « congés » → sélectionne la tâche congés configurée et force le commentaire « En congés ».
- `renderFavoriteButtons` : jusqu'à 8 boutons d'enregistrement rapide (libellé personnalisé, tronqué à 20 car.).
- `manualByDefault` : ouvre directement en mode saisie manuelle si l'option est activée en config.

### `popup/timer-recent.js` — sessions récentes

`reloadRecent` : `queryAll` filtré depuis hier minuit, regroupe **Aujourd'hui / Hier**, affiche par session
(nom, plage horaire, durée) avec total par jour et lien vers Notion. `wireRecent` délègue le lien au clic.

### `popup/stats.js` — onglet Stats (UI)

- État module `S` : `kind` (`'day'|'week'|'month'|'custom'`), `ref` (date de référence pour le décalage
  précédent/suivant), `custom` (plage `{from,to}` en mode Perso), `vacation` (`vacationTaskId`/`vacationName`
  résolus), et un **cache mémoire** (`Map`, clé = `kind` + bornes de la plage) pour éviter de requêter Notion deux
  fois la même plage pendant la session du popup.
- **`initStats(config)`** : appelée **paresseusement**, au premier affichage de l'onglet (câblé dans
  `popup/popup.js`, `if (tab.dataset.tab === 'stats') initStats(config)`), pas au démarrage du popup. Câble les
  écouteurs une seule fois (`wireOnce`), résout la tâche congés (`loadVacationTask`, via `getPage` + repli sur le
  nom si la relation Tâches n'est pas mappée), puis `refresh()`. Un second appel (ré-affichage de l'onglet) se
  contente de `refresh()`.
- `currentRange()` : délègue à `periodRange` de `core/stats.js` pour Jour/Semaine/Mois ; construit la plage
  directement depuis les champs date en mode Perso.
- **`fetchAggregate(range)`** : sert le cache si la plage a déjà été chargée, sinon interroge Notion avec
  `queryAll` filtré sur la propriété **date de début** mappée (`on_or_after`/`on_or_before` la plage, via
  `toNotionDate`), convertit chaque page en `Session` (`sessionFromPage`), puis appelle `aggregate` de
  `core/stats.js` avec `isVacationSession` et les heures hebdo de la config. Met le résultat en cache.
  `invalidateStats()` vide ce cache ; exportée pour permettre à un appelant de forcer un recalcul après
  l'enregistrement d'une session (non câblée à ce jour — le cache ne vit que le temps d'ouverture du popup, donc
  l'écart ne survit pas à une réouverture).
- `renderObjective` / `renderDays` / `renderProjects` : rendu HTML de la carte objectif (anneau CSS piloté par
  une variable `--p`, détail travaillé/objectif/reste/congés), des barres du rythme quotidien (hauteur
  proportionnelle au jour le plus chargé, congés en doré, jour vide en gris), et du bilan par projet (barre de
  proportion + durée + %).
- `refresh()` : orchestre le cycle affichage → état (`stats-loading` / `stats-error` / `stats-empty` /
  `stats-content`) selon le résultat de `fetchAggregate` (vide si `workedMs === 0 && congeDays === 0`).

### `config/config.js` — page de configuration (onglet plein écran)

- `onTest` : valide le token (`testToken`). `onLoadDb` : liste les bases (`searchDatabases`), peuple les 3 sélecteurs
  (Temps, Tâches, **Projets** optionnel) puis `loadSchemas`.
- `loadSchemas` : charge les schémas des 2 bases puis délègue le remplissage des `<select>` à `remapTime` /
  `remapTasks` — menus filtrés par **types compatibles** (`TIME_TYPES` / `TASKS_TYPES`) et **auto-mappés** par nom
  connu (`AUTO_TIME` / `AUTO_TASKS`). `remapTime`/`remapTasks` sont réutilisés après une injection.
- **Injection des champs** : `onInject(kind)` relit le **schéma frais** de la base (jamais l'état en cache, pour ne
  pas re-typer par erreur), calcule le plan via `planInjection`, l'affiche avec `renderInjectPreview` (aperçu +
  conflits + relations sautées) et n'écrit qu'**après confirmation** (`addDatabaseProperties`), avant de recharger le
  schéma et de re-mapper. Le bouton est désactivé pendant les appels (anti-double-clic). `injectTargets` fournit les
  cibles de relation (`tasksDbId`, `projetsDbId`).
- `loadTasksList` : peuple les sélecteurs de tâche congés et de favoris.
- Favoris : `renderFavorites`/`wireFavorites` (ajout/suppression, **max 8**).
- **`onSave`** : valide les champs obligatoires (Nom/Début/Fin, heures/semaine > 0), assemble l'objet `config`
  complet (token, 2 bases mappées, **base Projets** si choisie, `prefs`, thème) via `collectTimeFields`/
  `collectTasksFields`, `saveConfig`, puis referme l'onglet.
- Au chargement : applique le thème, repeuple depuis la config existante, et **charge automatiquement les bases** si
  un token est déjà présent (plus de clic manuel).

### `theme.js` — thème clair / sombre

`applyStoredTheme` lit `config.theme` (défaut `dark`) et pose `data-theme` sur `<html>`. `toggleTheme` bascule et
persiste. Partagé par le popup et la config.

## 5. Flux clés

1. **Démarrer un chrono** : sélection tâche → `onStart` → `createPage` (début) → `currentSession` persistée → badge 🟢
   → tick 1 s côté popup + notifications côté SW.
2. **Arrêter** : `onStop` / modale « Arrêter à… » → `finishSession` → `updatePage` (fin + commentaire + pause) →
   session nettoyée → badge vide → récents rechargés.
3. **Saisie manuelle / favori** : `saveManualFor` → `createPage` + `updatePage` en une passe → toast.
4. **Arrière-plan** : `tick` (1 min) → badge + notifications (timer long, fin de journée, objectif quotidien).

## 6. Dette v1 corrigée (rappels)

- Dates Notion en **offset local** (`toNotionDate`), jamais `Z`.
- **Zéro ID/nom en dur** : tout via `config.timeDb` / `config.tasksDb`.
- Un seul `formatDuration` (paramétrable). **`chrome.alarms`** dans le SW (jamais `setInterval`).
- **Backoff/retry sur 429** et normalisation des IDs selon les endpoints.
