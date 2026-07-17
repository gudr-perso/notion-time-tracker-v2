# Événements techniques — Notion Time Tracker

> Le **É** de la méthode AVEC. Mémoire des événements techniques marquants (pièges rencontrés et **résolus**,
> décisions de contournement), pour ne pas re-déboguer deux fois la même chose.
>
> **Règle de rédaction** : une entrée ne mérite d'exister que si, en la relisant, mon futur moi
> gagne du temps au lieu de re-déboguer. Message d'erreur **brut** obligatoire dans le champ Erreur
> (pas « ça marchait pas »). Format : **Contexte / Erreur / Hypothèse / Action / Résultat / Leçon**.
> On y met les diagnostics **non triviaux** ; pas les typos ni les ajustements CSS évidents.

---

## 2026-07-17 — La liste des tâches ne se charge plus, et le popup reste muet sur le pourquoi

- **Contexte** : v5.5.0. « La liste des tâches ne se charge plus, malgré une config OK. » Seul indice fourni par
  l'utilisateur : **le site où l'erreur est levée**, pas son texte — `core/notion-api.js`, `if (!res.ok) { throw
  new Error(data.message || …) }`. Notion a donc répondu **non-ok** au chargement des tâches (`queryPage` →
  `/databases/{id}/query`). Cause trouvée par l'utilisateur : dans le **filtre d'état**, valeurs d'exclusion
  saisies séparées par une **virgule** au lieu du `;` attendu (`buildTasksFilter` ne découpe que sur `;`).
- **Erreur** : **message Notion exact jamais capturé** — et c'est précisément le bug. `initTimer()` était
  `await`é sans `try/catch` ([popup.js](../src/popup/popup.js)) ; le rejet devenait une *unhandled rejection*,
  la liste restait vide, aucun texte à l'écran. L'utilisateur a dû **ouvrir les DevTools et coller le code
  source du point de levée** faute de pouvoir lire le message. Le seul artefact disponible est donc le site de
  levée, pas la chaîne `data.message`. Mécanisme côté valeur : `"termine,clos"` non découpé → **une seule**
  valeur inexistante envoyée en `does_not_equal`, que Notion a refusée (statut non-ok confirmé par la levée).
- **Hypothèse** : deux défauts distincts, empilés. (1) **Structurel** : toute erreur Notion au démarrage est
  invisible, pas seulement celle-ci. (2) **Ergonomique** : encoder plusieurs valeurs dans une chaîne à
  séparateur `;` est un piège — un séparateur (virgule **ou** point-virgule) peut légitimement apparaître dans
  un nom de statut Notion, donc *aucun* séparateur en clair n'est sûr.
- **Action** :
  1. `try/catch` autour de `initTimer()` → bandeau `#load-error` affichant `e.message` **brut** de Notion.
     Couvre toute la famille (token révoqué, base départagée, propriété renommée), pas ce seul cas.
  2. Filtre d'état : la saisie libre devient des **cases à cocher** des vrais statuts (`getDatabaseSchema`
     expose désormais `options` pour `status`/`select`). On ne peut plus taper une valeur fausse.
  3. Format stocké : `excludeValue` (chaîne `;`) → `excludeValues` (**tableau** de noms exacts). Plus aucun
     séparateur en clair. Logique extraite en `core/tasks-query.js` (`buildStatusFilter`, `readExcludeValues`),
     testée, avec repli sur l'ancien découpage `;` pour les configs existantes.
  4. Un statut sauvegardé absent des options réelles est rendu **« (absent de la base) »**, coché — préservé et
     signalé, jamais supprimé en silence.
- **Résultat** : 121 tests verts (15 nouveaux : 13 `tasks-query`, 2 `getDatabaseSchema`). Le câblage DOM
  (bandeau, cases) n'est **pas** exécuté par les tests — l'extension dépend des API `chrome.*` et le navigateur
  intégré ne rend `file://` qu'en captures statiques ; vérifié par relecture + `node --check`, pas en pilotant.
- **Leçon** : **une erreur d'une couche externe qu'on `throw` doit finir à l'écran, pas seulement dans la
  console.** Le signe qui ne trompe pas : l'utilisateur en est réduit à **coller le code source du point de
  levée** parce qu'il n'a pas le message — l'information existait, elle a été jetée. Un `await` de haut niveau
  sans `try/catch` sur un appel réseau est un trou d'observabilité. Et corollaire : **ne jamais encoder des
  données utilisateur multi-valeurs avec un séparateur en clair** (`;`, `,`) quand ces données peuvent
  légitimement contenir ce séparateur — préférer un tableau, ou un choix fermé (cases à cocher) qui supprime la
  saisie. Réserve d'honnêteté : le *message* Notion exact n'a pas été observé (avalé avant le correctif) ; le
  correctif du bandeau est justement ce qui rendra le prochain diagnostic immédiat.

## 2026-07-17 — Course au démarrage : la liste complète des tâches écrasée par le chargement léger

- **Contexte** : v5.3.2. Deuxième bug pré-existant repéré en relisant le code pendant la v5.3.0, traité en session séparée. `initTimer()` branche l'écouteur de `#task-search` **avant** son `await loadLightTasks()` (20 tâches affichées vite) ; taper déclenche `loadAllTasks()` (liste complète, `T.allLoaded = true`). Les deux écrivent dans le **même** `T.tasks`, sans se concerter. Bug **livré depuis la v5.0.0**.
- **Erreur** : pas de message — symptôme fonctionnel, et invisible en usage normal (il faut taper **pendant** le chargement). Reproduit sur le vrai module, harnais stubbant `document`/`chrome`/`fetch` avec le chargement léger relâché **après** le complet :
  ```
  recherche « zzz » → 0 option(s), zzz-cible INTROUVABLE   (attendu : 1 option)
  ```
  alors que la tâche existe bien dans la base.
- **Hypothèse** : si `loadAllTasks` résout **avant** `loadLightTasks`, le léger écrase `T.tasks` avec ses 20 tâches **pendant que `allLoaded` reste vrai** → le popup se croit complet, ne recharge plus jamais, et toute tâche hors des 20 premières devient introuvable jusqu'à réouverture.
- **Action** — la piste évidente (`if (T.allLoaded) return` **en tête** de `loadLightTasks`) est **mort-née** : à l'entrée, `allLoaded` est toujours faux (aucun `await` entre le branchement de l'écouteur et l'appel). Le test doit être **juste avant l'écriture**, après tous les `await`. Dans `src/popup/timer.js` :
  1. `loadLightTasks` calcule sa liste puis teste `T.allLoaded || T.allLoading` **immédiatement avant** de publier.
  2. `loadAllTasks` mémorise sa promesse dans `T.allLoading` : les appels concurrents la partagent (**3 frappes = 3 paginations complètes** avant, 1 après) et le drapeau signale « liste complète en route » au chargement léger.
  3. `T.tasks` et `T.allLoaded` publiés **sans `await` entre les deux** → `allLoaded` ne peut plus mentir sur le contenu de `T.tasks`.
  4. `ensurePinnedTasks` → `withPinnedTasks(tasks)`, qui **retourne** une liste au lieu d'écrire dans `T.tasks` (cf. Leçon).
  5. Le rendu relit `#task-search` **au moment du rendu** (`applyFilter`) au lieu d'une valeur capturée avant un `await` : deux frappes rapides rendaient dans l'ordre d'arrivée des réponses, la dernière affichant le résultat d'une saisie **périmée** (`25` options pour « Tache 1 »).
- **Résultat** : `1 option, zzz-cible TROUVÉE` ; 1 seule pagination ; le dernier rendu correspond toujours à la saisie. 87 tests verts (non-régression seulement : le popup n'est pas dans le socle testé).
- **Leçon** : **un drapeau « c'est chargé » posé à la fin d'un chargement n'arbitre rien pendant le vol** — d'où le doublon `allLoaded` (fini) / `allLoading` (en route). Trois réflexes pour tout état partagé écrit par deux chemins async :
  - le garde-fou va **juste avant l'écriture**, jamais en tête de fonction : chaque `await` rouvre la fenêtre ;
  - publier l'état et son drapeau **d'un seul geste**, sans `await` entre les deux ;
  - relire le DOM au moment du rendu ; une valeur lue avant un `await` est périmée au retour.

  Et surtout : **corriger une course peut en réveiller une autre**. Faire s'effacer le chargement léger a failli annuler le correctif des favoris de la v5.3.0 — s'il ne publie pas, `T.tasks` reste `[]`, et le re-rendu des favoris placé *après* lui retombait sur la liste vide, réaffichant « Favori » à vie. D'où `publishTasks()` : **point de passage unique** qui publie la liste **et** rejoue tout ce qui en dépend, à chaque publication. C'est la leçon de l'entrée « Favoris affichant tous Favori » (tout ce qui lit `T.tasks` doit être rejoué, pas seulement câblé) poussée à sa conclusion — un rendu unique après le chargement léger ne couvrait qu'un cas sur deux.

  Piège de langage vérifié au passage : `T.tasks.push(f(await g()))` capture le tableau **avant** d'évaluer l'argument — si `T.tasks` est réaffecté pendant le `await`, le push atterrit sur le tableau **orphelin**. Ici c'était **latent** (le chargement complet re-rapatriait l'épinglée) : mesuré, pas supposé — d'où « latent » et non « corrigé ». C'est la raison pour laquelle une fonction async ne doit pas écrire dans l'état partagé : elle **retourne**, l'appelant publie.

## 2026-07-17 — Réécrire un fichier source en PowerShell 5.1 corrompt tous les accents

- **Contexte** : v5.3.2. Pour prouver qu'un test échouait bien sans le correctif, neutralisation d'une ligne de `timer.js` via `(Get-Content $f -Raw) -replace ... | Set-Content $f -Encoding utf8`.
- **Erreur** : le fichier ressort en mojibake, sur toute sa longueur :
  ```
  // src/popup/timer.js â€” logique de l'onglet Timer : Ã©tat partagÃ© T + helpers
  ```
- **Hypothèse** : double faute d'encodage. `Get-Content` lit un fichier UTF-8 **sans BOM** comme du **Windows-1252** (défaut ANSI de PS 5.1) → `é` (`C3 A9`) devient `Ã©` ; `Set-Content -Encoding utf8` réencode ce `Ã©` en UTF-8 (`C3 83 C2 A9`) **et ajoute un BOM**. Chaque caractère accentué double de taille.
- **Action** : réparation par le chemin inverse — décoder les octets en UTF-8, retirer le `U+FEFF` de tête, réencoder en Windows-1252, réécrire en octets bruts (`[System.IO.File]::WriteAllBytes`). Vérifié réversible **avant** d'écrire : `0` caractère `U+FFFD` dans le texte décodé (sinon la perte aurait été définitive — les octets `81 8D 8F 90 9D` n'existent pas en 1252).
- **Résultat** : fichier identique à l'octet près, accents intacts, BOM parti ; `git diff` ne montrait plus que les modifications voulues.
- **Leçon** : sur ce projet (sources FR accentuées, Windows, PS 5.1), **ne jamais éditer un fichier source avec `Get-Content`/`Set-Content`** — utiliser l'outil d'édition, qui préserve l'encodage. La corruption est **silencieuse** : rien n'échoue, le code tourne toujours, seuls les accents sont détruits — et un `git diff` la noierait dans un fichier entièrement réécrit. Corollaire : la console PS 5.1 affiche aussi ces fichiers en mojibake (`Get-Content`, `Select-String`) alors qu'ils sont **sains sur le disque** ; ne pas confondre un défaut d'affichage avec un fichier corrompu — trancher sur les octets.

## 2026-07-17 — `.stats-custom` : le soupçon confirmé, et tout le CSS audité pour solde de tout compte

- **Contexte** : suite **directe** de l'entrée « `[hidden]` sans effet » ci-dessous (v5.3.0), qui se terminait par
  « *Suspecter aussi `.stats-custom` (v5.2.0), même forme* ». Tâche ouverte en session séparée pour vérifier, avec
  deux consignes : **reproduire avant de corriger**, puis **balayer tout le CSS** à la recherche d'autres cas.
- **Erreur** : soupçon **fondé**. Mesuré dans le DOM, onglet Stats ouvert sur « Semaine » :
  ```
  #stats-custom : hidden=true → getComputedStyle(el).display === "flex"   (attendu : "none")
                                getBoundingClientRect()   → 668 × 44 px    (donc bel et bien rendu)
  ```
  Les deux champs de date et le bouton OK s'affichaient donc en Jour/Semaine/Mois, où ils ne servent à rien.
  Bug **livré depuis la v5.2.0**.
- **Hypothèse** : identique à l'entrée ci-dessous, inutile de la redérouler — `.stats-custom { display:flex }`
  (auteur) bat `[hidden] { display:none }` (navigateur), l'origine primant sur la spécificité.
- **Action** :
  1. **Reproduire sans recharger l'extension** : `popup.html` ouverte en `file://` dans le Browser pane, puis
     simulation exacte du basculement d'onglet de `popup.js` (`$('tab-stats').hidden = false`).
     ⚠️ **Ceci périme la leçon du 2026-07-15** (« pas de preview `file://` ») : le Browser pane **rend désormais
     les `file://`**. `chrome.*` reste absent — le JS de l'extension ne tourne toujours pas — mais **la CSS, elle,
     se teste très bien** en pilotant le DOM à la main. La cascade ne dépend pas du contexte : `file://` et
     `chrome-extension://` rendent à l'identique.
  2. Correctif `.stats-custom[hidden] { display:none; }` (v5.3.1), puis re-vérification **sur la base v5.3.0**
     (la v5.3.0 avait modifié `popup.css` entre-temps).
  3. **Audit empirique de tout le CSS**, et non à l'œil : un script force `hidden` sur **chaque** élément de
     `popup.html` et `config.html` et relève ceux dont le `display` calculé ne retombe pas sur `none` ; croisé
     avec `grep '\.hidden ='` dans `src/` pour ne garder que les éléments réellement pilotés.
- **Résultat** : « Semaine » → `display:none`, non rendu ; « Perso » → `display:flex`, 668 × 44 px (pas de
  régression). 87 tests verts (non-régression seulement : la CSS n'est pas dans le socle testé `core/`).
  **Aucune autre occurrence réelle** — les 15 autres éléments pilotés par `hidden` retombent bien sur `none`.
  En revanche **~26 éléments *non* pilotés** portent un `display` d'auteur (`.field`, `.btn-row`, `.seg`, `.days`,
  `.row`, `.cell`…) : autant de **pièges dormants** le jour où l'un d'eux passerait sous `hidden`.
- **Leçon** : deux choses. (1) Le soupçon laissé en fin d'entrée précédente valait un **vrai bug livré** —
  l'écrire dans `EVENEMENTS.md` était utile, mais c'est **d'avoir ouvert la tâche dans la foulée** qui l'a fait
  corriger ; un soupçon non transformé en tâche serait mort là. (2) Pour trancher ce piège, **ne pas relire le
  CSS : le mesurer**. Poser `hidden` puis lire `getComputedStyle(el).display` tranche en deux secondes et sans
  faux négatif — c'est cette bascule (relecture → mesure) qui autorise à écrire « aucune autre occurrence »
  plutôt que « je n'en ai pas vu d'autre ».

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
  > ✅ **Suivi (v5.3.1)** : soupçon **confirmé** — `.stats-custom` était bien une **4ᵉ** occurrence, livrée depuis
  > la v5.2.0. Corrigée, et tout le CSS audité dans la foulée (aucune autre). Cf. l'entrée en tête de fichier.

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
  > ✅ **Suivi (v5.3.2)** : la course est corrigée — et elle a bien failli **annuler ce correctif-ci**, le
  > chargement léger pouvant désormais s'effacer sans jamais publier (`T.tasks` reste `[]`, le re-rendu placé
  > après lui retombe sur la liste vide). Le rendu est donc rejoué à **chaque** publication, via `publishTasks()`.
  > « Rappelé après `loadLightTasks()` » était le bon réflexe mais le mauvais point d'accroche : c'est
  > **la publication de la liste** qu'il faut suivre, pas un chargement en particulier. Cf. l'entrée en tête.

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
  > ⚠️ **Rectifié le 2026-07-17** : l'explication par la **spécificité est fausse** — c'est l'**origine** dans la
  > cascade (auteur > navigateur) qui tranche, la spécificité n'étant alors même pas consultée. Le correctif reste
  > le bon, mais le raisonnement induit en erreur : il laisse croire qu'un sélecteur peu spécifique serait sans
  > danger, alors que `div { display:flex }` casserait `hidden` tout autant. Cf. les entrées du 2026-07-17.
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
  > ⚠️ **Périmé le 2026-07-17** : le Browser pane **rend maintenant les `file://`**. `chrome.*` reste absent, donc le
  > JS de l'extension ne tourne pas — mais **la CSS se teste très bien** en pilotant le DOM à la main
  > (`getComputedStyle`), ce qui a permis de reproduire le bug `.stats-custom` sans recharger l'extension.
  > À retenir : « le JS ne tourne pas hors extension » **n'implique pas** « rien n'est testable hors extension ».

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

