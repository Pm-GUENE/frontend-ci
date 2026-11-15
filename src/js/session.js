/*
 * Session du dentiste ou de l'administrateur, redirections après connexion et règles de
 * saisie des mots de passe. Les règles sur les mots de passe reprennent celles du backend
 * (8 caractères au minimum, 72 octets au maximum à cause de bcrypt) pour prévenir l'utilisateur
 * avant l'envoi ; le backend reste la référence.
 * Ce fichier ne touche ni au DOM ni au réseau : le stockage est passé en paramètre,
 * il se teste donc avec `npm test`.
 */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrique();
  } else {
    racine.Session = fabrique();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CLE_SESSION = 'dentardv.session';
  const CLE_MESSAGE = 'dentardv.message';

  const PAGE_CONNEXION = 'connexion.html';
  const PAGE_MOT_DE_PASSE = 'mot-de-passe.html';
  const PAGE_DENTISTE = 'dentiste.html';
  const PAGE_ADMIN = 'admin.html';

  const ROLES = ['dentiste', 'admin'];
  const MOT_DE_PASSE_MIN = 8;
  const MOT_DE_PASSE_MAX_OCTETS = 72;

  // ---------- Session ----------

  /** Transforme la réponse de POST /connexion en session à garder pendant l'onglet. */
  function sessionDepuisReponse(reponse) {
    return {
      token: reponse.access_token,
      role: reponse.role,
      nom: reponse.nom,
      doit_changer_mdp: reponse.doit_changer_mdp === true,
    };
  }

  function sessionValide(session) {
    return Boolean(
      session &&
        typeof session.token === 'string' && session.token.length > 0 &&
        ROLES.includes(session.role) &&
        typeof session.nom === 'string'
    );
  }

  /**
   * Page où envoyer la personne selon sa session :
   * administrateur vers son espace, dentiste vers le changement de mot de passe si c'est
   * sa première connexion, sinon vers son espace. Sans session valide : la connexion.
   */
  function destination(session) {
    if (!sessionValide(session)) return PAGE_CONNEXION;
    if (session.role === 'admin') return PAGE_ADMIN;
    return session.doit_changer_mdp ? PAGE_MOT_DE_PASSE : PAGE_DENTISTE;
  }

  /**
   * Lecture et écriture de la session dans un stockage de type sessionStorage.
   * Tous les accès sont protégés : un stockage bloqué (navigation privée) ne fait jamais planter la page.
   */
  function creerStockage(stockage) {
    return {
      lire() {
        try {
          const brut = stockage.getItem(CLE_SESSION);
          if (!brut) return null;
          const session = JSON.parse(brut);
          return sessionValide(session) ? session : null;
        } catch (_) {
          return null;
        }
      },
      ecrire(session) {
        try {
          stockage.setItem(CLE_SESSION, JSON.stringify(session));
          return true;
        } catch (_) {
          return false;
        }
      },
      effacer() {
        try {
          stockage.removeItem(CLE_SESSION);
        } catch (_) {
          // Rien à faire.
        }
      },
      /** Message à afficher une seule fois sur la prochaine page (par exemple « session expirée »). */
      poserMessage(texte) {
        try {
          stockage.setItem(CLE_MESSAGE, texte);
        } catch (_) {
          // Rien à faire.
        }
      },
      prendreMessage() {
        try {
          const texte = stockage.getItem(CLE_MESSAGE);
          stockage.removeItem(CLE_MESSAGE);
          return texte || '';
        } catch (_) {
          return '';
        }
      },
    };
  }

  // ---------- Saisie ----------

  function validerIdentifiant(saisie) {
    const valeur = String(saisie === undefined || saisie === null ? '' : saisie).trim();
    return valeur
      ? { ok: true, valeur, message: '' }
      : { ok: false, valeur, message: 'Entrez votre identifiant.' };
  }

  /** À la connexion, on ne vérifie pas la longueur : seul le backend connaît le mot de passe. */
  function validerMotDePasseSaisi(saisie) {
    const valeur = String(saisie === undefined || saisie === null ? '' : saisie);
    return valeur.length > 0
      ? { ok: true, valeur, message: '' }
      : { ok: false, valeur, message: 'Entrez votre mot de passe.' };
  }

  function octets(texte) {
    return new TextEncoder().encode(texte).length;
  }

  /**
   * Nouveau mot de passe et sa confirmation.
   * Retourne { ok, erreurs: { nouveau, confirmation } } avec un message par champ en erreur.
   */
  function validerNouveauMotDePasse(nouveau, confirmation) {
    const valeur = String(nouveau === undefined || nouveau === null ? '' : nouveau);
    const verif = String(confirmation === undefined || confirmation === null ? '' : confirmation);
    const erreurs = { nouveau: '', confirmation: '' };

    if (valeur.length === 0) {
      erreurs.nouveau = 'Choisissez un nouveau mot de passe.';
    } else if (valeur.length < MOT_DE_PASSE_MIN) {
      erreurs.nouveau = `Le mot de passe doit contenir au moins ${MOT_DE_PASSE_MIN} caractères.`;
    } else if (octets(valeur) > MOT_DE_PASSE_MAX_OCTETS) {
      erreurs.nouveau = `Le mot de passe est trop long (${MOT_DE_PASSE_MAX_OCTETS} caractères au maximum).`;
    }

    if (verif.length === 0) {
      erreurs.confirmation = 'Confirmez votre mot de passe.';
    } else if (verif !== valeur) {
      erreurs.confirmation = 'Les deux mots de passe ne sont pas identiques.';
    }

    return { ok: !erreurs.nouveau && !erreurs.confirmation, erreurs };
  }

  /**
   * Que faire quand le backend refuse l'accès (401 ou 403) ?
   * Retourne null si l'erreur ne concerne pas la session, sinon :
   *   { type: 'deconnexion', message }  la session n'est plus valable : retour à la connexion ;
   *   { type: 'mot_de_passe' }          le dentiste doit d'abord changer son mot de passe temporaire.
   *
   * `chargement` vaut vrai pour le chargement d'une page : tout 403 est alors un problème de droits.
   * Il vaut faux pour une action sur un élément : un 403 peut alors être un refus métier
   * (« Ce rendez-vous ne vous appartient pas »), qui reste un simple message à l'écran.
   *
   * La fonction ne renvoie jamais vers la page de l'espace courant : c'est ce renvoi qui provoquait
   * un rechargement sans fin quand la session du navigateur ne correspondait plus aux droits réels.
   */
  function reactionErreurAcces(statut, corps, session, chargement) {
    if (statut === 401) {
      return { type: 'deconnexion', message: 'Votre session a expiré. Reconnectez-vous.' };
    }
    if (statut !== 403) return null;

    const detail = corps && typeof corps.detail === 'string' ? corps.detail : '';
    if (session && session.role === 'dentiste' && /changer votre mot de passe/i.test(detail)) {
      return { type: 'mot_de_passe' };
    }
    if (chargement || /réservé/i.test(detail)) {
      return { type: 'deconnexion', message: 'Accès refusé. Reconnectez-vous.' };
    }
    return null;
  }

  return {
    PAGE_CONNEXION,
    PAGE_MOT_DE_PASSE,
    PAGE_DENTISTE,
    PAGE_ADMIN,
    sessionDepuisReponse,
    sessionValide,
    destination,
    reactionErreurAcces,
    creerStockage,
    validerIdentifiant,
    validerMotDePasseSaisi,
    validerNouveauMotDePasse,
  };
});
