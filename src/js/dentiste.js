/*
 * Espace dentiste : planning de la semaine, liste filtrée, demandes en attente, rappel à 15 minutes
 * et changement de statut des rendez-vous. Les notifications et le planning se mettent à jour
 * toutes les 30 secondes. Les actions proposées sur un rendez-vous viennent du backend
 * (champ actions_possibles) : le frontend n'invente aucune règle de statut.
 */
(function () {
  'use strict';

  const C = window.Creneaux;
  const V = window.Validation;
  const ST = window.Statuts;
  const S = window.Session;
  const A = window.Agenda;
  const API = window.Api;

  const DELAI_ACTUALISATION = 30000;
  const SEMAINES_AFFICHABLES = 12; // de chaque côté de la semaine courante

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

  // Seul un dentiste ayant déjà changé son mot de passe temporaire reste ici.
  if (!session) {
    window.location.replace(S.PAGE_CONNEXION);
    return;
  }
  if (S.destination(session) !== S.PAGE_DENTISTE) {
    window.location.replace(S.destination(session));
    return;
  }

  const lundiCourant = C.lundiDeLaSemaine(new Date());
  const etat = {
    lundi: lundiCourant,
    rdvSemaine: [],
    rdvListe: [],
    notifications: { nombre: 0, nouveaux_rendez_vous: [], rappels: [] },
    onglet: 'planning',
    detailId: null,
    aAnnuler: null,
    soins: [],
    compteurs: { planning: 0, liste: 0, notifications: 0 }, // numéro de la dernière requête, pour ignorer les réponses périmées
    actionEnCours: false,
  };

  // ---------- Éléments de la page ----------

  const $ = (id) => document.getElementById(id);

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

  const ICONE_VALIDER =
    '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#1a9d4a"/>' +
    '<path d="M6.500 12.500l3.600 3.600 7.400-8" fill="none" stroke="#fff" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICONE_REFUSER =
    '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#e8453c"/>' +
    '<path d="M8 8l8 8M16 8l-8 8" fill="none" stroke="#fff" stroke-width="2.400" stroke-linecap="round"/></svg>';

  // ---------- Session et erreurs ----------

  function deconnecter(message) {
    stockage.effacer();
    if (message) stockage.poserMessage(message);
    window.location.replace(S.PAGE_CONNEXION);
  }

  /**
   * Retourne vrai si l'erreur concernait la session (la page est alors quittée).
   * `chargement` : vrai pour le chargement des données (tout 403 est un problème de droits),
   * faux pour une action sur un rendez-vous (un 403 « ce rendez-vous ne vous appartient pas »
   * reste un message à l'écran).
   * Si le backend exige le changement du mot de passe temporaire alors que la session du navigateur
   * l'ignorait, on corrige la session et on envoie le dentiste sur la page de changement.
   */
  function erreurDeSession(erreur, chargement = true) {
    const reaction = S.reactionErreurAcces(erreur.statut, erreur.corps, session, chargement);
    if (!reaction) return false;
    if (reaction.type === 'mot_de_passe') {
      session.doit_changer_mdp = true;
      stockage.ecrire(session);
      window.location.replace(S.PAGE_MOT_DE_PASSE);
      return true;
    }
    deconnecter(reaction.message);
    return true;
  }

  $('deconnexion').addEventListener('click', () => deconnecter());
  $('nom-dentiste').textContent = `Dr ${session.nom}`;

  function afficherErreur(zone, texte, erreur, actionLibelle, action) {
    const code = erreur && erreur.statut ? ` (erreur ${erreur.statut})` : '';
    zone.textContent = '';
    const bouton = el('button', { type: 'button', class: 'lien-bouton', texte: actionLibelle });
    bouton.addEventListener('click', action);
    zone.append(el('span', { texte: `${texte}${code}. ` }), bouton);
  }

  // ---------- Libellés ----------

  function quand(rdv) {
    const jour = C.libelleJour(C.depuisISO(rdv.date));
    return `${jour.nom} ${jour.court}, ${C.normaliserHeure(rdv.heure)}`;
  }

  function badgeStatut(statut) {
    const badge = el('span', { class: 'statut', texte: ST.libelleStatut(statut) });
    badge.dataset.statut = statut;
    return badge;
  }

  // ---------- Notifications : pastille, rappel, demandes en attente ----------

  async function chargerNotifications() {
    const numero = ++etat.compteurs.notifications;
    try {
      const donnees = await API.mesNotifications(session.token);
      if (numero !== etat.compteurs.notifications) return;
      etat.notifications = donnees;
      dessinerNotifications();
    } catch (erreur) {
      if (erreurDeSession(erreur)) return;
      if (numero !== etat.compteurs.notifications) return;
      if (etat.notifications.nombre === 0 && etat.notifications.nouveaux_rendez_vous.length === 0) {
        afficherErreur($('etat-demandes'), 'Impossible de charger les demandes', erreur, 'Réessayer', chargerNotifications);
      }
    }
  }

  function dessinerNotifications() {
    const { nombre, nouveaux_rendez_vous: demandes, rappels } = etat.notifications;

    // Pastille de comptage dans l'en-tête
    const pastille = $('pastille');
    pastille.hidden = nombre === 0;
    pastille.textContent = String(nombre);
    pastille.setAttribute('aria-label', nombre === 1 ? '1 notification' : `${nombre} notifications`);
    pastille.title = pastille.getAttribute('aria-label');

    // Bannière de rappel (rendez-vous confirmés dans moins de 15 minutes)
    const bandeau = $('bandeau-rappel');
    bandeau.textContent = '';
    rappels.forEach((rappel) => bandeau.append(el('p', { texte: A.messageRappel(rappel) })));
    bandeau.hidden = rappels.length === 0;

    // Demandes en attente
    $('compte-demandes').textContent = demandes.length > 0 ? `(${demandes.length})` : '';
    $('etat-demandes').textContent = demandes.length === 0 ? 'Aucune demande en attente.' : '';
    const liste = $('liste-demandes');
    liste.textContent = '';
    demandes.forEach((demande) => liste.append(creerDemande(demande)));
  }

  function creerDemande(demande) {
    const texte = el(
      'button',
      {
        type: 'button',
        class: 'demande-texte',
        'aria-label': `Voir le détail du rendez-vous de ${demande.patient_nom}, ${quand(demande)}`,
      },
      el('span', { class: 'demande-quand', texte: quand(demande) }),
      el('span', { class: 'demande-patient', texte: demande.patient_nom }),
      el('span', { class: 'demande-motif', texte: demande.motif })
    );
    texte.addEventListener('click', () => ouvrirDetailParId(demande.id, demande.date));

    const confirmer = el('button', {
      type: 'button',
      class: 'bouton-rond',
      title: 'Confirmer le rendez-vous',
      'aria-label': `Confirmer le rendez-vous de ${demande.patient_nom}`,
    });
    confirmer.innerHTML = ICONE_VALIDER;
    confirmer.addEventListener('click', () => agir(demande.id, 'confirme', $('alerte-action')));

    const refuser = el('button', {
      type: 'button',
      class: 'bouton-rond',
      title: 'Annuler le rendez-vous',
      'aria-label': `Annuler le rendez-vous de ${demande.patient_nom}`,
    });
    refuser.innerHTML = ICONE_REFUSER;
    refuser.addEventListener('click', () => ouvrirAnnulation({ id: demande.id, patient_nom: demande.patient_nom, date: demande.date, heure: demande.heure }));

    return el('li', { class: 'demande' }, texte, el('div', { class: 'demande-actions' }, confirmer, refuser));
  }

  // ---------- Planning de la semaine ----------

  function joursDeLaSemaine() {
    return C.joursOuvres(etat.lundi);
  }

  function majNavigationSemaine() {
    const ecart = C.ecartEnSemaines(lundiCourant, etat.lundi);
    $('semaine-precedente').disabled = ecart <= -SEMAINES_AFFICHABLES;
    $('semaine-suivante').disabled = ecart >= SEMAINES_AFFICHABLES;
    const jours = joursDeLaSemaine();
    const premier = C.libelleJour(jours[0]);
    const dernier = C.libelleJour(jours[4]);
    $('titre-semaine').textContent = `Semaine du ${premier.court} au ${dernier.court} ${jours[4].getFullYear()}`;
  }

  async function chargerPlanning() {
    const numero = ++etat.compteurs.planning;
    const jours = joursDeLaSemaine();
    $('grille-planning').setAttribute('aria-busy', 'true');
    try {
      const rdvs = await API.mesRendezVous(session.token, { du: C.versISO(jours[0]), au: C.versISO(jours[4]) });
      if (numero !== etat.compteurs.planning) return;
      etat.rdvSemaine = rdvs;
      $('etat-planning').textContent = '';
      dessinerPlanning();
    } catch (erreur) {
      if (erreurDeSession(erreur)) return;
      if (numero !== etat.compteurs.planning) return;
      afficherErreur($('etat-planning'), 'Impossible de charger le planning', erreur, 'Réessayer', chargerPlanning);
    } finally {
      if (numero === etat.compteurs.planning) $('grille-planning').removeAttribute('aria-busy');
    }
  }

  function dessinerPlanning() {
    const jours = joursDeLaSemaine();
    const aujourdhui = C.versISO(new Date());
    const grille = $('grille-planning');
    grille.textContent = '';

    jours.forEach((jour) => {
      const libelle = C.libelleJour(jour);
      const entete = el('div', { class: 'jour', 'aria-hidden': 'true' }, el('span', { texte: libelle.nom }), el('span', { texte: libelle.court }));
      if (C.versISO(jour) === aujourdhui) entete.classList.add('jour-courant');
      grille.append(entete);
    });

    const agenda = A.construireAgenda(etat.rdvSemaine, jours.map(C.versISO), C.horaires(), new Date());
    agenda.forEach((ligne) => {
      ligne.cases.forEach((cellule) => grille.append(creerCase(cellule)));
    });
  }

  function creerCase(cellule) {
    if (!cellule.rdv) {
      const libelle = cellule.etat === 'passe' ? 'passé' : 'libre';
      return el(
        'span',
        { class: `case case-${cellule.etat}` },
        el('span', { class: 'case-heure', texte: cellule.heure }),
        el('span', { class: 'visuellement-cache', texte: ` ${C.libelleDateLongue(cellule.date)}, ${libelle}` })
      );
    }

    const rdv = cellule.rdv;
    const bouton = el(
      'button',
      {
        type: 'button',
        class: `case case-${cellule.etat} case-rdv`,
        title: `${rdv.patient_nom} : ${rdv.soin.libelle}`,
        'aria-label': `${C.libelleDateLongue(cellule.date)} à ${cellule.heure}, ${ST.libelleStatut(rdv.statut)}, ${rdv.patient_nom}. Ouvrir le détail`,
      },
      el('span', { class: 'case-heure', texte: cellule.heure }),
      el('span', { class: 'case-nom', texte: A.nomCourt(rdv.patient_nom) })
    );
    bouton.addEventListener('click', () => ouvrirDetail(rdv));
    return bouton;
  }

  function changerSemaine(sens) {
    etat.lundi = C.ajouterJours(etat.lundi, 7 * sens);
    majNavigationSemaine();
    chargerPlanning();
  }

  $('semaine-precedente').addEventListener('click', () => changerSemaine(-1));
  $('semaine-suivante').addEventListener('click', () => changerSemaine(1));

  // Légende des couleurs
  A.LEGENDE.forEach((entree) => {
    $('legende').append(
      el('li', {}, el('span', { class: `echantillon case-${entree.etat}`, 'aria-hidden': 'true' }), ` ${entree.libelle}`)
    );
  });

  // ---------- Liste filtrée ----------

  function filtres() {
    return { date: $('filtre-date').value, soinId: $('filtre-motif').value, statut: $('filtre-statut').value };
  }

  async function chargerSoins() {
    try {
      etat.soins = await API.soins();
    } catch (_) {
      etat.soins = [];
    }
    const menu = $('filtre-motif');
    const choix = menu.value;
    menu.textContent = '';
    menu.append(el('option', { value: '', texte: 'Tous les motifs' }));
    etat.soins.forEach((soin) => menu.append(el('option', { value: String(soin.id), texte: soin.libelle })));
    menu.value = choix;
  }

  async function chargerListe() {
    const numero = ++etat.compteurs.liste;
    const actuels = filtres();
    $('reinitialiser-filtres').hidden = !A.filtresActifs(actuels);
    $('liste-rdv').setAttribute('aria-busy', 'true');
    try {
      const rdvs = await API.mesRendezVous(session.token, A.parametresListe(actuels));
      if (numero !== etat.compteurs.liste) return;
      etat.rdvListe = rdvs;
      dessinerListe(actuels);
    } catch (erreur) {
      if (erreurDeSession(erreur)) return;
      if (numero !== etat.compteurs.liste) return;
      afficherErreur($('etat-liste-rdv'), 'Impossible de charger les rendez-vous', erreur, 'Réessayer', chargerListe);
    } finally {
      if (numero === etat.compteurs.liste) $('liste-rdv').removeAttribute('aria-busy');
    }
  }

  function dessinerListe(actuels) {
    const liste = $('liste-rdv');
    liste.textContent = '';
    const n = etat.rdvListe.length;
    $('etat-liste-rdv').textContent =
      n === 0
        ? (A.filtresActifs(actuels) ? 'Aucun rendez-vous ne correspond à ces filtres.' : "Vous n'avez aucun rendez-vous pour le moment.")
        : (n === 1 ? '1 rendez-vous.' : `${n} rendez-vous.`);
    etat.rdvListe.forEach((rdv) => liste.append(creerCarteRdv(rdv)));
  }

  function creerCarteRdv(rdv) {
    const tel = el('a', { href: V.lienTelephone(rdv.patient_tel), texte: V.formaterTelephone(rdv.patient_tel) });

    const actions = el('div', { class: 'carte-rdv-actions' });
    A.actionsOrdonnees(rdv.actions_possibles).forEach((action) => {
      const bouton = el('button', {
        type: 'button',
        class: action === 'annule' ? 'bouton-petit bouton-petit-rouge' : 'bouton-petit',
        texte: A.libelleActionCourt(action),
        'aria-label': `${A.libelleAction(action)} de ${rdv.patient_nom}`,
      });
      bouton.addEventListener('click', () => {
        if (action === 'annule') ouvrirAnnulation(rdv);
        else agir(rdv.id, action, $('alerte-action'));
      });
      actions.append(bouton);
    });
    const detail = el('button', { type: 'button', class: 'bouton-petit bouton-petit-contour', texte: 'Détail', 'aria-label': `Voir le détail du rendez-vous de ${rdv.patient_nom}` });
    detail.addEventListener('click', () => ouvrirDetail(rdv));
    actions.append(detail);

    return el(
      'li',
      { class: 'carte-rdv' },
      el(
        'div',
        { class: 'carte-rdv-quand' },
        el('strong', { texte: C.libelleDateLongue(rdv.date) }),
        el('span', { texte: ` à ${C.normaliserHeure(rdv.heure)}` })
      ),
      el('div', { class: 'carte-rdv-corps' }, el('p', { class: 'carte-rdv-patient' }, `${rdv.patient_nom} · `, tel), el('p', { class: 'carte-rdv-motif', texte: rdv.soin.libelle })),
      badgeStatut(rdv.statut),
      actions
    );
  }

  ['filtre-date', 'filtre-motif', 'filtre-statut'].forEach((id) => $(id).addEventListener('change', chargerListe));
  $('filtres').addEventListener('submit', (evenement) => evenement.preventDefault());
  $('reinitialiser-filtres').addEventListener('click', () => {
    $('filtres').reset();
    chargerListe();
  });

  // ---------- Onglets ----------

  function choisirOnglet(nom) {
    etat.onglet = nom;
    ecrireMessage($('alerte-action'), '');
    const planning = nom === 'planning';
    $('onglet-planning').setAttribute('aria-selected', planning ? 'true' : 'false');
    $('onglet-planning').tabIndex = planning ? 0 : -1;
    $('onglet-liste').setAttribute('aria-selected', planning ? 'false' : 'true');
    $('onglet-liste').tabIndex = planning ? -1 : 0;
    $('panneau-planning').hidden = !planning;
    $('panneau-liste').hidden = planning;
    if (planning) {
      chargerPlanning();
    } else {
      chargerListe();
    }
  }

  $('onglet-planning').addEventListener('click', () => choisirOnglet('planning'));
  $('onglet-liste').addEventListener('click', () => choisirOnglet('liste'));
  [$('onglet-planning'), $('onglet-liste')].forEach((onglet) => {
    onglet.addEventListener('keydown', (evenement) => {
      if (evenement.key !== 'ArrowLeft' && evenement.key !== 'ArrowRight') return;
      const cible = etat.onglet === 'planning' ? 'liste' : 'planning';
      choisirOnglet(cible);
      $(`onglet-${cible}`).focus();
    });
  });

  // ---------- Détail d'un rendez-vous ----------

  const fenetreDetail = $('fenetre-detail');

  function remplirDetail(rdv) {
    etat.detailId = rdv.id;
    $('detail-dentiste').textContent = `Dr ${session.nom}`;
    $('detail-date').textContent = C.libelleDateLongue(rdv.date);
    $('detail-heure').textContent = C.normaliserHeure(rdv.heure);

    const statut = $('detail-statut');
    statut.textContent = ST.libelleStatut(rdv.statut);
    statut.dataset.statut = rdv.statut;

    $('detail-patient').textContent = rdv.patient_nom;
    const tel = $('detail-tel');
    tel.textContent = V.formaterTelephone(rdv.patient_tel);
    tel.setAttribute('href', V.lienTelephone(rdv.patient_tel));
    $('detail-motif').textContent = rdv.soin.libelle;
    $('detail-numero').textContent = String(rdv.id);
    $('erreur-detail').textContent = '';

    const zone = $('actions-detail');
    zone.textContent = '';
    A.actionsOrdonnees(rdv.actions_possibles).forEach((action) => {
      const bouton = el('button', {
        type: 'button',
        class: action === 'annule' ? 'pill pill-rouge bouton-action' : 'pill pill-dark bouton-action',
        texte: A.libelleAction(action),
      });
      bouton.addEventListener('click', () => {
        if (action === 'annule') ouvrirAnnulation(rdv);
        else agir(rdv.id, action, $('erreur-detail'));
      });
      zone.append(bouton);
    });
  }

  function ouvrirDetail(rdv) {
    remplirDetail(rdv);
    if (!fenetreDetail.open) fenetreDetail.showModal();
  }

  function trouverEnMemoire(id) {
    return etat.rdvSemaine.find((r) => r.id === id) || etat.rdvListe.find((r) => r.id === id) || null;
  }

  /** Une demande en attente peut concerner une autre semaine : on la charge par sa date si besoin. */
  async function ouvrirDetailParId(id, date) {
    const connu = trouverEnMemoire(id);
    if (connu) {
      ouvrirDetail(connu);
      return;
    }
    try {
      const rdvs = await API.mesRendezVous(session.token, { du: date, au: date });
      const trouve = rdvs.find((r) => r.id === id);
      if (trouve) ouvrirDetail(trouve);
      else $('etat-demandes').textContent = 'Ce rendez-vous est introuvable.';
    } catch (erreur) {
      if (erreurDeSession(erreur)) return;
      afficherErreur($('etat-demandes'), 'Impossible de charger le rendez-vous', erreur, 'Réessayer', () => ouvrirDetailParId(id, date));
    }
  }

  $('fermer-detail').addEventListener('click', () => fenetreDetail.close());
  fenetreDetail.addEventListener('click', (evenement) => {
    if (evenement.target === fenetreDetail) fenetreDetail.close();
  });
  fenetreDetail.addEventListener('close', () => { etat.detailId = null; });

  // ---------- Changement de statut ----------

  function remplacerEnMemoire(rdv) {
    etat.rdvSemaine = etat.rdvSemaine.map((r) => (r.id === rdv.id ? rdv : r));
    etat.rdvListe = etat.rdvListe.map((r) => (r.id === rdv.id ? rdv : r));
  }

  /** Recharge tout ce qui dépend des statuts : notifications, planning, et liste si elle est affichée. */
  function actualiserTout() {
    return Promise.all([
      chargerNotifications(),
      chargerPlanning(),
      etat.onglet === 'liste' ? chargerListe() : Promise.resolve(),
    ]);
  }

  /** Écrit un message dans une zone ; l'alerte générale n'est visible que si elle contient du texte. */
  function ecrireMessage(zone, texte) {
    zone.textContent = texte;
    if (zone.id === 'alerte-action') zone.hidden = !texte;
  }

  /**
   * Applique un changement de statut (confirme, termine ou annule).
   * `zoneErreur` : où afficher le message si le backend refuse (par exemple 409 : déjà annulé par le patient).
   * Dans ce cas, les données sont rechargées pour que l'écran montre l'état réel du rendez-vous,
   * puis le message est écrit en dernier pour ne pas être effacé par ce rechargement.
   * Retourne vrai si le changement a réussi.
   */
  async function agir(id, statut, zoneErreur) {
    if (etat.actionEnCours) return false;
    etat.actionEnCours = true;
    try {
      const rdv = await API.changerStatut(session.token, id, statut);
      remplacerEnMemoire(rdv);
      ecrireMessage($('alerte-action'), '');
      ecrireMessage(zoneErreur, '');
      await actualiserTout();
      if (fenetreDetail.open && etat.detailId === rdv.id) remplirDetail(rdv);
      return true;
    } catch (erreur) {
      if (erreurDeSession(erreur, false)) return false;
      const message = A.messageErreurAction(erreur.statut, V.extraireMessage(erreur.statut, erreur.corps));
      await actualiserTout(); // le rendez-vous a peut-être changé entre-temps (annulé par le patient, par exemple)
      const frais = fenetreDetail.open && etat.detailId !== null ? trouverEnMemoire(etat.detailId) : null;
      if (frais) remplirDetail(frais);
      ecrireMessage(zoneErreur, message);
      return false;
    } finally {
      etat.actionEnCours = false;
    }
  }

  // ---------- Annulation par le dentiste ----------

  const fenetreAnnulation = $('fenetre-annulation-rdv');

  function ouvrirAnnulation(rdv) {
    etat.aAnnuler = rdv;
    $('texte-annulation-rdv').textContent =
      `Le rendez-vous de ${rdv.patient_nom} (${C.libelleDateLongue(rdv.date)} à ${C.normaliserHeure(rdv.heure)}) sera annulé et le créneau libéré.`;
    $('erreur-annulation-rdv').textContent = '';
    fenetreAnnulation.showModal();
    $('annulation-rdv-non').focus(); // le choix le plus sûr est sélectionné par défaut
  }

  $('annulation-rdv-non').addEventListener('click', () => fenetreAnnulation.close());
  fenetreAnnulation.addEventListener('click', (evenement) => {
    if (evenement.target === fenetreAnnulation) fenetreAnnulation.close();
  });
  fenetreAnnulation.addEventListener('close', () => { etat.aAnnuler = null; });

  $('annulation-rdv-oui').addEventListener('click', async () => {
    const rdv = etat.aAnnuler;
    if (!rdv) return;
    const bouton = $('annulation-rdv-oui');
    bouton.disabled = true;
    bouton.textContent = 'Annulation…';
    const reussi = await agir(rdv.id, 'annule', $('erreur-annulation-rdv'));
    bouton.disabled = false;
    bouton.textContent = 'Oui, annuler';
    if (reussi) {
      fenetreAnnulation.close();
    } else if (!$('erreur-annulation-rdv').textContent) {
      fenetreAnnulation.close();
    }
  });

  // ---------- Actualisation automatique ----------

  setInterval(() => {
    if (!document.hidden) actualiserTout();
  }, DELAI_ACTUALISATION);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) actualiserTout();
  });

  // ---------- Démarrage ----------

  majNavigationSemaine();
  chargerNotifications();
  chargerPlanning();
  chargerSoins();
})();
