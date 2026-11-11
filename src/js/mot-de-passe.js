/*
 * Changement de mot de passe obligatoire à la première connexion d'un dentiste.
 * La page n'est accessible qu'avec une session de dentiste dont le mot de passe est encore
 * temporaire ; dans les autres cas, la personne est renvoyée vers la bonne page.
 */
(function () {
  'use strict';

  const V = window.Validation;
  const S = window.Session;
  const API = window.Api;

  function stockageNavigateur() {
    try {
      return window.sessionStorage;
    } catch (_) {
      const bloque = () => { throw new Error('stockage bloqué'); };
      return { getItem: bloque, setItem: bloque, removeItem: bloque };
    }
  }

  const stockage = S.creerStockage(stockageNavigateur());
  const session = stockage.lire();

  // Pas de session : connexion. Session sans mot de passe temporaire (ou administrateur) : son espace.
  if (!session) {
    window.location.replace(S.PAGE_CONNEXION);
    return;
  }
  if (session.role !== 'dentiste' || !session.doit_changer_mdp) {
    window.location.replace(S.destination(session));
    return;
  }

  const formulaire = document.getElementById('formulaire-mdp');
  const champNouveau = document.getElementById('champ-nouveau');
  const champConfirmation = document.getElementById('champ-confirmation');
  const erreurNouveau = document.getElementById('erreur-nouveau');
  const erreurConfirmation = document.getElementById('erreur-confirmation');
  const erreurFormulaire = document.getElementById('erreur-mdp');
  const bouton = document.getElementById('bouton-enregistrer');
  const texteBouton = document.getElementById('texte-enregistrer');

  let envoiEnCours = false;

  document.getElementById('intro-mdp').textContent =
    `Bonjour Dr ${session.nom}. Pour votre sécurité, choisissez un nouveau mot de passe avant de continuer.`;

  window.AfficherMdp.activer(document.getElementById('afficher-nouveau'), champNouveau);
  window.AfficherMdp.activer(document.getElementById('afficher-confirmation'), champConfirmation);

  function signalerErreur(champ, zone, message) {
    zone.textContent = message;
    if (message) champ.setAttribute('aria-invalid', 'true');
    else champ.removeAttribute('aria-invalid');
  }

  document.getElementById('deconnexion').addEventListener('click', () => {
    stockage.effacer();
    window.location.assign(S.PAGE_CONNEXION);
  });

  champNouveau.focus();

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    if (envoiEnCours) return;

    const verification = S.validerNouveauMotDePasse(champNouveau.value, champConfirmation.value);
    signalerErreur(champNouveau, erreurNouveau, verification.erreurs.nouveau);
    signalerErreur(champConfirmation, erreurConfirmation, verification.erreurs.confirmation);
    erreurFormulaire.textContent = '';

    if (!verification.ok) {
      (verification.erreurs.nouveau ? champNouveau : champConfirmation).focus();
      return;
    }

    envoiEnCours = true;
    bouton.disabled = true;
    texteBouton.textContent = 'Enregistrement…';

    try {
      await API.changerMotDePasse(session.token, champNouveau.value, champConfirmation.value);
      session.doit_changer_mdp = false;
      stockage.ecrire(session);
      window.location.assign(S.destination(session));
    } catch (erreur) {
      if (erreur.statut === 401) {
        // Jeton expiré ou invalide : on repart de la connexion.
        stockage.effacer();
        stockage.poserMessage('Votre session a expiré. Reconnectez-vous.');
        window.location.replace(S.PAGE_CONNEXION);
        return;
      }
      erreurFormulaire.textContent = V.extraireMessage(erreur.statut, erreur.corps);
    } finally {
      envoiEnCours = false;
      bouton.disabled = false;
      texteBouton.textContent = 'Enregistrer et continuer';
    }
  });
})();
