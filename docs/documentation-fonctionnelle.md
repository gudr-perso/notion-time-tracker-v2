# Documentation fonctionnelle — Notion Time Tracker

Version : `5.4.0`. Le **D-fonctionnel** du principe D² : décrit **ce que fait** l'application, du point de vue de
l'utilisateur, fonctionnalité par fonctionnalité. Aucun code ; pour l'implémentation, voir
[`documentation-technique.md`](documentation-technique.md).

---

## 1. Vue d'ensemble et concepts

### 1.1 À quoi sert l'extension

L'extension est un **pointeur de temps de travail**. On lance un chronomètre en commençant à travailler sur une
tâche, on l'arrête en ayant fini, et la session (tâche, début, fin, commentaire, pauses) est **écrite
automatiquement dans une base Notion**. On peut aussi **saisir a posteriori** une session oubliée. Un onglet
**Stats** (voir §4) donne une vue d'ensemble du temps travaillé par période.

### 1.2 Les deux bases Notion

L'extension manipule **deux** bases distinctes, toutes deux **entièrement mappables** (aucun nom de propriété n'est
imposé) :

| Base | Rôle | Sens |
|------|------|------|
| **Base des tâches** | Liste des tâches sur lesquelles on peut pointer. | **Lecture** |
| **Base des temps saisis** | Reçoit un enregistrement par session de travail. | **Lecture + écriture** |

On choisit une tâche dans la base des tâches ; l'extension crée alors une page dans la base des temps saisis, liée
à cette tâche.

### 1.3 Notions clés

- **Session** : une période de travail (début → fin) sur une tâche = une page dans la base des temps saisis.
- **Session en cours** : un chronomètre actif (ou en pause), persisté localement (survit à la fermeture du popup).
- **Mapping** : correspondance entre les « champs logiques » de l'extension (nom, début, fin, pause…) et les
  propriétés réelles de la base Notion de l'utilisateur.
- **Favori** : raccourci vers une tâche fréquente, pour un enregistrement rapide.
- **Congés** : une tâche dédiée sert à enregistrer les jours de congés.

---

## 2. Configuration (page en onglet plein écran)

Écran : **`config.html`**, ouvert **dans un onglet plein écran** (pas dans le popup étroit). Il s'ouvre
automatiquement au premier lancement (ou tant que la configuration est incomplète), et reste accessible via le
bouton ⚙️ du popup.

### 2.1 Connexion & choix des bases

1. **Token Notion** : créer une intégration interne sur `notion.so/my-integrations` et coller le token.
2. **Tester la connexion** : affiche en cas de succès le nom du compte connecté.
3. **Charger les bases** : liste les bases partagées avec l'intégration. Si un token est déjà enregistré, les bases
   sont **chargées automatiquement** à l'ouverture (plus besoin de cliquer).
4. **Double sélection** : choisir la **base des temps saisis** (écriture) et la **base des tâches** (lecture).
5. **Base Projets** (optionnelle) : sert de **cible aux relations « Projets »** lors de l'injection des champs
   (voir §2.3). Peut rester vide.

### 2.2 Mapping des champs

Le schéma des deux bases est chargé ; chaque champ logique propose un menu déroulant **filtré par type de propriété
compatible**, avec **auto-mapping** par nom connu (ex. « Nom », « Début session », « Fin session », « #TaskID »,
« 🎯 Projets », « Pause », « Commentaire de session », « TaskURL »…).

**Base des temps — champs obligatoires :**

| Champ logique | Type Notion | Usage |
|---|---|---|
| Nom de la session | `title` | Titre de la page session |
| Date de début | `date` | Heure de démarrage |
| Date de fin | `date` | Heure d'arrêt |

**Base des temps — champs optionnels :** TaskID (`rich_text`), Projets (`relation`), Temps de pause en minutes
(`number`), Commentaire (`rich_text`), URL application interne (`url`), Relation Tâches (`relation`).

**Base des tâches :** Titre (`title`), Projet (`rich_text`), TaskID externe (`rich_text`), URL externe (`url`),
Relation Projets (`relation`), propriété de tri, et **filtre de statuts** (voir §2.5).

### 2.3 Injection automatique des champs

Plutôt que de créer à la main, côté Notion, toutes les propriétés attendues, deux boutons créent
automatiquement les champs manquants dans chaque base :

- **⚙️ Créer les champs manquants — base Temps**
- **⚙️ Créer les champs manquants — base Tâches**

**Marche à suivre :** créer côté Notion **deux bases vides** (Temps, Tâches), les partager **en écriture** avec
l'intégration, les sélectionner ici, puis cliquer sur le bouton de chaque base.

**Aperçu avant écriture.** Un clic n'écrit rien : il affiche d'abord la liste des propriétés qui **seront créées**
(nom + type), signale les éventuels **conflits** (une propriété du même nom existe déjà mais avec un autre type —
elle est alors **laissée intacte**) et les **relations sautées** faute de base cible. L'écriture n'a lieu qu'après
**Confirmer**.

**Après création**, le schéma est rechargé et le mapping **s'auto-remplit** sur les champs fraîchement créés ; il
reste à cliquer **Enregistrer**.

**Sûr et répétable.** L'injection est **additive** : elle ne crée que ce qui manque et ne **renomme, retype ni
supprime jamais** une propriété existante. Re-cliquer quand tout est déjà en place n'a aucun effet.

**Base Projets (optionnelle).** Les champs « 🎯 Projets » sont des **relations** : elles ont besoin d'une base
cible. Sélectionner une **base Projets** existante (§2.1) pour que ces relations soient créées **dans les deux
sens** ; sans base Projets, elles sont simplement sautées (le reste est créé normalement). Le lien « Tâches » de la
base Temps pointe, lui, vers la base Tâches sélectionnée.

**Filtre de statut : à créer à la main.** L'API Notion ne permet pas de créer une propriété de type *Status*. Créer
(ou réutiliser) manuellement une propriété **Statut** dans la base Tâches, puis la mapper dans le filtre de statut
(voir §2.5). De même, la **propriété de tri** se mappe sur une propriété existante — rien à injecter.

### 2.4 Préférences

- **Commentaire obligatoire à l'arrêt** : empêche d'arrêter (ou d'enregistrer) une session sans commentaire.
- **Saisie manuelle par défaut** : le popup s'ouvre directement en mode saisie manuelle (oubli de timer).
- **Nom du bouton « application interne »** : libellé du bouton gris (défaut `CLICKUP`, max 20 car., majuscules).
- **Heures hebdomadaires** : objectif de temps par semaine (défaut 39, décimales acceptées ; **doit être > 0**).
- **Tâche congés** (optionnelle) : tâche utilisée pour marquer les congés.
- **Favoris (jusqu'à 8)** : tâches à accès rapide. Chaque ligne réunit la **tâche** Notion, un **libellé** de bouton
  personnalisable (max 20 car., facultatif — à défaut le nom de la tâche s'affiche), une **couleur** et un **picto**.
  - **Couleur** : un clic sur la pastille ouvre une palette de **10 couleurs**. Elle est volontairement fermée :
    chaque teinte est vérifiée lisible sur le fond des deux thèmes, aucun favori ne peut devenir invisible.
  - **Picto** : un clic ouvre une grille de **23 pictos**, précédés de **« aucun »** (le défaut). Le picto s'affiche
    toujours en blanc.
  - Un **nouveau favori** naît avec la première couleur libre de la palette et sans picto : le créer vite n'impose
    aucun choix. Les favoris **créés avant la v5.3.0** apparaissent en orange sans picto, soit exactement leur
    apparence d'avant.
  - Un seul panneau s'ouvre à la fois ; un clic à l'extérieur ou la touche **Échap** le referme. Comme partout
    ailleurs dans cette page, rien n'est enregistré tant que le bouton **Enregistrer** n'est pas cliqué.

Le bouton **Enregistrer** valide les champs obligatoires (Nom / Début / Fin) et l'objectif hebdo > 0, puis referme
l'onglet de configuration.

### 2.5 Filtre de statuts (base des tâches)

On peut exclure de la liste des tâches un ou plusieurs statuts (ex. tâches terminées). Plusieurs valeurs se
séparent par `;` (ex. `termine;clos`) ; le type de propriété (`status` ou `select`) est détecté automatiquement.

### 2.6 Sauvegarde & transfert de la configuration

Carte **« ⑥ Sauvegarde & transfert »**, en bas de la page de config, avec deux boutons :

- **⬇️ Exporter la config** : télécharge un fichier JSON (`notion-timer-config-AAAA-MM-JJ.json`, daté du jour)
  contenant les deux bases et leur mapping de champs, les préférences, la tâche congés et les favoris.
  **Le token Notion n'est jamais inclus dans le fichier** : sur un nouveau poste, il reste à le saisir et à le
  tester après l'import. Un message confirme l'export une fois le téléchargement lancé.
- **⬆️ Importer une config** : recharge un fichier précédemment exporté. Avant tout changement, une
  **confirmation** rappelle la **date d'export** et la **version de l'extension** dont provient le fichier, et
  précise que le **token du poste est conservé** (celui du fichier, s'il y en avait un, est ignoré). Une fois
  confirmé : la configuration est remplacée et **la page se recharge**. Sur un poste neuf, il reste alors à
  saisir le token, le tester, puis charger les bases — bases, champs, congés et favoris se **re-sélectionnent
  automatiquement** via le même chargement qu'au premier réglage (§2.1-2.4). Un fichier invalide (mauvais
  format, version plus récente que l'extension installée, bases manquantes) affiche un message d'erreur clair
  et n'écrit rien.

**Usage visé** : transférer la configuration entre postes ou navigateurs, ou en garder une sauvegarde de
sécurité — **au sein d'un même workspace Notion** (les bases et propriétés référencées dans le fichier doivent
exister côté Notion pour que le mapping soit valide après import). Ce n'est pas pensé pour partager sa config à
un tiers ni pour gérer plusieurs profils multi-workspace.

---

## 3. Écran principal — onglet Timer

Écran : **`popup.html`**, onglet **⏱️ Timer** (largeur ~700 px). Deux états mutuellement exclusifs : **repos**
et **en cours**. En-tête : bouton ⚙️ (config), titre, bouton ☀️/🌙 (thème clair/sombre, persisté).

### 3.1 État repos — sélection de tâche

- **Recherche de tâche** : filtre la liste. Au repos, seules les 20 dernières tâches modifiées sont chargées ; au
  premier caractère saisi, **toutes** les tâches sont chargées puis filtrées localement (nom + projet).
- **Liste de tâches** : affiche `Nom [Projet]`, triée d'abord par usage récent (historique local, max 20), puis par
  ordre alphabétique.
- **Boutons d'ouverture** : `🔗 CLICKUP` (libellé personnalisable) ouvre l'URL externe de la tâche ; `🔗 Notion`
  ouvre la tâche dans Notion. Ils s'activent selon la sélection et la disponibilité de l'URL.
- **▶️ Démarrer** : lance le chronomètre sur la tâche sélectionnée.

### 3.2 Démarrer un chronomètre

Au clic sur **Démarrer** : une **page session** est immédiatement créée dans la base des temps (nom, début =
maintenant, champs optionnels mappés) ; la session est persistée localement ; l'interface bascule en état en cours ;
le badge d'icône passe **🟢** ; la tâche remonte en tête de l'historique. Un garde-fou empêche le double-clic
(pas de session en double).

### 3.3 État en cours

Affiche : le **chronomètre** `HH:MM:SS` (temps écoulé moins pauses, rafraîchi chaque seconde), la **date/heure de
démarrage**, un **indicateur de pause** le cas échéant, le **nom de la tâche** (+ 🔗 vers Notion), une zone de
**commentaire de session**, et trois actions : **⏸ Pause**, **⏹ Arrêter**, **🕐 Arrêter à…**.

### 3.4 Pause / Reprise

**⏸ Pause** met en pause (badge ⏸️, compteur de pause) ; **▶️ Reprendre** cumule la durée de pause et repasse en 🟢.
Au-delà de **1 h de pause cumulée**, la reprise est bloquée par un avertissement. Le total de pause (en minutes) est
déduit du temps travaillé et enregistré si le champ Pause est mappé.

### 3.5 Arrêter

Au clic sur **⏹ Arrêter** : si l'option « commentaire obligatoire » est active et le commentaire vide → blocage. La
page session est mise à jour (fin = maintenant, commentaire, minutes de pause), la session locale est effacée, le
badge retiré, les récents rechargés. En cas d'échec réseau, la session est **conservée** pour permettre un nouvel essai.

### 3.6 Arrêter à une heure précise

Bouton **🕐 Arrêter à…** → **modale** avec Heure / Minute / Date. La **durée réelle** (fin choisie − début −
pauses) s'affiche en direct ; une heure d'arrêt antérieure au début est refusée (bouton désactivé). Utile quand on
a oublié d'arrêter en partant.

### 3.7 Saisie manuelle (session oubliée)

Case **« Saisie manuelle (oubli de timer) »** en haut de l'état repos (ou active par défaut si l'option de config
l'exige). Quand active : affiche **Début** / **Fin** (préremplis à « il y a 1 h » → « maintenant », arrondis à
5 min) et **Commentaire** ; le bouton principal devient **💾 Enregistrer** ; les sections **congés** et **favoris**
apparaissent. À l'enregistrement : validation (début & fin présents, fin > début, commentaire si obligatoire),
création puis clôture de la page en une passe (sans chronomètre), reset du formulaire et **toast de confirmation**.

### 3.8 Mode congés

Case **« Marquer comme congés »** (en saisie manuelle) : vérifie qu'une tâche congés est configurée (sinon alerte et
se décoche), sélectionne cette tâche et préremplit le commentaire « En congés » (modifiable).

### 3.9 Favoris (enregistrement rapide)

Section **« ⭐ Enregistrement rapide »** (visible en mode saisie manuelle s'il existe des favoris) : jusqu'à **8**
boutons (affichés en 4×2). Un clic **enregistre directement** une session sur la tâche du favori, avec la période
saisie (début/fin/commentaire). Pendant l'appel Notion, tous les boutons se **gèlent** et le bouton cliqué affiche
**« ⏳ … »** (son picto reste visible) ; un **toast « ✅ Ligne créée dans Notion »** confirme la création.

Chaque bouton porte l'identité choisie en configuration (§2.4) : un **liseret de 4 px** à gauche dans la couleur du
favori, son **picto** en blanc, puis son libellé. Le libellé est celui saisi en configuration ou, à défaut, le **nom
de la tâche Notion** ; s'il est trop long, il se termine par `…` et le texte entier apparaît en **infobulle**. Les
couleurs s'adaptent au thème : chaque teinte a une version claire et une version sombre, et le liseret suit la
bascule ☀️/🌙 sans rechargement.

### 3.10 Sessions récentes

En bas de l'onglet Timer : bloc regroupant les sessions par **📅 Aujourd'hui** et **📅 Hier**, avec un **total par
jour**. Chaque ligne : nom de tâche (tronqué), plage horaire `10:00 → 11:00`, durée, et 🔗 pour ouvrir dans Notion.

---

## 4. Onglet Stats

Écran : **`popup.html`**, onglet **📊 Stats**. Donne une vue d'ensemble du temps travaillé sur une période
choisie : objectif hebdomadaire, rythme quotidien, répartition par projet. Chargé **au premier affichage** de
l'onglet (pas au démarrage du popup), pour ne pas ralentir l'ouverture sur l'onglet Timer.

### 4.1 Choix de la période

Quatre modes, en haut de l'onglet : **Jour**, **Semaine** (par défaut, Lundi → Dimanche), **Mois** (calendaire) et
**Perso** (plage libre avec deux sélecteurs de date « du … au … » + bouton **OK**, qui **n'apparaissent qu'en mode
Perso**). Le libellé de la plage
affichée (ex. « 14 juil. – 20 juil. » ou « juillet 2026 ») s'affiche au centre, encadré de deux flèches
**‹ précédent** / **suivant ›** qui décalent la période d'un jour, d'une semaine ou d'un mois (désactivées en
mode Perso, qui se navigue via les sélecteurs de date).

### 4.2 Carte objectif

Un **anneau de progression** affiche le temps travaillé sur la période au centre, avec l'objectif en sous-texte
(ou « sans objectif » si aucun objectif ne s'applique). À côté, le détail : **Objectif**, **Travaillé**,
**Reste** (temps restant pour atteindre l'objectif, 0 si dépassé), et un badge **🌴 N j** si des jours de congé
ont été pris sur la période (rien si aucun).

### 4.3 Rythme quotidien

Une barre par jour de la période, hauteur proportionnelle au temps travaillé ce jour-là (le jour le plus chargé
sert de référence à 100 %). Un jour de congé s'affiche en **doré** avec l'icône 🌴 ; un jour sans aucune session
s'affiche en **gris**, vide. Chaque barre porte la durée du jour (ou l'icône congés) au-dessus, et l'initiale du
jour de la semaine (ou le quantième en mode Mois) en dessous.

### 4.4 Bilan par projet

Liste des projets ayant une session sur la période, triée par temps décroissant : nom du projet, barre de
proportion, durée et **pourcentage** du temps total travaillé sur la période. Les sessions de congés ne comptent
pas dans ce bilan (ni dans le temps travaillé, ni dans un projet).

### 4.5 Prise en compte des congés

Un jour est compté « congé » si sa session est liée à la **tâche congés** configurée (relation, ou repli sur le
nom de la tâche si la relation n'est pas mappée). L'objectif de la période est **ajusté** en conséquence :

> Objectif = (jours ouvrés de la période − jours de congé) × (heures hebdomadaires / 5)

Une **semaine ouvrée** compte 5 jours (Lundi → Vendredi) ; les jours de week-end (samedi, dimanche) ne comptent
ni dans les jours ouvrés ni dans l'objectif.

### 4.6 Période sans donnée

Si aucune session ne tombe dans la période choisie (et aucun congé), l'onglet affiche simplement
**« Aucune session sur cette période. »** à la place des cartes.

---

## 5. Notifications & badge (arrière-plan)

Gérées par le service worker via `chrome.alarms` (vérification chaque minute), indépendamment de l'ouverture du popup.

| Notification | Déclencheur | Contenu |
|---|---|---|
| **⏰ Timer long** | Session active depuis ≥ 3 h (rappel toutes les 3 h) | « Vous travaillez sur X depuis N h » |
| **🏁 Fin de journée** | Il est 17 h 45 et un timer tourne | Boutons « Arrêter maintenant » / « Continuer » |
| **🎯 Objectif quotidien** | Temps travaillé du jour ≥ 8 h | « Vous avez travaillé N h aujourd'hui. Bravo ! » (une fois/jour) |

**Badge d'icône** : 🟢 (actif), ⏸️ (en pause), vide (arrêté). Un clic sur une notification ouvre le popup. Le cumul
quotidien est calculé à partir de la **base des temps configurée** (aucun identifiant en dur).

---

## 6. Parcours utilisateur type

```
Premier usage
  └─ Popup → pas de config → ouverture de la page de config (onglet)
       └─ Token → Tester → (bases chargées) → choisir Temps + Tâches → Mapper → Préférences → Enregistrer
            └─ Retour popup, prêt à pointer

Journée type
  ├─ Ouvrir popup → chercher/choisir une tâche → ▶️ Démarrer
  ├─ (travail…)  badge 🟢, notifications éventuelles
  ├─ Pause déjeuner → ⏸ Pause … ▶️ Reprendre
  ├─ Fin de tâche → commentaire → ⏹ Arrêter (ou 🕐 Arrêter à…)
  └─ Oubli de la veille → Saisie manuelle → début/fin → 💾 Enregistrer (ou clic favori)
```
