# Brief · Notion Time Tracker

## Le problème
Je pointe mon temps de travail à la main dans Notion (ouvrir la base, créer une ligne, retaper la
tâche, l'heure de début, l'heure de fin…), et surtout **j'oublie de le faire** ou je le fais de
mémoire le soir — donc c'est faux, chronophage et pénible. Je veux un chrono qui écrit tout seul
dans Notion pendant que je bosse.

## Pour qui
**Moi d'abord** : consultant / salarié qui facture ou justifie son temps et dont le référentiel de
tâches vit déjà dans Notion.
**Après moi** : toute personne qui suit son temps par tâche/projet dans Notion (freelances, petites
équipes) et qui veut un pointage léger sans quitter son navigateur — à condition d'accepter de
connecter sa propre intégration Notion et de mapper ses champs.

## La feature cœur (UNE phrase)
« Mon app permet de **lancer/arrêter un chronomètre sur une tâche depuis un bouton du navigateur**
pour que **chaque session (début, fin, pauses, commentaire) soit écrite automatiquement dans ma base
Notion, sans saisie manuelle**. »

## Les données nécessaires

**Dans Notion (les deux bases pivots) :**
- **table_taches** *(base « Tâches » / GDR Work — lecture seule)* : nom, projet, url_externe
  (ClickUp/Jira…), url_notion
- **table_temps** *(base « Temps saisis » / Time — lecture + écriture, une ligne = une session)* :
  nom_session *(title, obligatoire)*, date_debut *(date, obligatoire)*, date_fin *(date,
  obligatoire)*, commentaire, temps_pause_min *(number)*, taskid, projets *(relation)*,
  relation_tache *(relation → table_taches)*, url_app

**En local (config & état de l'extension, `chrome.storage.local`) :**
- **table_config** : token_notion, id_base_temps, id_base_taches, mapping_champs,
  commentaire_obligatoire, libelle_bouton_appli, heures_hebdo, tache_conges, favoris (≤6)
- **table_session_en_cours** : tache, date_debut, en_pause, total_pause, commentaire, id_page_notion
- **table_historique** : tâches récemment utilisées (max 20)

## À quoi ressemble « ça marche »
Je choisis une tâche dans le popup, je clique **▶️ Démarrer** → une **page apparaît immédiatement
dans la base « Temps saisis » de Notion** (nom + heure de début), un **badge 🟢** s'affiche sur
l'icône de l'extension, et le chrono tourne. Je clique **⏹️ Arrêter** → la **même page Notion se
complète toute seule** avec l'heure de fin, les minutes de pause et mon commentaire. C'est fini quand
je n'ai plus jamais eu à taper une date à la main.

---

## Notes de cadrage
- **Nom provisoire** : la doc l'appelle *Notion Time Tracker*. Nom définitif à trancher.
- Ce brief décrit **l'existant (v4.9.4)**. Une [`specification-v2.md`](specification-v2.md) recense de
  la dette technique à corriger (ex. ID de base codé en dur dans les notifications). Si l'objectif est
  de recoder une **v2**, réorienter le périmètre en conséquence.
