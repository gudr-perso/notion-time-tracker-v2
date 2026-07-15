# Changelog

Toutes les évolutions notables de Notion Time Tracker.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/). Version = `manifest.json`.

> Numérotation : le projet reprend l'historique personnel de la v1 (`4.9.4`). Le recodage propre,
> nommé « v2 » en interne, est diffusé à partir de **5.0.0** (continuité de version côté utilisateur).

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
- Mise en place du suivi documentaire : `docs/ETAT_PROJET.md`, `docs/JOURNAL.md`, ce `CHANGELOG.md`.

## [2.0.0] et antérieur — socle initial

Non détaillé ici. Phase A+B du recodage : configuration, onglet Timer (start/pause/stop, stop-at, saisie manuelle,
favoris, sessions récentes), service worker (badge + notifications via `chrome.alarms`), thème clair/sombre,
socle `core/` testé (27 tests Vitest).
