# Versions — historique des changements

Toutes les évolutions notables de Notion Time Tracker (le **V** de la méthode AVEC).
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Version = `manifest.json`.

> Numérotation : le projet reprend l'historique personnel de la v1 (`4.9.4`). Le recodage propre,
> nommé « v2 » en interne, est diffusé à partir de **5.0.0** (continuité de version côté utilisateur).

## [5.7.1] — 2026-07-18

### Corrigé
- **Bloc de saisie des congés visible même « Marquer comme congés » décoché** : la règle `#vac-range { display:flex }`
  battait l'attribut `[hidden]` du navigateur, laissant le bloc (Du/Au + demi-journées + récap) affiché en
  permanence dès l'ouverture de la saisie manuelle. Ajout des garde-fous `#vac-range[hidden]` et
  `#vac-detail[hidden]` (`{ display:none }`) — **même piège** que `.stats-custom` / `.fav-pop`. Vérifié au
  navigateur contre le `popup.css` réel (`display:none` avec `hidden`, `flex` sans). CSS seul, aucun test impacté.
  Cf. `docs/EVENEMENTS.md`.

## [5.7.0] — 2026-07-18

Saisie des congés en **demi-journées** : matin / après-midi / journée sur une **plage de dates**, avec récap live
et « détailler les jours » — l'app crée **une ligne Notion par demi-journée** aux horaires du planning. Complète
la Phase 1 « planning / objectif » de la v5.6.0.

### Ajouté
- **Saisie congés en demi-journées** : quand « Marquer comme congés » est coché **et** qu'un planning est
  configuré, les champs début/fin sont remplacés par **Du [date + matin/aprem/journée] → Au [date +
  matin/aprem/journée]**. Un **récap** live indique le total en jours (fraction, ex. « 🌴 2,5 j ») et le nombre de
  lignes qui seront créées.
- **« Détailler les jours »** : déplie une liste éditable jour par jour (type par jour, `—` pour sauter) ; les
  jours non travaillés (planning vide, ex. week-end) sont grisés « non travaillé ».
- **Fonctions pures testées** `segmentSpan`, `generateLeaveSpans`, `leaveDays` (`core/schedule.js`) — bornes de
  plage respectées, jours non travaillés sautés, overrides par jour.

### Modifié
- À l'enregistrement d'un congé : création d'**une page Notion par demi-journée** (matin / après-midi aux horaires
  du planning ; une journée = 2 lignes), liées à la tâche Congés. **Échec partiel** signalé (« N/M créées »).
- **Rétro-compat** : sans planning configuré, la coche congés conserve l'ancienne saisie début/fin.

### Notes
- `core/schedule.js` (+`segmentSpan`/`generateLeaveSpans`/`leaveDays`), `popup/timer-manual.js` (bascule, récap,
  `saveVacation`, « détailler »), `popup.html`/`popup.css` (bloc `#vac-range`). **151 tests verts** (+11). Vérifs
  navigateur : récap (2,5 j · 5 lignes…), week-ends sautés, liste détaillée et overrides recalculant le récap.

## [5.6.0] — 2026-07-18

Stats → l'objectif se calcule à partir d'un **planning hebdomadaire** configurable (au lieu d'un forfait
d'heures/semaine), les congés s'affichent **en jours**, et chaque barre du rythme quotidien porte son **repère de
cible du jour**. (Socle de la saisie des congés en demi-journées, à venir en Phase 2.)

### Ajouté
- **Planning hebdomadaire** (config) : une grille 7 jours × horaires **matin / après-midi**, remplaçant le champ
  « Heures / semaine ». Le total hebdomadaire est **dérivé** et affiché en direct. Défaut pré-rempli : lun–jeu
  09:00–13:00 / 14:00–18:00, ven 14:00–17:00, sam/dim non travaillés → 39 h. Nouveau module pur testé
  `core/schedule.js` (`scheduledMsForDate`, `hasAnySchedule`, `weeklyTotalHours`, `DEFAULT_SCHEDULE`).
- **Repère de cible par barre** : le rythme quotidien affiche sur chaque barre un repère à la hauteur de la cible
  **du jour** (issue du planning), à la place de l'ancienne ligne de cible unique — devenue fausse dès que la
  cible varie d'un jour à l'autre. Les jours non travaillés n'ont pas de repère.

### Modifié
- **Objectif dérivé du planning** : l'objectif d'une période est la **somme des heures planifiées** de ses jours
  (un jour sans horaires = non travaillé), au lieu de `jours ouvrés × heures/5`. Les congés en sont retranchés en
  **heures réelles** (plafonnées à la cible du jour). Rétro-compatible : sans planning, le calcul retombe sur le
  forfait `weeklyHours/5` d'avant (aucun test de non-régression cassé).
- **Badge Congés en jours** : la carte objectif affiche les congés en **jours** (`🌴 2,5 j`), décimale `,0`
  masquée (`1 j`, pas `1,0 j`), au lieu d'un total d'heures.
- **Barres du rythme à hauteur exacte** : chaque barre vit désormais dans un **cadre à hauteur fixe** (`.track`),
  ce qui corrige au passage un tassement des grandes barres (7 h/8 h/9 h se retrouvaient toutes ~96 px, les
  libellés partageant la hauteur flex de la colonne). Cf. `docs/EVENEMENTS.md`.

### Notes
- `core/schedule.js` (nouveau) + `core/stats.js` (`aggregate` reçoit `schedule`, expose `perDay[].targetMs`,
  `congeDays` fractionnaire) + `config/*` (grille planning) + `popup/stats.js` & `popup.css` (badge jours, track,
  repère). **140 tests verts** (+15). Vérif navigateur : grille (total 39 h, segment incomplet → null), barres
  linéaires (7,5 h→91 px, 9 h→110 px) et repères alignés à la cible du jour. **Saisie des congés en demi-journées
  = Phase 2** (plan séparé).

## [5.5.5] — 2026-07-18

Stats → Rythme quotidien : un jour qui mêle travail et congés montre désormais les **deux**, et les congés
sont comptés **en heures** (plus en jours entiers).

### Corrigé
- **Jour mixte travail + congés écrasé en « barre orange »** : un jour comportant à la fois du travail et des
  congés (ex. 4 h de chacun) s'affichait comme une **barre orange unique** dont la hauteur valait, en prime, le
  seul temps *travaillé* — les heures de congé étant purement et simplement **jetées** par l'agrégation. Cause :
  chaque jour n'avait qu'un seau `{ ms (travail), isVacation (booléen) }`, et le rendu laissait le drapeau congé
  l'emporter sur tout. Désormais l'agrégation conserve **par jour** `workMs` **et** `congeMs`, et la barre est
  **empilée** : segment bleu (travail, en base) surmonté d'un segment orange (congés). Un jour mixte 4 h/4 h
  affiche donc une barre de 8 h moitié bleue, moitié orange, avec 🌴 et une infobulle « 04:00 travaillé ·
  04:00 congés ».
- **Congé plein jour redevenu une vraie barre** : comme la durée de congé était jetée, un jour de **congé pur**
  tombait à une hauteur nulle (moignon de 2 px). Il s'affiche maintenant en **barre orange proportionnelle** :
  8 h de congé = barre pleine hauteur, 4 h = mi-hauteur.

### Modifié
- **Congés comptés en heures dans l'objectif et le badge** : l'objectif de la période retranche désormais les
  **heures** de congé de chaque jour ouvré — plafonnées à une journée (un congé « 8 h » retire au plus une
  journée) et ignorées le week-end — au lieu de retrancher une journée entière dès qu'un congé, même d'une
  demi-journée, tombait ce jour-là. Une demi-journée de congé ne fausse plus l'anneau ni le « Reste ». Le badge
  **Congés** de la carte objectif affiche le **total en heures** (`🌴 20:00`) au lieu d'un nombre de jours
  (`🌴 3 j`).

### Notes
- `src/core/stats.js` (`aggregate` : seau `workMs`/`congeMs`, objectif en heures, sortie `congeMs`),
  `src/popup/stats.js` (`renderDays` empilé, badge en heures), `src/popup/popup.css` (segments `.seg`).
  **125 tests verts** (+4 : jour mixte, congé plein plafonné, congé week-end sans impact, objectif fractionnaire).
  Vérification navigateur : hauteurs de segments mesurées (mixte 47/47 px, congé plein 94 px, demi-congé 57 px).

## [5.5.4] — 2026-07-18

Rangement interne : la couleur de fond des cartes n'est plus écrite en double.

### Modifié
- **Fond des cartes factorisé en variable `--card-bg`** : la teinte de fond des cartes (dégradé marine
  translucide en thème sombre, blanc en thème clair) était recopiée **à l'identique** sur la coche
  *Saisie manuelle* — un doublon qui risquait de diverger à la moindre retouche. Elle est désormais définie
  **une seule fois par thème** (`--card-bg`), référencée par `.card` et `.manual-toggle.card-lite` ; les deux
  surcharges de thème clair devenues redondantes (celle de `.card` et celle de la coche) sont supprimées.
  **Aucun changement visible** : rendu strictement identique en clair comme en sombre.

### Notes
- `src/popup/popup.css` seul (2 déclarations de variable + 2 références + 2 suppressions). Aucun module `core/`
  ni test touché.

## [5.5.3] — 2026-07-18

Le graphe « Rythme quotidien » de l'onglet Stats ne provoque plus de scrollbar horizontale en vue Mois.

### Corrigé
- **Scrollbar horizontale en vue Mois** : les 28–31 colonnes du rythme quotidien débordaient (~656 px de contenu
  pour ~638 px disponibles), forçant une barre de défilement horizontale sur tout le popup. Cause : chaque colonne
  est un item flex qui, par défaut (`min-width:auto`), refuse de rétrécir sous la largeur intrinsèque de son
  contenu — et le libellé d'heure « 07:30 », **insécable**, imposait cette largeur incompressible sur chaque jour
  travaillé. Correctif : `min-width:0` sur `.day` (comportement flex correct, conforme à la spec) **et**, en vue
  Mois uniquement, l'étiquette d'heure au-dessus de chaque barre est masquée (elle était de toute façon illisible
  à cette densité) — la **durée exacte reste accessible en infobulle** (`title`) au survol de la barre. Le 🌴 des
  congés et le quantième sont conservés. Vues Jour/Semaine inchangées.

### Documentation
- **`CLAUDE.md`** : les routines codifient désormais un **« Rapport de fin de release » au format imposé** (bloc
  « Méthode projet appliquée » AVEC + D², règle « n/a » pour les briques non concernées, preuve de vérification,
  état commit).

### Notes
- `src/popup/popup.css` (`.day`) + `src/popup/stats.js` (`renderDays`). Aucun module `core/` touché, 121 tests verts.

## [5.5.1] — 2026-07-17

La zone « saisie manuelle » adopte le fond des cartes (comme les widgets Stats), souligné d'un liseré cyan.

### Modifié
- **Zone « saisie manuelle » harmonisée** : la coche *Saisie manuelle (oubli de timer)* et le bloc
  début/fin/commentaire quittent leur **fond bleu clair** hérité de la v1 pour le **fond marine des cartes**
  (identique aux widgets de l'onglet Stats), souligné d'un **liseré cyan** pour rester un repère distinctif.
  Les champs, les labels et la coche « congés » suivent désormais le **thème** (clair/sombre) au lieu d'être
  forcés en clair.
- **Sélecteur de date natif** : `color-scheme` des champs `datetime-local` aligné sur le thème, pour que l'icône
  du sélecteur reste lisible sur le nouveau fond sombre (invisible sinon).

### Notes
- Changement **CSS seul** (`src/popup/popup.css`) : aucun module `core/` touché, aucun test impacté (121 verts).

## [5.5.0] — 2026-07-17

Filtre d'état : choix des statuts par cases à cocher, et les erreurs Notion s'affichent enfin dans le popup.

### Ajouté
- **Bandeau d'erreur dans le popup** : une erreur Notion au chargement des tâches (token révoqué, base
  départagée, propriété de filtre renommée…) s'affiche désormais avec le **message brut de Notion**, au lieu de
  devenir une erreur silencieuse laissant la liste vide sans explication.
- Nouveau module pur testé `core/tasks-query.js` (`buildStatusFilter` / `readExcludeValues`).
- `getDatabaseSchema` expose maintenant les **valeurs** des propriétés `status` / `select` (champ `options`).

### Modifié
- **Filtre d'état — sélection au lieu de saisie libre** : les statuts à exclure se **cochent** parmi les vraies
  valeurs de la propriété mappée, au lieu de se taper séparés par `;`. Fini les fautes de frappe et de séparateur.
  Un statut sauvegardé qui n'existe plus dans la base est affiché **« (absent de la base) »** plutôt que perdu.
- **Format stocké** : `statusFilter.excludeValue` (chaîne séparée par `;`) devient `statusFilter.excludeValues`
  (**tableau** de noms exacts). Un séparateur pouvant légitimement apparaître dans un nom de statut, on n'en
  garde aucun. Les anciennes configs restent lues (repli sur le découpage `;` de `excludeValue`).

### Corrigé
- **La liste des tâches ne se chargeait plus si une valeur d'exclusion contenait une virgule** : `"termine,clos"`
  n'était pas découpé (séparateur attendu `;`), partait comme une seule valeur inexistante, et Notion rejetait le
  filtre — sans que rien ne s'affiche. Le bandeau ci-dessus rend l'erreur visible ; les cases à cocher rendent la
  faute impossible. Cf. `EVENEMENTS.md`.

### Notes
- **Aucune migration** : une config avec l'ancien `excludeValue` reste fonctionnelle. À la réouverture de la page
  de config, une valeur qui ne correspond à aucun statut réel apparaît comme case **« (absent de la base) »** —
  décocher, cocher les bons statuts, enregistrer suffit à repasser au nouveau format.

## [5.4.0] — 2026-07-17

Export et import de la configuration depuis la page de réglages — favoris compris, **sans le token**.

### Ajouté
- **Exporter la config** : télécharge un JSON (`notion-timer-config-AAAA-MM-JJ.json`) contenant bases, mapping
  des champs, préférences, congés et favoris. Le **token Notion n'y figure jamais** : le fichier peut transiter
  par un cloud sans exposer de secret.
- **Importer une config** : recharge un fichier exporté. Une confirmation annonce la date et la version du
  fichier avant de remplacer la configuration. Le **token du poste est conservé** (jamais écrasé), la page se
  recharge, puis bases/champs/congés/favoris se re-sélectionnent via le chargement habituel.
- Nouveau module pur testé `core/config-io.js` (`buildExport` / `parseImport` / `exportFileName`).

### Notes
- Usage visé : transfert entre postes/navigateurs et sauvegarde de sécurité, **au sein du même workspace
  Notion** (les identifiants Notion du fichier y restent valides). Le partage à un tiers et les « profils »
  multi-workspace sont hors périmètre.

## [5.3.2] — 2026-07-17

Correctif : la liste complète des tâches pouvait être perdue si on cherchait pendant le chargement du popup.

### Corrigé
- **Tâches introuvables après une recherche lancée trop tôt** (bug présent depuis la **v5.0.0**) : le popup
  affiche d'abord 20 tâches (chargement léger), et la première recherche déclenche le chargement de la liste
  complète. Les deux écrivent dans le même état, sans se concerter. Si la liste complète arrivait **avant** les
  20 tâches, celles-ci l'écrasaient **alors que le drapeau « tout est chargé » restait posé** : le popup se
  croyait complet, ne rechargeait plus jamais, et **toute tâche hors des 20 premières devenait introuvable**
  jusqu'à réouverture. Correctif : le chargement léger s'efface si la liste complète est arrivée **ou est en
  route**, et l'état n'est publié qu'en un seul geste. Cf. `EVENEMENTS.md`.
- **Trois défauts voisins, même cause, trouvés en creusant** :
  - **Une recherche de 3 caractères lançait 3 paginations complètes** de la base Tâches (le drapeau ne
    protégeait qu'après coup, pas pendant le vol) → **une seule** désormais, partagée.
  - **La liste affichée pouvait ne pas correspondre à la saisie** : deux frappes rapides rendaient dans l'ordre
    d'arrivée des réponses, la dernière pouvant afficher le résultat d'une saisie **périmée**.
  - **Les tâches épinglées** (favoris, congés) étaient ajoutées à l'état partagé depuis une fonction async, ce
    qui pouvait les faire atterrir dans une liste déjà remplacée (latent, jamais observé).

### Notes
- **Reproduit avant correction**, puis vérifié après, sur le vrai module (`document`/`chrome`/`fetch` stubbés,
  ordre d'arrivée des requêtes forcé) : le popup n'étant pas dans le socle testé, c'est le seul moyen d'établir
  une course autrement invisible. Les 87 tests `core/` ne servent ici que de non-régression.
- **Le correctif des libellés de favoris de la v5.3.0 a failli être annulé** : en s'effaçant, le chargement léger
  laisse l'état vide, or le re-rendu des favoris n'avait lieu qu'après lui. Le rendu est désormais rejoué à
  **chaque** publication de la liste (`publishTasks`), ce qui couvre aussi le cas où seule la liste complète
  publie. Non-régression vérifiée dans les deux sens.

## [5.3.1] — 2026-07-17

Correctif : le sélecteur de dates « Perso » de l'onglet Stats était affiché en permanence.

### Corrigé
- **Onglet Stats — le sélecteur de plage personnalisée restait visible** quelle que soit la période choisie
  (bug présent depuis la **v5.2.0**) : `.stats-custom` posait `display:flex` **sans garde `[hidden]`**, or une
  déclaration d'auteur bat la règle `[hidden] { display:none }` du navigateur. Les deux champs de date et le
  bouton **OK** s'affichaient donc aussi en mode Jour / Semaine / Mois, où ils sont sans effet.
  Correctif : `.stats-custom[hidden] { display:none; }`. Cf. `EVENEMENTS.md`.

### Notes
- **4ᵉ occurrence du même piège** (après `.modal-overlay`, `.toast` et `.fav-pop`), et celle que l'entrée
  `EVENEMENTS.md` du 2026-07-17 invitait justement à « suspecter ». **Tout le CSS a été audité** à cette
  occasion, empiriquement (chaque élément forcé en `hidden`, `display` calculé relevé) : **aucune autre
  occurrence réelle**. Environ 26 éléments *non pilotés par `hidden`* portent un `display` d'auteur et
  formeraient le même piège s'ils venaient à être masqués un jour — piste d'un garde-fou automatisé
  consignée dans `AVANCEMENT.md`.
- Aucun changement de comportement volontaire, aucune migration : la v5.3.1 ne fait que rétablir le
  comportement déjà décrit dans la documentation fonctionnelle.

## [5.3.0] — 2026-07-17

Favoris : une couleur et un picto par favori.

### Ajouté
- **Couleur et picto par favori**, choisis dans la page de configuration : une palette **fermée de 10
  couleurs** et **23 pictos** (ou aucun). Deux boutons compacts par ligne de favori ouvrent leur panneau.
- **Libellés FR des couleurs** (`FAV_COLOR_LABELS`) pour les infobulles et les lecteurs d'écran.
- Modules purs testés `core/fav-icons.js` (table des 23 pictos) et `core/fav-presets.js` (palette,
  normalisation, attribution automatique de la première couleur libre).
- Module partagé `src/fav-icon.js` : construction du picto SVG, pour le popup et la config.

### Modifié
- **Boutons favoris** : l'aplat orange laisse place au fond bleu élevé, avec un **liseret de 4 px** dans la
  couleur du favori et le picto en blanc. Libellé en 12 px sans gras, tronqué en `…` avec le texte entier
  en infobulle — au lieu d'être coupé à 20 caractères en JS.

### Corrigé
- **Les favoris affichaient « Favori » au lieu du nom de leur tâche** (bug présent depuis la v5.0.0) :
  `renderFavoriteButtons()` s'exécutait avant que la liste des tâches ne soit chargée. Cf. `EVENEMENTS.md`.
- L'affichage de « ⏳ … » pendant un enregistrement n'efface plus le picto du bouton.
- Le picto ne disparaît plus si un re-rendu survient pendant un enregistrement (état désactivé rejoué).

### Notes
- **Aucune migration** : les favoris existants prennent `orange` et aucun picto **à la lecture**
  (`normalizeFavorite`), et retrouvent donc exactement leur apparence d'avant.
- Tracés des pictos repris de [Tabler Icons](https://tabler.io/icons) (licence MIT, notice reproduite dans
  `core/fav-icons.js`).
- Palette **mesurée** et non supposée : les 10 teintes passent le 3:1 (WCAG 1.4.11) dans les deux thèmes.
- Trois pièges de conception consignés dans `EVENEMENTS.md` (couleur en double, ambre confondu avec
  l'orange, `[hidden]` battu par `display:grid`).

## [5.2.0] — 2026-07-16

Onglet Stats : tableau de bord du temps travaillé.

### Ajouté
- **Onglet 📊 Stats** : objectif hebdomadaire (anneau de progression), rythme quotidien (barres par jour),
  bilan par projet, prise en compte des congés.
- **Périodes** Jour / Semaine / Mois / Perso (plage libre) avec navigation précédent/suivant.
- Objectif ajusté aux congés : `(jours ouvrés − jours de congé) × heures-hebdo / 5`.
- Module pur testé `core/stats.js` (bornes de période, jours ouvrés, agrégation, détection congés, objectif).

### Modifié
- `sessionFromPage` expose désormais les IDs de la relation Tâches (`tasksRelIds`) pour la détection des congés.

## [5.1.0] — 2026-07-16

Liaison facilitée aux bases Notion : injection automatique des champs nécessaires.

### Ajouté
- **Config — boutons « Créer les champs manquants »** pour les bases Temps et Tâches : injection
  automatique des propriétés Notion attendues (dates, texte, nombre, url, relations), avec les bons
  types, en un clic après avoir créé les bases à vide côté Notion.
- **Aperçu + confirmation** avant toute écriture : le bouton liste d'abord ce qui sera créé (et
  signale les conflits de type / relations sautées), l'écriture n'a lieu qu'après validation.
- **Sélecteur « Base Projets » (optionnel)** servant de cible aux relations Projets, persisté dans
  `config.projetsDb`. Les relations sont créées **dans les deux sens** (`dual_property`).
- Après injection, rechargement du schéma et **auto-mapping** des champs fraîchement créés.

### Notes
- Injection **additive et idempotente** : jamais de renommage, retype ou suppression d'une propriété
  existante (un champ de même nom mais de type différent est signalé, pas modifié). Le schéma réel de
  la base est relu à chaque injection pour garantir cette non-régression.
- Le **filtre de statut** reste à créer manuellement (le type *Status* n'est pas créable via l'API
  Notion) — un encart d'aide le rappelle dans la config.

### Technique
- Nouveau module pur testé `src/core/schema-injection.js` (`planInjection` + specs de champs).
- Nouvelle fonction `addDatabaseProperties` dans `src/core/notion-api.js` (`PATCH /databases/{id}`,
  message clair sur 403).

## [5.0.1] — 2026-07-15

Retour visuel de l'enregistrement rapide par favori + confirmation de création.

### Ajouté
- **Toast de confirmation « ✅ Ligne créée dans Notion »** après un enregistrement rapide (favori) ou manuel,
  qui s'affiche en bas du popup et s'efface tout seul (repris de la v1).

### Modifié
- **Enregistrement rapide** : pendant la sauvegarde, les boutons se **gèlent** (favoris + « Enregistrer » désactivés)
  et le bouton déclencheur — favori cliqué **ou** bouton bleu « Enregistrer » — affiche « ⏳ … » le temps de l'appel Notion.

## [5.0.0] — 2026-07-15

Refonte de l'expérience Config + saisie manuelle, corrections de layout, thème clair lisible.

### Ajouté
- **Config** : chargement **automatique** des bases Notion à l'ouverture (plus besoin de cliquer « Charger mes bases »).
- **Config** : nouveau paramètre **« Saisie manuelle par défaut »** — le popup s'ouvre directement en mode oubli
  (et le reste d'un enregistrement à l'autre).
- **Filtre de statuts multi-valeurs** : plusieurs statuts à exclure séparés par `;` (ex. `termine;clos`).
- **Favoris** : jusqu'à **8** (au lieu de 6), affichés en **4×2**.
- Zone de **saisie manuelle au fond clair** (comme la carte du chrono), champs date/heure natifs en clair.

### Modifié
- La **configuration s'ouvre en onglet plein écran** au lieu du popup étroit (largeur ~1040 px).
- **Popup élargi à 700 px** (noms de tâches lisibles sur une ligne).
- **DÉBUT / FIN côte à côte** en saisie manuelle (gain de hauteur) + bloc compacté pour voir les 8 favoris.
- **Libellé du commentaire** adaptatif en saisie manuelle : « (OBLIGATOIRE) » / « (OPTIONNEL) » selon la config,
  avec validation bloquante si `requireComment` est actif (cohérent avec le mode chrono).
- Texte d'aide « congés » affiché seulement quand la case est cochée.
- Renommage **`doc/` → `docs/`** et mise à jour des icônes.

### Corrigé
- **Modale « Arrêter à » affichée en permanence** : `.modal-overlay { display:flex }` écrasait l'attribut `hidden`
  → ajout de `.modal-overlay[hidden] { display:none }`.
- **Débordement des grilles de config** (champ statuts, rangées de favoris coupés) → `minmax(0, 1fr)` + grille stricte.
- **Largeur du popup qui sautait** à l'ouverture de la saisie manuelle → `scrollbar-gutter: stable` sur `html`.
- **Thème clair** : fonds de cartes et de favoris devenus lisibles (fini le gris-violet terne, texte gris/bleu illisible).

### Technique
- Version passée de `2.0.0` à `5.0.0` (`manifest.json` + `package.json` + `package-lock.json`).
- Mise en place du suivi documentaire (méthode AVEC) : `docs/AVANCEMENT.md`, `docs/EVENEMENTS.md`, ce `VERSIONS.md`.

## [4.9.4] et antérieur — socle initial

Non détaillé ici. Phase A+B du recodage : configuration, onglet Timer (start/pause/stop, stop-at, saisie manuelle,
favoris, sessions récentes), service worker (badge + notifications via `chrome.alarms`), thème clair/sombre,
socle `core/` testé (27 tests Vitest).
