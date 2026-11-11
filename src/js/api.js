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
    const { methode = 'GET', corps = null, jeton = null } = options || {};
    const url = new URL(BASE + chemin, window.location.origin);
    Object.entries(parametres || {}).forEach(([cle, valeur]) => {
      if (valeur !== null && valeur !== undefined && valeur !== '') {
        url.searchParams.set(cle, valeur);
      }
    });

    const entetes = { Accept: 'application/json' };
    if (corps !== null) entetes['Content-Type'] = 'application/json';
    if (jeton) entetes.Authorization = `Bearer ${jeton}`;

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
    /** Suivi d'un rendez-vous : numéro + téléphone (9 chiffres). Erreur 404 si le couple ne correspond pas. */
    /**
     * Connexion d'un dentiste ou de l'administrateur. La réponse contient access_token, role,
     * nom et doit_changer_mdp. Erreur 401 si l'identifiant ou le mot de passe est incorrect.
     */
    connexion: (identifiant, motDePasse) =>
      appeler('/connexion', null, { methode: 'POST', corps: { identifiant, mot_de_passe: motDePasse } }),
    /**
     * Changement du mot de passe de la personne connectée (jeton obligatoire).
     * Erreur 422 si le nouveau mot de passe est trop court ou identique à l'actuel, 401 si le jeton a expiré.
     */
    changerMotDePasse: (jeton, nouveau, confirmation) =>
      appeler('/mot-de-passe', null, {
        methode: 'PATCH',
        jeton,
        corps: { nouveau_mot_de_passe: nouveau, confirmation },
      }),
    /** Liste des motifs de consultation (id, libelle). */
    soins: () => appeler('/soins'),
    /** Administrateur : liste des dentistes avec identifiant et motifs, le plus récent en premier. */
    dentistesAdmin: (jeton) => appeler('/admin/dentistes', null, { jeton }),
    /**
     * Administrateur : crée un dentiste (nom, specialite, soin_ids). La réponse contient l'identifiant
     * généré et mot_de_passe_temporaire, qui n'est renvoyé qu'une seule fois.
     */
    creerDentiste: (jeton, donnees) =>
      appeler('/admin/dentistes', null, { methode: 'POST', jeton, corps: donnees }),
    suivre: (id, tel) => appeler(`/rendez-vous/${encodeURIComponent(id)}`, { tel }),
    /** Annulation par le patient. Erreur 409 si le rendez-vous est terminé, déjà annulé ou passé. */
    annuler: (id, tel) =>
      appeler(`/rendez-vous/${encodeURIComponent(id)}/annulation`, { tel }, { methode: 'PATCH' }),
  };
})(window);
