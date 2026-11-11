/*
 * Règles de saisie du formulaire « Ajouter un dentiste » (espace administrateur).
 * Elles reprennent celles du backend (DentisteCreate dans schemas.py) pour prévenir
 * l'administrateur avant l'envoi ; le backend reste la référence.
 * Ce fichier ne touche ni au DOM ni au réseau, il se teste donc avec `npm test`.
 */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrique();
  } else {
    racine.Dentistes = fabrique();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NOM_MAX = 100;
  const SPECIALITE_MIN = 2;
  const SPECIALITE_MAX = 100;

  function nettoyer(texte) {
    return String(texte === undefined || texte === null ? '' : texte)
      .replace(/[’‘]/g, "'")  // apostrophe typographique des claviers de téléphone
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Nom affiché dans les listes : « Dr Moustapha Diaw ». */
  function nomAffiche(nom) {
    return `Dr ${nom}`;
  }

  /**
   * Ajoute ou retire un motif de la sélection (clic sur une case à cocher).
   * Retourne une nouvelle liste triée, sans doublon ; la liste d'origine n'est pas modifiée.
   */
  function basculerMotif(selection, id) {
    const ensemble = new Set(selection);
    if (ensemble.has(id)) ensemble.delete(id);
    else ensemble.add(id);
    return [...ensemble].sort((a, b) => a - b);
  }

  /**
   * Vérifie le formulaire : nom (prénom et nom, des lettres), spécialité, au moins un motif.
   * Retourne { ok, valeurs: { nom, specialite, soinIds }, erreurs: { nom, specialite, motifs } }.
   */
  function validerNouveauDentiste(saisie) {
    const nom = nettoyer(saisie.nom);
    const specialite = nettoyer(saisie.specialite);
    const soinIds = Array.isArray(saisie.soinIds) ? [...new Set(saisie.soinIds)].sort((a, b) => a - b) : [];
    const erreurs = { nom: '', specialite: '', motifs: '' };

    if (nom.length > NOM_MAX) {
      erreurs.nom = `Le nom est trop long (${NOM_MAX} caractères au maximum).`;
    } else if (!nom.includes(' ') || !/^\p{L}+(?:[ '\-]\p{L}+)+$/u.test(nom)) {
      erreurs.nom = 'Indiquez le prénom et le nom, avec des lettres uniquement.';
    }

    if (specialite.length < SPECIALITE_MIN) {
      erreurs.specialite = 'Indiquez la spécialité (par exemple : Chirurgien-dentiste).';
    } else if (specialite.length > SPECIALITE_MAX) {
      erreurs.specialite = `La spécialité est trop longue (${SPECIALITE_MAX} caractères au maximum).`;
    }

    if (soinIds.length === 0) {
      erreurs.motifs = 'Choisissez au moins un motif.';
    }

    return {
      ok: !erreurs.nom && !erreurs.specialite && !erreurs.motifs,
      valeurs: { nom, specialite, soinIds },
      erreurs,
    };
  }

  return { nomAffiche, basculerMotif, validerNouveauDentiste };
});
