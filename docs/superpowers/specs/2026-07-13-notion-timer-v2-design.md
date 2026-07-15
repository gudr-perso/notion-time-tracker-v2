# Design — Notion Time Tracker v2 (config + onglet Timer)

> Date : 2026-07-13
> Périmètre de cette itération : **page de configuration** + **onglet Timer** (+ service
> worker badge/notifications, thème clair/sombre, socle testé). L'onglet **Stats** est reporté.

Références : `doc/brief.md`, `doc/documentation-fonctionnelle.md`, `doc/documentation-technique.md`,
`doc/specification-v2.md`, `doc/design-ecrans.md`, captures `doc/screens/*.png`, et la page de
configuration du projet Captage (`C:/_pCloud/Captage/templates/parametres.html`) comme référence
**visuelle** de la config.

---

## 1. Décisions de cadrage

| Sujet | Décision |
|-------|----------|
| Nature | Extension Chrome/Edge **Manifest V3**, client pur (pas de backend). |
| Stack | **JavaScript vanilla + modules ES natifs**, **zéro build**, **zéro dépendance runtime**. |
| Tests | **Vitest** en dépendance *dev* uniquement, sur les modules `core/`. TDD sur la logique pure. |
| Config | **Page unique** qui défile (langage visuel de Captage), pas d'assistant multi-étapes. |
| Thème | **Clair / sombre** avec bascule ☀️/🌙 persistée. Sombre par défaut. |
| Arrière-plan | Service worker : **badge + notifications** (via `chrome.alarms`). |
| Largeur popup | ~**440 px** (les captures font foi ; on ignore les 700 px de `design-ecrans.md`). |
| Langue | **FR uniquement** (pas d'i18n `_locales` pour l'instant). |
| Migration v1 | **Aucune** (nouvelle extension = storage neuf ; données de session dans Notion). |

---

## 2. Architecture & arborescence

```
notion-timer-v2/
├── manifest.json                 # MV3, background { type: "module" }
├── icons/                        # existants (16/48/128)
├── src/
│   ├── background/
│   │   └── service-worker.js      # badge + notifications (chrome.alarms)
│   ├── popup/
│   │   ├── popup.html / popup.css
│   │   ├── popup.js               # bootstrap, routing d'onglets, thème
│   │   └── timer.js               # idle/running/manuel/congés/favoris/récentes/stop-at
│   ├── config/
│   │   ├── config.html / config.css
│   │   └── config.js              # page unique : token → bases → mapping ×2 → préférences
│   ├── core/                      # logique pure, sans API Chrome → testable Vitest
│   │   ├── notion-api.js          # fetch (auth, pagination has_more, retry/backoff 429)
│   │   ├── storage.js             # accès typé chrome.storage.local
│   │   ├── mapping.js             # Page Notion ⇄ objets métier (Task, Session)
│   │   └── time.js                # formatDuration, arrondis, périodes, off-hours
│   └── theme.js                   # bascule clair/sombre + persistance
└── test/                          # *.test.js (Vitest)
```

**Principe d'isolation** : seuls `notion-api.js` et `mapping.js` connaissent le format Notion ; le
reste manipule des objets métier `Task` / `Session`. `core/*` n'importe **aucune** API Chrome, ce qui
le rend directement testable par Vitest.

### 2.1 Contrats `core/` (indicatifs)

```js
// notion-api.js  (reçoit le token en paramètre, ne touche pas au storage)
testToken(token): Promise<{ ok, user }>
searchDatabases(token): Promise<Database[]>            // pagination incluse
getDatabaseSchema(token, dbId): Promise<Property[]>
queryAll(token, dbId, { filter, sorts }): Promise<Page[]>   // boucle has_more
createPage(token, dbId, properties): Promise<pageId>
updatePage(token, pageId, properties): Promise<void>
getPage(token, pageId): Promise<Page>

// mapping.js
taskFromPage(page, tasksFields): Task
sessionPropertiesForCreate(task, startTime, timeFields): properties
sessionPropertiesForUpdate({ endTime, comment, pauseMin }, timeFields): properties
sessionFromPage(page, timeFields): Session

// time.js
formatDuration(ms, { withSeconds }): string
roundToNearestFiveMinutes(date): Date
getPeriodDates(period, customStart?, customEnd?): { start, end }
computeOffHours(session): ms
workedMs(startTime, endTime|now, totalPauseDuration): ms
toNotionDate(date): string   // ISO 8601 AVEC offset local (+02:00), jamais 'Z' — cf. §9.1
```

---

## 3. Modèle de données local (`chrome.storage.local`)

Mapping **étendu aux deux bases** (corrige les dettes D1 et D2).

```js
config = {
  notionToken: "ntn_…",
  timeDb:  { id, name, fields: {
    taskName, startDate, endDate,           // obligatoires
    pause, comment, externalUrl, taskId, projects, tasksRelation  // optionnels (null si non mappé)
  }},
  tasksDb: { id, name, fields: {
    title, project, externalId, externalUrl, projectsRel,
    statusFilter: { property, type: 'status'|'select', excludeValue } | null,  // optionnel
    sortProperty | null
  }},
  prefs: {
    requireComment: false,
    externalButtonLabel: "CLICKUP",         // ≤ 20 car., forcé MAJ
    weeklyHours: 39,                        // décimales acceptées
    vacationTaskId: null,                   // optionnel
    favorites: [ { taskId, customLabel? } ] // max 6
  },
  theme: 'dark' | 'light'
}

currentSession = {
  pageId, taskId, taskName,
  startTime,                 // ISO
  isPaused, pauseStartTime,  // ISO | null
  totalPauseDuration         // ms cumulés
}

taskHistory = [taskId, …]    // max 20, LRU (plus récent en tête)
```

`storage.js` expose des accès typés (`getConfig`, `saveConfig`, `getCurrentSession`,
`setCurrentSession`, `clearCurrentSession`, `getTaskHistory`, `pushTaskHistory`).

---

## 4. Page de configuration (`config.html`)

Page **unique** qui défile, sections à en-tête (style Captage). Adaptée au client pur : `fetch`
direct vers `api.notion.com`, pas d'endpoint serveur. Chaque section déverrouille la suivante.

### ① Connexion Notion
- Champ token (`password`) + **« Tester la connexion »** → `GET /users/me` → « ✅ Connecté : *Nom* ».
- Si déjà configuré : « Token configuré ✓ » + bouton *Modifier*.

### ② Bases de données
- **« Charger mes bases »** → `POST /search` (pagination) → deux dropdowns :
  **Base Temps saisis** (écriture) et **Base Tâches** (lecture).
- Sélectionner les deux déverrouille le mapping et charge les schémas + la liste des tâches.

### ③ Mapping — Base Temps
Schéma via `GET /databases/{id}` ; chaque dropdown filtré par **type compatible** ; **auto-mapping**
par nom connu.
- **Obligatoires** : 📝 Nom `title` · 🕐 Début `date` · 🕑 Fin `date`.
- **Optionnels** : 🔢 TaskID `rich_text` · 🎯 Projets `relation` · ⏸️ Pause `number` ·
  💬 Commentaire `rich_text` · 🔗 URL app `url` · 🔗 Relation Tâches `relation`.

### ④ Mapping — Base Tâches *(nouveau v2)*
- 📝 Titre `title` · 🏷️ Projet (texte) · 🔢 ID externe `rich_text` · 🔗 URL externe `url` ·
  🎯 Relation Projets `relation`.
- 🚦 **Filtre d'état** (optionnel) : propriété `status`/`select` + valeur à **exclure**
  (ex. « clos »). Non mappé → toutes les tâches chargées.
- ↕️ **Tri** : propriété de tri (ex. « Dernière modification »).

### ⑤ Préférences
- ☐ Commentaire obligatoire à l'arrêt.
- 🔗 Libellé bouton externe (défaut `CLICKUP`, MAJ, ≤ 20 car.).
- ⏰ Heures/semaine (défaut 39).
- 🏖️ Tâche congés **optionnelle** (si vide → case « Marquer comme congés » du Timer désactivée).
- ⭐ Favoris (max 6) : tâche + libellé perso, avec ➕/❌.

### Validation & sortie
- **« ✅ Enregistrer »** : valide (3 champs Temps obligatoires mappés + heures > 0), persiste
  `config`, redirige vers `popup.html`.
- **Accès à la config** : petit **⚙️** à gauche du header du popup. Redirection **auto** vers la
  config tant que `notionToken` + `timeDb.id` + `tasksDb.id` ne sont pas tous présents.

---

## 5. Onglet Timer (`popup.html`)

Popup ~440 px, fidèle aux 4 captures. Header : **⚙️** (config, gauche) · **⏱️ Time Tracker**
(centre) · **☀️/🌙** (thème, droite). Onglets **Timer | Stats** — Stats affiché mais **placeholder
« Bientôt »** (hors périmètre).

### 5.1 État repos (idle) — capture `ecran-2d`
- Carte à cocher **« Saisie manuelle (oubli de timer) »**.
- **Rechercher une tâche** (input + loupe). Au repos : 20 dernières tâches modifiées. Au 1er
  caractère : chargement **complet** (pagination 100), filtre local sur nom + projet.
- Label **« Tâche *{tasksDb.name}* »** (dynamique) + `select` multi-lignes `Nom [Projet]`.
  Tri : **historique d'abord, puis alphabétique**, dédoublonné par ID.
- Boutons : **🔗 {externalButtonLabel}** · **🔗 Notion** · **▶️ DÉMARRER** (vert). Les 🔗
  s'(dés)activent selon la sélection et l'URL disponible.
- **Sessions récentes** : `queryAll` sur `timeDb` filtré `startDate ≥ début d'hier`, groupé
  **Aujourd'hui** / **Hier** avec total par jour ; lignes `Nom · HH:MM → HH:MM · durée · 🔗`.

### 5.2 État repos — saisie manuelle — capture `ecran-2a`
- Carte **DÉBUT / FIN** (`datetime-local`, pas de 5 min ; pré-remplis début = −1 h arrondi 5 min,
  fin = maintenant arrondi 5 min) + **Commentaire (optionnel)** + case **« Marquer comme congés »**
  (désactivée si pas de tâche congés ; sinon présélectionne la tâche congés et pré-remplit
  « En congés »).
- Carte **⭐ ENREGISTREMENT RAPIDE** (boutons orange, un par favori) : en mode manuel, **1 clic
  enregistre directement** la session (période saisie) sur la tâche du favori.
- Bouton principal → **💾 ENREGISTRER** : valide (début & fin présents, fin > début), `createPage`
  puis `updatePage` en une fois (pas de chrono), reset du formulaire.

### 5.3 État en cours (running) — capture `ecran-2b`
- Carte chrono géant **TEMPS ÉCOULÉ HH:MM:SS** = `workedMs` (écoulé − pauses), refresh 1 s
  (`setInterval` dans le popup ; le popup est vivant tant qu'il est ouvert).
- « Démarré le *jour date* à HH:MM » + indicateur de pause si actif.
- Carte tâche en cours + 🔗 Notion · zone **Commentaire de session**.
- Boutons **⏸ PAUSE** · **⏹ ARRÊTER** (orange) · **🕐 ARRÊTER À…**.

### 5.4 Démarrer / Pause / Arrêter
- **Démarrer** : `createPage` immédiat (`taskName` + `[Projet]`, `startDate` = maintenant, +
  champs optionnels mappés) → persiste `currentSession` → bascule running → message
  `sessionStarted` au worker (badge 🟢) → `pushTaskHistory`.
- **Pause / Reprendre** : cumul dans `totalPauseDuration` ; **max 1 h** de pause cumulée → blocage
  de la reprise + message ; badge ⏸️ / 🟢.
- **Arrêter** : si `requireComment` et commentaire vide → blocage + focus. Sinon `updatePage`
  (`endDate` = maintenant, `comment`, `pause` en minutes) → `clearCurrentSession` → badge vide →
  rechargement des sessions récentes.

### 5.5 Modale « Arrêter à… » — capture `ecran-2c`
- **Heure [HH]:[MM]** + **Date** ; **durée réelle** = fin choisie − début − pauses, recalculée en
  direct ; refus si fin < début (message + bouton désactivé) ; **✕ Annuler / ✓ Arrêter à cette heure**.

### 5.6 Invariants préservés (spec §7)
Page créée au démarrage / complétée à l'arrêt · pause max 1 h · historique LRU 20 · normalisation
des IDs Notion (`replace(/-/g,'')`) selon endpoints · favoris/tâche congés hors des 20 récentes
chargés individuellement (`getPage`).

---

## 6. Service worker (`service-worker.js`)

- **Badge** : 🟢 en cours · ⏸️ en pause · vide au repos. Piloté par messages du popup
  (`sessionStarted/Stopped/Paused/Resumed`) et restauré à `onStartup` depuis `currentSession`.
- **Notifications via `chrome.alarms`** (corrige D6/D7). Alarme périodique **1 min** évaluant 3
  règles (ignorées si en pause), avec flags anti-répétition :

  | Règle | Seuil (constante, défaut v1) | Détail |
  |-------|------------------------------|--------|
  | ⏰ Timer long | 3 h | Répété toutes les 3 h (`lastLongTimerNotif`). |
  | 🏁 Fin de journée | 17 h 45 | Si timer actif → notif + boutons « Arrêter maintenant » / « Continuer ». |
  | 🎯 Objectif quotidien | 8 h | Total du jour ≥ 8 h (1×/jour, `dailyGoalNotified` remis à 0 à minuit). |

- Le total du jour est calculé depuis Notion via **`config.timeDb` mappé** (corrige D1 — plus
  aucun ID ni nom de propriété en dur).
- Seuils gardés en constantes pour cette itération (configurables = backlog).

---

## 7. Thème (`theme.js`)

- `data-theme="dark|light"` posé sur `<html>` ; variables CSS pour les deux thèmes
  (palette sombre = Captage/captures : bleu nuit `#030826`/`#050c3f`, accents cyan `#2aa6e8`,
  orange `#f36100`).
- Bascule ☀️/🌙 dans le header, persistée dans `config.theme`. Partagé popup + config.

---

## 8. Tests (Vitest, TDD sur `core/`)

- `time.js` : `formatDuration` (avec/sans secondes), arrondi 5 min, `getPeriodDates`
  (today/week/lastweek/month/custom), off-hours par tranches de 5 min (week-end / <9 h / ≥18 h),
  `workedMs`, **`toNotionDate` (offset local, jamais `Z` ; cas heure d'été/hiver)**.
- `mapping.js` : `taskFromPage`, `sessionPropertiesForCreate/Update`, `sessionFromPage`, extraction
  projet `/\[([^\]]+)\]/` (+ « Sans projet », « 🏖️ Congés »).
- `notion-api.js` : boucle de pagination `has_more`, backoff 429 (fetch mocké).

---

## 9. Intégration Notion (rappel)

Base `https://api.notion.com/v1`, `Notion-Version: 2022-06-28`, `Authorization: Bearer <token>`.
Endpoints : `GET /users/me`, `POST /search`, `GET /databases/{id}`, `POST /databases/{id}/query`
(paginé), `GET /pages/{id}`, `POST /pages`, `PATCH /pages/{id}`.
`manifest.json` : `permissions: [storage, notifications, alarms]`, `host_permissions:
[https://api.notion.com/*]`.

### 9.1 Fuseau horaire (correctif v1 — obligatoire)

**Bug v1** : les dates étaient envoyées en **UTC** (`new Date().toISOString()` → suffixe `Z`).
Notion stockait/affichait alors l'heure en **GMT0**, d'où un décalage (ex. 9 h saisies → affichées
avec +2 h en CEST).

**Correctif v2** : toute date envoyée à Notion (`startDate`, `endDate`, saisie manuelle, stop-at)
passe par `time.toNotionDate(date)` qui produit un ISO 8601 **avec l'offset local** calculé au moment
donné (ex. `2026-07-09T09:00:00+02:00`) — **jamais** de `Z`. L'offset étant recalculé par instant, le
passage heure d'été/hiver est géré automatiquement. La lecture (`sessionFromPage`, sessions récentes)
reparse l'ISO et affiche en heure locale, ce qui round-trip correctement.

---

## 10. Périmètre

**Dans** : config complète (mapping 2 bases + préférences), onglet Timer (tous états + manuel +
congés + favoris + récentes + modale stop-at), service worker (badge + 3 notifs via `alarms`),
bascule de thème, modules `core/` + tests Vitest, `manifest.json` MV3.

**Hors (reporté)** : onglet Stats (placeholder « Bientôt »), i18n `_locales`, export CSV,
graphiques, édition/suppression de session récente, seuils/horaires configurables, sync
multi-appareils.

---

## 11. Dette v1 corrigée dans ce périmètre

D1 (ID base en dur) · D2 (props base Tâches en dur → mappées) · D3 (monolithe → modules) ·
D4 (deux `formatDuration` → un utilitaire paramétrable) · D6/D7 (`setInterval` SW → `chrome.alarms`) ·
D8 (retry/backoff 429) · D11 (tests sur le cœur) · **TZ (dates UTC → offset local, cf. §9.1)**.
*(D5 pagination stats, D9 i18n, D10 jours ouvrés relèvent de l'onglet Stats → reportés.)*
