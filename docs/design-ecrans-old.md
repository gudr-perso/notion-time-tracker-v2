# Design des écrans — Notion Time Tracker

Ce document présente les **maquettes (wireframes)** de tous les écrans et états, ainsi que la
**charte graphique**. Les maquettes sont en ASCII pour rester portables et versionnables ; les
dimensions et couleurs réelles sont indiquées à côté.

---

## 1. Charte graphique

### 1.1 Dimensions

- **Popup** : `700 × 600 px` (largeur inhabituellement grande pour un popup d'extension).
- **Assistant** (`config.html`) : pleine page onglet.

### 1.2 Palette de couleurs

Se réfèrer aux images

### 1.3 Barre de progression (stats) — couleurs par avancement

| Avancement | Couleur |
|-----------|---------|
| ≥ 100 % | vert `#10b981 → #059669` |
| ≥ 75 % | bleu `#3b82f6 → #2563eb` |
| ≥ 50 % | orange `#f59e0b → #d97706` |
| < 50 % | rouge `#ef4444 → #dc2626` |

### 1.4 Typographie & style

- Police système : `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto…`.
- Titres de boutons en **MAJUSCULES**, `letter-spacing: 0.5px`.
- Coins arrondis `8px`, ombres douces, transitions `0.3s`, effet `translateY(-2px)` au survol des boutons.
- Emojis utilisés comme icônes fonctionnelles (⏱️ 📊 ▶️ ⏸️ ⏹️ 🔗 ⭐ 🏖️ 🎯).

---

## 2. Écran — Configuration légère (première ouverture du popup) {#config-light}

Bloc affiché dans `popup.html` si aucun token (rarement vu, car `popup-init.js` redirige plutôt vers
l'assistant complet).

```
┌────────────────────────────────────────┐   700 px
│  ▓▓▓▓▓▓  ⏱️ Time Tracker  ▓▓▓▓▓▓        │  header dégradé violet
├────────────────────────────────────────┤
│                                        │
│  Token d'intégration Notion :          │
│  ┌──────────────────────────────────┐  │
│  │ secret_••••••••••••••••••••••     │  │  input password
│  └──────────────────────────────────┘  │
│  Créer une intégration sur             │
│  notion.so/my-integrations             │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │           ENREGISTRER            │  │  bouton violet
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

---

## 3. Écran — Assistant de configuration {#config}

### 3.1 Étape 1 — Connexion & bases

```
┌──────────────────────────────────────────────────────────┐
│  ▓▓▓▓  ⚙️ Configuration  ▓▓▓▓  (dégradé bleu nuit→bleu)    │
│  Connectez-vous à Notion et choisissez votre base         │
├──────────────────────────────────────────────────────────┤
│  🔐 Token Notion                                          │
│  Créez une intégration interne sur notion.so/…            │
│  ┌────────────────────────────────┐ ┌──────────────────┐ │
│  │ secret_••••••••••••            │ │ 🔗 Tester conn.  │ │
│  └────────────────────────────────┘ └──────────────────┘ │
│  ✅ Connecté en tant que Guillaume                        │
│ ───────────────────────────────────────────────────────  │
│  📊 Bases de données                                      │
│  ┌──────────────────────────────────────┐                │
│  │ 🔄 Charger mes bases de données      │                │
│  └──────────────────────────────────────┘                │
│                                                          │
│  Base des temps saisis                                    │
│  ┌────────────────┐ ┌────────────────┐                   │
│  │ 📊 Time        │ │ 📊 GDR Work    │  ← cartes cliquab. │
│  │ ID: 1fad…      │ │ ID: 2ab…       │    (sélection = ✓) │
│  └────────────────┘ └────────────────┘                   │
│  Base des tâches                                          │
│  ┌────────────────┐ ┌────────────────┐                   │
│  │ 📊 Time        │ │ 📊 GDR Work ✓  │                   │
│  └────────────────┘ └────────────────┘                   │
│                                                          │
│           ┌─────────────────────────────┐                │
│           │ ➡️ Configurer les champs    │ (si 2 bases OK) │
│           └─────────────────────────────┘                │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Étape 2 — Mapping & préférences

```
┌──────────────────────────────────────────────────────────┐
│  🗺️ Mapping des champs                                    │
│  Base sélectionnée : Time                                 │
│ ───────────────────────────────────────────────────────  │
│  Champs obligatoires                                      │
│  📝 Nom de la session *      [ Nom (title)          ▼]    │
│  🕐 Date de début *          [ Début session (date) ▼]    │
│  🕑 Date de fin *            [ Fin session (date)   ▼]    │
│ ───────────────────────────────────────────────────────  │
│  Champs optionnels                                        │
│  🔢 TaskID                   [ #TaskID (rich_text)  ▼]    │
│  🎯 Projets                  [ 🎯 Projets (relation)▼]    │
│  ⏸️ Temps de pause (min)     [ Pause (number)       ▼]    │
│  💬 Commentaire              [ Commentaire (r_text) ▼]    │
│  🔗 URL application interne  [ TaskURL (url)        ▼]    │
│  🔗 Relation Tâches          [ Tâches (relation)    ▼]    │
│ ───────────────────────────────────────────────────────  │
│  ⚙️ Préférences                                           │
│  ☐ Rendre le commentaire obligatoire à l'arrêt            │
│  🔗 Nom du bouton : [ CLICKUP                    ]        │
│  ⏰ Heures/semaine : [ 39 ]                               │
│  🏖️ Tâche congés :  [ -- Sélectionner --         ▼]      │
│  ⭐ Favoris (max 6) :                                     │
│     ┌────────────────────────────────────────────┐       │
│     │ ⭐ [ Tâche…      ▼]  Nom bouton:[ Mails ] ❌ │       │
│     └────────────────────────────────────────────┘       │
│     [ ➕ Ajouter un favori (1/5) ]                        │
│ ───────────────────────────────────────────────────────  │
│  [ ⬅️ Retour ]            [ ✅ Enregistrer et démarrer ]  │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Écran principal — Onglet Timer

### 4.1 État repos (idle)

```
┌────────────────────────────────────────┐              ⚙️
│  ▓▓▓▓▓  ⏱️ Time Tracker  ▓▓▓▓▓         │  (bouton reconfig
├────────────────────────────────────────┤   flottant en haut
│  [ ⏱️ Timer ]  [ 📊 Stats ]            │   à droite)
├────────────────────────────────────────┤
│  ☐ Saisie manuelle (oubli de timer)    │
│                                        │
│  Rechercher une tâche :                │
│  ┌──────────────────────────────────┐  │
│  │ Tapez pour filtrer…              │  │
│  └──────────────────────────────────┘  │
│  Tâche GDR Work :                      │
│  ┌──────────────────────────────────┐  │
│  │ Refonte API [Projet X]           │  │  select
│  │ Support client [Run]             │  │  size=5
│  │ Réunion équipe [Interne]         │  │
│  │ …                                │  │
│  └──────────────────────────────────┘  │
│  ┌────────┐┌────────┐┌──────────────┐  │
│  │🔗CLICKUP││🔗Notion││  ▶️ DÉMARRER │  │
│  └────────┘└────────┘└──────────────┘  │
│ ────────────────────────────────────── │
│  Sessions récentes                     │
│  📅 Aujourd'hui : 04:30                │
│  ┌──────────────────────────────────┐  │
│  │ Refonte API [Projet X]     🔗    │  │
│  │ 09:00 → 11:00          02:00:00  │  │
│  └──────────────────────────────────┘  │
│  📅 Hier : 07:15                       │
│  …                                     │
└────────────────────────────────────────┘
```

### 4.2 État repos — saisie manuelle activée

```
│  ☑ Saisie manuelle (oubli de timer)    │
│  Début : [ 2026-07-06T08:00      ]     │
│  Fin :   [ 2026-07-06T09:00      ]     │
│  Commentaire : [ ................. ]   │
│  ┌───────── fond orange ────────────┐  │
│  │ ☐ 🏖️ Marquer comme congés        │  │
│  └──────────────────────────────────┘  │
│  ⭐ Enregistrement rapide :            │
│  [⭐ Mails] [⭐ Support] [⭐ Réunion]  │
│  … (recherche + select identiques)     │
│  bouton principal → 💾 ENREGISTRER     │
```

### 4.3 État en cours (running)

```
┌────────────────────────────────────────┐
│  ▓▓▓▓▓  ⏱️ Time Tracker  ▓▓▓▓▓         │
│  [ ⏱️ Timer ]  [ 📊 Stats ]            │
├────────────────────────────────────────┤
│      ┌──── dégradé violet ─────┐       │
│      │   Temps écoulé          │       │
│      │      02:14:37           │       │  chrono géant
│      │ 🕐 Démarré lundi 06/07  │       │
│      │      à 09:15            │       │
│      │ ⏸️ En pause : 00:03:12  │       │  (si pause)
│      └─────────────────────────┘       │
│  ┌──────────────────────────────────┐  │
│  │ Refonte API [Projet X]      🔗   │  │
│  │ Session en cours                 │  │
│  └──────────────────────────────────┘  │
│  Commentaire de session :              │
│  ┌──────────────────────────────────┐  │
│  │ Décris ce que tu as fait…        │  │
│  └──────────────────────────────────┘  │
│  ┌─────────┐┌─────────┐┌────────────┐  │
│  │⏸️ Pause ││⏹️Arrêter││⏱️Arrêter à…│  │
│  └─────────┘└─────────┘└────────────┘  │
└────────────────────────────────────────┘
```

### 4.4 Modale « Arrêter à… »

```
      ╔══════════════════════════════════╗
      ║  🕐 Arrêter la session à :        ║
      ║                                  ║
      ║  Heure : [12] : [00]             ║
      ║  Date :  [ 2026-07-06 ]          ║
      ║                                  ║
      ║  ⏱️ Durée réelle : 02:45:00      ║
      ║                                  ║
      ║  [ ❌ Annuler ] [ ✅ Arrêter ]   ║
      ╚══════════════════════════════════╝
        (overlay sombre, clic extérieur = fermer)
```

---

## 5. Écran principal — Onglet Stats {#stats}

```
┌────────────────────────────────────────┐
│  [ ⏱️ Timer ]  [ 📊 Stats ]            │
├────────────────────────────────────────┤
│  Période : [ Cette semaine  ▼]  [🔄]   │
│  (si Personnalisé : [date]→[date] [OK])│
│ ────────────────────────────────────── │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │⏱️ Total│ │📅 Moy. │ │⏸️Pauses│      │
│  │32:15:00│ │06:27:00│ │ 45 min │      │
│  └────────┘ └────────┘ └────────┘      │
│  ┌── (si congés) ──────────────────┐   │
│  │ 🏖️ Congés            07:00:00   │   │
│  │ Temps travail effectif 25:15:00 │   │
│  └─────────────────────────────────┘   │
│ ────────────────────────────────────── │
│  🎯 Objectif : 39h            82%      │
│  ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇░░░░  (barre color) │
│  32:15 / 39h (dont 2:30 hors période)  │
│ ────────────────────────────────────── │
│  Répartition par projet                │
│  Projet X      12:00:00  (37%)         │
│  ▇▇▇▇▇▇▇░░░░░░░░░░░░░                  │
│  Run           08:30:00  (26%)         │
│  ▇▇▇▇▇░░░░░░░░░░░░░░░                  │
│  …                                     │
│ ────────────────────────────────────── │
│  Répartition par jour                  │
│  lundi 06/07/2026        08:00:00      │
│  mardi 07/07/2026        07:15:00      │
│  …                                     │
└────────────────────────────────────────┘
```

---

## 6. États du badge (icône de l'extension)

```
  ┌────┐        ┌────┐        ┌────┐
  │ ⏱️ │🟢      │ ⏱️ │⏸️      │ ⏱️ │
  └────┘        └────┘        └────┘
  Actif         En pause       Arrêté
  (vert)        (orange)       (vide)
```

---

## 7. Notifications système

```
┌─────────────────────────────────────────┐
│ [icon] ⏰ Timer en cours depuis longtemps │
│ Vous travaillez sur "Refonte API"         │
│ depuis 03:12                              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ [icon] 🏁 Fin de journée - Timer actif    │
│ Timer sur "Refonte API" depuis 08:30.     │
│ N'oubliez pas d'arrêter !                 │
│ [ Arrêter maintenant ]  [ Continuer ]     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ [icon] 🎯 Objectif quotidien atteint !    │
│ Vous avez travaillé 08:03 aujourd'hui.    │
│ Bravo ! 🎉                                │
└─────────────────────────────────────────┘
```

---

## 8. Arborescence des états d'interface

```
popup.html
├── #config-section        (si pas de token — cf. §2)
└── #tracker-section       (si configuré)
    ├── .tabs  [Timer | Stats]
    ├── #timer-tab
    │   ├── #idle-state
    │   │   ├── mode-toggle (saisie manuelle)
    │   │   ├── #manual-fields (début/fin/comment/congés/favoris)
    │   │   ├── recherche + #project-select
    │   │   ├── boutons ClickUp / Notion / Démarrer
    │   │   └── .recent-sessions
    │   ├── #running-state
    │   │   ├── .timer-display (chrono + pause)
    │   │   ├── .current-task
    │   │   ├── #session-comment
    │   │   └── Pause / Arrêter / Arrêter à…
    │   └── #stop-at-modal
    └── #stats-tab
        ├── .period-selector (+ #custom-period)
        ├── .stats-summary (3 cartes)
        ├── .goal-section (barre)
        ├── .projects-section
        └── .days-section
```
