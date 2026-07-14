# Documentation technique — Notion Time Tracker

Version : `4.9.4`. Extension navigateur **Manifest V3**, JavaScript vanilla, sans build ni dépendance.

---

## 1. Architecture générale

```
┌──────────────────────────────────────────────────────────────┐
│                     Navigateur (Chrome/Edge)                   │
│                                                                │
│  ┌─────────────────────────┐      ┌───────────────────────┐   │
│  │  POPUP (action)          │      │ SERVICE WORKER         │   │
│  │  popup.html              │◄────►│ background.js          │   │
│  │   ├─ popup-init.js       │ msg  │  - badge               │   │
│  │   ├─ popup.js  (UI+logic)│      │  - notifications       │   │
│  │   └─ popup.css           │      │  - polling 60 s        │   │
│  │                          │      └───────────┬───────────┘   │
│  │  config.html             │                  │               │
│  │   ├─ config.js           │                  │               │
│  │   └─ config.css          │                  │               │
│  └───────────┬──────────────┘                  │               │
│              │                                  │               │
│   ┌──────────▼──────────────────────────────────▼─────────┐   │
│   │            chrome.storage.local (persistance)          │   │
│   └────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬──────────────────────────────┘
                                 │ HTTPS (fetch)
                                 ▼
                   ┌──────────────────────────────┐
                   │  API REST Notion (v2022-06-28) │
                   │  api.notion.com/v1/*           │
                   └──────────────────────────────┘
```

**Il n'y a pas de content script** : l'extension ne s'injecte dans aucune page web. Toute la logique
vit dans le popup et le service worker. Il n'y a **pas d'étape de build** : les fichiers sont chargés tels quels.

---

## 2. Inventaire des fichiers

| Fichier | Rôle | Taille approx. |
|---------|------|------|
| `manifest.json` | Déclaration de l'extension (MV3) | — |
| `background.js` | Service worker : badge, notifications, polling | ~235 lignes |
| `popup.html` | Structure du popup (onglets Timer/Stats) | ~290 lignes |
| `popup.css` | Styles du popup | ~1000 lignes |
| `popup-init.js` | Contrôle de config au chargement + bouton reconfig | ~65 lignes |
| `popup.js` | **Cœur applicatif** : timer, sessions, API, stats, favoris | ~2060 lignes |
| `config.html` | Assistant de configuration (2 étapes) | ~250 lignes |
| `config.css` | Styles de l'assistant | — |
| `config.js` | Logique de l'assistant (token, bases, mapping, favoris) | ~760 lignes |
| `icons/icon{16,48,128}.png` | Icônes | — |
| `generate_icons.py` | Script utilitaire de génération d'icônes | — |

### 2.1 `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "Notion Time Tracker",
  "version": "4.9.4",
  "permissions": ["storage", "notifications"],
  "host_permissions": ["https://api.notion.com/*"],
  "action": { "default_popup": "popup.html", "default_icon": {…} },
  "background": { "service_worker": "background.js" },
  "icons": {…}
}
```

- **Permissions** : `storage` (persistance), `notifications` (rappels).
- **host_permissions** : uniquement `api.notion.com` (les appels `fetch` cross-origin y sont autorisés).
- Pas de permission `tabs` déclarée bien que `chrome.tabs.create` soit utilisé — cet appel ne
  nécessite pas de permission spéciale (ouverture d'onglet simple).

---

## 3. Modèle de données local (`chrome.storage.local`)

Toutes les données locales sont stockées sous forme de paires clé/valeur.

| Clé | Type | Description |
|-----|------|-------------|
| `notionToken` | `string` | Token d'intégration interne Notion (`secret_…`). |
| `notionMapping` | `object` | Configuration des bases et du mapping des champs (voir 3.1). |
| `currentSession` | `object \| absent` | Session chronométrée en cours (voir 3.2). |
| `taskHistory` | `string[]` | IDs des 20 dernières tâches utilisées (ordre du + récent au + ancien). |
| `favorites` | `object[]` | Favoris `{ taskId, customLabel? }`, max 6. |
| `requireComment` | `boolean` | Commentaire obligatoire à l'arrêt. |
| `customButtonLabel` | `string` | Libellé du bouton « application interne » (défaut `CLICKUP`). |
| `weeklyHours` | `number` | Objectif hebdomadaire en heures (défaut 39). |
| `vacationTaskId` | `string` | ID de la tâche « congés ». |

### 3.1 Structure de `notionMapping`

```js
{
  databaseId:      "…",          // Base « Temps saisis » (écriture)
  databaseName:    "Time",
  gdrDatabaseId:   "…",          // Base « Tâches » (lecture)
  gdrDatabaseName: "GDR Work",
  fields: {
    taskName:    "Nom",                 // title      (obligatoire)
    startDate:   "Début session",       // date       (obligatoire)
    endDate:     "Fin session",         // date       (obligatoire)
    pause:       "Pause (min)" | null,  // number     (optionnel)
    comment:     "Commentaire…" | null, // rich_text  (optionnel)
    clickupUrl:  "TaskURL" | null,      // url        (optionnel)
    taskId:      "#TaskID" | null,      // rich_text  (optionnel)
    projects:    "🎯 Projets" | null,    // relation   (optionnel)
    gdrRelation: "Tâches" | null        // relation   (optionnel)
  }
}
```

### 3.2 Structure de `currentSession`

```js
{
  pageId:            "…",          // ID de la page Notion créée au démarrage
  taskId:            "…",          // ID de la tâche pointée
  taskName:          "Ma tâche [Projet]",
  startTime:         "2026-07-06T09:15:00.000Z",  // ISO
  isPaused:          false,        // présent si mis en pause au moins une fois
  pauseStartTime:    null,         // ISO du début de la pause en cours
  totalPauseDuration: 0            // ms de pause cumulés
}
```

> **Remarque architecture** : la page session est créée dans Notion **au démarrage** du timer
> (pas à l'arrêt). L'arrêt fait un `PATCH` pour renseigner la date de fin. Conséquence : une session
> jamais arrêtée reste une page « ouverte » (sans date de fin) dans Notion.

---

## 4. Intégration API Notion

Base URL : `https://api.notion.com/v1`. En-têtes communs :

```
Authorization: Bearer <notionToken>
Notion-Version: 2022-06-28
Content-Type: application/json   (pour POST/PATCH)
```

### 4.1 Endpoints utilisés

| # | Méthode & endpoint | Utilisé par | Rôle |
|---|--------------------|-------------|------|
| 1 | `GET /users/me` | `config.js`, `popup.js` | Tester la validité du token |
| 2 | `POST /search` (`filter.value="database"`) | `config.js` | Lister les bases partagées |
| 3 | `GET /databases/{id}` | `config.js` | Récupérer le schéma (propriétés) de la base temps |
| 4 | `POST /databases/{id}/query` | `popup.js`, `config.js` | Charger tâches, sessions récentes, stats |
| 5 | `GET /pages/{id}` | `popup.js` | Charger une tâche favorite manquante |
| 6 | `POST /pages` | `popup.js` | **Créer** une session (au démarrage / saisie manuelle) |
| 7 | `PATCH /pages/{id}` | `popup.js` | **Mettre à jour** une session (fin, commentaire, pause) |

> Les IDs de base sont normalisés via `.replace(/-/g, '')` (retrait des tirets) avant certains appels.

### 4.2 Chargement des tâches (base « Tâches »)

Requête `POST /databases/{gdrDatabaseId}/query` :

```js
{
  filter: { property: 'EtatL', status: { does_not_equal: 'clos' } },
  sorts:  [{ property: 'Dernière modification', direction: 'descending' }],
  page_size: 20   // ou 100 si recherche (avec pagination via start_cursor)
}
```

**Mapping d'une tâche** (propriétés attendues dans la base « Tâches ») :

| Propriété Notion | Type | Champ interne |
|------------------|------|---------------|
| `Nom` | title | `name` |
| `Projet_texte` | rich_text | `project` |
| `#TaskID` | rich_text | `taskId` |
| `TaskURL` | url | `taskUrl` |
| `🎯 Projets` | relation | `projects[]` |
| (id de page) | — | `notionUrl = notion.so/{id}` |

> ⚠️ Ces noms de propriétés de la base « Tâches » sont **codés en dur** (contrairement à la base
> « Temps saisis » qui est mappée). Voir dette technique.

### 4.3 Création d'une session (`POST /pages`)

`createTimePage(taskData, startTime)` construit dynamiquement l'objet `properties` selon le mapping :

- **Toujours** : `taskName` (title, avec `[Projet]` accolé), `startDate` (date).
- **Si mappé** : `gdrRelation` (relation vers la tâche), `taskId` (rich_text), `projects` (relation
  multiple), `clickupUrl` (url).
- `parent: { type: 'database_id', database_id: databaseId }`.
- Retourne l'`id` de la page créée.

### 4.4 Mise à jour d'une session (`PATCH /pages/{id}`)

`updateTimePage(pageId, endTime, comment, pauseMinutes)` :

- **Toujours** : `endDate` (date).
- **Si mappé + valeur** : `comment` (rich_text), `pause` (number, minutes).

### 4.5 Récupération des sessions (récentes & stats)

- **Sessions récentes** : filtre `startDate >= début d'hier`, tri descendant.
- **Stats** : filtre `startDate` dans `[début, fin]` de la période, tri ascendant.

---

## 5. Le service worker (`background.js`)

### 5.1 Responsabilités

1. **Badge** de l'icône selon l'état (🟢 / ⏸️ / vide), piloté par messages du popup.
2. **Notifications** planifiées via un `setInterval` de 60 s.
3. Restauration de l'état au démarrage (`onStartup`) et gestion `onInstalled`.

### 5.2 Communication popup → worker

`chrome.runtime.sendMessage({ action })` avec `action ∈ { sessionStarted, sessionStopped, sessionPaused, sessionResumed }`.
Le worker met à jour `activeSession` (en mémoire) et le badge.

### 5.3 Polling (toutes les 60 s)

Lit `currentSession` depuis le storage et évalue trois règles (ignorées si en pause) :

| Constante | Valeur | Règle |
|-----------|--------|-------|
| `longTimerHours` | 3 | Notif si session ≥ 3 h (répétée toutes les 3 h via `lastLongTimerNotif`). |
| `endOfDayHour/Minute` | 17:45 | Notif à l'heure exacte, avec boutons d'action. |
| `dailyGoalHours` | 8 | Notif si total du jour ≥ 8 h (flag `dailyGoalNotified`, remis à 0 à minuit). |

### 5.4 ⚠️ Dette technique majeure — ID codé en dur

`getTodayTotalWorkTime()` interroge une base Notion via un **ID en dur** :

```js
fetch('https://api.notion.com/v1/databases/1fad0619270980b6b5e3f028e2002d00/query', …)
```

Cette base n'est **pas** celle configurée par l'utilisateur, et les noms de propriétés
(`Début session`, `Fin session`) sont également en dur. Le calcul d'objectif quotidien ne fonctionne
donc que pour l'instance d'origine. **À corriger impérativement en v2** (utiliser `notionMapping`).

---

## 6. Le popup (`popup.js`) — organisation logique

Fichier monolithique (~2060 lignes), organisé en sections :

1. **Constantes & état global** : `notionToken`, `notionMapping`, `currentSession`, `tasks`,
   `weeklyHours`, `vacationTaskId`, intervals de timer.
2. **Références DOM** : ~60 `getElementById` en tête de fichier.
3. **Initialisation** (`DOMContentLoaded`) : `loadConfig` → `loadTasks` → `loadFavorites` →
   `loadCurrentSession` → `loadRecentSessions`.
4. **Configuration** : `loadConfig`, `saveConfig` (dans le popup léger), `testNotionConnection`.
5. **Tâches** : `loadTasks` (pagination + historique + favoris manquants), `populateTaskSelect`,
   `filterTasks`, `getPageTitle`, `getProjectsRelation`.
6. **Sessions** : `startSession`, `stopSession`, `stopSessionAt`, `togglePause`, `loadCurrentSession`.
7. **Modale « Arrêter à »** : `openStopAtModal`, `updateRealDuration`, `closeStopAtModal`.
8. **API Notion** : `createTimePage`, `updateTimePage`, `loadRecentSessions`, `fetchSessionsForPeriod`.
9. **Timer** : `startTimer`/`stopTimer`/`updateTimerDisplay`, `startPauseTimer`/`updatePauseDisplay`
   (via `setInterval` à 1 s).
10. **Ouverture de tâches** : `openSelectedTask`, `openCurrentTask`, `openSessionTask`.
11. **Onglets** : `switchTab`.
12. **Statistiques** : `loadStats`, `getPeriodDates`, `fetchSessionsForPeriod`, `calculateStats`, `displayStats`.
13. **Favoris** : `loadFavorites`, `saveFavoriteSession`, `selectFavoriteTask`, `updateFavoritesVisibility`.
14. **Utilitaires** : `formatDuration`, `formatDateTimeLocal`, `roundToNearestFiveMinutes`,
    `formatDate`, `showMessage`, gestion des sections/états.

### 6.1 Gestion du temps & des pauses

- Temps travaillé affiché = `(now − startTime) − totalPauseDuration`.
- `formatDuration(ms)` → `HH:MM:SS` dans `popup.js` ; `HH:MM` dans `background.js` (deux versions !).
- Rafraîchissement du chronomètre : `setInterval(updateTimerDisplay, 1000)`.

### 6.2 Historique & tri des tâches

`addToTaskHistory(taskId)` : place la tâche en tête, dédoublonne, limite à 20, persiste. Au chargement,
`loadTasks` réordonne : tâches de l'historique d'abord (dans l'ordre), puis reste trié alphabétiquement.

### 6.3 Cache des stats

`statsCache` + `statsCacheTime`, validité **5 min** (`CACHE_DURATION`). Le bouton 🔄 invalide le cache.

### 6.4 Calcul « hors période » (off-hours)

Dans `calculateStats`, chaque session est parcourue **par tranches de 5 min** ; une tranche est
« hors période » si week-end, ou en semaine avant 9 h / à partir de 18 h. Le cumul alimente
l'affichage « (dont X h hors période) » et une seconde barre de progression.

---

## 7. L'assistant (`config.js`) — organisation logique

1. **`init`** : recharge la config existante, pré-remplit, charge les tâches GDR et les favoris.
2. **`testConnection`** : `GET /users/me`, sauvegarde le token.
3. **`loadDatabases`** : `POST /search`, affiche la liste **en double** (temps / tâches).
4. **`selectDatabase(id, el, type)`** : gère les deux sélections (`time` / `gdr`).
5. **`goToStep2`** : charge le schéma de la base temps + les tâches GDR, peuple les selects.
6. **`populateFieldSelects`** : répartit chaque propriété dans le(s) select(s) compatible(s) selon son type.
7. **`autoSelectFields`** : pré-sélection par nom connu.
8. **`saveConfiguration`** : valide et persiste `notionMapping` + préférences, puis redirige vers `popup.html`.
9. **Favoris** : `loadGdrTasks` (pagination complète), `renderFavorites`, `addFavorite` (max 6),
   `populateVacationTaskSelect`.

---

## 8. Flux de navigation entre écrans

```
Clic sur l'icône
   └─ popup.html chargé
        └─ popup-init.js : storage a notionToken ET notionMapping ?
             ├─ NON → window.location = config.html  (assistant)
             └─ OUI → affiche le tracker + bouton ⚙️ (reconfig → config.html)

config.html (Enregistrer) → window.location = popup.html
```

---

## 9. Points de vigilance / limitations connues

1. **ID de base codé en dur** dans `background.js` (cf. §5.4).
2. **Noms de propriétés de la base « Tâches » codés en dur** (`EtatL`, `Dernière modification`,
   `Nom`, `Projet_texte`, `#TaskID`, `TaskURL`, `🎯 Projets`) : non mappables.
3. **`popup.js` monolithique** (~2060 lignes) : forte densité, pas de modules.
4. **Deux implémentations de `formatDuration`** (formats différents popup/worker).
5. **Pas de gestion de rafraîchissement du token** ni de pagination sur les stats (`query` sans
   boucle `has_more` pour les sessions de période → risque de troncature au-delà de 100 sessions).
6. **`chrome.action.openPopup()`** utilisé depuis le worker (support navigateur variable).
7. **Aucun test automatisé**, aucune internationalisation (FR en dur).
8. **Objectif mensuel** approximé (`jours × 5/7`), sans calendrier de jours ouvrés réel.

Voir [`specification-v2.md`](specification-v2.md) pour les corrections proposées.
