/*
 * Page de suivi : le patient retrouve son rendez-vous avec son numéro et son téléphone,
 * voit son statut (actualisé toutes les 30 secondes) et peut l'annuler tant que c'est possible.
 *
 * Après une réservation, la fenêtre de confirmation garde le numéro et le téléphone dans
 * sessionStorage (clé « dentardv.suivi ») : la page les reprend pour afficher le rendez-vous
 * directement, sans que ces informations passent par l'adresse de la page.
 */
(function () {
  'use strict';

  const C = window.Creneaux;
  const V = window.Validation;
  const S = window.Statuts;
  const API = window.Api;

  const CLE_SUIVI = 'dentardv.suivi';
  const DELAI_ACTUALISATION = 30000;
  const MESSAGE_INTROUVABLE = 'Rendez-vous introuvable. Vérifiez votre numéro et votre téléphone.';

  const etapeRecherche = document.getElementById('etape-recherche');
  const etapeResultat = document.getElementById('etape-resultat');
  const formulaire = document.getElementById('formulaire-suivi');
  const champNumero = document.getElementById('champ-numero');
  const champTel = document.getElementById('champ-tel-suivi');
  const erreurNumero = document.getElementById('erreur-numero');
  const erreurTel = document.getElementById('erreur-tel-suivi');
  const erreurRecherche = document.getElementById('erreur-recherche');
  const boutonSuivre = document.getElementById('bouton-suivre');

  const statutRdv = document.getElementById('statut-rdv');
  const messageSuivi = document.getElementById('message-suivi');
  const erreurResultat = document.getElementById('erreur-resultat');
  const boutonRetour = document.getElementById('bouton-retour');
  const boutonAnnuler = document.getElementById('bouton-annuler');
  const lienReprendre = document.getElementById('lien-reprendre');

  const fenetreAnnulation = document.getElementById('fenetre-annulation');
  const erreurAnnulation = document.getElementById('erreur-annulation');
  const annulationNon = document.getElementById('annulation-non');
  const annulationOui = document.getElementById('annulation-oui');

  let courant = null;        // { id, tel, rdv } : le rendez-vous affiché
  let minuteur = null;
  let recherche = false;     // une recherche est en cours
  let annulation = false;    // une annulation est en cours

  messageSuivi.setAttribute('tabindex', '-1');

  // ---------- Stockage de la session ----------

  function lireSession() {
    try {
      const brut = sessionStorage.getItem(CLE_SUIVI);
      if (!brut) return null;
      const donnees = JSON.parse(brut);
      return donnees && Number.isInteger(donnees.id) && typeof donnees.tel === 'string' ? donnees : null;
    } catch (_) {
      return null;
    }
  }

  function ecrireSession(id, tel) {
    try {
      sessionStorage.setItem(CLE_SUIVI, JSON.stringify({ id, tel }));
    } catch (_) {
      // Stockage bloqué : la page fonctionne, mais ne se rouvrira pas toute seule après un rechargement.
    }
  }

  function effacerSession() {
    try {
      sessionStorage.removeItem(CLE_SUIVI);
    } catch (_) {
      // Rien à faire.
    }
  }

  // ---------- Affichage ----------

  function signalerErreur(champ, zone, message) {
    zone.textContent = message;
    if (message) champ.setAttribute('aria-invalid', 'true');
    else champ.removeAttribute('aria-invalid');
  }

  function afficherEtape(nom) {
    etapeRecherche.hidden = nom !== 'recherche';
    etapeResultat.hidden = nom !== 'resultat';
  }

  function afficherResultat(rdv) {
    const vue = S.messageSuivi(rdv, C.libelleDateLongue(rdv.date));

    statutRdv.textContent = vue.etiquette;
    statutRdv.dataset.statut = vue.statut;
    messageSuivi.textContent = vue.texte;

    document.getElementById('detail-numero').textContent = String(rdv.id);
    document.getElementById('detail-dentiste').textContent = `Dr ${rdv.dentiste.nom}`;
    document.getElementById('detail-date').textContent = C.libelleDateLongue(rdv.date);
    document.getElementById('detail-heure').textContent = C.normaliserHeure(rdv.heure);
    document.getElementById('detail-motif').textContent = rdv.soin.libelle;

    boutonAnnuler.hidden = !vue.peutAnnuler;
    lienReprendre.hidden = !vue.peutReprendre;
    erreurResultat.textContent = '';
  }

  // ---------- Recherche ----------

  async function chercher(id, tel, depuisSession) {
    recherche = true;
    boutonSuivre.disabled = true;
    boutonSuivre.textContent = 'Recherche…';
    erreurRecherche.textContent = '';

    try {
      const rdv = await API.suivre(id, tel);
      courant = { id, tel, rdv };
      ecrireSession(id, tel);
      afficherResultat(rdv);
      afficherEtape('resultat');
      demarrerActualisation();
      messageSuivi.focus();
    } catch (erreur) {
      if (depuisSession) effacerSession();
      erreurRecherche.textContent =
        erreur.statut === 404 ? MESSAGE_INTROUVABLE : V.extraireMessage(erreur.statut, erreur.corps);
      afficherEtape('recherche');
    } finally {
      recherche = false;
      boutonSuivre.disabled = false;
      boutonSuivre.textContent = 'Suivre mon rendez-vous';
    }
  }

  formulaire.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    if (recherche) return;

    const numero = S.validerNumero(champNumero.value);
    const tel = V.validerTelephone(champTel.value);
    signalerErreur(champNumero, erreurNumero, numero.message);
    signalerErreur(champTel, erreurTel, tel.message);
    erreurRecherche.textContent = '';

    if (!numero.ok) champNumero.focus();
    else if (!tel.ok) champTel.focus();
    if (!numero.ok || !tel.ok) return;

    chercher(numero.valeur, tel.valeur, false);
  });

  // ---------- Actualisation automatique ----------

  async function actualiser() {
    if (!courant || recherche || annulation) return;
    try {
      const rdv = await API.suivre(courant.id, courant.tel);
      const change = rdv.statut !== courant.rdv.statut || rdv.annulable !== courant.rdv.annulable;
      courant.rdv = rdv;
      if (change) afficherResultat(rdv);
    } catch (_) {
      // Coupure passagère : on garde l'affichage actuel et on réessaiera au prochain passage.
    }
  }

  function demarrerActualisation() {
    arreterActualisation();
    minuteur = setInterval(() => {
      if (!document.hidden) actualiser();
    }, DELAI_ACTUALISATION);
  }

  function arreterActualisation() {
    if (minuteur) clearInterval(minuteur);
    minuteur = null;
  }

  // Au retour sur l'onglet, on met tout de suite à jour sans attendre le prochain passage.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) actualiser();
  });

  // ---------- Retour ----------

  boutonRetour.addEventListener('click', () => {
    arreterActualisation();
    courant = null;
    effacerSession();
    formulaire.reset();
    signalerErreur(champNumero, erreurNumero, '');
    signalerErreur(champTel, erreurTel, '');
    erreurRecherche.textContent = '';
    afficherEtape('recherche');
    champNumero.focus();
  });

  // ---------- Annulation par le patient ----------

  boutonAnnuler.addEventListener('click', () => {
    erreurAnnulation.textContent = '';
    fenetreAnnulation.showModal();
    annulationNon.focus(); // le choix le plus sûr est sélectionné par défaut
  });

  annulationNon.addEventListener('click', () => fenetreAnnulation.close());

  fenetreAnnulation.addEventListener('click', (evenement) => {
    if (evenement.target === fenetreAnnulation) fenetreAnnulation.close();
  });

  annulationOui.addEventListener('click', async () => {
    if (!courant || annulation) return;
    annulation = true;
    annulationOui.disabled = true;
    annulationNon.disabled = true;
    annulationOui.textContent = 'Annulation…';

    try {
      const rdv = await API.annuler(courant.id, courant.tel);
      courant.rdv = rdv;
      fenetreAnnulation.close();
      afficherResultat(rdv);
      messageSuivi.focus();
    } catch (erreur) {
      // Le plus souvent : le rendez-vous a changé entre-temps (déjà annulé, terminé ou passé).
      const message = V.extraireMessage(erreur.statut, erreur.corps);
      fenetreAnnulation.close();
      annulation = false;
      await actualiser();
      erreurResultat.textContent = message;
    } finally {
      annulation = false;
      annulationOui.disabled = false;
      annulationNon.disabled = false;
      annulationOui.textContent = 'Oui, annuler';
    }
  });

  // ---------- Démarrage ----------

  const memorise = lireSession();
  if (memorise) {
    champNumero.value = String(memorise.id);
    champTel.value = V.formaterTelephone(memorise.tel);
    chercher(memorise.id, memorise.tel, true);
  } else {
    afficherEtape('recherche');
    champNumero.focus();
  }
})();
