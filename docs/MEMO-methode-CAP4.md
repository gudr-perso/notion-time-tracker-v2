# Mémo — la méthode CAP⁴ (guide de pratique)

> **Pour qui ?** Le **consultant ou le développeur** qui doit **pratiquer** la méthode sur un projet réel.
> Ce n'est pas un argumentaire commercial (pour ça, voir la page CAP du site) : c'est le **mode d'emploi** —
> ce que font les 4 briques, et comment le dispositif est **paramétré** et **opéré** au quotidien.

**CAP⁴** = piloter un vrai projet avec un assistant IA, **du cadrage à la vérification du code**. Quatre
briques : les trois de CAP³ (BSP · AVEC · D²) **+ S&R (Security & Review)** — vérifier le code produit —, qui
fait passer de ³ à ⁴.

| # | Brique | Temps | Verbe | Rôle en une ligne |
|---|---|---|---|---|
| 1 | **BSP** | en amont | cadrer | Brainstorming → Spécification → Plan avant d'écrire du code |
| 2 | **AVEC** | pendant | mémoriser | La mémoire vivante du projet, tenue et relue par l'assistant |
| 3 | **D²** | en complément | documenter | Deux documentations de référence, alignées sur chaque version |
| 4 | **S&R** (Security & Review) | en aval | vérifier | Vérifier le code produit : sécurité (bloquant, chaque commit) + revue de code (rappel, release) |

> Deux niveaux de lecture : d'abord **les 4 briques** (la méthode), puis **le paramétrage technique** (fichiers,
> routines, garde-fous). Le consultant lit la 1ʳᵉ partie ; le développeur qui reprend le projet lit les deux.

---

## Les 4 briques

### 1 · BSP — cadrer avant de coder *(en amont)*

- **Rôle** : fixer une cible nette **avant** de lancer l'IA sur le code.
- **But** : ne pas partir dans la mauvaise direction ; éviter l'« intention floue ».
- **Ce que ça fait** : trois étapes enchaînées — **B**rainstorming (faire émerger le besoin par un
  questionnement socratique) → **S**pécification (le figer dans un doc clair) → **P**lan (le découper en
  exécution, avec points de contrôle et tests). On ne lance l'IA sur le code qu'une fois ces trois passées.
- **Outillage** : le plugin **Superpowers** (Claude Code) outille ces pratiques — brainstorming, plans
  découpés avec revues, mais aussi TDD, revue de code, débogage méthodique. BSP en est la porte d'entrée.
- **Trace dans le projet** : `docs/superpowers/specs/` (spécifications) et `docs/superpowers/plans/` (plans).

### 2 · AVEC — la mémoire vivante *(pendant)*

- **Rôle** : garder le fil d'une session à l'autre, sans re-briefer.
- **But** : reprise instantanée + **zéro régression de connaissance** (décisions et bugs capitalisés).
- **Ce que ça fait** : l'assistant tient lui-même une doc vivante en **4 fichiers** (initiales = AVEC), qu'il
  **lit en début de session** et **met à jour spontanément** (routines, voir plus bas).

| Lettre | Fichier | Rôle |
|---|---|---|
| **A** | `docs/AVANCEMENT.md` | où on en est : fait / à faire / idées non tranchées / prochaine action |
| **V** | `docs/VERSIONS.md` | ce qui a changé, **par version** (format Keep a Changelog) |
| **É** | `docs/EVENEMENTS.md` | les pièges techniques déjà résolus (pour ne pas re-déboguer) |
| **C** | `CLAUDE.md` (racine) | le chef d'orchestre : règles, **pointeurs**, **routines** |

> `CLAUDE.md` ne *contient* pas la mémoire, il la **pilote**. **Règle d'or** : le contenu d'AVANCEMENT /
> VERSIONS / ÉVÉNEMENTS **ne se recopie pas** dans `CLAUDE.md` — il n'y garde que pointeurs et routines.

### 3 · D² — la documentation de référence *(en complément)*

- **Rôle** : une photo fidèle et **stable** de ce que fait le produit et de comment il est bâti.
- **But** : une doc **qui ne ment pas** — elle ne dérive pas, parce que sa mise à jour fait partie de la livraison.
- **Ce que ça fait** : deux documentations tenues à jour et synchronisées à chaque version.

| Doc | Répond à | Contenu |
|---|---|---|
| `docs/documentation-fonctionnelle.md` | *Qu'est-ce que ça fait ?* | Fonctionnalités vues par l'utilisateur (écrans, comportements, options). Aucun code. |
| `docs/documentation-technique.md` | *Comment c'est fait ?* | Stack, architecture, rôle technique des grandes fonctions de chaque module. |

### 4 · S&R — Security & Review : vérifier le code produit *(en aval)*

- **Rôle** : scruter le code **après** l'avoir écrit, avant qu'il ne parte — sur deux fronts : **sécurité** et **qualité**.
- **But** : ne livrer ni faille par inadvertance, ni code bancal ; **tracer** les risques (corrigés / à suivre / acceptés).
- **Ce que ça fait** : **deux facettes**, à **deux régimes** et **deux cadences** — c'est le point à garder net :

| Facette | Régime | Cadence | Ce que ça fait |
|---|---|---|---|
| **S** — Sécurité | **bloque** le commit (frontière dure) | **à chaque commit** | Analyse du diff selon la grille sécu → entrée dans `docs/SECURITY.md` |
| **R** — Revue de code | **rappelle** sans bloquer (gradient) | **à la release** | `/code-review` sur le diff de la version (bugs + qualité) ; findings traités ou notés |

- **Grille sécurité** (S) : token Notion (jamais loggé / en URL) · `innerHTML`/XSS · CSP · message passing
  popup↔SW · injection de champs Notion · permissions MV3 / `host_permissions` · secrets en dur.
- **Pourquoi S bloque et R rappelle** : la sécurité est une **frontière** au coût d'oubli asymétrique ; la
  qualité est un **gradient** dont la valeur dépend du volume de code → on ne bloque que ce qui doit l'être.
- **C'est cette brique qui fait passer CAP³ → CAP⁴.** Les **constats sécu** restent **internes**
  (`docs/SECURITY.md` gitignoré, jamais poussé sur GitHub).

---

## Le paramétrage technique (comment ça marche)

### Les fichiers et leurs rôles

| Fichier | Brique | Suivi git ? | Rôle |
|---|---|---|---|
| `CLAUDE.md` | AVEC (C) | versionné | Règles + pointeurs + routines. Lu à **chaque** session |
| `docs/AVANCEMENT.md` | AVEC (A) | versionné | Snapshot vivant. Réécrit **souvent** |
| `docs/VERSIONS.md` | AVEC (V) | versionné | Historique par version. Ajout **à chaque release** |
| `docs/EVENEMENTS.md` | AVEC (É) | versionné | Pièges résolus. **Ajout** à chaque galère non triviale |
| `docs/documentation-fonctionnelle.md` | D² | versionné | Ce que fait l'app. MàJ à chaque version impactante |
| `docs/documentation-technique.md` | D² | versionné | Comment c'est fait. MàJ à chaque version impactante |
| `docs/SECURITY.md` | S&R (S) | **gitignoré** | **Registre** des revues + points ouverts (constats internes) |
| `docs/SETUP.md` | paramétrage | versionné | **Bootstrap** : recréer les garde-fous à l'identique sur un autre PC |
| `.claude/hooks/*.sh` + `.claude/settings.json` | paramétrage | **gitignoré** | Les garde-fous mécaniques (hooks) |
| `docs/superpowers/specs/` · `.../plans/` | BSP | versionné | Spécifications et plans de cadrage |

### Le numéro de version (source de vérité)

- **Source unique** : `manifest.json` (dupliqué dans `package.json` / `package-lock.json`).
- `AVANCEMENT.md` l'**affiche en reflet** (lecture rapide), `VERSIONS.md` l'**historise**. On ne stocke
  **jamais** le numéro ailleurs comme « autorité » → pas de désynchronisation (le garde-fou release le vérifie).

### Les routines automatiques

Le moteur, c'est le bloc **« Routines à appliquer de moi-même »** de `CLAUDE.md`, appliqué **spontanément** :

| Déclencheur | Ce que l'assistant fait sans qu'on le demande | Brique |
|---|---|---|
| **Bug non trivial corrigé** | Ajoute une entrée dans `docs/EVENEMENTS.md` | AVEC (É) |
| **Nouvelle version décidée** (« on passe en vX.Y.Z ») | Bump `manifest`+`package`+`lock`, section `VERSIONS.md`, reflet `AVANCEMENT.md`, **applique D²** — dans `release: vX.Y.Z` | AVEC (V) + D² |
| **Feature finie / demande / idée écartée** | Met à jour `docs/AVANCEMENT.md` | AVEC (A) |
| **Avant chaque commit** | **Revue de sécurité** du diff → entrée dans `docs/SECURITY.md` | S&R (S) |

### Les garde-fous mécaniques (hooks)

**Limite honnête** : ces routines reposent sur l'assistant qui suit `CLAUDE.md` — fiable, mais pas infaillible
sur une longue session. D'où un **filet mécanique** : deux *hooks* Claude Code (dans `.claude/`, **gitignoré**)
exécutés **avant chaque `git commit`**. Chacun **double** une routine — la routine porte l'intention (pilier 2,
faillible), le hook garantit le déclenchement (pilier 1, déterministe).

| Hook | Enforce la brique | Vérifie (mécanique) | Effet |
|---|---|---|---|
| `security-gate.sh` | **S&R** (S) | qu'une revue du diff a été **consignée** | **bloque** le commit tant que non faite |
| `release-gate.sh` | **V** (d'AVEC) | sur bump : `manifest`=`package`=`lock`, section `VERSIONS.md`, mention `AVANCEMENT.md` | **bloque** si incohérent ; **rappelle** (sans bloquer) D², É et la revue de code (`/code-review`) |

> **Principe directeur** : un hook n'automatise que ce qui est **mécaniquement vérifiable**. Les **jugements**
> (un bug est-il « non trivial » ? le diff impacte-t-il la doc ?) ne peuvent **pas** être tranchés par un script
> → ils restent des **routines** (au plus **rappelés** en douceur). Sur-automatiser userait la vigilance.

- **Reconfiguration sur un autre PC** : `.claude/` et `docs/SECURITY.md` étant gitignorés (et pas toujours
  propagés par pCloud), c'est **`docs/SETUP.md`** (versionné) qui contient tout — contenu **verbatim** des
  scripts + `settings.json` — pour les reconstruire. **Activation** : ouvrir `/hooks` (ou redémarrer Claude
  Code) puis approuver les hooks du projet.

---

## Formats & exemples

### Une entrée d'`EVENEMENTS.md`

Suit **Contexte / Erreur / Hypothèse / Action / Résultat / Leçon**, avec le **message d'erreur brut** (pas « ça
marchait pas »). Critère : une entrée n'existe que si, relue plus tard, elle **fait gagner du temps**.

```markdown
## 2026-07-15 — Largeur du popup qui saute en mode saisie manuelle
- **Contexte** : la largeur gagnait ~15 px en cochant « Saisie manuelle ».
- **Erreur** : (pas de message — symptôme visuel : largeur qui bouge quand la scrollbar apparaît)
- **Hypothèse fausse** : `scrollbar-gutter: stable` sur `body` → sans effet.
- **Action** : le déplacer sur `html` (conteneur de défilement ; ne se propage pas de `body`).
- **Résultat** : gouttière réservée en permanence, largeur constante.
- **Leçon** : pour figer la largeur d'un popup, `scrollbar-gutter` va sur `html`, pas `body`.
```

### Une section de `VERSIONS.md`

```markdown
## [5.0.0] — 2026-07-15
### Ajouté
- Filtre de statuts multi-valeurs (séparés par `;`).
### Corrigé
- Modale « Arrêter à » toujours affichée (`.modal-overlay{display:flex}` écrasait `hidden`).
```

### Une entrée de `docs/SECURITY.md` *(exemple de format)*

```markdown
### 2026-07-20 — v5.7.x (injection de champs)
- **Périmètre** : src/core/schema-injection.js, src/config/config.js.
- **Constats** : [Moyen] nom de propriété Notion non validé avant écriture API — corrigé (config.js).
- **Statut** : corrigé dans ce commit.
```

### Un extrait d'`AVANCEMENT.md`

```markdown
**Version courante : `5.7.2`** — source de vérité = manifest.json.
| Brique | État |
|---|---|
| Onglet Stats | ✅ v5.6.0 |
### 🟡 Idées non tranchées
- Favoris « 1 clic » même si commentaire obligatoire — à trancher.
```

---

## En pratique (aide-mémoire)

- **Reprendre le projet** → ouvrir `docs/AVANCEMENT.md` en premier.
- **Démarrer une feature** → **cadrer d'abord** (BSP : brainstorming → spec → plan) avant de coder.
- **Sortir une version** → dire « on passe en vX.Y.Z » ; l'assistant fait bump + VERSIONS + reflet + D². Le
  garde-fou release **bloque** si un morceau manque, et **rappelle** de passer `/code-review` sur le diff.
- **Committer** → la **revue de sécurité** du diff est faite et consignée (le garde-fou sécurité l'impose).
- **Comprendre un vieux bug** → chercher dans `docs/EVENEMENTS.md` avant de re-fouiller le code.
- **Repartir sur un PC neuf** → suivre `docs/SETUP.md` pour rétablir les garde-fous.
