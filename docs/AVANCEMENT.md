# Notion Time Tracker — État du projet & comment continuer

> Point de reprise. Lis ce fichier en premier quand tu rouvres le projet.
> Dernière mise à jour : 2026-07-16.

**Version courante : `5.1.0`** — source de vérité = `manifest.json` (reflet ici, historique dans `docs/VERSIONS.md`).

---

## Où on en est

Extension **Chrome/Edge (Manifest V3)** de suivi du temps de travail, écrivant chaque session dans **Notion**.
JS vanilla + modules ES natifs, **zéro build**, **zéro dépendance runtime**. Recodage propre de la v1.

L'**itération 1** (Config + onglet Timer + service worker + thème + socle testé) est **livrée et poussée en v5.0.0**.
L'onglet **Stats** est **reporté**.

| Brique | État |
|---|---|
| **Config** (page en onglet, mapping des 2 bases, préférences, favoris) | ✅ v5.0.0 |
| **Onglet Timer** (start/pause/stop, stop-at, saisie manuelle, congés, favoris, récents) | ✅ |
| **Service worker** (badge + notifications via `chrome.alarms`) | ✅ |
| **Thème clair / sombre** (bascule persistée) | ✅ |
| **Socle `core/` testé** (`time`, `mapping`, `notion-api`, `storage`) | ✅ **27 tests verts** |
| **Onglet Stats** | ⬜ **Reporté** (brainstorming dédié à faire) |

**Tests** : `npm test` → `27 passed (4 files)`.

## Features / demandes — suivi

### ✅ Faites (v5.1.0)
- **Injection automatique des champs Notion** : deux boutons dans la config créent les propriétés
  manquantes des bases Temps et Tâches (bons types, relations `dual_property`), avec aperçu +
  confirmation, sélecteur « Base Projets » optionnel, et auto-mapping après coup. Additif/idempotent.
  Nouveau module pur testé `core/schema-injection.js` + `addDatabaseProperties`. Détail : `docs/VERSIONS.md`.
  Spec : `docs/superpowers/specs/2026-07-16-injection-champs-notion-design.md`.

### ✅ Faites (v5.0.1)
- **Enregistrement rapide** : gel des boutons pendant la sauvegarde + « ⏳ … » sur le bouton déclencheur
  (favori cliqué **ou** bouton bleu « Enregistrer »), et **toast « ✅ Ligne créée dans Notion »** (favori et saisie manuelle).

### ✅ Faites (v5.0.0)
Voir le détail dans `docs/VERSIONS.md`. En résumé : config en onglet plein écran, popup 700 px,
favoris 8 (4×2), filtre statuts multi-valeurs, saisie manuelle au fond clair + champs début/fin côte à côte,
libellé commentaire adaptatif + validation, chargement auto des bases, param « Saisie manuelle par défaut »,
corrections de layout (débordements, modale, largeur) et thème clair lisible.

### 🟡 Idées échangées, non tranchées
- **Favoris « 1 clic » même si commentaire obligatoire** : actuellement la validation `requireComment`
  s'applique aussi à l'enregistrement rapide par favori (sauf congés, auto-commentés). À trancher si on veut lever
  cette contrainte pour les favoris.
- **Hook de rappel des routines projet** : gardé **en réserve** (cf. « Automatisation » dans `CLAUDE.md`).
  À activer seulement si je constate des oublis de mise à jour EVENEMENTS/VERSIONS/AVANCEMENT.
- **Largeur popup ajustable** : 700 px choisi, ajustable si besoin (max 800 px pour un popup Chrome).

### ⬜ Tâches créées et non faites
- (aucune pour l'instant)

## Prochaine action

1. **Onglet Stats** (la grande brique restante) — mérite un brainstorming dédié (périmètre, périodes, agrégations).
2. Décider du point « favoris 1 clic vs commentaire obligatoire » ci-dessus.

## Carte du code

→ **Structure du code : voir `CLAUDE.md` § « Structure des fichiers »** (source unique, ne pas dupliquer ici).

## Décisions verrouillées

Le cadrage complet est dans **`CLAUDE.md`**. Rappels clés :
- **FR uniquement**, **zéro build**, **zéro dépendance runtime** ; tests Vitest en devDependency (TDD sur `core/`).
- **Deux bases Notion mappables** : `timeDb` (écriture) + `tasksDb` (lecture) — aucun ID/nom en dur.
- Dates Notion en **ISO avec offset local** (`toNotionDate`), **jamais `Z`** (dette v1).
- Service worker : **`chrome.alarms`**, jamais `setInterval`. Backoff/retry sur 429.
- Popup **~700 px** ; config **en onglet plein écran**.

## Environnement & reprise (checklist)

1. Ouvrir le dossier (déjà synchronisé) et lire ce fichier.
2. `npm install` (deps = Vitest en devDependency ; `node_modules/` git-ignored).
3. `npm test` → doit afficher `27 passed`.
4. **Charger l'extension** : `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée »
   → sélectionner le **dossier racine** (celui du `manifest.json`). Recharger avec ↻ après chaque modif ;
   console du service worker via son lien dédié.

## Git / remote

- Remote : `https://github.com/gudr-perso/notion-time-tracker-v2.git`, branche `main`.
- **Identité git locale** = `gudr-perso` (email noreply GitHub) — à reconfigurer sur nouveau clone (cf. `docs/EVENEMENTS.md`).
- **Release** : bumper `manifest.json` + `package.json` + `package-lock.json`, mettre à jour `VERSIONS.md` et la
  version reflétée ci-dessus, commit `release: vX.Y.Z`.
