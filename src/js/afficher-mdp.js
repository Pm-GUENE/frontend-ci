/*
 * Bouton « œil » des champs de mot de passe : affiche ou cache la saisie.
 * Usage : AfficherMdp.activer(bouton, champ) ; le bouton porte aria-pressed et un libellé accessible.
 */
(function (racine) {
  'use strict';

  const ICONE_VISIBLE =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<path d="M2 12s3.600-6.500 10-6.500S22 12 22 12s-3.600 6.500-10 6.500S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.800"/></svg>';

  const ICONE_CACHE =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<path d="M2 12s3.600-6.500 10-6.500S22 12 22 12s-3.600 6.500-10 6.500S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.800"/>' +
    '<path d="M4 4l16 16" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"/></svg>';

  function activer(bouton, champ) {
    function afficher(visible) {
      champ.type = visible ? 'text' : 'password';
      bouton.setAttribute('aria-pressed', visible ? 'true' : 'false');
      bouton.setAttribute('aria-label', visible ? 'Cacher le mot de passe' : 'Afficher le mot de passe');
      bouton.innerHTML = visible ? ICONE_CACHE : ICONE_VISIBLE;
    }
    bouton.type = 'button';
    afficher(false);
    bouton.addEventListener('click', () => {
      afficher(champ.type === 'password');
      champ.focus();
    });
  }

  racine.AfficherMdp = { activer };
})(window);
