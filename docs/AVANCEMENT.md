# Notion Time Tracker — État du projet & comment continuer

> Point de reprise. Lis ce fichier en premier quand tu rouvres le projet.
> Dernière mise à jour : 2026-07-17.

**Version courante : `5.4.0`** — source de vérité = `manifest.json` (reflet ici, historique dans `docs/VERSIONS.md`).

---

## Où on en est

Extension **Chrome/Edge (Manifest V3)** de suivi du temps de travail, écrivant chaque session dans **Notion**.
JS vanilla + modules ES natifs, **zéro build**, **zéro dépendance runtime**. Recodage propre de la v1.

L'**itération 1** (Config + onglet Timer + service worker + thème + socle testé) est **livrée et poussée en v5.0.0**.
L'onglet **Stats** est **livré en v5.2.0**.

| Brique | État |
|---|---|
| **Config** (page en onglet, mapping des 2 bases, préférences, favoris) | ✅ v5.0.0 |
| **Onglet Timer** (start/pause/stop, stop-at, saisie manuelle, congés, favoris, récents) | ✅ |
| **Service worker** (badge + notifications via `chrome.alarms`) | ✅ |
| **Thème clair / sombre** (bascule persistée) | ✅ |
| **Socle `core/` testé** (`time`, `mapping`, `notion-api`, `storage`, `stats`, `fav-presets`, `fav-icons`) | ✅ **87 tests verts** |
| **Onglet Stats** | ✅ v5.2.0 |
| **Favoris : couleur + picto** | ✅ v5.3.0 |
| **Export / import de la config** | ✅ v5.4.0 |

**Tests** : `npm test` → `106 passed (8 files)`.

## Features / demandes — suivi

### ✅ Faites (v5.4.0)
- **Export / import de la configuration** depuis la page de réglages : un bouton télécharge un JSON
  (`notion-timer-config-AAAA-MM-JJ.json`, date locale) contenant bases, mapping, préférences, congés et
  favoris — **jamais le token Notion**. L'import valide le fichier (format, version, présence des deux bases),
  affiche une confirmation avec la date et la version d'origine, **conserve le token du poste** (jamais celui
  du fichier), écrit la config puis recharge la page ; le chargement habituel (`onLoadDb` → remap → favoris)
  re-sélectionne tout ensuite. Nouveau module pur testé `core/config-io.js` (`buildExport` / `parseImport` /
  `exportFileName`). Détail : `docs/VERSIONS.md`.

### ✅ Faites (v5.3.2)
- **Course au chargement des tâches** (`popup/timer.js`) — le bug pré-existant suivi ci-dessous, corrigé :
  taper dans la recherche pendant le chargement initial pouvait faire écraser la liste complète par les
  20 tâches du chargement léger, `allLoaded` restant vrai → tâches hors des 20 premières **introuvables**
  jusqu'à réouverture du popup. **Reproduit avant correction** sur le vrai module (harnais stubbant
  `document`/`chrome`/`fetch`). Trois défauts voisins trouvés au passage et corrigés : **3 frappes = 3 scans
  complets de la base** (→ 1 seul), rendu sur une saisie **périmée**, et écriture de `T.tasks` depuis une
  fonction async. Détail : `docs/VERSIONS.md`, méthode : `docs/EVENEMENTS.md`.

### ✅ Faites (v5.3.1)
- **Sélecteur de dates « Perso » affiché en permanence (onglet Stats)** — bug **livré depuis la v5.2.0**, corrigé :
  `.stats-custom` posait `display:flex` sans garde `[hidden]`. **4ᵉ** occurrence du piège, celle que l'entrée
  `EVENEMENTS.md` du 2026-07-17 invitait à « suspecter ». **Reproduit avant correction** (mesuré : 668 × 44 px
  rendus alors que `hidden` était posé), puis **tout le CSS audité** empiriquement → **aucune autre occurrence
  réelle**. Détail : `docs/VERSIONS.md`, méthode et pièges dormants : `docs/EVENEMENTS.md`.

### ✅ Faites (v5.3.0)
- **Couleur et picto par favori** : liseret de 4 px + picto blanc sur fond bleu, palette **fermée de 10 couleurs**
  (mesurées : toutes ≥ 3:1 dans les deux thèmes) et **23 pictos** + « aucun », choisis dans la config. Aucune
  migration — `normalizeFavorite` applique les défauts à la lecture. Modules purs `core/fav-icons.js`,
  `core/fav-presets.js`, module partagé `src/fav-icon.js`. Détail : `docs/VERSIONS.md`.
  Spec : `docs/superpowers/specs/2026-07-17-favoris-couleur-picto-design.md`.
- **Corrigé en route** : les favoris affichaient « Favori » au lieu du nom de leur tâche (bug **livré depuis la
  v5.0.0** — rendu avant le chargement des tâches). Cf. `docs/EVENEMENTS.md`.

### ✅ Faites (v5.2.0)
- **Onglet Stats** : objectif hebdomadaire (anneau de progression travaillé/objectif), rythme quotidien
  (barres par jour, congés en doré), bilan par projet, périodes Jour/Semaine/Mois/Perso avec navigation
  précédent/suivant, objectif ajusté aux congés. Nouveau module pur testé `core/stats.js`. Détail :
  `docs/VERSIONS.md`.

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
- **Garde-fou contre le piège `[hidden]`** : le piège a frappé **4 fois** (`.modal-overlay`, `.toast`, `.fav-pop`
  en v5.3.0, `.stats-custom` en v5.3.1), dont deux fois **livré** jusqu'à l'utilisateur. L'audit de la v5.3.1 a
  relevé **~26 éléments « dormants »** portant un `display` d'auteur (`.field`, `.btn-row`, `.seg`, `.row`,
  `.cell`…) qui casseraient `hidden` le jour où on les masquerait. Idée : un test Vitest de **contrôle statique**
  (zéro dépendance, simple lecture des `.css` / `.js`) échouant si une classe pilotée par `hidden` pose un
  `display` sans garde. **Non tranché** : le socle testé est aujourd'hui `core/` (logique pure) uniquement —
  étendre les tests à la CSS est un choix de cadrage à valider.

### ⬜ Tâches créées et non faites
**Bug pré-existant** repéré en relisant le code pendant la v5.3.2, **aucune tâche lancée** à ce jour :
- **Session restaurée affichée sans son projet** (`popup/timer-actions.js:169`) : à l'ouverture du popup,
  `getCurrentSession().then(...)` cherche la tâche dans `T.tasks` **au câblage**, quand la liste est encore
  vide. `enterRunning` retombe donc sur son repli : nom sans le suffixe `[projet]`, et URL Notion reconstruite
  à la main au lieu de `task.notionUrl`. **Bénin** (repli en place, rien ne plante) — d'où le report.
  **Troisième cas de la même famille** après les libellés de favoris (v5.3.0) et la course (v5.3.2) : *du code
  qui lit `T.tasks` avant qu'elle soit chargée, et qui n'est jamais rejoué ensuite*. La v5.3.2 a créé le point
  d'accroche qui manquait — `publishTasks()`, rejoué à chaque publication de la liste — donc le correctif tient
  probablement en une ligne. À confirmer : redonner un nom à une session déjà restaurée pendant qu'elle tourne
  demande de vérifier qu'on ne réécrit pas l'affichage d'un chronomètre en cours.

*(Les deux bugs pré-existants repérés pendant la v5.3.0 sont traités : `.stats-custom` en **v5.3.1**, la
course `loadAllTasks` / `loadLightTasks` en **v5.3.2** — cf. plus haut.)*

## Prochaine action

1. **Vérifier la v5.3.2 en chargeant l'extension** (le popup n'est pas couvert par les tests) : ouvrir le
   popup et **taper aussitôt** dans la recherche, sans attendre l'affichage de la liste → une tâche située
   hors des 20 premières doit rester trouvable, la liste affichée doit correspondre à la saisie, et les
   favoris doivent porter le nom de leur tâche (pas « Favori »).
2. Décider du point « favoris 1 clic vs commentaire obligatoire » ci-dessus.
3. Décider du garde-fou `[hidden]` (test de contrôle statique) — cf. « Idées non tranchées ».

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
   ⚠️ **pCloud ne synchronise pas `.git`** : sur une machine neuve, le dossier arrive **sans historique**.
   Cloner le remote à côté et déplacer son `.git` dans le dossier, ou repartir d'un clone. Cf. `docs/EVENEMENTS.md`
   (2026-07-17). Vérifier **dans les deux sens** si le local est en retard **ou en avance** sur le remote.
2. Node.js requis (non fourni par la synchro). `npm install` (deps = Vitest en devDependency ; `node_modules/`
   git-ignored — il peut arriver par pCloud, mais reste inutilisable sans Node).
3. `npm test` → doit afficher `87 passed`.
4. **Charger l'extension** : `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée »
   → sélectionner le **dossier racine** (celui du `manifest.json`). Recharger avec ↻ après chaque modif ;
   console du service worker via son lien dédié.

## Git / remote

- Remote : `https://github.com/gudr-perso/notion-time-tracker-v2.git`, branche `main`. **v5.3.2 poussée** (2026-07-17).
- **Identité git locale** = `gudr-perso` (email noreply GitHub) — à reconfigurer sur nouveau clone (cf. `docs/EVENEMENTS.md`).
- **Pousser à chaque release** : pCloud sauvegarde les fichiers, **pas l'historique** — seul GitHub fait office de
  sauvegarde. Une version « livrée » mais non poussée meurt avec la machine (cf. `docs/EVENEMENTS.md` 2026-07-17).
- **Release** : bumper `manifest.json` + `package.json` + `package-lock.json`, mettre à jour `VERSIONS.md` et la
  version reflétée ci-dessus, commit `release: vX.Y.Z`.
