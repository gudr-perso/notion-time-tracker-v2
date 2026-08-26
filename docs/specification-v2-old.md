# Spécification pour une v2 — Notion Time Tracker

Ce document réunit tout le nécessaire pour **recoder l'application de zéro**, en repartant sur des
bases saines. Il s'appuie sur les documentations [fonctionnelle](documentation-fonctionnelle.md) et
[technique](documentation-technique.md), et liste la dette technique à corriger.

---

## 1. Objectif de la v2

Reproduire **à l'identique les fonctionnalités** de la v1 (aucune régression fonctionnelle), tout en :

- Éliminant la dette technique (IDs et noms de champs codés en dur).
- Modularisant le code (fin du monolithe `popup.js`).
- Rendant la base « Tâches » **entièrement configurable** (comme la base « Temps »).
- Ajoutant robustesse (pagination stats, gestion d'erreurs, tests).

---

## 2. Périmètre fonctionnel (checklist de parité v1)

Chaque item doit exister dans la v2 :

**Configuration**
- [ ] Saisie + test du token Notion (`GET /users/me`).
- [ ] Découverte des bases partagées (`POST /search`).
- [ ] Sélection de **2 bases** : « Temps saisis » (écriture) et « Tâches » (lecture).
- [ ] Mapping des champs de la base Temps (3 obligatoires, 6 optionnels), avec auto-mapping par nom.
- [ ] **NOUVEAU v2** : mapping des champs de la base **Tâches** (titre, projet, id externe, url, filtre d'état, relation).
- [ ] Préférences : commentaire obligatoire, libellé bouton externe, heures hebdo, tâche congés, favoris (max 6).
- [ ] Reconfiguration accessible à tout moment (bouton ⚙️).

**Timer**
- [ ] Recherche + sélection de tâche (chargement paginé, tri par historique puis alpha).
- [ ] Démarrer / Pause (limite 1 h) / Reprendre / Arrêter.
- [ ] Arrêter à une heure/date précise (rétroactif) avec aperçu de durée.
- [ ] Saisie manuelle (début/fin/commentaire, pré-remplissage arrondi 5 min).
- [ ] Mode congés (auto-sélection tâche + commentaire).
- [ ] Favoris : enregistrement direct en 1 clic (mode manuel).
- [ ] Ouverture de tâche dans l'app externe / Notion.
- [ ] Sessions récentes groupées Aujourd'hui / Hier avec totaux.

**Stats**
- [ ] Périodes : aujourd'hui / semaine / semaine préc. / mois / personnalisé.
- [ ] Cartes : total, moyenne/jour, pauses (+ bloc congés si présent).
- [ ] Objectif ajusté (congés déduits) + barre colorée par avancement.
- [ ] Calcul « hors période » (week-end / hors 9 h-18 h).
- [ ] Répartition par projet et par jour.
- [ ] Cache 5 min + actualisation forcée.

**Arrière-plan**
- [ ] Badge 🟢 / ⏸️ / vide.
- [ ] Notifications : timer long (3 h), fin de journée (17 h 45, corrigée cf. §4), objectif quotidien (8 h).
- [ ] Restauration d'état au démarrage du navigateur.

---

## 3. Modèle de données cible

Conserver le schéma `chrome.storage.local` de la v1 (cf. [technique §3](documentation-technique.md#3-modèle-de-données-local-chromestoragelocal)),
**en étendant `notionMapping`** pour rendre la base Tâches configurable :

```js
notionMapping = {
  timeDb:  { id, name, fields: {
              taskName, startDate, endDate,      // obligatoires
              pause, comment, externalUrl, taskId, projects, tasksRelation  // optionnels
            }},
  tasksDb: { id, name, fields: {
              title,          // titre de la tâche
              project,        // texte projet (ex-"Projet_texte")
              externalId,     // ex-"#TaskID"
              externalUrl,    // ex-"TaskURL"
              projectsRel,    // relation ex-"🎯 Projets"
              statusFilter: { property, type: 'status'|'select', excludeValue }, // ex-EtatL != clos
              sortProperty    // ex-"Dernière modification"
            }}
}
```

> Renommer `gdrDatabaseId` → `tasksDb.id`, `databaseId` → `timeDb.id`. Prévoir une **migration**
> lisant l'ancien format au premier lancement v2.

---

## 4. Dette technique à corriger (obligatoire)

| # | Problème v1 | Correction v2 |
|---|-------------|---------------|
| D1 | **ID de base codé en dur** dans `background.js` (`1fad…`) pour l'objectif quotidien | Lire `notionMapping.timeDb` + champs mappés. |
| D2 | **Noms de propriétés de la base Tâches codés en dur** (`EtatL`, `Nom`, `Projet_texte`, `#TaskID`, `TaskURL`, `🎯 Projets`, `Dernière modification`) | Tous mappés via `tasksDb.fields` (cf. §3). |
| D3 | **`popup.js` monolithique** (~2060 lignes) | Découper en modules ES (voir §5). |
| D4 | **Deux `formatDuration`** incohérents (popup `HH:MM:SS` / worker `HH:MM`) | Un utilitaire partagé unique paramétrable. |
| D5 | **Stats non paginées** (`query` sans boucle `has_more`) → troncature > 100 sessions | Boucle de pagination sur toutes les requêtes de query. |
| D6 | **Notif fin de journée** dépend d'un tick pile à `17:45` (ratée si worker endormi) | Utiliser `chrome.alarms` au lieu de `setInterval`. |
| D7 | **`setInterval` dans un service worker MV3** (peut être suspendu) | Remplacer tout le polling par `chrome.alarms`. |
| D8 | **Aucune gestion de rate-limit / retry** Notion (429) | Backoff + file d'attente. |
| D9 | **FR codé en dur** | Externaliser les libellés (i18n `_locales`). |
| D10 | **Objectif mensuel approximé** (`jours × 5/7`) | Calcul réel des jours ouvrés (option : jours fériés). |
| D11 | **Aucun test** | Tests unitaires sur calculs (durées, périodes, off-hours, stats). |

---

## 5. Architecture cible recommandée

Rester en **Manifest V3, JS vanilla** (léger, sans build) OU introduire un bundler léger (Vite) si
l'on souhaite des modules ES et des tests. Découpage proposé :

```
src/
├── manifest.json
├── background/
│   └── service-worker.js        # alarms, badge, notifications
├── popup/
│   ├── popup.html / popup.css
│   ├── popup.js                 # bootstrap + routing d'onglets
│   ├── timer.js                 # start/stop/pause/stopAt/manuel/congés/favoris
│   ├── stats.js                 # périodes, calculs, rendu
│   └── tasks.js                 # chargement/tri/recherche des tâches
├── config/
│   ├── config.html / config.css
│   └── config.js                # assistant 2 étapes + mapping 2 bases
├── core/
│   ├── notion-api.js            # wrapper fetch (auth, pagination, retry)
│   ├── storage.js               # accès typé chrome.storage + migration
│   ├── mapping.js               # lecture/écriture properties selon mapping
│   └── time.js                  # formatDuration, arrondis, périodes, off-hours
└── _locales/…                   # i18n
```

**Principe clé** : `core/notion-api.js` et `core/mapping.js` sont les **seuls** points qui connaissent
le format Notion. Le reste manipule des objets métier (`Session`, `Task`).

### 5.1 Contrats de service (core)

```js
// notion-api.js
testToken(token): Promise<{ ok, user }>
searchDatabases(): Promise<Database[]>          // pagination incluse
getDatabaseSchema(dbId): Promise<Property[]>
queryAll(dbId, { filter, sorts }): Promise<Page[]>   // boucle has_more
createPage(dbId, properties): Promise<pageId>
updatePage(pageId, properties): Promise<void>
getPage(pageId): Promise<Page>

// mapping.js
taskFromPage(page, tasksMapping): Task
sessionPropertiesForCreate(task, startTime, timeMapping): properties
sessionPropertiesForUpdate(endTime, comment, pauseMin, timeMapping): properties
sessionFromPage(page, timeMapping): Session
```

---

## 6. Algorithmes de référence (à réimplémenter fidèlement)

### 6.1 Temps travaillé

```
travaillé = (fin | maintenant) − début − totalPauseDuration
```

### 6.2 Bornes de période (`getPeriodDates`)

- **today** : 00:00 → 23:59:59 du jour.
- **week** : lundi 00:00 → dimanche 23:59:59 (lundi = 1 ; dimanche géré comme −6).
- **lastweek** : semaine précédente (lundi−7 → dimanche−7).
- **month** : 1er du mois → dernier jour du mois.
- **custom** : deux dates saisies, bornées à 00:00 / 23:59:59.

### 6.3 Objectif selon période

- today → 8 h. week → `weeklyHours`. month/custom → `floor(nbJours × 5/7) × 8 h`.
- `objectifAjusté = objectif − tempsCongés`.
- `pourcentage = tempsTravailEffectif / objectifAjusté × 100` (plafonné à 100 % pour l'affichage).

### 6.4 Détection « hors période » (off-hours)

Parcourir chaque session **par tranches de 5 min** ; tranche hors période si :
`jour ∈ {samedi, dimanche}` **ou** `heure < 9` **ou** `heure ≥ 18`. Ignorer les sessions congés.

### 6.5 Projet d'une session

Extraire via regex `/\[([^\]]+)\]/` dans le titre ; sinon « Sans projet » ; « 🏖️ Congés » si la
session est liée à la tâche congés.

### 6.6 Tri des tâches

`[…historique (ordre), …reste trié alpha]`, dédoublonné par ID. Historique : max 20, LRU.

---

## 7. Comportements notables à préserver

- Page session **créée au démarrage** du timer, complétée au `PATCH` d'arrêt.
- Chargement **léger au repos** (20 tâches) vs **complet à la recherche** (pagination 100).
- Favoris et tâche congés peuvent référencer des tâches **hors des 20 récentes** → chargement
  individuel (`GET /pages/{id}`) pour les rendre sélectionnables.
- Limite de **1 h de pause** cumulée.
- Cache stats **5 min**.
- Normalisation des IDs Notion (`replace(/-/g,'')`) selon les endpoints.

---

## 8. Améliorations optionnelles (backlog v2+)

- Édition / suppression d'une session récente depuis le popup.
- Reprise en 1 clic de la dernière tâche.
- Export CSV des stats.
- Graphiques (barres/camembert) pour la répartition.
- Objectif quotidien et plages horaires configurables (au lieu de 8 h / 9 h-18 h en dur).
- Support multi-langues réel (EN/FR).
- Thème clair/sombre.
- Synchronisation de la session en cours entre appareils (via une page Notion « état »).

---

## 9. Recette (tests d'acceptation)

Rejouer le [parcours utilisateur type](documentation-fonctionnelle.md#6-parcours-utilisateur-type)
et vérifier :

1. Config vierge → assistant → mapping 2 bases → retour popup fonctionnel.
2. Démarrer → badge 🟢 → page créée dans Notion avec les bons champs.
3. Pause > 1 h → blocage de reprise.
4. Arrêter → date de fin + commentaire + minutes de pause écrits.
5. Arrêter à une heure passée → durée réelle correcte.
6. Saisie manuelle + favori → session créée sans chronomètre.
7. Congés → session marquée, décomptée dans les stats.
8. Stats : chaque période affiche total/moyenne/objectif cohérents ; > 100 sessions non tronquées.
9. Notifications : 3 h, 17 h 45, 8 h se déclenchent (via `chrome.alarms`).
10. Redémarrage navigateur → état (badge + session) restauré.
