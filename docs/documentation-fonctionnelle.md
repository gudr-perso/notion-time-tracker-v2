# Documentation fonctionnelle — Notion Time Tracker

Version : `5.0.1`. Le **D-fonctionnel** du principe D² : décrit **ce que fait** l'application, du point de vue de
l'utilisateur, fonctionnalité par fonctionnalité. Aucun code ; pour l'implémentation, voir
[`documentation-technique.md`](documentation-technique.md).

---

## 1. Vue d'ensemble et concepts

### 1.1 À quoi sert l'extension

L'extension est un **pointeur de temps de travail**. On lance un chronomètre en commençant à travailler sur une
tâche, on l'arrête en ayant fini, et la session (tâche, début, fin, commentaire, pauses) est **écrite
automatiquement dans une base Notion**. On peut aussi **saisir a posteriori** une session oubliée.

> Un onglet **Stats** est prévu mais **non encore livré** en v5.0.1 (voir §4).

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
Relation Projets (`relation`), propriété de tri, et **filtre de statuts** (voir §2.4).

### 2.3 Préférences

- **Commentaire obligatoire à l'arrêt** : empêche d'arrêter (ou d'enregistrer) une session sans commentaire.
- **Saisie manuelle par défaut** : le popup s'ouvre directement en mode saisie manuelle (oubli de timer).
- **Nom du bouton « application interne »** : libellé du bouton gris (défaut `CLICKUP`, max 20 car., majuscules).
- **Heures hebdomadaires** : objectif de temps par semaine (défaut 39, décimales acceptées ; **doit être > 0**).
- **Tâche congés** (optionnelle) : tâche utilisée pour marquer les congés.
- **Favoris (jusqu'à 8)** : tâches à accès rapide, chacune avec un libellé de bouton personnalisable (max 20 car.).

Le bouton **Enregistrer** valide les champs obligatoires (Nom / Début / Fin) et l'objectif hebdo > 0, puis referme
l'onglet de configuration.

### 2.4 Filtre de statuts (base des tâches)

On peut exclure de la liste des tâches un ou plusieurs statuts (ex. tâches terminées). Plusieurs valeurs se
séparent par `;` (ex. `termine;clos`) ; le type de propriété (`status` ou `select`) est détecté automatiquement.

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
boutons (affichés en 4×2), chacun avec son libellé. Un clic **enregistre directement** une session sur la tâche du
favori, avec la période saisie (début/fin/commentaire). Pendant l'appel Notion, tous les boutons se **gèlent** et le
bouton cliqué affiche **« ⏳ … »** ; un **toast « ✅ Ligne créée dans Notion »** confirme la création.

### 3.10 Sessions récentes

En bas de l'onglet Timer : bloc regroupant les sessions par **📅 Aujourd'hui** et **📅 Hier**, avec un **total par
jour**. Chaque ligne : nom de tâche (tronqué), plage horaire `10:00 → 11:00`, durée, et 🔗 pour ouvrir dans Notion.

---

## 4. Onglet Stats — **reporté** (non livré en v5.0.1)

L'onglet **📊 Stats** existe dans l'interface mais affiche seulement un **placeholder « Bientôt »**. Les
statistiques (totaux par période, objectif et progression, répartition par projet et par jour, prise en compte des
congés) sont **prévues** mais **non implémentées** à ce stade. Cette brique mérite un cadrage dédié (voir
`AVANCEMENT.md`).

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
