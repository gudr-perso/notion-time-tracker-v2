# Notion Time Tracker — État du projet & comment continuer

> Point de reprise. Lis ce fichier en premier quand tu rouvres le projet.
> Dernière mise à jour : 2026-07-18.

**Version courante : `5.7.2`** — source de vérité = `manifest.json` (reflet ici, historique dans `docs/VERSIONS.md`).

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
| **Socle `core/` testé** (`time`, `mapping`, `notion-api`, `storage`, `stats`, `schedule`, `fav-presets`, `fav-icons`, `schema-injection`, `config-io`, `tasks-query`) | ✅ **151 tests verts** |
| **Onglet Stats** | ✅ v5.2.0 |
| **Favoris : couleur + picto** | ✅ v5.3.0 |
| **Export / import de la config** | ✅ v5.4.0 |
| **Filtre d'état : cases à cocher + erreurs Notion visibles** | ✅ v5.5.0 |
| **Saisie manuelle sur fond marine + liseré cyan** | ✅ v5.5.1 |
| **Stats Mois : plus de scrollbar horizontale (rythme quotidien)** | ✅ v5.5.3 |
| **Fond des cartes factorisé en variable `--card-bg` (doublon supprimé)** | ✅ v5.5.4 |
| **Stats : jour mixte travail+congés (barres empilées) + congés comptés en heures** | ✅ v5.5.5 |
| **Stats : objectif dérivé d'un planning hebdo + congés en jours + repère de cible par barre** | ✅ v5.6.0 |
| **Congés : saisie en demi-journées (plage + détailler, 1 ligne/demi-journée)** | ✅ v5.7.0 |

**Tests** : `npm test` → `151 passed (10 files)`.

## Features / demandes — suivi

### ✅ Faites (v5.7.2)
- **Récap congés : message d'état vide clarifié** — au lieu de « Aucune demi-journée sélectionnée » (trompeur un
  jour non travaillé), on indique la cause : « Aucun jour travaillé sur cette période (voir le planning) » ou
  « Rien à poser (tout est sur « — ») ». `timer-manual.js` seul.

### ✅ Faites (v5.7.1)
- **Correctif : bloc congés affiché même décoché** — `#vac-range { display:flex }` battait le `[hidden]` du
  navigateur ; ajout des garde-fous `#vac-range[hidden]` / `#vac-detail[hidden]`. 3ᵉ occurrence du piège (après
  `.stats-custom`, `.fav-pop`). CSS seul. Détail : `docs/EVENEMENTS.md`.

### ✅ Faites (v5.7.0) — Phase 2 « congés / saisie »
- **Saisie des congés en demi-journées** : coche congés (avec planning) → **Du [date + matin/aprem/journée] → Au
  [date + …]**, récap live (jours + lignes), et lien **« Détailler les jours »** (liste éditable jour par jour,
  `—` pour sauter, jours non travaillés grisés). Enregistrement = **1 ligne Notion par demi-journée** aux horaires
  du planning (échec partiel signalé). Sans planning : ancienne saisie début/fin conservée.
- Nouvelles fonctions pures testées `segmentSpan` / `generateLeaveSpans` / `leaveDays` (`core/schedule.js`).
  `popup/timer-manual.js` + `popup.html`/`popup.css`. +11 tests (151 verts). Détail : `docs/VERSIONS.md`.
- **Feature congés terminée** (Phases 1 + 2). Spec : `docs/superpowers/specs/2026-07-18-conges-demi-journees-design.md`.

### ✅ Faites (v5.6.0) — Phase 1 « congés / planning »
- **Planning hebdomadaire en config** : grille 7 jours × horaires matin/après-midi, remplace « Heures/semaine » ;
  total hebdo dérivé et affiché en direct ; défaut pré-rempli (lun–jeu 8 h, ven 7 h → 39 h). Nouveau module pur
  testé `core/schedule.js`.
- **Objectif dérivé du planning** : objectif d'une période = somme des heures planifiées de ses jours (jour sans
  horaires = non travaillé) ; congés retranchés en heures réelles (plafonnées à la cible du jour). Rétro-compatible
  (sans planning, forfait `weeklyHours/5` d'avant).
- **Congés en jours** (badge `🌴 2,5 j`, `,0` masqué) et **repère de cible par barre** (cible du jour du planning,
  remplace la ligne globale). Restructuration `.day` → `.track` à hauteur fixe : corrige au passage le tassement
  des grandes barres (cf. EVENEMENTS). +15 tests (140 verts). Détail : `docs/VERSIONS.md`.
- **Reste à faire — Phase 2** : saisie des congés en **demi-journées** (matin/aprem/journée + plage, écriture
  1 ligne/demi-journée via les horaires du planning). Spec : `docs/superpowers/specs/2026-07-18-conges-demi-journees-design.md`.

### ✅ Faites (v5.5.5)
- **Jour mixte travail + congés dans « Rythme quotidien »** : un jour cumulant travail et congés (ex. 4 h + 4 h)
  était écrasé en **barre orange unique** dont la hauteur ne valait, en plus, que le temps *travaillé* — la durée
  de congé était **jetée** à l'agrégation. `aggregate` conserve maintenant `workMs` **et** `congeMs` par jour, et
  `renderDays` empile deux segments (bleu travail en base + orange congés). Un congé **plein jour** redevient une
  barre orange **pleine hauteur** (il tombait à un moignon de 2 px). Infobulle détaillée « 04:00 travaillé ·
  04:00 congés ».
- **Congés comptés en heures** (objectif + badge) : l'objectif retranche les **heures** de congé de chaque jour
  ouvré (plafonnées à une journée, ignorées le week-end) au lieu d'une journée entière par jour touché — une
  demi-journée de congé ne fausse plus l'anneau/Reste. Badge **Congés** affiché en heures (`🌴 20:00`).
  `core/stats.js` + `popup/stats.js` + `popup.css` ; +4 tests (125 verts). Détail : `docs/VERSIONS.md`.

### ✅ Faites (v5.5.4)
- **Fond des cartes factorisé en variable `--card-bg`** : la teinte de fond des cartes (dégradé marine en
  sombre, blanc en clair) était recopiée à l'identique sur la coche *Saisie manuelle* — un doublon qui aurait
  divergé à la moindre retouche du fond de carte. Désormais définie **une seule fois par thème** et référencée
  par `.card` et `.manual-toggle.card-lite` ; les deux surcharges de thème clair devenues redondantes sont
  supprimées. **Aucun changement visible** (rendu strictement identique en clair et en sombre). CSS seul
  (`src/popup/popup.css`), aucun test impacté. Détail : `docs/VERSIONS.md`.

### ✅ Faites (v5.5.3)
- **Scrollbar horizontale corrigée en vue Mois (Stats → Rythme quotidien)** : les 28–31 colonnes débordaient parce
  que chaque colonne (item flex) gardait `min-width:auto` et que le libellé d'heure « 07:30 » insécable imposait
  une largeur incompressible. Correctif `min-width:0` sur `.day` + masquage des étiquettes d'heure en vue Mois
  (illisibles à 31 colonnes), la durée passant en **infobulle** (`title`) de la barre. 🌴 congés et quantième
  conservés ; vues Jour/Semaine inchangées. `popup.css` + `stats.js`, aucun test impacté. Détail : `docs/VERSIONS.md`.
- **Routine « Rapport de fin de release » codifiée dans `CLAUDE.md`** : format imposé du bloc de synthèse (AVEC +
  D², règle « n/a », preuve de vérification, état commit) à produire à chaque release.

### ✅ Faites (v5.5.1)
- **Zone « saisie manuelle » sur fond marine + liseré cyan** : la coche *Saisie manuelle (oubli de timer)* et le
  bloc début/fin/commentaire abandonnent le fond bleu clair hérité de la v1 pour le **fond des cartes** (comme les
  widgets Stats), avec un **liseré cyan** comme repère. Champs, labels et coche « congés » suivent désormais le
  thème (clair/sombre) ; `color-scheme` des `datetime-local` aligné sur le thème pour garder le sélecteur natif
  lisible sur fond sombre. **CSS seul** (`src/popup/popup.css`), aucun test impacté. Détail : `docs/VERSIONS.md`.

### ✅ Faites (v5.5.0)
- **Filtre d'état par cases à cocher** : les statuts à exclure de la liste des tâches se cochent parmi les
  vraies valeurs de la propriété mappée (fini la saisie libre séparée par `;`, source de la panne « liste qui
  ne se charge plus » quand une virgule s'y glissait). Format stocké passé de `excludeValue` (chaîne) à
  `excludeValues` (tableau de noms exacts, sans séparateur en clair) ; anciennes configs encore lues. Un statut
  disparu de la base est affiché « (absent de la base) », jamais supprimé en silence.
- **Erreurs Notion visibles dans le popup** : `initTimer()` est enveloppé d'un `try/catch` qui affiche le
  message brut de Notion (token, base, propriété…) dans un bandeau, au lieu de le laisser filer en console.
- Nouveau module pur testé `core/tasks-query.js` (`buildStatusFilter` / `readExcludeValues`) ;
  `getDatabaseSchema` expose désormais les valeurs des propriétés `status` / `select`. Détail :
  `docs/VERSIONS.md`, méthode : `docs/EVENEMENTS.md`.

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

**Cosmétiques congés (v5.7.0)** repérés en revue finale, **non bloquants** (la donnée écrite reste correcte) :
- **Segmenté matin/aprem non reflété par un override** : quand « Détailler les jours » pose un type différent sur
  un jour-borne (Du/Au), le contrôle segmenté garde son ancienne sélection en surbrillance (`syncHalfButtons` ne lit
  que `VAC.fromHalf`/`toHalf`, pas `VAC.overrides`). Purement visuel.
- **Vider entièrement « Au »** : `renderVacDetail` blanchit la liste (`!to`) alors que le récap/`generateLeaveSpans`
  retombent sur un jour unique (`toDate || fromDate`) → petite incohérence liste ⇄ récap dans un cas rare.
- *Rappel (déjà documenté, pas un cosmétique)* : réenregistrer la même plage après un **échec partiel** recrée les
  demi-journées déjà posées (pas de reprise automatique).

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
3. `npm test` → doit afficher `121 passed`.
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
