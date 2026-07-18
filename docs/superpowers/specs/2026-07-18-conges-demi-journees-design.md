# Design — Congés en demi-journées + planning hebdomadaire

> Spec issue du brainstorming du 2026-07-18. Statut : **à valider** avant plan d'implémentation.
> Méthode : CAP³ (cadrage validé) → écriture de la spec → `writing-plans`.

## 1. Contexte & problème

Aujourd'hui un congé se saisit comme une **session manuelle** (début/fin en heures) liée à la tâche
Congés, et l'objectif retranche des heures « brutes ». Deux frictions :

1. **Saisie non naturelle** : on pose des congés en **demi-journées** (matin / après-midi / journée), pas
   « de 9:03 à 13:47 ». Écrire des heures à la main est fastidieux et arbitraire.
2. **Incohérence 8 h vs 7,8 h** : l'objectif est de 39 h/sem ⇒ 7,8 h/jour, alors que l'utilisateur pense
   ses journées en heures réelles variables (lundi 8 h, vendredi 6 h…). Le forfait plat `weeklyHours/5` ne
   reflète pas la réalité, et le badge « en jours » n'a pas de diviseur cohérent.

## 2. Décisions validées (brainstorming)

| Sujet | Décision |
|-------|----------|
| Saisie | **Demi-journées** (matin / après-midi / journée), avec **plage de dates**. |
| Valeur d'un congé | **Heures réelles**, issues d'un **planning hebdomadaire** configurable. |
| Rôle du planning | Il **définit aussi l'objectif** (source de vérité unique ; jour sans horaires = non travaillé). |
| Écriture Notion | **1 ligne par demi-journée** (journée = 2 lignes matin + après-midi). |
| UI de saisie | **Variante A** (Du [date + ½j] → Au [date + ½j], génération auto + récap) **+ lien « détailler les jours »** dépliant une liste éditable jour par jour (variante C) pour les cas particuliers. |
| Badge | **En jours, 1 décimale**, décimale `0` masquée (« 1 j », « 2,5 j », « 0,5 j »). |
| Rétro-compat | Sans planning : comportement **actuel** conservé (forfait `weeklyHours/5`, ancienne saisie). |

## 3. Modèle de données

### 3.1 `prefs.schedule` (nouveau)

Planning hebdomadaire, un segment matin et un segment après-midi par jour de semaine. Heures en `"HH:MM"`.
Segment absent = `null` ; les deux `null` = **jour non travaillé**.

```js
prefs.schedule = {
  mon: { am: ["09:00", "13:00"], pm: ["14:00", "18:00"] },
  tue: { am: ["09:00", "13:00"], pm: ["14:00", "18:00"] },
  wed: { am: ["09:00", "13:00"], pm: ["14:00", "18:00"] },
  thu: { am: ["09:00", "13:00"], pm: ["14:00", "18:00"] },
  fri: { am: ["09:00", "13:00"], pm: ["14:00", "17:00"] },  // vendredi après-midi plus court
  sat: { am: null, pm: null },
  sun: { am: null, pm: null },
}
```

Ce planning est aussi le **défaut pré-rempli** de la grille (lun–jeu 8 h, ven 7 h → **39 h/sem** pile).

- Clé de jour = `['sun','mon','tue','wed','thu','fri','sat'][date.getDay()]`.
- `schedule` **absent ou entièrement vide** ⇒ mode **fallback** (cf. §5.3).
- `weeklyHours` reste dans `prefs` : soit valeur héritée (fallback), soit **recalculée = total du planning** à
  l'enregistrement de la config (pour l'affichage et d'éventuels consommateurs). Il n'est plus **saisi**
  directement quand un planning existe (cf. §4.1).

### 3.2 Sessions de congé écrites

Inchangé côté format : chaque demi-journée = une page du `timeDb`, liée à la tâche Congés (donc détectée par
`isVacationSession`), avec `start`/`end` = les bornes du segment planning et `pauseMin = 0`. Aucune nouvelle
propriété Notion à mapper.

## 4. Phase 1 — Planning hebdomadaire + objectif dérivé

### 4.1 Config (`config.html` / `config.js`)

- Remplacer le champ **« Heures / semaine »** par une **grille Planning type** : 7 lignes (Lun→Dim) × 4 champs
  `time` (Matin début, Matin fin, Après-midi début, Après-midi fin). Champs vides autorisés.
- **Défaut pré-rempli** (nouvelle config) : lun–jeu `09:00–13:00 / 14:00–18:00`, ven `09:00–13:00 / 14:00–17:00`,
  sam/dim vides → **39 h/sem**.
- Afficher le **total dérivé** en lecture seule : « ≈ 39 h/semaine ».
- À l'enregistrement : validation légère (fin > début par segment ; segments cohérents), écriture de
  `prefs.schedule` et de `prefs.weeklyHours = total`.
- **Export/import** (`config-io.js`) : inclure `schedule` dans `buildExport`/`parseImport` (token toujours exclu).

### 4.2 Objectif dérivé (`core/schedule.js` nouveau + `core/stats.js`)

Nouveau module pur `core/schedule.js` (sans DOM, sans API Chrome) :

- `scheduledMsForDate(schedule, date)` → durée travaillée planifiée du jour (matin + après-midi), en ms ; `0`
  si jour non travaillé ou pas de planning.
- `segmentSpan(schedule, date, seg)` → `{ start: Date, end: Date } | null` pour `seg ∈ {'am','pm'}`.
- `generateLeaveSpans(schedule, { fromDate, fromHalf, toDate, toHalf, overrides })` → liste ordonnée de
  `{ start, end }` (une par demi-journée), jours non travaillés **sautés** (cf. §5.1).

`aggregate` (dans `core/stats.js`) reçoit désormais **`schedule`** (en plus / à la place de `weeklyHours`) :

```
rawObjectiveMs   = Σ_{date ∈ [start,end]} scheduledMsForDate(schedule, date)
objectiveMs      = Σ_{date} max(0, scheduledMs(date) − min(congeMs(date), scheduledMs(date)))
                 = rawObjectiveMs − Σ_{date} min(congeMs(date), scheduledMs(date))
remainingMs      = max(0, objectiveMs − workedMs)
progress         = objectiveMs > 0 ? workedMs / objectiveMs : null
```

Généralise la v5.5.5 (où `scheduledMs(date)` valait le forfait plat les jours ouvrés). Le plafond
`min(congeMs, scheduledMs)` reste utile pour les anciens congés en heures brutes.

### 4.3 Badge congés (jours, heures réelles)

```
congeDays = Σ_{date, scheduledMs(date) > 0} min(congeMs(date), scheduledMs(date)) / scheduledMs(date)
```

Journée pleine off = `1,0` ; un matin de 4 h sur une journée de 7,5 h = `0,53` → affiché « 0,5 j ». Rendu :
arrondi 1 décimale, **décimale `0` masquée** (« 1 j », pas « 1,0 j »). `aggregate` renvoie `congeDays` (nombre)
et `congeMs` (total heures, conservé pour d'éventuels usages) ; le popup formate.

## 5. Phase 2 — Saisie des congés en demi-journées

### 5.1 Génération (règles)

Entrée : `fromDate + fromHalf`, `toDate + toHalf`, chaque `half ∈ {matin, aprem, journée}`.

- **Jour unique** (`from == to`) : seul `fromHalf` s'applique (`matin`→am, `aprem`→pm, `journée`→am+pm).
- **Plage** (`from < to`) :
  - Jour de début : `matin`→am seul, `aprem`→pm seul, `journée`→am+pm.
  - Jour de fin : `matin`→am seul, `aprem`→pm seul, `journée`→am+pm.
  - Jours intermédiaires : journée pleine (am+pm).
  - **Jours non travaillés** (segments planning `null`) : **sautés** silencieusement.
- `overrides` (issu du lien « détailler ») : `{ 'YYYY-MM-DD': 'matin'|'aprem'|'journée'|'—' }` remplace le type
  d'un jour donné (`—` = ne rien poser ce jour-là).
- Chaque demi-journée retenue → une paire `{ start, end }` (bornes du segment). Une journée = 2 paires.

### 5.2 UI popup (`popup.html` / `popup.css` / `timer-manual.js`)

Quand « Marquer comme congés » est coché, **remplacer** les champs début/fin par le bloc **Variante A** :

- Ligne « Du » : `date` + segmenté `Matin | Après-midi | Journée`.
- Ligne « Au » : `date` + segmenté `Matin | Après-midi | Journée` (masquée si `Au == Du`, ou synchronisée).
- **Récapitulatif** live : « 🌴 2,5 j · 4 lignes · week-ends sautés » (recalcul à chaque changement, via
  `generateLeaveSpans`, sans appel Notion).
- Lien **« détailler les jours »** : déplie la **liste éditable** (variante C) — une ligne par jour de la plage
  avec un sélecteur `Matin/Après-midi/Journée/—`, les jours non travaillés grisés. Alimente `overrides`.
- Commentaire (prérempli « En congés », modifiable) conservé.

### 5.3 Écriture Notion (`timer-manual.js`)

À l'enregistrement : pour chaque `{ start, end }` de `generateLeaveSpans`, `createPage` + `updatePage`
(mêmes `sessionPropertiesForCreate/Update` que la saisie manuelle, tâche = Congés, `pauseMin = 0`).

- **Séquentiel**, avec garde anti double-clic existante ; bouton en « ⏳ … ».
- **Échec partiel** : si une ligne échoue, arrêter, afficher combien ont été créées (« 2/4 créées, échec sur le
  11/07 : <message Notion> ») pour éviter les doublons au réessai. Toast de succès sinon (« ✅ N lignes créées »).
- `reloadRecent()` + invalidation du cache Stats en fin.

### 5.4 Rétro-compatibilité

- **Config sans `schedule`** : la grille est vide → l'objectif retombe sur `weeklyHours/5` (jours ouvrés), et la
  saisie congés **garde l'ancien mode début/fin**. La feature demi-journées s'active dès qu'un planning existe.
- **Anciens congés** (sessions début/fin arbitraires) : toujours lus ; leurs heures réelles alimentent
  `congeMs(date)`, plafonnées au planning du jour. Rien à migrer.

## 6. Affichage Stats (`popup/stats.js`)

- **Badge** : cf. §4.3 (jours, 1 décimale, `.0` masqué).
- **Barres empilées** bleu/orange : **déjà en place** (v5.5.5) — inchangées.
- **Ligne « cible quotidienne »** : aujourd'hui une ligne globale à `weeklyHours/5`. La cible variant par jour,
  la remplacer par un **repère de cible par barre** (à la hauteur de `scheduledMs(date)`) ; jours non
  travaillés sans repère. **Validé.**

## 7. Découpage & tests

**Phasage** (2 livraisons possibles, mais une seule spec) :

- **Phase 1** : `core/schedule.js` + objectif dérivé + config grille + badge en jours. Autonome et testable.
- **Phase 2** : saisie demi-journées (UI A + détailler C) + génération + écriture Notion multi-lignes.

**Tests (Vitest, modules `core/` uniquement)** :

- `core/schedule.test.js` (nouveau) : `scheduledMsForDate` (jour plein / demi / non travaillé / sans planning),
  `segmentSpan`, `generateLeaveSpans` (jour unique, plage, bornes matin/aprem/journée, week-ends sautés,
  overrides, jour à segment manquant).
- `core/stats.test.js` (maj) : objectif dérivé du planning (jours hétérogènes), congé plafonné au planning du
  jour, `congeDays` en fraction d'heures réelles, fallback sans planning = comportement v5.5.5.
- **Vérif navigateur** (rendu) : bloc de saisie A + liste C ; badge « .0 » masqué ; repère de cible par barre.

## 8. Hors-scope (YAGNI)

- Un seul type d'absence (« Congés ») ; pas de RTT/maladie distincts.
- Granularité **demi-journée** à la saisie (pas de saisie horaire fine — l'ancien mode reste dispo sans planning).
- Pas de nouvelle propriété Notion (demi-journées dérivées des horaires du planning).
- Pas de gestion de fuseaux multiples ni de jours fériés automatiques.

## 9. Points tranchés en relecture (2026-07-18)

1. Config : le champ « Heures/semaine » est **remplacé** par la grille planning (total dérivé affiché). ✅
2. Sémantique des bornes de plage (§5.1) : **validée** telle quelle. ✅
3. Graphe : **repère de cible par barre** (cible du jour), la ligne globale disparaît. ✅

Spec **approuvée** par l'utilisateur le 2026-07-18. Prochaine étape : plan d'implémentation (`writing-plans`).
