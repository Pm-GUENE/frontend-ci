/*
 * Page d'accueil : recherche, liste des dentistes et créneaux de la semaine.
 * Le clic sur un créneau libre émet l'événement « creneau:choisi » (dentiste, date, heure),
 * que la fenêtre de réservation écoute. La recherche par motif passe par la barre de recherche.
 */
(function () {
  'use strict';

  const C = window.Creneaux;
  const API = window.Api;

  const MAX_SEMAINES = 8;     // on peut réserver jusqu'à 8 semaines à l'avance
  const LIGNES_REPLIEES = 4;  // horaires visibles avant « Voir plus d'horaires »
  const DELAI_RECHERCHE = 300;

  const etat = {
    q: '',
    lundiCourant: C.lundiDeLaSemaine(new Date()),
    lundi: C.lundiDeLaSemaine(new Date()),
    cartes: [],
    demande: 0,
  };

  const zoneListe = document.getElementById('liste-dentistes');
  const zoneEtat = document.getElementById('etat-liste');
  const champRecherche = document.getElementById('recherche');
  const formulaire = document.getElementById('formulaire-recherche');

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

  // ---------- Messages d'état ----------

  function afficherMessage(texte) {
    zoneEtat.textContent = texte;
  }

  function afficherErreur(texte, actionLibelle, action) {
    zoneEtat.textContent = '';
    zoneEtat.append(
      el('span', { texte: texte + ' ' }),
      el('button', { type: 'button', class: 'lien-bouton', texte: actionLibelle })
    );
    zoneEtat.querySelector('button').addEventListener('click', action);
  }

  // ---------- Liste des dentistes ----------

  async function chargerDentistes() {
    const numero = ++etat.demande;
    afficherMessage('Chargement des dentistes…');
    zoneListe.setAttribute('aria-busy', 'true');
    try {
      const dentistes = await API.dentistes({ q: etat.q.trim() });
      if (numero !== etat.demande) return;
      afficherDentistes(dentistes);
    } catch (erreur) {
      if (numero !== etat.demande) return;
      zoneListe.textContent = '';
      etat.cartes = [];
      afficherErreur('Impossible de charger les dentistes.', 'Réessayer', chargerDentistes);
    } finally {
      if (numero === etat.demande) zoneListe.removeAttribute('aria-busy');
    }
  }

  function afficherDentistes(dentistes) {
    zoneListe.textContent = '';
    etat.cartes = [];
    if (dentistes.length === 0) {
      afficherMessage(
        etat.q.trim()
          ? 'Aucun dentiste ne propose ce motif ou ne correspond à cette recherche.'
          : 'Aucun dentiste disponible pour le moment.'
      );
      return;
    }
    afficherMessage(dentistes.length === 1 ? '1 dentiste trouvé.' : `${dentistes.length} dentistes trouvés.`);
    dentistes.forEach((dentiste) => {
      const carte = creerCarte(dentiste);
      etat.cartes.push(carte);
      zoneListe.append(carte.racine);
    });
    majNavigation();
    etat.cartes.forEach(chargerCreneaux);
  }

  // ---------- Carte d'un dentiste ----------

  function creerCarte(dentiste) {
    const carte = { dentiste, libres: [], deplie: false, demande: 0 };

    // Les motifs sont de simples étiquettes : pour chercher par motif, on utilise la barre de recherche.
    const puces = dentiste.soins.map((soin) => el('span', { class: 'puce', texte: soin.libelle }));

    carte.precedent = el('button', { type: 'button', class: 'fleche', 'aria-label': 'Semaine précédente', texte: '‹' });
    carte.suivant = el('button', { type: 'button', class: 'fleche', 'aria-label': 'Semaine suivante', texte: '›' });
    carte.precedent.addEventListener('click', () => changerSemaine(-1));
    carte.suivant.addEventListener('click', () => changerSemaine(1));

    carte.grille = el('div', { class: 'grille', role: 'group' });
    carte.plus = el('button', { type: 'button', class: 'voir-plus', texte: "VOIR PLUS D'HORAIRES" });
    carte.plus.addEventListener('click', () => {
      carte.deplie = !carte.deplie;
      carte.plus.textContent = carte.deplie ? "VOIR MOINS D'HORAIRES" : "VOIR PLUS D'HORAIRES";
      carte.plus.setAttribute('aria-expanded', carte.deplie ? 'true' : 'false');
      dessinerGrille(carte);
    });
    carte.plus.setAttribute('aria-expanded', 'false');

    carte.racine = el(
      'article',
      { class: 'carte-dentiste' },
      el(
        'div',
        { class: 'carte-identite' },
        // Icône « Médecin » de Rosa Suave (Flaticon), décorative : le nom du dentiste est écrit à côté.
        el('img', { class: 'avatar', src: 'assets/avatar-medecin.png', alt: '', width: '64', height: '64' }),
        el(
          'div',
          { class: 'carte-texte' },
          el('h3', { texte: `Dr ${dentiste.nom}` }),
          el('p', { class: 'specialite', texte: dentiste.specialite }),
          el('p', { class: 'libelle-motifs', texte: 'Motifs proposés :' }),
          el('div', { class: 'puces' }, ...puces)
        )
      ),
      el(
        'div',
        { class: 'carte-agenda' },
        el('div', { class: 'agenda' }, carte.precedent, carte.grille, carte.suivant),
        carte.plus
      )
    );
    return carte;
  }

  // ---------- Créneaux de la semaine ----------

  function changerSemaine(sens) {
    const suivant = C.ajouterJours(etat.lundi, 7 * sens);
    if (sens < 0 && !C.peutReculer(etat.lundi, etat.lundiCourant)) return;
    if (sens > 0 && !C.peutAvancer(etat.lundi, etat.lundiCourant, MAX_SEMAINES)) return;
    etat.lundi = suivant;
    majNavigation();
    etat.cartes.forEach(chargerCreneaux);
  }

  function majNavigation() {
    const reculer = C.peutReculer(etat.lundi, etat.lundiCourant);
    const avancer = C.peutAvancer(etat.lundi, etat.lundiCourant, MAX_SEMAINES);
    etat.cartes.forEach((carte) => {
      carte.precedent.disabled = !reculer;
      carte.suivant.disabled = !avancer;
    });
  }

  async function chargerCreneaux(carte) {
    const numero = ++carte.demande;
    const jours = C.joursOuvres(etat.lundi);
    carte.grille.setAttribute('aria-busy', 'true');
    carte.grille.classList.add('grille-chargement');
    try {
      const libres = await API.creneaux(carte.dentiste.id, C.versISO(jours[0]), C.versISO(jours[4]));
      if (numero !== carte.demande) return;
      carte.libres = libres;
      carte.erreur = false;
    } catch (erreur) {
      if (numero !== carte.demande) return;
      carte.libres = [];
      carte.erreur = true;
    }
    carte.grille.removeAttribute('aria-busy');
    carte.grille.classList.remove('grille-chargement');
    dessinerGrille(carte);
  }

  function dessinerGrille(carte) {
    const jours = C.joursOuvres(etat.lundi);
    carte.grille.textContent = '';

    jours.forEach((jour) => {
      const libelle = C.libelleJour(jour);
      carte.grille.append(
        el('div', { class: 'jour', 'aria-hidden': 'true' }, el('span', { texte: libelle.nom }), el('span', { texte: libelle.court }))
      );
    });

    if (carte.erreur) {
      const reessayer = el('button', { type: 'button', class: 'lien-bouton', texte: 'Réessayer' });
      reessayer.addEventListener('click', () => chargerCreneaux(carte));
      carte.grille.append(el('p', { class: 'erreur-creneaux' }, 'Créneaux indisponibles. ', reessayer));
      return;
    }

    const grille = C.construireGrille(carte.libres, jours, C.horaires());
    C.lignesVisibles(grille, carte.deplie, LIGNES_REPLIEES).forEach((ligne) => {
      ligne.cases.forEach((cellule) => {
        const libelleLong = `${C.libelleDateLongue(cellule.date)} à ${cellule.heure}`;
        const bouton = el('button', {
          type: 'button',
          class: cellule.libre ? 'creneau creneau-libre' : 'creneau creneau-indisponible',
          disabled: !cellule.libre,
          'aria-label': cellule.libre
            ? `Réserver le ${libelleLong} avec le Dr ${carte.dentiste.nom}`
            : `${libelleLong} indisponible`,
          texte: cellule.heure,
        });
        if (cellule.libre) {
          bouton.addEventListener('click', () => {
            document.dispatchEvent(
              new CustomEvent('creneau:choisi', {
                detail: { dentiste: carte.dentiste, date: cellule.date, heure: cellule.heure },
              })
            );
          });
        }
        carte.grille.append(bouton);
      });
    });
  }

  // ---------- Recherche ----------

  let minuteur = null;
  champRecherche.addEventListener('input', () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => {
      etat.q = champRecherche.value;
      chargerDentistes();
    }, DELAI_RECHERCHE);
  });

  formulaire.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    clearTimeout(minuteur);
    etat.q = champRecherche.value;
    chargerDentistes();
  });

  chargerDentistes();
})();
