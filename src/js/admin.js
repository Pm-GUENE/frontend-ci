/*
 * Espace administrateur : liste des dentistes et création d'un compte dentiste.
 * L'identifiant et le mot de passe temporaire sont générés par le backend ; le mot de passe n'est
 * renvoyé qu'une seule fois. Il n'est affiché que dans la fenêtre « Dentiste créé » et effacé
 * dès qu'elle se ferme : il n'est ni gardé en mémoire, ni stocké dans le navigateur.
 */
(function () {
  'use strict';

  const V = window.Validation;
  const S = window.Session;
  const D = window.Dentistes;
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

  // Pas de session : connexion. Session d'un dentiste : son propre espace.
  if (!session) {
    window.location.replace(S.PAGE_CONNEXION);
    return;
  }
  if (session.role !== 'admin') {
    window.location.replace(S.destination(session));
    return;
  }

  const liste = document.getElementById('liste-admin');
  const zoneEtat = document.getElementById('etat-admin');

  const fenetre = document.getElementById('fenetre-ajout');
  const etapeSaisie = document.getElementById('etape-saisie');
  const etapeCree = document.getElementById('etape-cree');
  const formulaire = document.getElementById('formulaire-ajout');
  const champNom = document.getElementById('champ-nom-dentiste');
  const champSpecialite = document.getElementById('champ-specialite');
  const choixMotifs = document.getElementById('choix-motifs');
  const erreurNom = document.getElementById('erreur-nom-dentiste');
  const erreurSpecialite = document.getElementById('erreur-specialite');
  const erreurMotifs = document.getElementById('erreur-motifs');
  const erreurAjout = document.getElementById('erreur-ajout');
  const boutonCreer = document.getElementById('bouton-creer');

  const valeurIdentifiant = document.getElementById('valeur-identifiant');
  const valeurMdp = document.getElementById('valeur-mdp');
  const boutonTerminer = document.getElementById('bouton-terminer');
  const confirmationFermeture = document.getElementById('confirmation-fermeture');

  let soins = [];
  let selection = [];
  let nouveauId = null;      // dentiste créé pendant cette visite, pour le repérer dans la liste
  let creationFaite = false; // la liste doit être rechargée à la fermeture de la fenêtre
  let mdpCopie = false;
  let envoiEnCours = false;

  /** Crée un élément. Le texte passe par textContent : aucune donnée de l'API n'est interprétée comme du HTML. */
  function el(balise, proprietes, ...enfants) {
    const noeud = document.createElement(balise);
    Object.entries(proprietes || {}).forEach(([cle, valeur]) => {
      if (valeur === false || valeur === null || valeur === undefined) return;
      if (cle === 'class') noeud.className = valeur;
      else if (cle === 'texte') noeud.textContent = valeur;
      else noeud.setAttribute(cle, valeur === true ? '' : valeur);
    });
    enfants.forEach((enfant) => {
      if (enfant) noeud.append(enfant);
    });
    return noeud;
  }

  // ---------- Session ----------

  function deconnecter(message) {
    stockage.effacer();
    if (message) stockage.poserMessage(message);
    window.location.replace(S.PAGE_CONNEXION);
  }

  /** Retourne vrai si l'erreur concernait la session (la page est alors quittée). */
  function erreurDeSession(erreur) {
    if (erreur.statut === 401) {
      deconnecter('Votre session a expiré. Reconnectez-vous.');
      return true;
    }
    if (erreur.statut === 403) {
      window.location.replace(S.destination(session));
      return true;
    }
    return false;
  }

  document.getElementById('deconnexion').addEventListener('click', () => deconnecter());

  // ---------- Liste des dentistes ----------

  function afficherMessage(texte) {
    zoneEtat.textContent = texte;
  }

  function afficherErreur(texte, actionLibelle, action) {
    zoneEtat.textContent = '';
    const bouton = el('button', { type: 'button', class: 'lien-bouton', texte: actionLibelle });
    bouton.addEventListener('click', action);
    zoneEtat.append(el('span', { texte: texte + ' ' }), bouton);
  }

  function creerCarte(dentiste) {
    const titre = el('h2', { texte: D.nomAffiche(dentiste.nom) });
    if (dentiste.id === nouveauId) {
      titre.append(' ', el('span', { class: 'badge-nouveau', texte: 'Nouveau' }));
    }
    return el(
      'li',
      { class: 'carte-admin' },
      el('img', { class: 'avatar', src: 'assets/avatar-medecin.png', alt: '', width: '64', height: '64' }),
      el(
        'div',
        { class: 'carte-admin-texte' },
        titre,
        el('p', { class: 'specialite', texte: dentiste.specialite }),
        el('p', { class: 'identifiant', texte: `Identifiant : ${dentiste.identifiant}` }),
        el('p', { class: 'libelle-motifs', texte: 'Motifs proposés :' }),
        el('div', { class: 'puces' }, ...dentiste.soins.map((soin) => el('span', { class: 'puce', texte: soin.libelle })))
      )
    );
  }

  async function chargerListe() {
    afficherMessage('Chargement des dentistes…');
    liste.setAttribute('aria-busy', 'true');
    try {
      const dentistes = await API.dentistesAdmin(session.token);
      liste.textContent = '';
      dentistes.forEach((dentiste) => liste.append(creerCarte(dentiste)));
      afficherMessage(
        dentistes.length === 0
          ? 'Aucun dentiste pour le moment. Utilisez « Ajouter un dentiste ».'
          : dentistes.length === 1 ? '1 dentiste.' : `${dentistes.length} dentistes.`
      );
    } catch (erreur) {
      if (erreurDeSession(erreur)) return;
      liste.textContent = '';
      const code = erreur.statut ? ` (erreur ${erreur.statut})` : '';
      afficherErreur(`Impossible de charger les dentistes${code}.`, 'Réessayer', chargerListe);
    } finally {
      liste.removeAttribute('aria-busy');
    }
  }

  // ---------- Motifs à cocher ----------

  async function chargerSoins() {
    try {
      soins = await API.soins();
    } catch (_) {
      soins = [];
    }
    dessinerMotifs();
  }

  function dessinerMotifs() {
    choixMotifs.textContent = '';
    soins.forEach((soin) => {
      const case_ = el('input', { type: 'checkbox', value: String(soin.id), name: 'motifs' });
      case_.checked = selection.includes(soin.id);
      case_.addEventListener('change', () => {
        selection = D.basculerMotif(selection, soin.id);
        erreurMotifs.textContent = '';
      });
      choixMotifs.append(el('label', { class: 'puce-choix' }, case_, el('span', { texte: soin.libelle })));
    });
  }

  // ---------- Fenêtre d'ajout ----------

  function signalerErreur(champ, zone, message) {
    zone.textContent = message;
    if (champ) {
      if (message) champ.setAttribute('aria-invalid', 'true');
      else champ.removeAttribute('aria-invalid');
    }
  }

  async function ouvrirAjout() {
    formulaire.reset();
    selection = [];
    envoiEnCours = false;
    signalerErreur(champNom, erreurNom, '');
    signalerErreur(champSpecialite, erreurSpecialite, '');
    signalerErreur(null, erreurMotifs, '');
    erreurAjout.textContent = '';
    boutonCreer.disabled = false;
    boutonCreer.textContent = 'Créer';

    etapeCree.hidden = true;
    etapeSaisie.hidden = false;
    fenetre.setAttribute('aria-labelledby', 'titre-ajout');
    dessinerMotifs();

    fenetre.showModal();
    champNom.focus();

    if (soins.length === 0) {
      await chargerSoins();
      if (soins.length === 0) {
        erreurAjout.textContent = "Les motifs de consultation n'ont pas pu être chargés. Fermez cette fenêtre et réessayez.";
      }
    }
  }

  document.getElementById('ouvrir-ajout').addEventListener('click', ouvrirAjout);

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    if (envoiEnCours) return;

    const verification = D.validerNouveauDentiste({
      nom: champNom.value,
      specialite: champSpecialite.value,
      soinIds: selection,
    });
    signalerErreur(champNom, erreurNom, verification.erreurs.nom);
    signalerErreur(champSpecialite, erreurSpecialite, verification.erreurs.specialite);
    signalerErreur(null, erreurMotifs, verification.erreurs.motifs);
    erreurAjout.textContent = '';

    if (!verification.ok) {
      if (verification.erreurs.nom) champNom.focus();
      else if (verification.erreurs.specialite) champSpecialite.focus();
      else {
        const premiere = choixMotifs.querySelector('input');
        if (premiere) premiere.focus();
      }
      return;
    }

    envoiEnCours = true;
    boutonCreer.disabled = true;
    boutonCreer.textContent = 'Création…';

    try {
      const cree = await API.creerDentiste(session.token, {
        nom: verification.valeurs.nom,
        specialite: verification.valeurs.specialite,
        soin_ids: verification.valeurs.soinIds,
      });
      afficherCree(cree);
    } catch (erreur) {
      if (erreurDeSession(erreur)) return;
      erreurAjout.textContent = V.extraireMessage(erreur.statut, erreur.corps);
      envoiEnCours = false;
      boutonCreer.disabled = false;
      boutonCreer.textContent = 'Créer';
    }
  });

  // ---------- Écran « Dentiste créé » ----------

  function afficherCree(cree) {
    nouveauId = cree.id;
    creationFaite = true;
    mdpCopie = false;

    document.getElementById('resume-cree').textContent = `Le compte de ${D.nomAffiche(cree.nom)} a été créé.`;
    valeurIdentifiant.value = cree.identifiant;
    valeurMdp.value = cree.mot_de_passe_temporaire;
    initialiserBoutonCopie(document.getElementById('copier-identifiant'));
    initialiserBoutonCopie(document.getElementById('copier-mdp'));

    confirmationFermeture.hidden = true;
    boutonTerminer.hidden = false;
    etapeSaisie.hidden = true;
    etapeCree.hidden = false;
    fenetre.setAttribute('aria-labelledby', 'titre-cree');
    document.getElementById('titre-cree').focus();
  }

  function initialiserBoutonCopie(bouton) {
    bouton.textContent = 'Copier';
    bouton.classList.remove('bouton-copie-ok');
  }

  async function copier(champ, bouton, estMotDePasse) {
    let reussi = false;
    try {
      await navigator.clipboard.writeText(champ.value);
      reussi = true;
    } catch (_) {
      // Presse-papiers refusé (page non sécurisée, autorisation refusée) : on essaie la sélection manuelle.
      champ.focus();
      champ.select();
      try {
        reussi = document.execCommand('copy');
      } catch (__) {
        reussi = false;
      }
    }

    if (reussi) {
      bouton.textContent = 'Copié';
      bouton.classList.add('bouton-copie-ok');
      if (estMotDePasse) mdpCopie = true;
    } else {
      bouton.textContent = 'Sélectionnez et copiez à la main';
    }
  }

  document.getElementById('copier-identifiant').addEventListener('click', (e) => copier(valeurIdentifiant, e.currentTarget, false));
  document.getElementById('copier-mdp').addEventListener('click', (e) => copier(valeurMdp, e.currentTarget, true));

  // Une copie manuelle (Ctrl+C sur le champ) compte aussi.
  valeurMdp.addEventListener('copy', () => { mdpCopie = true; });

  // ---------- Fermeture de la fenêtre ----------

  function ecranCreeAffiche() {
    return !etapeCree.hidden;
  }

  function demanderFermeture() {
    if (ecranCreeAffiche() && !mdpCopie) {
      confirmationFermeture.hidden = false;
      boutonTerminer.hidden = true;
      document.getElementById('fermeture-retour').focus();
      return;
    }
    if (fenetre.open) fenetre.close();
  }

  document.getElementById('fermer-ajout').addEventListener('click', demanderFermeture);
  boutonTerminer.addEventListener('click', demanderFermeture);

  document.getElementById('fermeture-retour').addEventListener('click', () => {
    confirmationFermeture.hidden = true;
    boutonTerminer.hidden = false;
    document.getElementById('copier-mdp').focus();
  });

  document.getElementById('fermeture-confirmer').addEventListener('click', () => {
    if (fenetre.open) fenetre.close();
  });

  // Un clic sur le fond sombre se comporte comme la croix.
  fenetre.addEventListener('click', (evenement) => {
    if (evenement.target === fenetre) demanderFermeture();
  });

  // La touche Échap passe aussi par la demande de confirmation si le mot de passe n'est pas copié.
  fenetre.addEventListener('cancel', (evenement) => {
    if (ecranCreeAffiche() && !mdpCopie) {
      evenement.preventDefault();
      if (confirmationFermeture.hidden) {
        confirmationFermeture.hidden = false;
        boutonTerminer.hidden = true;
        document.getElementById('fermeture-retour').focus();
      } else {
        confirmationFermeture.hidden = true;
        boutonTerminer.hidden = false;
      }
    }
  });

  // Quelle que soit la façon de fermer : on efface le mot de passe, puis on recharge la liste.
  fenetre.addEventListener('close', () => {
    valeurMdp.value = '';
    valeurIdentifiant.value = '';
    mdpCopie = false;
    if (creationFaite) {
      creationFaite = false;
      chargerListe();
    }
  });

  // ---------- Démarrage ----------

  chargerListe();
  chargerSoins();
})();
