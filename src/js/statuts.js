/*
 * Statuts d'un rendez-vous et messages affichés au patient sur la page de suivi.
 * Le backend écrit les statuts sans accent (en_attente, confirme, termine, annule) :
 * c'est ce fichier qui les présente avec accents.
 * Ce fichier ne touche ni au DOM ni au réseau, il se teste donc avec `npm test`.
 */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrique();
  } else {
    racine.Statuts = fabrique();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LIBELLES = {
    en_attente: 'En attente',
    confirme: 'Confirmé',
    termine: 'Terminé',
    annule: 'Annulé',
  };

  function libelleStatut(statut) {
    return LIBELLES[statut] || 'Statut inconnu';
  }

  /** Numéro de rendez-vous : des chiffres, supérieur à zéro. */
  function validerNumero(saisie) {
    const texte = String(saisie === undefined || saisie === null ? '' : saisie).trim();
    if (/^\d{1,9}$/.test(texte) && Number(texte) > 0) {
      return { ok: true, valeur: Number(texte), message: '' };
    }
    return { ok: false, valeur: null, message: 'Entrez le numéro de rendez-vous reçu à la réservation.' };
  }

  /**
   * Ce que la page de suivi affiche pour un rendez-vous renvoyé par l'API.
   * `dateLongue` est la date déjà mise en toutes lettres (« mercredi 11 novembre 2026 »).
   * Retourne : statut, etiquette, texte, peutAnnuler (bouton « Annuler »), peutReprendre (lien vers l'accueil).
   */
  function messageSuivi(rdv, dateLongue) {
    const heure = String(rdv.heure).slice(0, 5);
    const quand = `du ${dateLongue} à ${heure} avec le Dr ${rdv.dentiste.nom}`;
    let texte;

    switch (rdv.statut) {
      case 'en_attente':
        texte = `Votre rendez-vous ${quand} est en attente de validation. Il sera validé prochainement par le dentiste.`;
        break;
      case 'confirme':
        texte = `Votre rendez-vous ${quand} est confirmé. À bientôt !`;
        break;
      case 'annule':
        texte = `Votre rendez-vous ${quand} a été annulé.`;
        break;
      case 'termine':
        texte = `Votre consultation ${quand} est terminée.`;
        break;
      default:
        texte = "Le statut de votre rendez-vous n'est pas reconnu. Contactez la clinique.";
    }

    return {
      statut: rdv.statut,
      etiquette: libelleStatut(rdv.statut),
      texte,
      peutAnnuler: rdv.annulable === true,
      peutReprendre: rdv.statut === 'annule',
    };
  }

  return { libelleStatut, validerNumero, messageSuivi };
});
