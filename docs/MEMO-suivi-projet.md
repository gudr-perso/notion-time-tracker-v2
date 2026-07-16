# Mémo — la méthode AVEC (suivi du projet)

Ce projet tient sa propre mémoire selon la **méthode AVEC** : quelques fichiers, dont une partie se met à jour
**toute seule** (Claude applique des routines sans qu'on les redemande). Ce mémo explique qui fait quoi.

**AVEC** = les initiales des fichiers qui portent la mémoire du projet :

| Lettre | Fichier | Rôle |
|---|---|---|
| **A** | `docs/AVANCEMENT.md` | où on en est |
| **V** | `docs/VERSIONS.md` | ce qui a changé, par version |
| **É** | `docs/EVENEMENTS.md` | les événements techniques (pièges déjà résolus) |
| **C** | `CLAUDE.md` (racine) | le chef d'orchestre : règles, pointeurs, routines |

> `CLAUDE.md` ne *contient* pas la mémoire, il la **pilote** : il pointe vers les trois docs et déclenche
> leur mise à jour. C'est la méthode **avec** laquelle on travaille le projet.

## Les fichiers et leurs rôles

| Fichier | Rôle | Qui le lit | Rythme d'écriture |
|---|---|---|---|
| **`CLAUDE.md`** (racine) | Règles du projet + **pointeurs** vers les docs + **routines** d'auto-remplissage | Claude, à **chaque** session | Rare (quand la méthode change) |
| **`docs/AVANCEMENT.md`** | **Snapshot vivant** : ce qui est fait / à faire / idées non tranchées / prochaine action | Toi + Claude | Réécrit **souvent** |
| **`docs/EVENEMENTS.md`** | **Mémoire des événements** techniques (pièges déjà résolus) pour ne pas re-déboguer | Claude surtout | **Ajout** à chaque galère non triviale |
| **`docs/VERSIONS.md`** | **Historique par version** (ce qui a changé pour l'utilisateur) | Toi / utilisateurs | Ajout **à chaque release** |

**Règle d'or** : le contenu d'AVANCEMENT / VERSIONS / ÉVÉNEMENTS **ne se recopie pas** dans `CLAUDE.md`.
CLAUDE.md ne garde que les **pointeurs** et les **routines**.

## Le numéro de version

- **Source de vérité unique** : `manifest.json` (dupliqué dans `package.json` / `package-lock.json`).
- `AVANCEMENT.md` l'**affiche en reflet** (lecture rapide), `VERSIONS.md` l'**historise**.
- On ne stocke **jamais** le numéro ailleurs comme « autorité » → pas de désynchronisation.

## Le principe d'automatisme

Le moteur, c'est le bloc **« Routines à appliquer de moi-même »** dans `CLAUDE.md`, que Claude lit à chaque
session et applique **spontanément** :

| Déclencheur | Ce que Claude fait, sans qu'on le demande |
|---|---|
| **Bug non trivial corrigé** (diagnostic pas évident) | Ajoute une entrée dans `docs/EVENEMENTS.md` |
| **Nouvelle version décidée** (« on passe en vX.Y.Z ») | Bump `manifest.json` + `package.json` + `lock`, ajoute la section `VERSIONS.md`, reflète la version dans `AVANCEMENT.md`, **applique D²** (voir plus bas) — dans le commit `release: vX.Y.Z` |
| **Feature finie / nouvelle demande / idée écartée** | Met à jour `docs/AVANCEMENT.md` |

**Limite honnête** : cet automatisme repose sur Claude qui suit les instructions de `CLAUDE.md`. C'est fiable,
mais pas infaillible sur une très longue session. Un **filet de sécurité** est prévu en réserve : un *hook* qui,
en fin de tour, rappelle mécaniquement ces routines. Il n'est **pas activé** pour l'instant — on l'ajoutera
seulement si on constate des oublis (sinon c'est du bruit).

## Le principe D² (les deux documentations)

À côté d'AVEC (la **mémoire de travail**), **D²** porte la **documentation de référence** : deux fichiers tenus
à jour avec chaque version.

| Doc | Répond à | Contenu |
|---|---|---|
| **`docs/documentation-fonctionnelle.md`** | *Qu'est-ce que ça fait ?* | Les fonctionnalités vues par l'utilisateur (écrans, comportements, options). Aucun code. |
| **`docs/documentation-technique.md`** | *Comment c'est fait ?* | La stack, l'architecture, et le rôle technique des grandes fonctions de chaque module. |

**Routine** : à chaque changement de version, on relit ces deux docs et on les met à jour si le changement les
impacte (si une doc manque, on la crée). C'est intégré à la routine « Nouvelle version décidée » ci-dessus.

## Format d'une entrée d'ÉVÉNEMENTS

Chaque entrée suit : **Contexte / Erreur / Hypothèse / Action / Résultat / Leçon**, avec un **message d'erreur
brut** (pas « ça marchait pas »). Critère de qualité : une entrée n'existe que si, en la relisant plus tard,
on gagne du temps au lieu de re-déboguer.

## Exemples concrets

### Une entrée d'`EVENEMENTS.md`

```markdown
## 2026-07-15 — Largeur du popup qui saute en mode saisie manuelle

- **Contexte** : la largeur du popup gagnait ~15 px en cochant « Saisie manuelle ».
- **Erreur** :
  ```
  (pas de message — symptôme visuel : la largeur bouge quand la scrollbar apparaît)
  ```
- **Hypothèse fausse (tentée)** : `scrollbar-gutter: stable` sur `body` → sans effet, le décalage persistait.
- **Action** : déplacer `scrollbar-gutter: stable` sur `html` (le conteneur de défilement ; ça ne se propage pas de `body`).
- **Résultat** : gouttière réservée en permanence, largeur constante.
- **Leçon** : pour figer la largeur d'un popup, `scrollbar-gutter` va sur `html`, pas `body`.
```

> Quand il y a un vrai message d'erreur, on le colle **brut** (exemple réel de la session) :
> `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vitest' imported from …vitest.config.js`
> → cause : `node_modules` absent → action : `npm install`.

### Une section de `VERSIONS.md`

```markdown
## [5.0.0] — 2026-07-15

### Ajouté
- Filtre de statuts multi-valeurs (séparés par `;`, ex. `termine;clos`).
- Favoris : jusqu'à 8, affichés en 4×2.

### Modifié
- La configuration s'ouvre en onglet plein écran (au lieu du popup étroit).

### Corrigé
- Modale « Arrêter à » affichée en permanence (`.modal-overlay { display:flex }` écrasait l'attribut `hidden`).
```

### Un extrait d'`AVANCEMENT.md`

```markdown
**Version courante : `5.0.0`** — source de vérité = manifest.json.

| Brique | État |
|---|---|
| Config (page en onglet, mapping des 2 bases) | ✅ v5.0.0 |
| Onglet Stats | ⬜ Reporté |

### 🟡 Idées échangées, non tranchées
- Favoris « 1 clic » même si commentaire obligatoire — à trancher.
```

## En pratique

- **Reprendre le projet** → ouvrir `docs/AVANCEMENT.md` en premier.
- **Sortir une version** → dire à Claude « on passe en vX.Y.Z » ; il s'occupe du bump + VERSIONS + reflet.
- **Comprendre un vieux bug** → chercher dans `docs/EVENEMENTS.md` avant de re-fouiller le code.
