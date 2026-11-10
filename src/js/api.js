/*
 * Appels à l'API du backend. Le navigateur appelle toujours /api/..., Nginx
 * transmet la requête au backend FastAPI en retirant le préfixe /api.
 */
(function (racine) {
  'use strict';

  const BASE = '/api';

  async function appeler(chemin, parametres) {
    const url = new URL(BASE + chemin, window.location.origin);
    Object.entries(parametres || {}).forEach(([cle, valeur]) => {
      if (valeur !== null && valeur !== undefined && valeur !== '') {
        url.searchParams.set(cle, valeur);
      }
    });
    const reponse = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!reponse.ok) {
      const erreur = new Error(`Erreur ${reponse.status}`);
      erreur.statut = reponse.status;
      throw erreur;
    }
    return reponse.json();
  }

  racine.Api = {
    /** Dentistes avec leurs motifs. Filtre : q (nom de dentiste ou de motif). */
    dentistes: (filtres) => appeler('/dentistes', filtres),
    /** Créneaux libres d'un dentiste entre deux dates (AAAA-MM-JJ). */
    creneaux: (dentisteId, du, au) => appeler('/creneaux', { dentiste_id: dentisteId, du, au }),
  };
})(window);
