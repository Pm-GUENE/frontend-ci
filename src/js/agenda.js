/*
 * Logique de l'espace dentiste : état de chaque case du planning, actions possibles sur un
 * rendez-vous, rappels et filtres de la liste.
 * Les statuts sont ceux du backend, sans accent : en_attente, confirme, termine, annule.
 * Ce fichier ne touche ni au DOM ni au réseau, il se teste donc avec `npm test`.
 */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrique();
  } else {
    racine.Agenda = fabrique();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Ordre d'affichage des boutons : l'annulation toujours en dernier.
  const ORDRE_ACTIONS = ['confirme', 'termine', 'annule'];

  const LIBELLES_ACTION = {
    confirme: 'Confirmer le rendez-vous',
    termine: 'Marquer comme terminé',
    annule: 'Annuler le rendez-vous',
  };

  const LIBELLES_ACTION_COURTS = {
    confirme: 'Confirmer',
    termine: 'Terminé',
    annule: 'Annuler',
  };

  // Légende du planning, dans l'ordre d'affichage.
  const LEGENDE = [
    { etat: 'libre', libelle: 'Libre' },
    { etat: 'en_attente', libelle: 'En attente' },
    { etat: 'confirme', libelle: 'Confirmé' },
    { etat: 'termine', libelle: 'Terminé' },
    { etat: 'passe', libelle: 'Passé' },
  ];

  /** Boutons à afficher pour un rendez-vous, dans l'ordre voulu, sans les statuts inconnus. */
  function actionsOrdonnees(actionsPossibles) {
    const liste = Array.isArray(actionsPossibles) ? actionsPossibles : [];
    return ORDRE_ACTIONS.filter((action) => liste.includes(action));
  }

  function libelleAction(action) {
    return LIBELLES_ACTION[action] || action;
  }

  function libelleActionCourt(action) {
    return LIBELLES_ACTION_COURTS[action] || action;
  }

  function normaliserHeure(heure) {
    return String(heure).slice(0, 5);
  }

  function cleCreneau(date, heure) {
    return `${date} ${normaliserHeure(heure)}`;
  }

  /** Moment (date locale) d'un créneau à partir de « AAAA-MM-JJ » et « HH:MM ». */
  function momentCreneau(date, heure) {
    const [annee, mois, jour] = date.split('-').map(Number);
    const [h, m] = normaliserHeure(heure).split(':').map(Number);
    return new Date(annee, mois - 1, jour, h, m);
  }

  /**
   * Rendez-vous qui occupent un créneau, indexés par « date heure ».
   * Un rendez-vous annulé libère son créneau : il n'apparaît pas dans le planning
   * (il reste visible dans la liste).
   */
  function rdvParCreneau(rdvs) {
    const index = new Map();
    for (const rdv of rdvs) {
      if (rdv.statut === 'annule') continue;
      const cle = cleCreneau(rdv.date, rdv.heure);
      if (!index.has(cle)) index.set(cle, rdv);
    }
    return index;
  }

  /**
   * État d'une case du planning :
   * le statut du rendez-vous s'il y en a un, sinon « passe » (créneau déjà écoulé) ou « libre ».
   */
  function etatCase(rdv, date, heure, maintenant) {
    if (rdv) return rdv.statut;
    return momentCreneau(date, heure) < maintenant ? 'passe' : 'libre';
  }

  /**
   * Construit le planning d'une semaine : une ligne par horaire, une case par jour.
   * `jours` : dates au format AAAA-MM-JJ ; `heures` : « HH:MM ».
   */
  function construireAgenda(rdvs, jours, heures, maintenant) {
    const index = rdvParCreneau(rdvs);
    return heures.map((heure) => ({
      heure,
      cases: jours.map((date) => {
        const rdv = index.get(cleCreneau(date, heure)) || null;
        return { date, heure, rdv, etat: etatCase(rdv, date, heure, maintenant) };
      }),
    }));
  }

  /**
   * Nom abrégé pour une case étroite du planning : « Mamadou Sall » devient « Mamadou S. ».
   * Un seul mot reste tel quel.
   */
  function nomCourt(nom) {
    const mots = String(nom === undefined || nom === null ? '' : nom).trim().split(/\s+/).filter(Boolean);
    if (mots.length === 0) return '';
    if (mots.length === 1) return mots[0];
    return `${mots[0]} ${mots[mots.length - 1][0].toUpperCase()}.`;
  }

  /** Texte de la bannière de rappel pour un rendez-vous confirmé dans moins de 15 minutes. */
  function messageRappel(rappel) {
    return `Rendez-vous à ${normaliserHeure(rappel.heure)} avec ${rappel.patient_nom} (${rappel.motif}), dans moins de 15 minutes.`;
  }

  /**
   * Message affiché au dentiste quand le backend refuse un changement de statut.
   * Le backend écrit « Changement de statut impossible : annule -> confirme » quand le rendez-vous
   * a changé entre-temps (le patient l'a annulé, par exemple) : on le remplace par une phrase claire.
   * Les autres refus (par exemple « terminé » avant l'heure) gardent le message précis du backend.
   */
  function messageErreurAction(statutHttp, messageBackend) {
    if (statutHttp === 409 && /^Changement de statut impossible/i.test(String(messageBackend))) {
      return "Ce rendez-vous a changé entre-temps (le patient l'a peut-être annulé). L'affichage a été mis à jour.";
    }
    return messageBackend;
  }

  /**
   * Paramètres de GET /mes-rendez-vous pour les filtres de la liste (date, motif, statut).
   * Un filtre vide n'est pas envoyé. Une date unique devient une période d'un jour (du = au).
   */
  function parametresListe(filtres) {
    const parametres = {};
    if (filtres.date) {
      parametres.du = filtres.date;
      parametres.au = filtres.date;
    }
    if (filtres.soinId) parametres.soin_id = filtres.soinId;
    if (filtres.statut) parametres.statut = filtres.statut;
    return parametres;
  }

  /** Vrai si au moins un filtre est actif (pour le message « aucun résultat » et le bouton Réinitialiser). */
  function filtresActifs(filtres) {
    return Boolean(filtres.date || filtres.soinId || filtres.statut);
  }

  return {
    LEGENDE,
    actionsOrdonnees,
    libelleAction,
    libelleActionCourt,
    cleCreneau,
    momentCreneau,
    rdvParCreneau,
    etatCase,
    construireAgenda,
    nomCourt,
    messageRappel,
    messageErreurAction,
    parametresListe,
    filtresActifs,
  };
});
