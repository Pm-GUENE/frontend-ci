/*
 * Appels à l'API du backend. Le navigateur appelle toujours /api/..., Nginx
 * transmet la requête au backend FastAPI en retirant le préfixe /api.
 *
 * En cas d'erreur, la promesse est rejetée avec une Error qui porte :
 *   statut : code HTTP (absent si le réseau est coupé)
 *   corps  : réponse JSON de l'erreur, si elle existe (voir Validation.extraireMessage)
 */
(function (racine) {
  'use strict';

  const BASE = '/api';

  async function appeler(chemin, parametres, options) {
    const { methode = 'GET', corps = null } = options || {};
    const url = new URL(BASE + chemin, window.location.origin);
    Object.entries(parametres || {}).forEach(([cle, valeur]) => {
      if (valeur !== null && valeur !== undefined && valeur !== '') {
        url.searchParams.set(cle, valeur);
      }
    });

    const entetes = { Accept: 'application/json' };
    if (corps !== null) entetes['Content-Type'] = 'application/json';

    const reponse = await fetch(url, {
      method: methode,
      headers: entetes,
      body: corps !== null ? JSON.stringify(corps) : undefined,
    });

    if (!reponse.ok) {
      const erreur = new Error(`Erreur ${reponse.status}`);
      erreur.statut = reponse.status;
      try {
        erreur.corps = await reponse.json();
      } catch (_) {
        erreur.corps = null;
      }
      throw erreur;
    }
    return reponse.json();
  }

  racine.Api = {
    /** Dentistes avec leurs motifs. Filtre : q (nom de dentiste ou de motif). */
    dentistes: (filtres) => appeler('/dentistes', filtres),
    /** Créneaux libres d'un dentiste entre deux dates (AAAA-MM-JJ). */
    creneaux: (dentisteId, du, au) => appeler('/creneaux', { dentiste_id: dentisteId, du, au }),
    /**
     * Réserve un rendez-vous. Données : patient_nom, patient_tel, dentiste_id, soin_id,
     * date (AAAA-MM-JJ), heure (HH:MM). La réponse contient l'id = numéro de rendez-vous.
     */
    reserver: (donnees) => appeler('/rendez-vous', null, { methode: 'POST', corps: donnees }),
  };
})(window);
