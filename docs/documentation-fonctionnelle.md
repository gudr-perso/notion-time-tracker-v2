# Documentation fonctionnelle — Notion Time Tracker

Ce document décrit **ce que fait** l'application, du point de vue de l'utilisateur, fonctionnalité
par fonctionnalité. Il ne contient pas de code ; pour l'implémentation, voir
[`documentation-technique.md`](documentation-technique.md).

---

## 1. Vue d'ensemble et concepts

### 1.1 À quoi sert l'extension

L'extension est un **pointeur de temps de travail**. Un salarié / consultant lance un chronomètre
quand il commence à travailler sur une tâche, l'arrête quand il a fini, et la session (tâche, heure
de début, heure de fin, commentaire, pauses) est **écrite automatiquement dans une base Notion**.

Elle permet aussi de **saisir a posteriori** des sessions oubliées et de **visualiser des
statistiques** de temps.

### 1.2 Les deux bases Notion

L'extension manipule **deux** bases de données Notion distinctes :

| Base | Rôle | Sens |
|------|------|------|
| **Base « Tâches »** (nommée « GDR Work » dans l'instance d'origine) | Liste des tâches sur lesquelles on peut pointer. | **Lecture** |
| **Base « Temps saisis »** (nommée « Time ») | Reçoit un enregistrement par session de travail. | **Lecture + écriture** |

L'utilisateur choisit une tâche dans la base « Tâches », l'extension crée alors une page dans la
base « Temps saisis », liée à cette tâche.

### 1.3 Notions clés

- **Session** : une période de travail (début → fin) sur une tâche = une page dans la base « Temps saisis ».
- **Session en cours** : un chronomètre actif (ou en pause), persisté localement.
- **Mapping** : correspondance entre les « champs logiques » de l'extension (nom, début, fin, pause…)
  et les propriétés réelles de la base Notion de l'utilisateur.
- **Favori** : raccourci vers une tâche fréquemment utilisée.
- **Congés** : une tâche dédiée sert à enregistrer les jours de congés, décomptés de l'objectif.

---

## 2. Configuration initiale (assistant)

Écran : **`config.html`**. Voir maquette dans [`design-ecrans.md`](design-ecrans.md#config).

L'assistant se déclenche automatiquement au premier lancement (ou tant que la configuration est
incomplète), et est ré-accessible à tout moment via le bouton ⚙️ du popup.

### 2.1 Étape 1 — Connexion & choix des bases

1. **Saisie du token Notion** : l'utilisateur crée une intégration interne sur
   `notion.so/my-integrations` et colle son token (`secret_…` / `ntn_…`).
2. **Test de connexion** : bouton « 🔗 Tester la connexion ». En cas de succès, affiche le nom de
   l'utilisateur connecté et déverrouille la suite.
3. **Chargement des bases** : bouton « 🔄 Charger mes bases de données » liste toutes les bases
   partagées avec l'intégration.
4. **Double sélection** : la même liste est affichée deux fois :
   - **« Base des temps saisis »** → où seront écrites les sessions.
   - **« Base des tâches »** → d'où seront lues les tâches (ex. GDR Work).
5. Une fois les **deux** bases sélectionnées, le bouton « ➡️ Configurer les champs » apparaît.

### 2.2 Étape 2 — Mapping des champs & préférences

L'extension charge le **schéma** (propriétés) de la base « Temps saisis » et propose, pour chaque
champ logique, un menu déroulant filtré par type de propriété compatible.

**Champs obligatoires :**

| Champ logique | Type Notion attendu | Usage |
|---------------|--------------------|-------|
| 📝 Nom de la session | `title` | Titre de la page session |
| 🕐 Date de début | `date` | Heure de démarrage |
| 🕑 Date de fin | `date` | Heure d'arrêt |

**Champs optionnels :**

| Champ logique | Type Notion | Usage |
|---------------|-------------|-------|
| 🔢 TaskID | `rich_text` | Identifiant externe de la tâche |
| 🎯 Projets | `relation` | Relation vers les projets liés |
| ⏸️ Temps de pause (min) | `number` | Minutes de pause cumulées |
| 💬 Commentaire | `rich_text` | Description libre |
| 🔗 URL application interne | `url` | Lien externe (ClickUp, Jira…) |
| 🔗 Relation Tâches | `relation` | Relation vers la base « Tâches » |

> **Auto-mapping** : l'assistant pré-sélectionne automatiquement les champs dont le nom
> correspond à une liste de noms connus (ex. « Nom », « Début session », « Fin session »,
> « #TaskID », « 🎯 Projets », « Pause », « Commentaire de session », « TaskURL »…).

**Préférences (dans la même étape) :**

- **Commentaire obligatoire à l'arrêt** (case à cocher) : empêche d'arrêter un timer sans commentaire.
- **Nom du bouton « Application interne »** : libellé du bouton gris (par défaut `CLICKUP`, max 20 car., forcé en majuscules).
- **Heures hebdomadaires** : objectif de temps par semaine (défaut 39, décimales acceptées, ex. 37.5).
- **Tâche congés (obligatoire)** : tâche de la base « Tâches » utilisée pour marquer les congés.
- **Favoris (jusqu'à 6)** : liste de tâches à accès rapide, chacune avec un libellé de bouton personnalisable (max 20 car.).

Le bouton « ✅ Enregistrer et démarrer » valide (champs obligatoires + heures > 0 + tâche congés
choisie) puis redirige vers le popup principal.

---

## 3. Écran principal — onglet Timer

Écran : **`popup.html`**, onglet **⏱️ Timer**. Deux états mutuellement exclusifs : **repos (idle)**
et **en cours (running)**.

### 3.1 État repos — sélection de tâche

- **Recherche de tâche** : champ texte qui filtre la liste. Au premier caractère saisi, l'extension
  charge **toutes** les tâches (au repos, seules les 20 dernières modifiées sont chargées pour la
  performance) puis filtre localement sur le nom et le projet.
- **Liste de tâches** (`select` multi-lignes) : affiche `Nom [Projet]`. Les tâches sont **triées** :
  d'abord les tâches récemment utilisées (historique local, max 20), puis les autres par ordre alphabétique.
- **Boutons d'ouverture** :
  - `🔗 CLICKUP` (libellé personnalisable) : ouvre l'URL externe de la tâche sélectionnée.
  - `🔗 Notion` : ouvre la tâche dans Notion.
  - Ces boutons se (dés)activent selon la sélection et la disponibilité de l'URL.
- **▶️ Démarrer** : lance le chronomètre sur la tâche sélectionnée.

### 3.2 Démarrer un chronomètre

Au clic sur **Démarrer** :

1. Une **page session** est immédiatement créée dans la base « Temps saisis » avec le nom de la tâche,
   la date de début (= maintenant), et les champs optionnels mappés (relation tâche, projets, TaskID, URL).
2. La session est persistée localement (`currentSession`).
3. L'interface bascule en **état en cours**.
4. Le service worker affiche un **badge 🟢** sur l'icône.
5. La tâche est ajoutée en tête de l'historique local.

### 3.3 État en cours

Affiche :

- **Chronomètre** `HH:MM:SS` (temps écoulé **moins** le temps de pause), rafraîchi chaque seconde.
- **Date/heure de démarrage** (« Démarré le lundi 06/07/2026 à 09:15 »).
- **Indicateur de pause** (si en pause) : durée de la pause en cours.
- **Nom de la tâche** en cours + bouton 🔗 pour l'ouvrir dans Notion.
- **Commentaire de session** : zone de texte libre.
- Trois boutons d'action : **⏸️ Pause**, **⏹️ Arrêter**, **⏱️ Arrêter à…**.

### 3.4 Pause / Reprise

- **⏸️ Pause** : met le timer en pause, démarre un compteur de pause, badge ⏸️.
- **▶️ Reprendre** : reprend le timer, cumule la durée de pause dans `totalPauseDuration`, badge 🟢.
- **Limite** : au-delà de **1 h de pause cumulée**, un message d'avertissement bloque la reprise.
- Le temps de pause total est déduit du temps travaillé et enregistré (en minutes) dans le champ
  « Pause » de la session si celui-ci est mappé.

### 3.5 Arrêter

Au clic sur **⏹️ Arrêter** :

1. Si l'option « commentaire obligatoire » est active et le commentaire vide → blocage + focus.
2. La page session est mise à jour dans Notion : date de fin (= maintenant), commentaire, minutes de pause.
3. La session locale est effacée, le badge retiré, l'historique récent rechargé.

### 3.6 Arrêter à une heure précise

Bouton **⏱️ Arrêter à…** → ouvre une **modale** :

- Champs **Heure** (0-23), **Minute** (0-59), **Date**.
- Affiche en temps réel la **durée réelle** calculée (fin choisie − début − pauses).
- Contrôles : refuse une heure d'arrêt antérieure au début (message d'erreur, bouton désactivé).
- Bouton « ✅ Arrêter à cette heure » : enregistre la fin à l'horaire choisi (utile quand on a
  oublié d'arrêter en partant).

### 3.7 Saisie manuelle (session oubliée)

Case à cocher **« Saisie manuelle (oubli de timer) »** en haut de l'état repos. Quand active :

- Affiche les champs **Début**, **Fin** (`datetime-local`, pas de 5 min), **Commentaire**.
- Pré-remplit Début = il y a 1 h (arrondi 5 min), Fin = maintenant (arrondi 5 min).
- Le bouton principal devient **💾 Enregistrer** (au lieu de Démarrer).
- Affiche la section **congés** et la section **favoris** (voir ci-dessous).

Au clic sur Enregistrer : validation (début & fin présents, fin > début), création + mise à jour de
la page session en une fois (pas de chronomètre), puis reset du formulaire.

### 3.8 Mode congés

Case à cocher **« 🏖️ Marquer comme congés »** (visible en saisie manuelle). Quand active :

- Vérifie qu'une tâche congés est configurée (sinon alerte + décoche).
- Pré-remplit le commentaire avec « En congés » (modifiable).
- Sélectionne automatiquement la tâche congés configurée.

Les sessions congés sont **décomptées de l'objectif** et affichées séparément dans les stats.

### 3.9 Favoris (enregistrement rapide)

Section **« ⭐ Enregistrement rapide »** (visible uniquement en mode saisie manuelle, s'il existe des favoris).

- Un bouton par favori configuré, affichant son libellé personnalisé (ou le nom de la tâche tronqué).
- **En mode saisie manuelle** : un clic enregistre **directement** une session avec la période saisie
  (début/fin/commentaire) sur la tâche du favori.
- (Hors mode manuel, historiquement, un clic sélectionne simplement la tâche dans la liste.)

### 3.10 Sessions récentes

En bas de l'onglet Timer, bloc **« Sessions récentes »** :

- Regroupe les sessions par **📅 Aujourd'hui** et **📅 Hier**, avec un **total par jour**.
- Chaque ligne : nom de tâche (tronqué à 70 car.), plage horaire `10:00 → 11:00`, durée, et icône 🔗
  pour ouvrir la session dans Notion.

---

## 4. Écran principal — onglet Stats

Écran : **`popup.html`**, onglet **📊 Stats**. Voir maquette [`design-ecrans.md`](design-ecrans.md#stats).

### 4.1 Sélecteur de période

Menu déroulant : **Aujourd'hui**, **Cette semaine** (défaut), **Semaine précédente**, **Ce mois**,
**Personnalisé** (deux dates + OK). Bouton **🔄** pour forcer l'actualisation (ignore le cache de 5 min).

### 4.2 Indicateurs principaux (cartes)

- **⏱️ Total** : temps total sur la période.
- **📅 Moyenne/jour** : total ÷ nombre de jours de la période.
- **⏸️ Pauses** : minutes de pause cumulées.
- Si congés sur la période : bloc supplémentaire affichant **🏖️ Congés** et **temps de travail effectif**.

### 4.3 Objectif & barre de progression

- **Objectif** selon période : 8 h/jour (aujourd'hui), heures hebdo paramétrées (semaine), ou approximation
  jours ouvrés × 8 h (mois / personnalisé).
- L'objectif est **ajusté** en déduisant le temps de congés.
- **Barre de progression** colorée selon l'avancement : rouge (<50 %), orange (<75 %), bleu (<100 %), vert (≥100 %).
- Détail `HH:MM / objectif`, avec mention **« (dont X h hors période) »** si du temps a été saisi
  hors 9 h-18 h en semaine ou le week-end.

### 4.4 Répartition par projet

Liste triée par temps décroissant. Le **projet** est extrait des `[crochets]` dans le nom de la
session (ou « Sans projet », ou « 🏖️ Congés »). Chaque ligne : nom, durée, pourcentage, mini-barre.

### 4.5 Répartition par jour

Liste des jours de la période avec le temps travaillé par jour (libellé « lundi 06/07/2026 »).

---

## 5. Notifications & badge (arrière-plan)

Gérées par le service worker, indépendamment de l'ouverture du popup.

| Notification | Déclencheur | Contenu |
|--------------|-------------|---------|
| **⏰ Timer long** | Session active depuis ≥ 3 h (rappel toutes les 3 h) | « Vous travaillez sur X depuis HH:MM » |
| **🏁 Fin de journée** | Il est 17 h 45 et un timer tourne | Boutons « Arrêter maintenant » / « Continuer » |
| **🎯 Objectif quotidien** | Temps travaillé du jour ≥ 8 h | « Vous avez travaillé HH:MM aujourd'hui. Bravo ! » (une fois/jour) |

**Badge d'icône** : 🟢 (actif), ⏸️ (en pause), vide (arrêté). Un clic sur une notification ouvre le popup.

> ⚠️ Le calcul de l'objectif quotidien dans le service worker interroge un **ID de base codé en
> dur** — voir la dette technique dans [`specification-v2.md`](specification-v2.md).

---

## 6. Parcours utilisateur type

```
Premier usage
  └─ Popup s'ouvre → pas de config → redirection vers l'assistant
       └─ Token → Test → Charger bases → choisir Temps + Tâches → Mapper → Préférences → Enregistrer
            └─ Retour popup, prêt à pointer

Journée type
  ├─ Ouvrir popup → chercher/choisir une tâche → ▶️ Démarrer
  ├─ (travail…)  badge 🟢, notifications éventuelles
  ├─ Pause déjeuner → ⏸️ Pause … ▶️ Reprendre
  ├─ Fin de tâche → écrire commentaire → ⏹️ Arrêter (ou ⏱️ Arrêter à…)
  └─ Oubli de la veille → Saisie manuelle → début/fin → 💾 Enregistrer (ou favori)

Suivi
  └─ Onglet 📊 Stats → choisir période → lire objectif, projets, jours
```
