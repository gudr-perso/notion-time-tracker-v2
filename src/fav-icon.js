// src/fav-icon.js — construit le picto SVG d'un favori.
// Vit hors de core/ : core/ reste sans DOM. Partagé popup + config, comme theme.js.
import { FAV_ICONS } from './core/fav-icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Rend un <svg> prêt à insérer, ou null si la clé ne désigne aucun picto (dont 'none').
// Construit avec createElementNS et jamais innerHTML.
export function favIconSvg(key, className = 'fav-ico') {
  const ico = FAV_ICONS[key];
  if (!ico) return null;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); // le picto suit la couleur du texte : blanc
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ico.paths) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}
