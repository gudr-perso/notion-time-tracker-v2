// src/core/fav-icons.js — table des pictos des favoris. Données pures, sans API Chrome ni DOM.
//
// Tracés repris de Tabler Icons — https://tabler.io/icons — licence MIT.
// Copyright (c) 2020-2024 Paweł Kuna. https://github.com/tabler/tabler-icons/blob/main/LICENSE
//
// Les 80 tracés ci-dessous sont une portion substantielle de l'œuvre : la licence MIT exige que
// la notice de copyright ET la notice de permission voyagent avec eux. Un lien ne vaut pas
// notice, d'où sa reproduction intégrale ici — dans le fichier lui-même, pour qu'elle suive le
// code quel que soit l'empaquetage de l'extension. Texte repris tel quel de la LICENSE livrée
// avec @tabler/icons@3.31.0, la version d'où proviennent les tracés (le `main` amont porte
// aujourd'hui « 2020-2026 » : à toute régénération, réaligner l'année sur la version refetchée).
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Extraits des sources `outline` (viewBox 24, stroke currentColor, sans remplissage), cadre
// transparent d'origine (`M0 0h24v24H0z`) retiré. L'ordre des clés pilote la grille de la config.
//
// Régénération : refetch de https://unpkg.com/@tabler/icons@3.31.0/icons/outline/<nom>.svg et
// extraction des attributs `d`. Correspondance des clés → noms Tabler : file → file-text,
// chart → chart-bar, laptop → device-laptop ; les 20 autres portent le même nom.
export const FAV_ICONS = {
  code: {
    label: 'Développement',
    paths: [
      'M7 8l-4 4l4 4',
      'M17 8l4 4l-4 4',
      'M14 4l-4 16',
    ],
  },
  users: {
    label: 'Réunion',
    paths: [
      'M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
      'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
      'M16 3.13a4 4 0 0 1 0 7.75',
      'M21 21v-2a4 4 0 0 0 -3 -3.85',
    ],
  },
  headset: {
    label: 'Support',
    paths: [
      'M4 14v-3a8 8 0 1 1 16 0v3',
      'M18 19c0 1.657 -2.686 3 -6 3',
      'M4 14a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2v-3z',
      'M15 14a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2v-3z',
    ],
  },
  beach: {
    label: 'Congés',
    paths: [
      'M17.553 16.75a7.5 7.5 0 0 0 -10.606 0',
      'M18 3.804a6 6 0 0 0 -8.196 2.196l10.392 6a6 6 0 0 0 -2.196 -8.196z',
      'M16.732 10c1.658 -2.87 2.225 -5.644 1.268 -6.196c-.957 -.552 -3.075 1.326 -4.732 4.196',
      'M15 9l-3 5.196',
      'M3 19.25a2.4 2.4 0 0 1 1 -.25a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 1 .25',
    ],
  },
  bug: {
    label: 'Bug',
    paths: [
      'M9 9v-1a3 3 0 0 1 6 0v1',
      'M8 9h8a6 6 0 0 1 1 3v3a5 5 0 0 1 -10 0v-3a6 6 0 0 1 1 -3',
      'M3 13l4 0',
      'M17 13l4 0',
      'M12 20l0 -6',
      'M4 19l3.35 -2',
      'M20 19l-3.35 -2',
      'M4 7l3.75 2.4',
      'M20 7l-3.75 2.4',
    ],
  },
  file: {
    label: 'Document',
    paths: [
      'M14 3v4a1 1 0 0 0 1 1h4',
      'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z',
      'M9 9l1 0',
      'M9 13l6 0',
      'M9 17l6 0',
    ],
  },
  mail: {
    label: 'Mail',
    paths: [
      'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z',
      'M3 7l9 6l9 -6',
    ],
  },
  phone: {
    label: 'Téléphone',
    paths: [
      'M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2',
    ],
  },
  car: {
    label: 'Déplacement',
    paths: [
      'M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
      'M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
      'M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5',
    ],
  },
  coffee: {
    label: 'Pause',
    paths: [
      'M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1',
      'M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2',
      'M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2',
      'M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5z',
      'M16.746 16.726a3 3 0 1 0 .252 -5.555',
    ],
  },
  school: {
    label: 'Formation',
    paths: [
      'M22 9l-10 -4l-10 4l10 4l10 -4v6',
      'M6 10.6v5.4a6 3 0 0 0 12 0v-5.4',
    ],
  },
  chart: {
    label: 'Analyse',
    paths: [
      'M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
      'M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
      'M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z',
      'M4 20h14',
    ],
  },
  checklist: {
    label: 'Tâches',
    paths: [
      'M9.615 20h-2.615a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8',
      'M14 19l2 2l4 -4',
      'M9 8h4',
      'M9 12h2',
    ],
  },
  tool: {
    label: 'Maintenance',
    paths: [
      'M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5',
    ],
  },
  cloud: {
    label: 'Infra',
    paths: [
      'M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878',
    ],
  },
  search: {
    label: 'Recherche',
    paths: [
      'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0',
      'M21 21l-6 -6',
    ],
  },
  book: {
    label: 'Documentation',
    paths: [
      'M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0',
      'M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0',
      'M3 6l0 13',
      'M12 6l0 13',
      'M21 6l0 13',
    ],
  },
  star: {
    label: 'Étoile',
    paths: [
      'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z',
    ],
  },
  building: {
    label: 'Client',
    paths: [
      'M3 21l18 0',
      'M9 8l1 0',
      'M9 12l1 0',
      'M9 16l1 0',
      'M14 8l1 0',
      'M14 12l1 0',
      'M14 16l1 0',
      'M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16',
    ],
  },
  clock: {
    label: 'Temps',
    paths: [
      'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0',
      'M12 7v5l3 3',
    ],
  },
  palette: {
    label: 'Design',
    paths: [
      'M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25',
      'M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
      'M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
      'M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    ],
  },
  laptop: {
    label: 'Ordinateur',
    paths: [
      'M3 19l18 0',
      'M5 6m0 1a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1z',
    ],
  },
  message: {
    label: 'Échange',
    paths: [
      'M8 9h8',
      'M8 13h6',
      'M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z',
    ],
  },
};
