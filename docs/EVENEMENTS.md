# Événements techniques — Notion Time Tracker

> Le **É** de la méthode AVEC. Mémoire des événements techniques marquants (pièges rencontrés et **résolus**,
> décisions de contournement), pour ne pas re-déboguer deux fois la même chose.
>
> **Règle de rédaction** : une entrée ne mérite d'exister que si, en la relisant, mon futur moi
> gagne du temps au lieu de re-déboguer. Message d'erreur **brut** obligatoire dans le champ Erreur
> (pas « ça marchait pas »). Format : **Contexte / Erreur / Hypothèse / Action / Résultat / Leçon**.
> On y met les diagnostics **non triviaux** ; pas les typos ni les ajustements CSS évidents.

---

## 2026-07-17 — `[hidden]` sans effet : une déclaration `display:` d'auteur bat le navigateur

- **Contexte** : v5.3.0, panneaux de choix couleur/picto dans la config. Ouverture/fermeture pilotées par
  `pop.hidden = true/false`, et `.fav-pop { display:grid }` pour la grille de pastilles.
- **Erreur** : pas de message — symptôme visuel. Les **16 panneaux** (8 favoris × 2) se seraient affichés
  **ouverts en permanence**. « Un seul panneau à la fois », la fermeture au clic extérieur et Échap :
  tous inopérants, tout le code de fermeture s'exécutait sans rien changer à l'écran.
- **Hypothèse** : `hidden` s'implémente par une règle de la **feuille du navigateur**
  (`[hidden] { display:none }`). Dans la cascade, l'origine prime sur la spécificité : toute déclaration
  `display:` **d'auteur** l'emporte, même à spécificité (0,1,0). `pop.hidden = true` ne fait donc rien.
- **Action** : `.fav-pop[hidden] { display:none; }`.
- **Résultat** : les panneaux se ferment.
- **Leçon** : **dès qu'une règle pose `display:` sur un élément piloté par `hidden`, ajouter la garde
  `[hidden] { display:none }`**. C'était la **troisième** occurrence dans ce projet — `.modal-overlay[hidden]`
  et `.toast[hidden]` (popup.css) portaient déjà la parade **et le commentaire qui l'explique**, relus le jour
  même sans que le rapprochement se fasse. Le piège ne se voit pas à la relecture du JS : il est
  entièrement dans le CSS. Suspecter aussi `.stats-custom` (v5.2.0), même forme.

## 2026-07-17 — Favoris affichant tous « Favori » : rendu avant le chargement des tâches

- **Contexte** : v5.3.0. Constaté en relisant `renderFavoriteButtons()`, pas signalé par un utilisateur —
  le bug était **livré depuis la v5.0.0**.
- **Erreur** : pas de message — chaque favori sans libellé personnalisé affichait « Favori » à vie, jamais
  le nom de sa tâche Notion.
- **Hypothèse** : dans `initTimer()`, `wireManual()` appelle `renderFavoriteButtons()` **avant**
  `await loadLightTasks()`. `T.tasks` vaut donc `[]`, `T.tasks.find(...)` rend `undefined`, et le repli
  `fav.customLabel || task?.name || 'Favori'` tombe sur la constante. La fonction n'étant jamais rappelée,
  l'affichage restait faux définitivement.
- **Action** : exposer le rendu via `helpers.renderFavorites` (comme `reloadRecent` le fait déjà) et le
  rappeler après `await loadLightTasks()`. Rendu initial conservé pour que la boîte ne surgisse pas tard.
- **Résultat** : les noms de tâches s'affichent.
- **Leçon** : ce symptôme **masquait sa propre cause** — la même absence de tâches faisait aussi échouer le
  clic sur un favori avec « Tâche du favori introuvable ». Dans ce popup, **tout ce qui lit `T.tasks` doit
  être rappelé après `loadLightTasks()`, pas seulement câblé avant**. Famille de bugs à surveiller : cf. la
  course `loadAllTasks` / `loadLightTasks` qui écrase `T.tasks` en laissant `allLoaded` à `true`.

## 2026-07-17 — Deux pièges de palette : couleur en double, et un correctif qui aggrave

- **Contexte** : v5.3.0, palette fermée de 10 couleurs, `nextFreeColor()` attribuant la première couleur
  libre à un nouveau favori.
- **Erreur** : pas de message. Deux symptômes distincts, tous deux trouvés en relecture.
  ```
  3 favoris d'avant la v5.3.0 affichent -> ['orange','orange','orange']
  4e favori créé                        -> cyan
  5e favori créé                        -> orange   <-- sosie des trois premiers
  ```
- **Hypothèse** : (1) `nextFreeColor` lisait la couleur **brute** (`f?.color`), alors qu'un favori d'avant
  la v5.3.0 n'a pas de champ `color` mais **s'affiche** en orange via `normalizeFavorite`. Il réservait donc
  `undefined` et orange restait « libre ». (2) Séparément, l'ambre clair `#d97706` tombait à **2,97:1** sur
  le fond de carte (sous le 3:1 de WCAG 1.4.11) et dérivait de 11° de teinte **vers l'orange**, réduisant
  l'écart orange/ambre à ΔE00 9,9 — la paire la plus proche de la palette.
- **Action** : (1) `nextFreeColor` mappe désormais par `normalizeFavorite(f).color`. (2) Ambre clair passé à
  `#a16207` — **et non `#b45309`**, le « cran suivant de la rampe » pourtant intuitif : mesuré, il tombait à
  1,9° de l'orange (contre 8° avant) et *dégradait* ΔE00 à 9,59.
- **Résultat** : plus de doublon ; ambre à 4,59:1 et ΔE00 15,84 de l'orange.
- **Leçon** : deux leçons pour le prix d'une. **« Utilisé » doit vouloir dire « affiché »** : dès qu'une
  normalisation existe, tout ce qui raisonne sur les valeurs doit passer par elle, jamais sur le brut.
  Et **mesurer avant d'affirmer** : la palette était réputée « validée lisible » sans qu'aucun contraste
  n'ait été calculé, et le correctif intuitif empirait le défaut qu'il prétendait réparer. Un test de
  non-régression écrit dans la foulée passait d'ailleurs **au vert sur le code bugué** (`.not.toBe('orange')`
  était satisfait par cyan, première couleur de la palette) : vérifier qu'un test échoue **avant** de
  corriger n'est pas une formalité.

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
