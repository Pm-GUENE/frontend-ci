/*
 * Validation du formulaire de réservation et messages d'erreur de l'API.
 * Les règles reprennent celles du backend (schemas.py et services.py) pour prévenir
 * le patient avant l'envoi. Le backend reste la référence : il revérifie tout.
 * Ce fichier ne touche ni au DOM ni au réseau, il se teste donc avec `npm test`.
 */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrique();
  } else {
    racine.Validation = fabrique();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NOM_MAX = 100;
  const MESSAGE_TEL = 'Numéro invalide (exemple : 77 123 45 67).';

  /**
   * Nom du patient : des lettres, séparées par des espaces, apostrophes ou tirets.
   * Retourne { ok, valeur, message } où valeur est le nom nettoyé à envoyer.
   */
  function validerNom(nom) {
    const valeur = String(nom || '')
      .replace(/[’‘]/g, "'")   // apostrophe typographique des claviers de téléphone
      .replace(/\s+/g, ' ')
      .trim();
    if (valeur.length < 2) {
      return { ok: false, valeur, message: 'Entrez votre prénom et votre nom.' };
    }
    if (valeur.length > NOM_MAX) {
      return { ok: false, valeur, message: `Le nom est trop long (${NOM_MAX} caractères au maximum).` };
    }
    if (!/^\p{L}+(?:[ '\-]\p{L}+)*$/u.test(valeur)) {
      return { ok: false, valeur, message: 'Le nom ne doit contenir que des lettres.' };
    }
    return { ok: true, valeur, message: '' };
  }

  /**
   * Téléphone sénégalais : 9 chiffres commençant par 3 ou 7, avec ou sans indicatif
   * (+221, 00221 ou 221). Retourne les 9 chiffres, ou null si le numéro est invalide.
   */
  function normaliserTelephone(tel) {
    let chiffres = String(tel || '').replace(/[\s.\-()]/g, '');
    for (const prefixe of ['+221', '00221', '221']) {
      if (chiffres.startsWith(prefixe) && chiffres.length > 9) {
        chiffres = chiffres.slice(prefixe.length);
        break;
      }
    }
    return /^[37]\d{8}$/.test(chiffres) ? chiffres : null;
  }

  function validerTelephone(tel) {
    const valeur = normaliserTelephone(tel);
    return valeur
      ? { ok: true, valeur, message: '' }
      : { ok: false, valeur: null, message: MESSAGE_TEL };
  }

  /** « 771234567 » devient « 77 123 45 67 ». */
  function formaterTelephone(neufChiffres) {
    const c = String(neufChiffres);
    if (!/^\d{9}$/.test(c)) return c;
    return `${c.slice(0, 2)} ${c.slice(2, 5)} ${c.slice(5, 7)} ${c.slice(7, 9)}`;
  }

  function validerMotif(valeur) {
    return Number.isInteger(Number(valeur)) && Number(valeur) > 0 && String(valeur).trim() !== ''
      ? { ok: true, valeur: Number(valeur), message: '' }
      : { ok: false, valeur: null, message: 'Choisissez un motif de consultation.' };
  }

  /**
   * Message à afficher pour une erreur de l'API.
   * `corps` est la réponse JSON de l'erreur : { detail: "texte" } ou, pour une donnée
   * invalide détectée par FastAPI, { detail: [{ msg: "Value error, texte" }] }.
   */
  function extraireMessage(statut, corps) {
    const detail = corps && corps.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0 && detail[0] && typeof detail[0].msg === 'string') {
      return detail[0].msg.replace(/^Value error,\s*/i, '');
    }
    if (statut === undefined || statut === null) {
      return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
    }
    if (statut === 409) return "Ce créneau vient d'être pris, choisissez-en un autre.";
    if (statut === 404) return 'Dentiste ou motif introuvable. Fermez cette fenêtre et réessayez.';
    if (statut === 422) return 'Les informations saisies sont invalides.';
    if (statut >= 500) return 'Le service est momentanément indisponible. Réessayez dans un instant.';
    return 'Une erreur est survenue. Réessayez.';
  }

  return {
    validerNom,
    normaliserTelephone,
    validerTelephone,
    formaterTelephone,
    validerMotif,
    extraireMessage,
  };
});
