/*
 * Page de connexion commune aux dentistes et à l'administrateur.
 * Après la connexion, la session (jeton, rôle, nom) est gardée dans sessionStorage pour la durée
 * de l'onglet, puis la personne est envoyée vers la bonne page (voir Session.destination).
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

  const formulaire = document.getElementById('formulaire-connexion');
  const champIdentifiant = document.getElementById('champ-identifiant');
  const champMdp = document.getElementById('champ-mdp');
  const erreurIdentifiant = document.getElementById('erreur-identifiant');
  const erreurMdp = document.getElementById('erreur-mdp');
  const erreurConnexion = document.getElementById('erreur-connexion');
  const bouton = document.getElementById('bouton-connexion');
  const texteBouton = document.getElementById('texte-connexion');
  const notice = document.getElementById('notice');

  const blocDejaConnecte = document.getElementById('deja-connecte');
  const texteDejaConnecte = document.getElementById('texte-deja-connecte');
  const lienContinuer = document.getElementById('continuer');
  const boutonChangerCompte = document.getElementById('changer-compte');

  let envoiEnCours = false;

  window.AfficherMdp.activer(document.getElementById('afficher-mdp'), champMdp);

  function signalerErreur(champ, zone, message) {
    zone.textContent = message;
    if (message) champ.setAttribute('aria-invalid', 'true');
    else champ.removeAttribute('aria-invalid');
  }

  // Message laissé par une autre page (par exemple « Votre session a expiré »)
  const message = stockage.prendreMessage();
  if (message) {
    notice.textContent = message;
    notice.hidden = false;
  }

  // Une session est déjà ouverte : on propose de continuer ou de changer de compte.
  const existante = stockage.lire();
  if (existante) {
    const titre = existante.role === 'admin' ? 'administrateur' : `Dr ${existante.nom}`;
    texteDejaConnecte.textContent = `Vous êtes déjà connecté en tant que ${titre}.`;
    lienContinuer.setAttribute('href', S.destination(existante));
    blocDejaConnecte.hidden = false;
    formulaire.hidden = true;
    lienContinuer.focus();
  } else {
    champIdentifiant.focus();
  }

  boutonChangerCompte.addEventListener('click', () => {
    stockage.effacer();
    blocDejaConnecte.hidden = true;
    notice.hidden = true;
    formulaire.hidden = false;
    champIdentifiant.focus();
  });

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    if (envoiEnCours) return;

    const identifiant = S.validerIdentifiant(champIdentifiant.value);
    const motDePasse = S.validerMotDePasseSaisi(champMdp.value);
    signalerErreur(champIdentifiant, erreurIdentifiant, identifiant.message);
    signalerErreur(champMdp, erreurMdp, motDePasse.message);
    erreurConnexion.textContent = '';

    if (!identifiant.ok) champIdentifiant.focus();
    else if (!motDePasse.ok) champMdp.focus();
    if (!identifiant.ok || !motDePasse.ok) return;

    envoiEnCours = true;
    bouton.disabled = true;
    texteBouton.textContent = 'Connexion…';

    try {
      const reponse = await API.connexion(identifiant.valeur, motDePasse.valeur);
      const session = S.sessionDepuisReponse(reponse);

      if (!stockage.ecrire(session)) {
        erreurConnexion.textContent =
          'Votre navigateur bloque l\'enregistrement de la session. Quittez la navigation privée ou autorisez le stockage, puis réessayez.';
        return;
      }
      window.location.assign(S.destination(session));
    } catch (erreur) {
      erreurConnexion.textContent = V.extraireMessage(erreur.statut, erreur.corps);
      if (erreur.statut === 401) {
        champMdp.value = '';
        champMdp.focus();
      }
    } finally {
      envoiEnCours = false;
      bouton.disabled = false;
      texteBouton.textContent = 'Se connecter';
    }
  });
})();
