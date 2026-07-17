# Événements techniques — Notion Time Tracker

> Le **É** de la méthode AVEC. Mémoire des événements techniques marquants (pièges rencontrés et **résolus**,
> décisions de contournement), pour ne pas re-déboguer deux fois la même chose.
>
> **Règle de rédaction** : une entrée ne mérite d'exister que si, en la relisant, mon futur moi
> gagne du temps au lieu de re-déboguer. Message d'erreur **brut** obligatoire dans le champ Erreur
> (pas « ça marchait pas »). Format : **Contexte / Erreur / Hypothèse / Action / Résultat / Leçon**.
> On y met les diagnostics **non triviaux** ; pas les typos ni les ajustements CSS évidents.

---

## 2026-07-15 — `npm test` échoue : vitest absent

- **Contexte** : premier lancement des tests après synchronisation du repo (dossier local relié au remote).
- **Erreur** :
  ```
  'vitest' n'est pas reconnu en tant que commande interne ou externe, un programme exécutable ou un fichier de commandes.
  Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vitest' imported from C:\_pCloud\Extensions\notion-timer-v2\vitest.config.js
  ```
- **Hypothèse** : `node_modules/` absent (projet « zéro build », mais Vitest est une devDependency à installer).
- **Action** : `npm install`.
- **Résultat** : 27 tests verts.
- **Leçon** : sur ce repo, **`npm install` avant de lancer les tests** sur tout nouveau clone/machine. `node_modules/` est git-ignored.

## 2026-07-15 — La page de config s'ouvrait dans le popup étroit

- **Contexte** : au premier lancement, la configuration s'affichait à ~440 px (largeur du popup), contenu tronqué.
- **Erreur** : pas de message — symptôme visuel (blocs coupés, illisible).
- **Hypothèse** : `popup.js` faisait `window.location = '../config/config.html'`, ce qui charge la config **dans** le popup contraint, alors qu'elle est stylée pour une pleine page (`max-width` large).
- **Action** : ouvrir la config en onglet — `chrome.tabs.create({ url: chrome.runtime.getURL('src/config/config.html') })` puis `window.close()`. Après sauvegarde, refermer l'onglet via `chrome.tabs.getCurrent()` + `chrome.tabs.remove()`.
- **Résultat** : config en plein écran.
- **Leçon** : une page de config large s'ouvre **en onglet**, jamais via `window.location` depuis le popup.

## 2026-07-15 — Grilles de config qui débordent et sont coupées

- **Contexte** : champs (statuts, rangées de favoris) coupés à droite des cartes en config.
- **Erreur** : symptôme visuel (contenu tronqué par `overflow:hidden` de `.card`).
- **Hypothèse** : `grid-template-columns: 210px 1fr` — une piste `1fr` a un minimum implicite `auto`, donc un `<select>`/`<input>` au contenu long **fait déborder** la colonne, et `overflow:hidden` la coupe.
- **Action** : `grid-template-columns: 230px minmax(0, 1fr)` sur les rangées, et grille stricte `minmax(0,1fr) 160px auto` pour chaque rangée de favori. Ajout de `min-width:0` / `max-width:100%` de sécurité.
- **Résultat** : plus aucun débordement.
- **Leçon** : dès qu'une **grille CSS déborde**, remplacer `1fr` par **`minmax(0, 1fr)`**. C'est le remède standard.

## 2026-07-15 — Modale « Arrêter à » affichée en permanence

- **Contexte** : à l'ouverture du popup, la modale stop-at s'affichait par-dessus l'état idle, alors que son HTML porte l'attribut `hidden`.
- **Erreur** : symptôme visuel (modale visible d'emblée, boutons Démarrer masqués).
- **Hypothèse** : `.modal-overlay { display:flex }` (spécificité de classe) **l'emporte** sur la règle navigateur `[hidden] { display:none }` (spécificité plus faible). L'attribut `hidden` était donc ignoré.
- **Action** : ajouter `.modal-overlay[hidden] { display:none; }` (spécificité classe+attribut, qui regagne la main).
- **Résultat** : modale masquée par défaut, visible seulement au clic « ARRÊTER À… ».
- **Leçon** : tout `display` posé sur une **classe** casse l'attribut `hidden` sur les éléments concernés → toujours prévoir `.classe[hidden] { display:none }`.

## 2026-07-15 — Largeur du popup qui saute en mode saisie manuelle

- **Contexte** : la largeur du popup gagnait ~15 px en cochant « Saisie manuelle » (apparition de la scrollbar quand le contenu dépasse les 600 px max d'un popup Chrome).
- **Erreur** : symptôme visuel (largeur qui bouge).
- **Hypothèse fausse (tentée)** : `scrollbar-gutter: stable` sur `body` → **sans effet**, le décalage persistait.
- **Action** : déplacer `scrollbar-gutter: stable` sur **`html`** — le conteneur de défilement du document. `scrollbar-gutter` **ne se propage pas** depuis `body`.
- **Résultat** : gouttière réservée en permanence, largeur constante idle/manuel.
- **Leçon** : pour figer la largeur d'un popup, `scrollbar-gutter: stable` va sur **`html`**, pas `body`. (Contrainte annexe : un popup Chrome plafonne à **600 px de haut** — on compacte, on n'agrandit pas.)

## 2026-07-15 — Impossible de prévisualiser via le Browser pane

- **Contexte** : tentative de rendu de `config.html` en local pour valider un layout.
- **Erreur** :
  ```
  navigate timed out after 300s
  https://file is blocked by policy and cannot be opened in the Browser pane.
  ```
- **Hypothèse** : le Browser pane refuse les URL `file://` (policy), et de toute façon `config.js` plante hors extension car `chrome.*` est `undefined`.
- **Action** : abandon de la preview par ce biais ; validation par **analyse CSS** puis rechargement de l'extension par l'utilisateur.
- **Résultat** : corrections validées au rechargement.
- **Leçon** : pas de preview `file://` dans le Browser pane, et une UI d'extension ne se teste pas hors contexte extension (`chrome.*` absent) → **recharger l'extension** dans `chrome://extensions`.

## 2026-07-15 — Commit refusé : identité git inconnue

- **Contexte** : premier commit sur le repo (fraîchement `git init`, aucune config d'identité).
- **Erreur** :
  ```
  Author identity unknown
  *** Please tell me who you are.
  fatal: no email was given and auto-detection is disabled
  ```
- **Hypothèse** : ni `user.name` ni `user.email` définis (repo neuf, pas de config globale exploitable).
- **Action** : configurer en **local** l'identité reprise de l'auteur des commits distants :
  `git config user.name "gudr-perso"` / `git config user.email "285798810+gudr-perso@users.noreply.github.com"`.
- **Résultat** : commit créé et poussé.
- **Leçon** : sur ce repo, l'identité git est **locale** = `gudr-perso` (email noreply GitHub) ; à reconfigurer sur tout nouveau clone.

## 2026-07-17 — pCloud ne synchronise pas `.git` : la v5.2.0 a failli être perdue avec le PC

- **Contexte** : reprise du projet sur un **nouveau PC** (l'ancien, sous `C:\_pCloud\…`, est HS), dossier `E:\_pCloud\Extensions\notion-timer-v2` synchronisé par pCloud. Question de départ : « ce PC est-il à jour ? ».
- **Erreur** :
  ```
  fatal: not a git repository (or any of the parent directories): .git
  ```
  Et surtout, en comparant au distant : `manifest.json` distant = `5.1.0`, local = `5.2.0`.
- **Hypothèse** : pCloud a synchronisé les fichiers (y compris des dossiers cachés comme `.claude`, `.superpowers`, et même `node_modules/` pourtant git-ignored) **mais pas `.git`**. Le dossier n'était donc pas « en retard » : il était **en avance**, porteur de tout le travail v5.2.0 (onglet Stats) jamais poussé — et sans historique local.
- **Action** :
  1. Diagnostic : `git ls-remote` (distant joignable, `main` = `89dcf6a`), clone du distant à côté puis comparaison fichier par fichier (hash, puis re-comparaison **en normalisant les fins de ligne** pour écarter les faux positifs CRLF).
  2. Rattachement : déplacer le `.git` du clone dans le dossier pCloud → l'historique jusqu'à v5.1.0 revient et le travail Stats apparaît en modifications non committées. (`Move-Item` C: → E: recopie puis échoue à supprimer la source en lecture seule : le dépôt est bien en place, seul le nettoyage est à refaire.)
  3. Identité locale `gudr-perso`, `npm install` + `npm test` (66 verts) **avant** de figer, puis commit `release: v5.2.0` et push.
- **Résultat** : `main` distant = `bca3293` = local, arbre propre. Rien de perdu.
- **Leçon** : **pCloud n'est pas une sauvegarde de l'historique git** — seul le push vers GitHub l'est. Donc : **pousser à chaque release**, ne jamais laisser une version « livrée » vivre uniquement dans le dossier synchronisé. Corollaire de diagnostic : « pas à jour » n'est pas toujours « en retard » — comparer les deux sens avant d'agir. Et avec `core.autocrlf=true`, un clone frais fait apparaître des fichiers `M` qui n'ont **aucun** diff réel (`git diff` vide) : normaliser les fins de ligne avant de conclure, ils disparaissent d'eux-mêmes au `git add`.
