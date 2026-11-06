/*
 * Orbit — original chibi mascot "Luna", drawn in SVG. Moods: happy, focused, sleepy, worried.
 * © 2026 Helder (Maidzinha) — PolyForm Noncommercial 1.0.0
 */
(function (root) {
  'use strict';

  const INK = '#2b1838';

  const eyes = {
    happy:
      `<path d="M41 69 Q48 60 55 69" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M65 69 Q72 60 79 69" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
    focused:
      `<ellipse cx="48" cy="68" rx="6" ry="8" fill="${INK}"/><ellipse cx="72" cy="68" rx="6" ry="8" fill="${INK}"/>` +
      `<ellipse cx="48" cy="68" rx="4" ry="5.5" class="m-acc2" opacity=".75"/><ellipse cx="72" cy="68" rx="4" ry="5.5" class="m-acc2" opacity=".75"/>` +
      `<circle cx="50" cy="65" r="2.2" fill="#fff"/><circle cx="74" cy="65" r="2.2" fill="#fff"/>`,
    sleepy:
      `<path d="M41 70 Q48 76 55 70" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M65 70 Q72 76 79 70" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>` +
      `<text x="92" y="30" font-size="13" font-weight="700" class="m-acc2 zz">z</text>` +
      `<text x="101" y="19" font-size="10" font-weight="700" class="m-acc2 zz zz2">z</text>`,
    worried:
      `<ellipse cx="48" cy="69" rx="5.5" ry="7.5" fill="${INK}"/><ellipse cx="72" cy="69" rx="5.5" ry="7.5" fill="${INK}"/>` +
      `<circle cx="50" cy="66" r="2" fill="#fff"/><circle cx="74" cy="66" r="2" fill="#fff"/>` +
      `<path d="M40 56 L54 59" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M80 56 L66 59" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M89 52 Q93 60 89 63 Q85 60 89 52 Z" fill="#8fd3ff"/>`,
  };

  const mouths = {
    happy: `<path d="M53 82 Q60 90 67 82 Z" fill="#c2366f"/>`,
    focused: `<path d="M55 83 Q60 87 65 83" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    sleepy: `<ellipse cx="60" cy="85" rx="3.5" ry="4" fill="#c2366f"/>`,
    worried: `<path d="M53 86 Q56.5 82 60 86 Q63.5 90 67 86" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  };

  function svg(mood) {
    const m = eyes[mood] ? mood : 'happy';
    return `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="mascot-svg mood-${m}" role="img" aria-label="Luna">
  <circle cx="27" cy="22" r="13" class="m-hair-dark"/>
  <circle cx="93" cy="22" r="13" class="m-hair-dark"/>
  <ellipse cx="60" cy="58" rx="45" ry="45" class="m-hair"/>
  <ellipse cx="21" cy="88" rx="11" ry="27" class="m-hair-dark"/>
  <ellipse cx="99" cy="88" rx="11" ry="27" class="m-hair-dark"/>
  <ellipse cx="60" cy="69" rx="33" ry="31" fill="#ffe6da"/>
  <path d="M26 62 Q28 22 60 20 Q92 22 94 62 Q86 46 76 47 Q70 37 61 47 Q51 38 43 49 Q33 47 26 62 Z" class="m-hair"/>
  <ellipse cx="40" cy="80" rx="6.5" ry="3.5" fill="#ff8fbf" opacity=".65"/>
  <ellipse cx="80" cy="80" rx="6.5" ry="3.5" fill="#ff8fbf" opacity=".65"/>
  ${eyes[m]}
  ${mouths[m]}
  <g transform="translate(86 30) rotate(-20)">
    <ellipse cx="0" cy="0" rx="12" ry="4" fill="none" class="m-acc2-stroke" stroke-width="2.4"/>
    <circle cx="0" cy="0" r="6.5" class="m-acc"/>
    <path d="M-12 0 A12 4 0 0 0 12 0" fill="none" class="m-acc2-stroke" stroke-width="2.4"/>
  </g>
</svg>`;
  }

  root.OrbitMascot = { svg };
})(window);
