# Notion Time Tracker — Documentation

> Extension navigateur (Chrome / Edge, Manifest V3) de suivi du temps de travail,
> avec enregistrement des sessions dans une base de données **Notion** configurable dynamiquement.
>
> **Version documentée :** `4.9.4` (voir `manifest.json`)

---

## Objet de cette documentation

Cette documentation a un double objectif :

1. **Décrire l'existant** (fonctionnel + technique) de façon complète et fidèle au code.
2. **Permettre de recoder une v2 de zéro**, sans avoir besoin de relire le code source d'origine.

Elle est volontairement exhaustive : chaque fonctionnalité, chaque appel API, chaque clé de
stockage et chaque écran est décrit.

---

## Sommaire des fichiers

| Fichier | Contenu | Public cible |
|---------|---------|--------------|
| [`documentation-fonctionnelle.md`](documentation-fonctionnelle.md) | Ce que fait l'application, fonctionnalité par fonctionnalité, parcours utilisateur | Product, utilisateurs avancés, QA |
| [`documentation-technique.md`](documentation-technique.md) | Architecture, fichiers, modèle de données, API Notion, algorithmes | Développeurs |
| [`design-ecrans.md`](design-ecrans.md) | Maquettes (wireframes) de tous les écrans et états, charte graphique | Designers, développeurs front |
| [`specification-v2.md`](specification-v2.md) | Cahier des charges pour recoder une v2 propre, dette technique à corriger | Équipe v2 |

---

## Résumé en une page

**Notion Time Tracker** est un chronomètre de temps de travail qui vit dans la barre d'outils du
navigateur. L'utilisateur :

1. Se connecte à Notion via un **token d'intégration interne**.
2. Configure deux bases Notion : une **base « Tâches »** (source des tâches à pointer, ex. « GDR Work »)
   et une **base « Temps saisis »** (destination des sessions chronométrées).
3. **Mappe** les champs de l'extension sur les propriétés réelles de sa base de temps.

Ensuite, au quotidien, il peut :

- **Démarrer / mettre en pause / arrêter** un chronomètre sur une tâche.
- **Arrêter à une heure précise** (rétroactif).
- **Saisir manuellement** une session oubliée (début / fin / commentaire).
- Marquer une session comme **congés**.
- Utiliser des **favoris** pour enregistrer une session en un clic.
- Consulter ses **statistiques** (par période, par projet, par jour, objectif hebdomadaire).
- Recevoir des **notifications** (timer trop long, fin de journée, objectif atteint).

Toutes les données de sessions sont stockées **dans Notion** ; l'extension ne conserve
localement que la configuration, la session en cours, l'historique des tâches et les favoris.

---

## Stack technique en bref

- **Manifest V3**, Service Worker (`background.js`).
- **JavaScript vanilla** (aucune dépendance, aucun build, aucun framework).
- **API REST Notion** (`https://api.notion.com/v1`, version `2022-06-28`).
- **`chrome.storage.local`** pour la persistance locale.
- **`chrome.notifications`** + **badge** d'action pour les rappels.
- CSS pur (pas de préprocesseur).

Voir [`documentation-technique.md`](documentation-technique.md) pour le détail.
