# Versions — historique des changements

Toutes les évolutions notables de Notion Time Tracker (le **V** de la méthode AVEC).
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Version = `manifest.json`.

> Numérotation : le projet reprend l'historique personnel de la v1 (`4.9.4`). Le recodage propre,
> nommé « v2 » en interne, est diffusé à partir de **5.0.0** (continuité de version côté utilisateur).

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
