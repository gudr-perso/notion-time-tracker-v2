# Design — Onglet Stats (Notion Time Tracker v2)

> Spec validée en brainstorming le 2026-07-16. Cible : version **5.2.0**
> (la 5.1.0 est prise par la feature « injection des champs Notion »).
> Complète la spec socle `2026-07-13-notion-timer-v2-design.md` (l'onglet Stats y était reporté).

## 1. Objectif & périmètre

L'onglet **📊 Stats** remplace le placeholder « Bientôt ». Il répond à quatre besoins, tous retenus :

1. **Suivi de l'objectif hebdomadaire** — où j'en suis vs mon objectif d'heures (progression, reste).
2. **Bilan par projet** — répartition du temps par projet sur la période.
3. **Rythme quotidien** — heures jour par jour (barres), pour repérer tendances/journées creuses.
4. **Congés & absences** — jours de congés posés, déduits de l'objectif.

**Périodes** consultables : **Jour · Semaine · Mois · Perso** (plage de dates libre), avec navigation
précédent/suivant.

**Hors périmètre** (YAGNI) : export CSV, comparaison inter-périodes, objectifs par projet, graphiques
autres que barres/anneau, i18n.

## 2. Décisions de cadrage (validées)

| Sujet | Décision |
|---|---|
| Périodes | Jour, Semaine (Lun–Dim), Mois, Perso (du…au…). Navigation ‹ ›. |
| Source projet | Extraction depuis le nom de session `Tâche [Projet]` via `extractProject`. Pas de résolution de relation. |
| Jours ouvrés | **5 j/semaine (Lun–Ven)**. `cibleQuotidienne = weeklyHours / 5`. |
| Congés | Badge « 🌴 N jour(s) » **et** déduction de l'objectif. Sessions congés exclues du temps travaillé. |
| Disposition | **Option A** : anneau de progression « objectif » en héros, puis rythme quotidien, puis projets. |
| Graphiques | SVG/CSS purs, **zéro dépendance runtime** (contrainte projet). |
| Données | Lues depuis la base des temps configurée (aucun ID/nom en dur). |

## 3. Architecture

Deux nouveaux fichiers, alignés sur la séparation existante (core pur testé / popup UI) :

- **`src/core/stats.js`** — logique pure, **testée (Vitest / TDD)**, aucune API Chrome. Bornes de période,
  comptage jours ouvrés, agrégation (par jour, par projet, congés), calcul d'objectif.
- **`src/popup/stats.js`** — couche UI de l'onglet : sélecteur de période, navigation, fetch, rendu.
  Branchée sur `popup.js` comme `timer.js` / `timer-recent.js` (fonction `wireStats(sharedT, helpers)`).

`core/stats.js` n'importe aucune API Chrome ; il réutilise `time.js` (`workedMs`, `startOfDay`,
`formatDuration`) et `mapping.js` (`extractProject`, `sessionFromPage`).

## 4. Flux de données

```
Ouverture onglet Stats / changement de période / navigation ‹ ›
  └─ calcul de la plage {start, end} (core: periodRange)
       └─ cache mémoire par plage ? ── hit ─→ rendu
                    │ miss
                    ▼
       queryAll(token, timeDb.id, { filter startDate∈[start,end], sorts })   ← pagination has_more gérée
                    ▼
       sessions = pages.map(sessionFromPage).filter(start && end)
                    ▼
       agg = stats.aggregate(sessions, { range, vacation, weeklyHours })
                    ▼
       render(agg)   (spinner masqué)
```

- **Filtre Notion** : `startDate` `on_or_after` = `toNotionDate(range.start)` **et** `on_or_before` =
  `toNotionDate(range.end)` (fin de période incluse). Tri descendant sur `startDate`.
- **Spinner** pendant le fetch ; **état vide** si aucune session (« Aucune session sur cette période »).
- **Cache mémoire** : `Map<clé de plage, agg>` vidé au rechargement du popup. Évite un re-fetch quand on
  revient sur une période déjà consultée dans la session. Invalidé si la config change.
- **Rattachement d'une session à un jour** : par sa **date de début** (`startTime`). Une session à cheval
  sur minuit compte en entier pour son jour de début (simplicité ; cas marginal).

## 5. Modèle d'agrégation — `core/stats.js`

Fonctions pures (contrats indicatifs) :

- `periodRange(kind, refDate) → { start: Date, end: Date, label: string }`
  - `kind` ∈ `'day' | 'week' | 'month'`. `week` = **lundi 00:00 → dimanche 23:59:59.999**.
    `month` = 1er → dernier jour. `day` = 00:00 → 23:59:59.999.
  - Pour `'custom'`, la plage est fournie directement (pas de calcul).
- `weekdaysBetween(start, end) → number` — nombre de jours **Lun–Ven** dans `[start, end]` (bornes incluses).
- `dailyTarget(weeklyHours) → hours` = `weeklyHours / 5`.
- `computeObjectiveHours(weekdays, congeDays, weeklyHours) → hours`
  = `max(0, (weekdays − congeDays) × weeklyHours/5)`.
- `aggregate(sessions, { range, isVacation, weeklyHours }) → Aggregate`

**`Aggregate`** :

```js
{
  workedMs,                 // temps travaillé total (hors congés)
  objectiveMs,             // objectif ajusté congés, en ms
  remainingMs,             // max(0, objectiveMs − workedMs)
  progress,                // workedMs / objectiveMs (0..1+, ou null si objectif = 0)
  congeDays,               // nb de jours distincts avec ≥1 session congé dans la plage
  perDay: [                // une entrée par jour de la plage (ordre chronologique)
    { date: Date, ms, isVacation: bool, isWeekend: bool }
  ],
  perProject: [            // trié par ms décroissant
    { project: string, ms, ratio }   // ratio = ms / workedMs
  ],
}
```

**Détection congés** (`isVacation(session)`), construite dans `popup/stats.js` et passée à `aggregate` :

1. Si le champ **relation Tâches** (`timeFields.tasksRelation`) est mappé et présent sur la page : la session
   est un congé si la relation pointe vers `normId(prefs.vacationTaskId)`.
   → nécessite d'étendre `sessionFromPage` pour exposer les IDs de relation (nouveau champ, rétro-compatible).
2. **Repli** si la relation n'est pas mappée : correspondance de **nom** — la session est un congé si son
   `name` correspond au titre attendu de la tâche congés (`titleWithProject(congeTask.name, congeTask.project)`).
   Le nom/projet de la tâche congés est lu une fois depuis la base des tâches (ou l'historique en cache).
3. Si aucune tâche congés n'est configurée : `congeDays = 0`, aucune session marquée congé.

**Jours de congé distincts** : ensemble des `startOfDay(session.startTime)` des sessions congés dans la plage.

## 6. UI — disposition A

Le panneau `#tab-stats` (aujourd'hui placeholder) est remplacé. De haut en bas :

1. **Barre de période**
   - Segments `Jour · Semaine · Mois · Perso` (le sélecteur actif surligné).
   - Flèches ‹ › (période précédente/suivante) + libellé de plage (ex. « 8 – 14 juil. », « Juillet 2026 »).
   - « Perso » déplie deux `input[type=date]` (du… au…) + bouton d'application.
2. **Carte objectif (héros)**
   - **Anneau de progression** SVG/CSS (`conic-gradient` ou cercle SVG `stroke-dasharray`), centre =
     `travaillé / objectif`. Réutilise `formatDuration(ms, { withSeconds:false })`.
   - À droite : Objectif ajusté · Travaillé · Reste · badge « 🌴 N jour(s) ».
   - Si `objectiveMs = 0` (période 100 % week-end/congé) : anneau neutre, texte « Pas d'objectif ».
3. **Carte rythme quotidien**
   - Barres verticales : L→D (semaine), jours du mois (mois), jours de la plage (perso), la journée seule (jour).
   - Congés en **doré**, jours vides en gris ; ligne de **cible quotidienne** pointillée.
   - Étiquette de hauteur (durée) au-dessus, initiale/numéro de jour dessous.
4. **Carte par projet**
   - Barres horizontales + libellé projet (tronqué) + `durée · %`. Trié décroissant.
   - « Sans projet » pour les sessions sans crochet.

**Thème** : réutilise les variables CSS clair/sombre existantes. Largeur ~700 px (popup). Le contenu défile
verticalement si nécessaire.

## 7. Intégration `popup.js`

- L'activation de l'onglet Stats déclenche un premier rendu (lazy : pas de fetch tant que l'onglet n'est pas ouvert).
- `wireStats(T, helpers)` reçoit le contexte partagé (`token`, `config`, `timeFields`).
- Après un **enregistrement de session** (timer/manuel/favori), invalider le cache de la plage courante si
  l'onglet Stats est visible (ou simplement au prochain affichage). Simplicité : invalidation au changement d'onglet.

## 8. Tests (TDD `core/stats.js`)

Cas couverts :

- `periodRange` : semaine Lun–Dim correcte (y compris changement de mois/année), mois (28/30/31 j), jour.
- `weekdaysBetween` : plage sur un week-end (0), une semaine pleine (5), un mois, bornes incluses.
- `computeObjectiveHours` : semaine sans congé (= weeklyHours), avec 1 congé, période 100 % week-end (0),
  congés > jours ouvrés (clamp à 0).
- `aggregate` : temps travaillé (pauses déduites via `workedMs`), exclusion des sessions congés du total,
  `congeDays` distincts, `perDay` complet et ordonné, `perProject` trié + ratios, période vide.
- Cas limites : session sans `endTime` ignorée, session à cheval sur minuit rattachée à son jour de début.

La couche UI (`popup/stats.js`) n'est pas testée unitairement (comme `timer-*.js`) — vérifiée manuellement
dans l'extension chargée.

## 9. Livraison (version 5.2.0)

- Bump `manifest.json` + `package.json` + `package-lock.json` → `5.2.0`.
- `docs/VERSIONS.md` : section `[5.2.0]` (onglet Stats).
- `docs/AVANCEMENT.md` : Stats passe à ✅, retirer de « prochaine action ».
- **D²** : `documentation-fonctionnelle.md` §4 réécrite (Stats livré, description des 4 blocs et des périodes) ;
  `documentation-technique.md` : nouveaux modules `core/stats.js` + `popup/stats.js`.
- `docs/EVENEMENTS.md` : entrée seulement si un piège non trivial surgit (ex. fuseau sur bornes de période).
- Commit de release `release: v5.2.0`.
