# Documentation technique — Notion Time Tracker

Version : `5.4.0` (source de vérité : `manifest.json`). Le **D-technique** du principe D² : décrit *comment
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

`config.prefs.favorites` : `[{ taskId, customLabel, color, icon }]`, max 8. `color` et `icon` sont des **clés**
(`'cyan'`, `'code'`, `'none'`), jamais des valeurs. Deux raisons : la teinte réelle vit en CSS (`--fav-<clé>`, un jeu
par thème), ce qui laisse le thème clair assombrir toute la palette **sans toucher aux données** ; et une clé traverse
`normalizeFavorite()` qui la valide contre une liste blanche, ce qui rend `var(--fav-${fav.color})` non détournable.
**Aucune migration** n'accompagne l'arrivée de `color`/`icon` en v5.3.0 : `normalizeFavorite()` applique les défauts
(`orange`, `none`) **à la lecture**, donc un favori d'avant la v5.3.0 s'affiche exactement comme avant.
⚠️ Ces clés sont un **contrat de persistance** : en renommer une ferait perdre sa couleur ou son picto à chaque favori
concerné, **sans erreur**. Deux tests les verrouillent nommément (`test/fav-presets.test.js`).

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
- `getDatabaseSchema(dbId)` : propriétés d'une base → `[{name,type}]` (alimente les listes de mapping). Pour les
  propriétés `status` / `select`, ajoute `options: [nom,…]` (les valeurs possibles) — sert au choix des statuts à
  exclure par cases à cocher (§ `config.js`).
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

### `core/fav-icons.js` — table des pictos des favoris (données pures)

`FAV_ICONS` : table `clé → { label, paths }` des **23 pictos**. `paths` est un **tableau** d'attributs `d` SVG (de 1 à
9 par picto : `beach` en a 5, `bug` 9), en `viewBox 0 0 24 24`, tracés en `stroke` sans remplissage. Données
**régénérables** : tracés extraits des sources `outline` de [Tabler Icons](https://tabler.io/icons) (licence **MIT**,
notice de permission reproduite intégralement en en-tête — un lien ne vaut pas notice). L'en-tête porte aussi la
procédure de régénération et la correspondance des 3 clés qui divergent des noms Tabler (`file` → `file-text`,
`chart` → `chart-bar`, `laptop` → `device-laptop`). **L'ordre des clés pilote la grille de la config.**

### `core/fav-presets.js` — couleur et picto d'un favori (pur)

- `FAV_COLORS` : les **10 clés** de couleur, **dans l'ordre** — il pilote la grille de config **et** l'attribution
  automatique.
- `FAV_COLOR_LABELS` : libellés FR (infobulles, lecteurs d'écran) — la clé stockée n'est pas du français.
- `normalizeFavorite(fav)` → `{ taskId, customLabel, color, icon }` : applique les défauts, remplace toute clé
  inconnue par le défaut. C'est **le** point qui dispense de migrer `chrome.storage`. Le garde du picto est
  `typeof === 'string' && Object.hasOwn(...)` : `hasOwn` et non `in`, sinon `'toString'` passerait pour un picto.
- `nextFreeColor(favorites)` : première couleur non utilisée, repli sur `FAV_COLORS[0]` si les 10 sont prises.
  ⚠️ Compare la couleur **affichée** (`normalizeFavorite(f).color`) et non la couleur brute — un favori d'avant la
  v5.3.0 n'a pas de champ `color` mais s'affiche en orange. Cf. `EVENEMENTS.md` (2026-07-17).

### `fav-icon.js` — construction du picto SVG (partagé popup + config)

`favIconSvg(key, className)` → un `<svg>` prêt à insérer, ou `null` si la clé ne désigne aucun picto (dont `'none'`,
qui est une **absence** et n'est volontairement pas une clé de `FAV_ICONS`). Construit avec `createElementNS`, jamais
`innerHTML`. Le picto hérite de la couleur du texte (`stroke="currentColor"`), ce qui évite au CSS de connaître le
picto affiché. **Vit à la racine de `src/` et non dans `core/`** : il touche au DOM, que `core/` s'interdit — même
place que `theme.js`, pour la même raison (partagé entre les deux pages).

### `core/storage.js` — accès typé `chrome.storage.local`

Encapsule la persistance : `getConfig`/`saveConfig`, `getCurrentSession`/`setCurrentSession`/`clearCurrentSession`,
`getTaskHistory`/`pushTaskHistory` (**LRU** : dédoublonne, préfixe, tronque à 20). Seul module qui touche
directement `chrome.storage.local` côté UI.

### `core/config-io.js` — export/import de la configuration (pur)

Module **pur et testé** (Vitest, TDD) qui construit l'enveloppe exportée et valide un fichier importé, sans
jamais toucher au DOM ni à `chrome.storage` — l'appelant (`config/config.js`) fournit `now`/`appVersion` et
écrit le résultat.

- **`buildExport(config, appVersion, now = new Date())`** : construit `{ format, formatVersion, exportedAt,
  appVersion, config }`. Le **token est retiré par déstructuration objet** (`const { notionToken, ...rest } =
  config`), donc sa clé est **absente** du JSON (jamais `null`, jamais une chaîne vide qui laisserait croire à
  un choix délibéré). **`exportedAt` passe par `toNotionDate(now)`** : l'horodatage porte l'offset local, comme
  toute date envoyée à Notion (cf. §4, `core/time.js`). Ne mute pas `config` (spread, pas d'affectation).
- **`parseImport(text, currentConfig)`** : valide puis renvoie la config prête à écrire (lève une `Error` au
  message clair sinon, affiché tel quel dans la zone de statut de la page) :
  - JSON invalide → rejeté ; `format !== 'notion-timer-config'` → rejeté (fichier étranger) ;
  - **`formatVersion` supérieur** à celui connu de l'extension installée → rejeté (« mets l'extension à jour »),
    ce qui protège une extension **plus ancienne** contre un fichier exporté par une **plus récente** ;
  - `timeDb.id` ou `tasksDb.id` absents → rejeté (fichier incomplet) ;
  - les favoris (`config.prefs.favorites`) sont **normalisés** (`normalizeFavorite` de `fav-presets.js`),
    **filtrés** à ceux qui ont un `taskId`, et **plafonnés à 8** — mêmes règles qu'à la saisie manuelle en config ;
  - **le token ne vient jamais du fichier** : le retour vaut `{ ...c, notionToken: currentConfig?.notionToken ||
    '', prefs: {...} }` — le `notionToken` est réécrit **après** le spread de `c`, donc toute valeur qui
    traînerait dans le fichier importé (ancien export non nettoyé, fichier trafiqué) est **écrasée** par celui du
    poste courant (ou `''` sur un poste neuf, jamais celui du fichier).
- **`exportFileName(now = new Date())`** : `notion-timer-config-AAAA-MM-JJ.json`, construit à partir des
  parties **locales** de la date (`getFullYear`/`getMonth`/`getDate`), pas de `toISOString` qui basculerait de
  date le soir selon le fuseau.

**Ne réimplémente pas la sélection** : après import, `config/config.js` recharge la page ; c'est le flux habituel
de la config (`onLoadDb` → `remapTime`/`remapTasks` → `loadTasksList` → `renderFavorites`) qui re-sélectionne
bases, champs, congés et favoris à partir de la config fraîchement écrite — aucune logique de ré-affichage n'est
dupliquée ici. La colle DOM (construction du `Blob`, lien de téléchargement, `<input type="file">`, `confirm()`,
`location.reload()`) vit entièrement dans `src/config/config.js` (`onExport`/`onImportFile`), pas dans ce module.

### `core/tasks-query.js` — filtre d'exclusion de statuts (pur)

Module **pur et testé** (Vitest) qui construit le filtre Notion d'exclusion de statuts de la base Tâches, à
partir de l'objet `statusFilter` du mapping. Consommé par `popup/timer.js` (`buildTasksFilter`) ; l'écriture de
l'objet vient de `config/config.js`.

- **`readExcludeValues(statusFilter)`** : renvoie les noms de statuts à exclure, taillés et sans vide. Source
  canonique : le **tableau** `excludeValues` (noms exacts). **Repli rétro-compat** : si absent, découpe l'ancien
  champ chaîne `excludeValue` sur `;` — un séparateur pouvant légitimement figurer dans un nom de statut, le
  format cible n'en garde **aucun** (cf. `docs/EVENEMENTS.md`, 2026-07-17).
- **`buildStatusFilter(statusFilter)`** : `{ property, type, excludeValues[] }` → filtre Notion, ou `undefined`
  si pas de propriété ou aucune valeur. Clé `select` si `type === 'select'`, sinon `status`. Une valeur →
  `does_not_equal` simple ; plusieurs → **`and` de `does_not_equal`**.

### `core/schedule.js` — planning hebdomadaire (pur)

Modèle du **planning type** (horaires travaillés par jour de semaine), source de l'objectif et des horaires de
congés. `schedule = { mon:{am:[deb,fin]|null, pm:…}, … }`, heures en `"HH:MM"`, segment `null` = non travaillé.

- **`WEEKDAY_KEYS`** : `['sun','mon',…,'sat']` (indexe `Date.getDay()` → clé de jour).
- **`DEFAULT_SCHEDULE`** : défaut pré-rempli (lun–jeu 09:00–13:00 / 14:00–18:00, ven 14:00–17:00, sam/dim off → 39 h).
- **`scheduledMsForDate(schedule, date)`** : durée travaillée planifiée du jour (matin + après-midi), en ms ; `0`
  si jour non travaillé ou planning absent.
- **`hasAnySchedule(schedule)`** : vrai si au moins un créneau non vide (sinon `aggregate` retombe sur le forfait).
- **`weeklyTotalHours(schedule)`** : total hebdomadaire en heures (affiché en config).

### `core/stats.js` — agrégations statistiques (pur)

- **`periodRange(kind, refDate)`** : bornes `{start, end, label}` d'une période autour de `refDate` selon
  `kind` (`'day' | 'week' | 'month'`) — jour calendaire, semaine **Lundi → Dimanche**, mois calendaire — avec un
  libellé FR (ex. « 14 juil. – 20 juil. », « juillet 2026 »). Le mode `'custom'` (plage libre) est géré côté UI
  (`popup/stats.js`), pas ici.
- **`weekdaysBetween(start, end)`** : nombre de jours **ouvrés** (Lundi → Vendredi inclus) entre deux dates.
- **`dailyTargetHours(weeklyHours)`** : `weeklyHours / 5` (objectif journalier théorique, semaine de 5 jours ouvrés).
- **`objectiveHours(weekdays, congeDays, weeklyHours)`** : objectif **forfaitaire** ajusté aux congés —
  `max(0, (weekdays − congeDays) × weeklyHours / 5)`. Depuis la v5.6.0, `aggregate` **ne l'appelle plus**
  (objectif dérivé du planning) ; conservée pour l'API et ses tests.
- **`isVacationSession(session, {vacationTaskId, vacationName})`** : détecte une session de congés — priorité à
  la relation Tâches (`session.tasksRelIds` contient l'ID de la tâche congés, IDs normalisés sans tirets), repli
  sur l'égalité du nom (`session.name === vacationName`) si la relation n'est pas mappée ou vide.
- **`aggregate(sessions, {start, end, isVacation, weeklyHours, schedule})`** : agrégation centrale de l'onglet
  Stats. Amorce une entrée par jour de la plage (`{ date, workMs, congeMs, isWeekend }`, week-ends inclus), puis
  pour chaque session calcule sa durée (`workedMs` de `time.js`, pauses déduites) et l'ajoute — selon
  `isVacation(s)` — soit au `congeMs` du jour et au total congés (**exclue** du temps travaillé et des projets),
  soit au `workMs` du jour, au `workedMs` total et au total du projet (`extractProject(s.name)` de `mapping.js`).
  **Objectif dérivé du planning** : pour chaque jour, la cible `targetMs = scheduledMsForDate(schedule, date)`
  (exposée sur `perDay[i].targetMs` pour le repère de rendu) ; `objectiveMs = Σ targetMs − Σ min(congeMs, targetMs)`.
  **Repli** : sans planning (`hasAnySchedule` faux), `targetMs` vaut le forfait plat `dailyTargetHours(weeklyHours)`
  les jours ouvrés et 0 le week-end — reproduisant le calcul d'avant la v5.6.0. Retourne
  `{ workedMs, congeMs, objectiveMs, remainingMs, progress, congeDays, perDay[], perProject[] }` — `congeDays` est
  désormais un **nombre de jours fractionnaire** (`Σ min(congeMs,targetMs)/targetMs`, pour le badge), `congeMs` le
  total des heures de congé, `remainingMs = max(0, objectiveMs − workedMs)`, `progress = workedMs / objectiveMs`
  (ou `null` si aucun objectif), `perProject` trié par durée décroissante avec `ratio` (part du temps total).

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
(Timer / Stats), puis `initTimer(config)`. Cet `await initTimer` est enveloppé d'un **`try/catch`** : une erreur
Notion au chargement (token, base, propriété de filtre…) s'affiche dans le bandeau `#load-error` avec le message
brut de Notion, au lieu de devenir une *unhandled rejection* laissant la liste vide sans explication.

### `popup/timer.js` — état partagé + chargement des tâches

- Objet **`T`** : état partagé de l'onglet Timer (config, tokens, mappings, `tasks`, `history`, `selectedTaskId`,
  `session`). Deux drapeaux distincts pour la liste complète : **`allLoaded`** (publiée dans `tasks`) et
  **`allLoading`** (promesse du chargement en cours, `null` sinon) — un drapeau posé en fin de chargement
  n'arbitre rien pendant le vol.
- `buildTasksFilter` : **délègue à `buildStatusFilter` de `core/tasks-query.js`** (filtre Notion d'exclusion de
  statuts, multi-valeurs → `and` de `does_not_equal`). `buildTasksSorts` : tri par la propriété configurée.
- `sortTasks` : place les tâches récentes (ordre `taskHistory`) en tête, le reste trié alphabétiquement (FR), dédoublonné.
- `loadLightTasks` (20 tâches au démarrage) vs `loadAllTasks` (pagination complète, déclenchée à la 1ʳᵉ recherche).
  Les deux écrivent dans le **même** `T.tasks` et peuvent être en vol en même temps (l'écouteur de recherche
  est branché avant la fin du chargement léger), d'où trois règles à ne pas casser :
  **(1)** `loadLightTasks` teste `allLoaded || allLoading` **juste avant** de publier — jamais en tête de
  fonction, où `allLoaded` est toujours faux ; **(2)** `loadAllTasks` mémorise sa promesse dans `allLoading`,
  que les appels concurrents partagent (une frappe = un appel, mais une seule pagination) ; **(3)** `tasks` et
  `allLoaded` sont publiés sans `await` entre les deux. Cf. `docs/EVENEMENTS.md` (2026-07-17).
- `withPinnedTasks(tasks)` : complète une liste avec les tâches épinglées (favoris + congés) qui en sont
  absentes, chargées à l'unité (`getPage`). **Retourne** la liste et n'écrit jamais dans `T.tasks` : publier
  est l'affaire de l'appelant (`T.tasks.push(f(await g()))` capturerait le tableau avant l'`await` et
  pousserait sur un tableau orphelin en cas de réaffectation).
- `applyFilter` : rend la liste en relisant `#task-search` **au moment du rendu**, jamais une valeur capturée
  avant un `await` (deux frappes rapides rendent dans l'ordre d'arrivée des réponses, pas de la saisie).
- **`publishTasks(tasks)`** : **seul** endroit qui écrit `T.tasks`. Publie la liste **et rejoue tout ce qui en
  dépend** (`applyFilter`, `helpers.renderFavorites`), car la liste est publiée jusqu'à **deux** fois (léger puis
  complet) et le léger peut ne jamais publier. Y ajouter un `await` casserait l'atomicité dont dépend `allLoaded` ;
  tout nouveau rendu lisant `T.tasks` s'accroche ici, pas dans `initTimer`. Cf. `docs/EVENEMENTS.md` (2026-07-17).
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
- **`renderFavoriteButtons()`** : construit les boutons depuis `config.prefs.favorites`, chacun normalisé par
  `normalizeFavorite`. Pose la couleur via `btn.style.setProperty('--fav-color', 'var(--fav-<clé>)')` — une propriété
  personnalisée dont la valeur est elle-même un `var()`, ce qui fait que le **basculement de thème repeint le liseret
  sans une ligne de JS**. Le picto vient de `favIconSvg`, le libellé va dans un `<span class="fav-btn-label">` tronqué
  par CSS, le texte entier dans `title`.
  ⚠️ Exposée via **`helpers.renderFavorites`** et **rappelée après `loadLightTasks()`** : câblée seule dans
  `wireManual`, elle s'exécute avant que `T.tasks` n'existe et tout favori sans libellé affiche « Favori ». Cf.
  `EVENEMENTS.md` (2026-07-17).
- `setSaving(on, sourceBtn)` : ne remplace que le **`.fav-btn-label`** (repli sur le bouton pour « Enregistrer », qui
  n'a pas de libellé séparé) — écraser le `textContent` du bouton effacerait le picto SVG.
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
- **Sélecteur de plage perso** (`#stats-custom`) : affiché/masqué par `$('stats-custom').hidden = S.kind !== 'custom'`.
  ⚠️ Comme `.fav-pop` en config, il porte une garde `.stats-custom[hidden]` — sans elle, son `display:flex` bat le
  `[hidden]` du navigateur et le bloc reste visible en permanence (bug de la v5.2.0, corrigé en v5.3.1).
  Cf. `EVENEMENTS.md` (2026-07-17).
- **`fetchAggregate(range)`** : sert le cache si la plage a déjà été chargée, sinon interroge Notion avec
  `queryAll` filtré sur la propriété **date de début** mappée (`on_or_after`/`on_or_before` la plage, via
  `toNotionDate`), convertit chaque page en `Session` (`sessionFromPage`), puis appelle `aggregate` de
  `core/stats.js` avec `isVacationSession`, les heures hebdo **et le planning** (`prefs.schedule`) de la config.
  Met le résultat en cache.
  `invalidateStats()` vide ce cache ; exportée pour permettre à un appelant de forcer un recalcul après
  l'enregistrement d'une session (non câblée à ce jour — le cache ne vit que le temps d'ouverture du popup, donc
  l'écart ne survit pas à une réouverture).
- `renderObjective` / `renderDays` / `renderProjects` : rendu HTML de la carte objectif (anneau CSS piloté par
  une variable `--p`, détail travaillé/objectif/reste + badge congés **en jours** — `🌴 2,5 j`, décimale `,0`
  masquée), des barres du
  rythme quotidien, et du bilan par projet (barre de proportion + durée + %). `renderDays` **empile** par jour
  deux segments `.seg` — bleu (`workMs`, base) + doré (`congeMs`, au-dessus) — la hauteur totale étant
  proportionnelle à `workMs + congeMs` du jour le plus chargé (`maxMs = max(workMs+congeMs, targetMs)`, pour que le
  **repère de cible** tienne dans le cadre) ; chaque barre vit dans un **cadre à hauteur fixe** `.track` (hauteurs
  exactes — cf. `EVENEMENTS.md` 2026-07-18) et porte un repère `.day-target` à la cible `targetMs` du jour (aucun
  si jour non travaillé) ; jour vide en gris. L'infobulle (`title`) détaille travail et/ou congés
  (« 04:00 travaillé · 04:00 congés »), et l'étiquette d'heure au-dessus des barres est **masquée en vue Mois**
  (seul le 🌴 des congés y reste) : à 28–31 colonnes le libellé « 07:30 » insécable débordait. Côté CSS, `.day`
  porte `min-width:0` pour que les colonnes flex puissent rétrécir (sans quoi `min-width:auto` empêchait tout
  rétrécissement → scrollbar horizontale).
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
- **Filtre d'état** : `renderStatusExclude` (appelée par `remapTasks` et sur `change` du sélecteur de propriété)
  affiche **une case à cocher par valeur réelle** de la propriété `status`/`select` mappée (lues via le champ
  `options` de `getDatabaseSchema`). Les valeurs déjà exclues sont pré-cochées **seulement si elles concernent la
  propriété courante** (changer de propriété repart de zéro) ; une valeur sauvegardée absente des options est
  rendue cochée avec la mention « (absent de la base) » — préservée, jamais supprimée en silence. `collectTasksFields`
  produit `statusFilter.excludeValues` (**tableau**) à partir des cases cochées, remplaçant l'ancien champ texte
  `excludeValue` séparé par `;`.
- **Favoris** : `renderFavorites` reconstruit la liste depuis `state.favorites` (ajout/suppression, **max 8**), chaque
  ligne portant tâche, libellé, et deux cellules `pickCell(i, fav, kind)` — un bouton déclencheur (aperçu de l'état)
  plus son panneau, `colorPop` (10 pastilles) ou `iconPop` (« aucun » + 23 pictos).
  `wireFavorites` délègue **un seul** écouteur de clic sur `#fav-list` (via `closest()`, car le clic atterrit souvent
  sur le `<svg>` ou la pastille interne), plus deux écouteurs `document` pour la fermeture au clic extérieur et à
  Échap. `togglePopover`/`closePopovers` garantissent **un seul panneau ouvert**. Choisir écrit dans
  `state.favorites[i]` puis **re-rend toute la liste** : l'état circule dans un seul sens (state → DOM), et le
  re-rendu rafraîchit l'aperçu et referme le panneau d'un même geste. Un nouveau favori prend `nextFreeColor`.
  ⚠️ Deux pièges de rendu documentés dans le CSS : les panneaux s'ouvrent **vers le haut** (`.card` porte
  `overflow:hidden`, la ligne Favoris est la dernière de sa carte) et portent une garde `.fav-pop[hidden]`
  (sans elle, `display:grid` bat le `[hidden]` du navigateur). Cf. `EVENEMENTS.md` (2026-07-17).
- **`onSave`** : valide les champs obligatoires (Nom/Début/Fin, heures/semaine > 0), assemble l'objet `config`
  complet (token, 2 bases mappées, **base Projets** si choisie, `prefs`, thème) via `collectTimeFields`/
  `collectTasksFields`, `saveConfig`, puis referme l'onglet.
- **`onExport`** : `buildExport` (config courante + version du manifeste) → `Blob` JSON → lien `<a download>`
  cliqué par programme (`URL.createObjectURL`, révoqué juste après). **`onImportFile`** : lit le fichier
  (`file.text()`), délègue la validation à `parseImport`, relit `exportedAt`/`appVersion` du JSON brut pour les
  afficher dans un `confirm()` (date + version d'origine, rappel que le token du poste est conservé), puis
  `saveConfig(next)` + `location.reload()` seulement après confirmation. Toute erreur de `parseImport` s'affiche
  telle quelle dans `#import-status`, sans écriture. Cf. `core/config-io.js` ci-dessus pour la logique pure.
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
