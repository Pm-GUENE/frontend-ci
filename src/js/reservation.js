/*
 * Fenêtre de réservation : s'ouvre sur l'événement « creneau:choisi » (émis par la liste des
 * dentistes), vérifie le formulaire, envoie la réservation puis affiche le numéro de rendez-vous.
 *
 * Après une réservation réussie, le numéro et le téléphone sont gardés dans sessionStorage
 * (clé « dentardv.suivi ») pour pré-remplir la page de suivi, sans les mettre dans l'adresse.
 * Les créneaux du dentiste sont rechargés via l'événement « creneaux:rafraichir ».
 */
(function () {
  'use strict';

  const C = window.Creneaux;
  const V = window.Validation;
  const API = window.Api;

  const CLE_SUIVI = 'dentardv.suivi';

  const fenetre = document.getElementById('fenetre-reservation');
  const etapeFormulaire = document.getElementById('etape-formulaire');
  const etapeConfirmation = document.getElementById('etape-confirmation');
  const formulaire = document.getElementById('formulaire-reservation');
  const champNom = document.getElementById('champ-nom');
  const champTel = document.getElementById('champ-tel');
  const champMotif = document.getElementById('champ-motif');
  const erreurNom = document.getElementById('erreur-nom');
  const erreurTel = document.getElementById('erreur-tel');
  const erreurMotif = document.getElementById('erreur-motif');
  const erreurFormulaire = document.getElementById('erreur-formulaire');
  const boutonEnvoyer = document.getElementById('envoyer-reservation');
  const boutonAutreCreneau = document.getElementById('autre-creneau');

  let creneau = null;   // { dentiste, date, heure }
  let envoiEnCours = false;

  function mettreTexte(id, texte) {
    document.getElementById(id).textContent = texte;
  }

  function signalerErreur(champ, zone, message) {
    zone.textContent = message;
    if (message) champ.setAttribute('aria-invalid', 'true');
    else champ.removeAttribute('aria-invalid');
  }

  function effacerErreurs() {
    signalerErreur(champNom, erreurNom, '');
    signalerErreur(champTel, erreurTel, '');
    signalerErreur(champMotif, erreurMotif, '');
    erreurFormulaire.textContent = '';
  }

  function remplirMotifs(dentiste) {
    champMotif.textContent = '';
    const invite = document.createElement('option');
    invite.value = '';
    invite.textContent = 'Choisir un motif';
    champMotif.append(invite);
    dentiste.soins.forEach((soin) => {
      const option = document.createElement('option');
      option.value = String(soin.id);
      option.textContent = soin.libelle;
      champMotif.append(option);
    });
  }

  // ---------- Ouverture et fermeture ----------

  function ouvrir(detail) {
    creneau = detail;
    envoiEnCours = false;

    formulaire.reset();
    effacerErreurs();
    remplirMotifs(detail.dentiste);
    mettreTexte('resume-nom', `Dr ${detail.dentiste.nom}`);
    mettreTexte('resume-date', C.libelleDateLongue(detail.date));
    mettreTexte('resume-heure', detail.heure);

    etapeConfirmation.hidden = true;
    etapeFormulaire.hidden = false;
    boutonEnvoyer.hidden = false;
    boutonEnvoyer.disabled = false;
    boutonEnvoyer.textContent = 'Prendre rendez-vous';
    boutonAutreCreneau.hidden = true;
    fenetre.setAttribute('aria-labelledby', 'titre-reservation');

    fenetre.showModal();
    champNom.focus();
  }

  function fermer() {
    if (fenetre.open) fenetre.close();
  }

  document.addEventListener('creneau:choisi', (evenement) => ouvrir(evenement.detail));
  document.getElementById('fermer-reservation').addEventListener('click', fermer);
  boutonAutreCreneau.addEventListener('click', fermer);

  // Un clic sur le fond sombre (en dehors de la fenêtre) ferme aussi la fenêtre.
  fenetre.addEventListener('click', (evenement) => {
    if (evenement.target === fenetre) fermer();
  });

  // ---------- Envoi ----------

  function verifier() {
    const nom = V.validerNom(champNom.value);
    const tel = V.validerTelephone(champTel.value);
    const motif = V.validerMotif(champMotif.value);

    signalerErreur(champNom, erreurNom, nom.message);
    signalerErreur(champTel, erreurTel, tel.message);
    signalerErreur(champMotif, erreurMotif, motif.message);

    if (!nom.ok) champNom.focus();
    else if (!tel.ok) champTel.focus();
    else if (!motif.ok) champMotif.focus();

    return nom.ok && tel.ok && motif.ok ? { nom: nom.valeur, tel: tel.valeur, motif: motif.valeur } : null;
  }

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    if (envoiEnCours || !creneau) return;

    erreurFormulaire.textContent = '';
    const saisie = verifier();
    if (!saisie) return;

    envoiEnCours = true;
    boutonEnvoyer.disabled = true;
    boutonEnvoyer.textContent = 'Envoi en cours…';

    try {
      const rendezVous = await API.reserver({
        patient_nom: saisie.nom,
        patient_tel: saisie.tel,
        dentiste_id: creneau.dentiste.id,
        soin_id: saisie.motif,
        date: creneau.date,
        heure: creneau.heure,
      });
      afficherConfirmation(rendezVous, saisie.tel);
    } catch (erreur) {
      envoiEnCours = false;
      const message = V.extraireMessage(erreur.statut, erreur.corps);
      erreurFormulaire.textContent = message;

      if (erreur.statut === 409) {
        // Créneau pris par quelqu'un d'autre : on met la grille à jour et on propose d'en choisir un autre.
        boutonEnvoyer.hidden = true;
        boutonAutreCreneau.hidden = false;
        boutonAutreCreneau.focus();
        document.dispatchEvent(
          new CustomEvent('creneaux:rafraichir', { detail: { dentisteId: creneau.dentiste.id } })
        );
      } else {
        boutonEnvoyer.disabled = false;
        boutonEnvoyer.textContent = 'Prendre rendez-vous';
      }
    }
  });

  // ---------- Confirmation ----------

  function afficherConfirmation(rendezVous, telephone) {
    mettreTexte('confirmation-nom', `Dr ${rendezVous.dentiste.nom}`);
    mettreTexte('confirmation-date', C.libelleDateLongue(rendezVous.date));
    mettreTexte('confirmation-heure', C.normaliserHeure(rendezVous.heure));
    mettreTexte('numero-rdv', String(rendezVous.id));

    try {
      sessionStorage.setItem(CLE_SUIVI, JSON.stringify({ id: rendezVous.id, tel: telephone }));
    } catch (_) {
      // Navigation privée ou stockage bloqué : la page de suivi demandera simplement les deux informations.
    }

    etapeFormulaire.hidden = true;
    etapeConfirmation.hidden = false;
    fenetre.setAttribute('aria-labelledby', 'titre-confirmation');
    document.getElementById('titre-confirmation').focus();

    document.dispatchEvent(
      new CustomEvent('creneaux:rafraichir', { detail: { dentisteId: rendezVous.dentiste.id } })
    );
  }
})();
