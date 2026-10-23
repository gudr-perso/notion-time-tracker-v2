// src/core/changelog.js — historique des versions montré dans l'onglet « Mises à jour ».
//
// Module pur : ni API Chrome, ni DOM. C'est du **contenu rédigé pour l'utilisateur final**, pas une
// copie de docs/VERSIONS.md : ni chemin de fichier, ni nom de fonction, ni nombre de tests, ni
// renvoi à une décision de conception. La duplication avec VERSIONS.md est assumée — deux lecteurs,
// deux niveaux de langue ; seule la cohérence du numéro de tête est tenue par un test.
//
// ⚠ À CHAQUE RELEASE : ajouter l'entrée EN TÊTE. `test/changelog.test.js` compare cette tête à la
// version de manifest.json et rougit si elle a été oubliée.
//
// Forme d'une puce : { titre, texte }. Le titre se pose en <strong>, le texte à la suite. Une puce
// sans titre rend son seul texte.

export const MAX_ENTREES = 10;

export const CHANGELOG = [
  {
    version: '5.8.0',
    date: '2026-10-23',
    resume: 'La configuration gagne un onglet « Mises à jour » : les dix dernières versions, expliquées simplement.',
    ajoute: [
      { titre: 'Onglet « Mises à jour »', texte: 'la page de configuration se range en deux onglets, « Paramètres » et « Mises à jour ». Le second liste les dix dernières versions, chacune avec un résumé et le détail de ce qui a été ajouté, modifié ou corrigé ; la version que vous utilisez porte la mention « Installée ».' },
      { titre: 'Pastille de nouveauté', texte: 'une pastille apparaît sur l’onglet après une mise à jour de l’extension, et s’efface dès que vous avez ouvert l’onglet.' },
    ],
    modifie: [],
    corrige: [],
  },
  {
    version: '5.7.7',
    date: '2026-10-23',
    resume: 'Saisie manuelle : en rattrapant plusieurs créneaux d’affilée, le début repart de la fin que vous venez d’enregistrer.',
    ajoute: [
      { titre: 'Créneaux enchaînés', texte: 'après avoir enregistré 15:30 → 16:00, le formulaire propose 16:00 → 17:00 au lieu de revenir à « il y a une heure → maintenant » : les lignes se suivent bord à bord, sans retaper la date. Le commentaire, lui, est vidé à chaque fois.' },
      { titre: 'Congés à part', texte: 'après l’enregistrement d’un congé, le formulaire garde son préremplissage habituel.' },
    ],
    modifie: [
      { titre: 'Sessions à cheval sur minuit', texte: 'une fin proposée au lendemain (23:30 → 00:30) n’est plus ramenée sur le jour du début au premier changement de date.' },
    ],
    corrige: [],
  },
  {
    version: '5.7.6',
    date: '2026-08-26',
    resume: 'Les sessions récentes affichent le commentaire écrit en fin de session.',
    ajoute: [
      { titre: 'Commentaire visible', texte: 'la ligne d’horaire des sessions récentes montre le commentaire en italique (« 17:00 → 17:55 — commentaire… »), tronqué à 70 caractères. Rien ne s’affiche si la session n’en a pas.' },
    ],
    modifie: [],
    corrige: [],
  },
  {
    version: '5.7.5',
    date: '2026-07-24',
    resume: 'Saisie manuelle : la date de fin suit toute seule le jour de la date de début.',
    ajoute: [],
    modifie: [],
    corrige: [
      { titre: 'Jour reporté', texte: 'en changeant le jour du début (par exemple du 23 au 22), le jour de la fin suit automatiquement et l’heure de fin est conservée — plus besoin de la retaper.' },
      { titre: 'Plusieurs changements de suite', texte: 'le report vaut à chaque changement et plus seulement au premier : 23 → 22 puis 22 → 21 ne laisse plus la fin bloquée sur le 22.' },
      { titre: 'Minuit respecté', texte: 'une fin délibérément posée un autre jour (session à cheval sur minuit) n’est pas déplacée.' },
    ],
  },
  {
    version: '5.7.4',
    date: '2026-07-21',
    resume: 'Le bas du popup n’est plus coupé : la liste des tâches et les sessions récentes restent atteignables.',
    ajoute: [],
    modifie: [],
    corrige: [
      { titre: 'Contenu inaccessible', texte: 'selon le moment où les tâches arrivaient de Notion, le bas du popup pouvait déborder sans barre de défilement et rester hors d’atteinte jusqu’au rechargement de l’extension. Le popup a désormais une hauteur fixe : l’en-tête et les onglets ne bougent plus, et seul le contenu défile.' },
    ],
  },
  {
    version: '5.7.3',
    date: '2026-07-21',
    resume: 'La barre de défilement prend le bleu du thème, dans le popup comme dans la configuration.',
    ajoute: [],
    modifie: [
      { titre: 'Barre de défilement', texte: 'elle quitte le gris du système pour le bleu de l’application, en thème sombre comme en thème clair, y compris dans la liste des tâches.' },
    ],
    corrige: [],
  },
  {
    version: '5.7.2',
    date: '2026-07-18',
    resume: 'Congés : le récap dit désormais pourquoi il n’y a rien à poser.',
    ajoute: [],
    modifie: [
      { titre: 'Message du récap', texte: '« Aucune demi-journée sélectionnée » devient « Aucun jour travaillé sur cette période (voir le planning) » quand la plage ne contient aucun jour travaillé, ou « Rien à poser (tout est sur “—”) » quand vous avez écarté tous les jours.' },
    ],
    corrige: [],
  },
  {
    version: '5.7.1',
    date: '2026-07-18',
    resume: 'Le bloc de saisie des congés ne reste plus affiché quand la case est décochée.',
    ajoute: [],
    modifie: [],
    corrige: [
      { titre: 'Bloc toujours visible', texte: 'les champs « Du / Au », les demi-journées et le récap s’affichaient en permanence dès l’ouverture de la saisie manuelle, même « Marquer comme congés » décoché.' },
    ],
  },
  {
    version: '5.7.0',
    date: '2026-07-18',
    resume: 'Posez vos congés en demi-journées sur une plage de dates : une ligne Notion est créée par demi-journée.',
    ajoute: [
      { titre: 'Congés en demi-journées', texte: 'quand « Marquer comme congés » est coché et qu’un planning est configuré, les champs début / fin laissent place à « Du [date + matin, après-midi ou journée] → Au [même choix] ». Un récap indique le total en jours (🌴 2,5 j) et le nombre de lignes qui seront créées.' },
      { titre: 'Détailler les jours', texte: 'déplie la liste jour par jour pour changer un type ou sauter une journée (« — ») ; les jours non travaillés du planning y sont grisés.' },
    ],
    modifie: [
      { titre: 'Une ligne par demi-journée', texte: 'l’enregistrement crée une page Notion par demi-journée, aux horaires du planning (une journée = deux lignes), liées à la tâche Congés. Si une partie échoue, le nombre de lignes réellement créées est annoncé.' },
      { titre: 'Sans planning', texte: 'la coche congés conserve l’ancienne saisie début / fin.' },
    ],
    corrige: [],
  },
  {
    version: '5.6.0',
    date: '2026-07-18',
    resume: 'L’objectif des statistiques se calcule à partir d’un planning hebdomadaire, et les congés s’affichent en jours.',
    ajoute: [
      { titre: 'Planning hebdomadaire', texte: 'dans la configuration, une grille 7 jours × matin / après-midi remplace le champ « Heures / semaine », et le total par semaine se met à jour tout seul. Par défaut : lundi à jeudi 09:00–13:00 et 14:00–18:00, vendredi 14:00–17:00, soit 39 h.' },
      { titre: 'Cible par jour', texte: 'chaque barre du rythme quotidien porte le repère de la cible du jour, au lieu d’une ligne de cible unique qui devenait fausse dès que la cible variait. Les jours non travaillés n’ont pas de repère.' },
    ],
    modifie: [
      { titre: 'Objectif', texte: 'l’objectif d’une période est la somme des heures planifiées de ses jours, dont on retranche les heures de congé. Sans planning configuré, l’ancien calcul s’applique.' },
      { titre: 'Badge Congés', texte: 'la carte objectif affiche les congés en jours (🌴 2,5 j, et « 1 j » sans décimale) plutôt qu’en heures.' },
    ],
    corrige: [
      { titre: 'Hauteur des barres', texte: 'les grandes barres du rythme quotidien ne se tassent plus : 7 h, 8 h et 9 h se distinguent à nouveau.' },
    ],
  },
  {
    version: '5.5.5',
    date: '2026-07-18',
    resume: 'Rythme quotidien : un jour qui mêle travail et congés montre désormais les deux.',
    ajoute: [],
    modifie: [
      { titre: 'Congés comptés en heures', texte: 'l’objectif retranche les heures de congé de chaque jour (au plus une journée), au lieu d’enlever une journée entière dès qu’une demi-journée de congé tombait ce jour-là.' },
    ],
    corrige: [
      { titre: 'Jour mixte', texte: 'un jour de 4 h de travail et 4 h de congés s’affichait en une seule barre orange, dont la hauteur ne comptait que le travail. La barre est maintenant empilée : bleu pour le travail, orange pour les congés, avec une infobulle « 04:00 travaillé · 04:00 congés ».' },
      { titre: 'Congé plein jour', texte: 'un jour entièrement en congé tombait à une barre de quelques pixels ; il s’affiche désormais à sa vraie hauteur.' },
    ],
  },
];

export function dixDernieres(entrees = CHANGELOG) {
  return Array.isArray(entrees) ? entrees.slice(0, MAX_ENTREES) : [];
}

// Vrai quand l'onglet mérite sa pastille. Une version courante vide ou absente rend faux : on ne
// signale pas une nouveauté qu'on ne sait pas nommer.
export function estNouvelleVersion(versionVue, versionCourante) {
  if (!versionCourante) return false;
  return versionVue !== versionCourante;
}
