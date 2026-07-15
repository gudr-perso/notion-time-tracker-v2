# Notion Time Tracker v2

Extension Chrome/Edge (Manifest V3) de suivi du temps de travail, écrivant chaque session dans
Notion. Recodage v2 propre de la v1 (`4.9.4`). Documentation d'origine dans `docs/`, design validé dans
`docs/superpowers/specs/2026-07-13-notion-timer-v2-design.md`.

## Suivi de projet (à lire et tenir à jour)

Trois fichiers dans `docs/` portent la mémoire du projet. **Leur contenu ne se recopie pas ici** — CLAUDE.md
ne garde que ces pointeurs et les routines ci-dessous :

- **`docs/ETAT_PROJET.md`** — snapshot vivant de l'avancement (fait / à faire / idées non tranchées / prochaine
  action). À rouvrir **en premier** pour reprendre le projet.
- **`docs/JOURNAL.md`** — mémoire des pièges techniques (Contexte / Erreur brute / Hypothèse / Action / Résultat /
  Leçon). Sert à ne pas re-déboguer deux fois la même chose.
- **`docs/CHANGELOG.md`** — historique des changements **par version** (format Keep a Changelog).

**Version** : la **source de vérité est `manifest.json`** (dupliquée dans `package.json` / `package-lock.json`).
Ne jamais stocker le numéro ailleurs comme autorité ; `ETAT_PROJET.md` l'affiche en reflet, `CHANGELOG.md` l'historise.

### Routines à appliquer de moi-même (sans qu'on me le demande)

- **Bug non trivial corrigé** (diagnostic non évident au premier coup d'œil) → ajouter une entrée à
  `docs/JOURNAL.md` au format Contexte / Erreur **brute** / Hypothèse / Action / Résultat / Leçon. Les typos et
  ajustements CSS triviaux n'y vont **pas**.
- **Nouvelle version décidée** → bumper `manifest.json` + `package.json` + `package-lock.json`, ajouter la section
  correspondante dans `docs/CHANGELOG.md`, refléter la version dans `docs/ETAT_PROJET.md` — le tout dans le commit
  de release (`release: vX.Y.Z`).
- **Feature terminée, nouvelle demande, ou idée écartée** → mettre à jour `docs/ETAT_PROJET.md`.

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

**Source unique de la carte du code** (ETAT_PROJET.md y renvoie, ne pas dupliquer).

```
manifest.json · icons/
src/
  background/service-worker.js   badge + notifications (chrome.alarms, MV3-safe)
  popup/
    popup.html/.css/.js          shell, onglets, thème, redirection config (onglet)
    timer.js                     état partagé + chargement des tâches
    timer-actions.js             start/pause/stop, stop-at (modale)
    timer-manual.js              saisie manuelle, congés, favoris (enregistrement rapide)
    timer-recent.js              sessions récentes
  config/  config.html/.css/.js  page de config (onglet plein écran)
  core/                          logique pure, testée (sans API Chrome)
    notion-api.js                fetch, pagination has_more, retry 429, normId
    mapping.js                   Page Notion ⇄ Task / Session
    time.js                      durées, arrondis, toNotionDate (offset local)
    storage.js                   accès typé chrome.storage.local
  theme.js
test/      *.test.js (Vitest)
docs/      ETAT_PROJET.md · JOURNAL.md · CHANGELOG.md · MEMO-suivi-projet.md (+ spec de design)
```

## Modèle de données local (`chrome.storage.local`)

- `config` : `{ notionToken, timeDb{id,name,fields}, tasksDb{id,name,fields}, prefs{…}, theme }`
- `currentSession` : `{ pageId, taskId, taskName, startTime, isPaused, pauseStartTime, totalPauseDuration }`
- `taskHistory` : `[taskId]` max 20, LRU.

Détail complet et contrats `core/` : voir la spec de design.
