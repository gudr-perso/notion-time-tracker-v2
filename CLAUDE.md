# Notion Time Tracker v2

Extension Chrome/Edge (Manifest V3) de suivi du temps de travail, écrivant chaque session dans
Notion. Recodage v2 propre de la v1 (`4.9.4`). Documentation d'origine dans `doc/`, design validé dans
`docs/superpowers/specs/2026-07-13-notion-timer-v2-design.md`.

## Décisions de cadrage (validées)

| Sujet | Décision |
|-------|----------|
| Nature | Extension **Manifest V3**, client pur (aucun backend). |
| Stack | **JS vanilla + modules ES natifs**, **zéro build**, **zéro dépendance runtime**. |
| Tests | **Vitest** en *devDependency* uniquement, TDD sur les modules `core/` (logique pure). |
| Config | **Page unique** qui défile (langage visuel repris de Captage `parametres.html`). |
| Bases Notion | **Deux** bases, toutes deux **mappables** : `timeDb` (écriture) + `tasksDb` (lecture). |
| Thème | **Clair / sombre**, bascule ☀️/🌙 persistée (`config.theme`), sombre par défaut. |
| Arrière-plan | Service worker : **badge + notifications** via `chrome.alarms` (pas de `setInterval`). |
| Largeur popup | ~**700 px** (préférence validée à l'usage : noms de tâches lisibles sur une ligne). |
| Langue | **FR uniquement** (pas d'i18n `_locales` pour l'instant). |
| Migration v1 | **Aucune** (storage neuf). |
| Périmètre itération 1 | **Config + onglet Timer** (+ SW, thème, socle testé). Onglet **Stats reporté**. |

## Contraintes de correction (dette v1)

- **Fuseau horaire** : émettre les dates Notion en ISO **avec offset local** via `time.toNotionDate()`
  (ex. `…+02:00`), **jamais** `…Z`. La v1 envoyait de l'UTC → décalage à l'affichage. Cf. spec §9.1.
- Aucun ID de base ni nom de propriété **en dur** : tout passe par `config.timeDb` / `config.tasksDb`.
- Un seul `formatDuration` (paramétrable). `chrome.alarms` (jamais `setInterval` dans le SW).
- Backoff/retry sur 429 Notion. Normalisation des IDs (`replace(/-/g,'')`) selon endpoints.

## Architecture

```
Navigateur (Chrome/Edge, MV3)
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ POPUP (action)               │  msg   │ SERVICE WORKER               │
│  popup.html / .css           │◄──────►│  service-worker.js           │
│  popup.js  (bootstrap,       │        │   - badge 🟢/⏸️/vide          │
│             onglets, thème)  │        │   - notifications            │
│  timer.js  (idle/running/    │        │   - chrome.alarms (1 min)    │
│             manuel/congés/   │        └──────────────┬───────────────┘
│             favoris/stop-at) │                       │
│  config.html/.css/.js        │                       │
│  theme.js                    │                       │
└───────────────┬──────────────┘                       │
        ┌───────▼───────────────────────────────────────▼───────┐
        │              chrome.storage.local                      │
        │   config · currentSession · taskHistory                │
        └────────────────────────────────────────────────────────┘
                                │ fetch (host_permissions)
                                ▼
        ┌────────────────────────────────────────────────────────┐
        │  core/ (logique pure, sans API Chrome → testable)       │
        │   notion-api.js  fetch, pagination has_more, retry 429  │
        │   mapping.js     Page Notion ⇄ Task / Session           │
        │   time.js        durées, arrondis, périodes, toNotionDate│
        │   storage.js     accès typé chrome.storage.local        │
        └───────────────────────────┬────────────────────────────┘
                                    │ HTTPS
                                    ▼
                    API REST Notion (v2022-06-28)
```

**Principe d'isolation** : seuls `notion-api.js` et `mapping.js` connaissent le format Notion ; le
reste manipule des objets métier `Task` / `Session`. `core/*` n'importe aucune API Chrome.

## Structure des fichiers

```
manifest.json · icons/
src/
  background/service-worker.js
  popup/   popup.html popup.css popup.js timer.js
  config/  config.html config.css config.js
  core/    notion-api.js storage.js mapping.js time.js
  theme.js
test/      *.test.js (Vitest)
```

## Modèle de données local (`chrome.storage.local`)

- `config` : `{ notionToken, timeDb{id,name,fields}, tasksDb{id,name,fields}, prefs{…}, theme }`
- `currentSession` : `{ pageId, taskId, taskName, startTime, isPaused, pauseStartTime, totalPauseDuration }`
- `taskHistory` : `[taskId]` max 20, LRU.

Détail complet et contrats `core/` : voir la spec de design.
