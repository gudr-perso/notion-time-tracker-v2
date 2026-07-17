# Versions — historique des changements

Toutes les évolutions notables de Notion Time Tracker (le **V** de la méthode AVEC).
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Version = `manifest.json`.

> Numérotation : le projet reprend l'historique personnel de la v1 (`4.9.4`). Le recodage propre,
> nommé « v2 » en interne, est diffusé à partir de **5.0.0** (continuité de version côté utilisateur).

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
