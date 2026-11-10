/*
 * Logique des créneaux : dates, semaine affichée, grille des horaires.
 * Ce fichier ne touche ni au DOM ni au réseau, il se teste donc avec `npm test`.
 * Il fonctionne dans le navigateur (window.Creneaux) et dans Node (require).
 */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrique();
  } else {
    racine.Creneaux = fabrique();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
    'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.',
    'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  // Horaires de la clinique : 08h00 à 17h00, créneaux de 30 minutes (dernier créneau à 16h30).
  const PREMIER_CRENEAU = 8 * 60;
  const DERNIER_CRENEAU = 16 * 60 + 30;
  const DUREE_CRENEAU = 30;

  const deuxChiffres = (n) => String(n).padStart(2, '0');

  /** Date locale au format AAAA-MM-JJ (sans passer par l'UTC, qui décalerait d'un jour). */
  function versISO(date) {
    return `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`;
  }

  /** Date locale à minuit à partir d'un texte AAAA-MM-JJ. */
  function depuisISO(iso) {
    const [annee, mois, jour] = iso.split('-').map(Number);
    return new Date(annee, mois - 1, jour);
  }

  function ajouterJours(date, nombre) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + nombre);
  }

  /**
   * Lundi de la semaine à afficher. Le samedi et le dimanche, la clinique est fermée :
   * on propose directement la semaine suivante.
   */
  function lundiDeLaSemaine(date) {
    const jour = date.getDay();
    if (jour === 6) return ajouterJours(date, 2);
    if (jour === 0) return ajouterJours(date, 1);
    return ajouterJours(date, -(jour - 1));
  }

  /** Les cinq jours ouvrés (lundi à vendredi) d'une semaine. */
  function joursOuvres(lundi) {
    return [0, 1, 2, 3, 4].map((decalage) => ajouterJours(lundi, decalage));
  }

  /** Tous les horaires d'une journée : 08:00, 08:30, ... 16:30. */
  function horaires() {
    const liste = [];
    for (let minutes = PREMIER_CRENEAU; minutes <= DERNIER_CRENEAU; minutes += DUREE_CRENEAU) {
      liste.push(`${deuxChiffres(Math.floor(minutes / 60))}:${deuxChiffres(minutes % 60)}`);
    }
    return liste;
  }

  /** "09:00:00" (réponse de l'API) devient "09:00". */
  function normaliserHeure(heure) {
    return String(heure).slice(0, 5);
  }

  /**
   * Construit la grille d'une semaine. L'API ne renvoie que les créneaux libres :
   * tout horaire absent de la réponse (déjà pris ou déjà passé) est donc indisponible.
   * Retourne une ligne par horaire, avec une case par jour.
   */
  function construireGrille(creneauxLibres, jours, heures) {
    const libres = new Set(
      creneauxLibres.map((c) => `${c.date} ${normaliserHeure(c.heure)}`)
    );
    return heures.map((heure) => ({
      heure,
      cases: jours.map((jour) => {
        const date = versISO(jour);
        return { date, heure, libre: libres.has(`${date} ${heure}`) };
      }),
    }));
  }

  /** Lignes affichées : toutes si la grille est dépliée, sinon les premières seulement. */
  function lignesVisibles(grille, deplie, nombreReplie) {
    return deplie ? grille : grille.slice(0, nombreReplie);
  }

  /** Nombre de semaines entre deux lundis. */
  function ecartEnSemaines(lundiA, lundiB) {
    const jours = Math.round((depuisISO(versISO(lundiB)) - depuisISO(versISO(lundiA))) / 86400000);
    return Math.round(jours / 7);
  }

  function peutReculer(lundiAffiche, lundiCourant) {
    return ecartEnSemaines(lundiCourant, lundiAffiche) > 0;
  }

  function peutAvancer(lundiAffiche, lundiCourant, maxSemaines) {
    return ecartEnSemaines(lundiCourant, lundiAffiche) < maxSemaines - 1;
  }

  /** Libellés d'un jour : nom (« lundi ») et date courte (« 9 nov. »). */
  function libelleJour(date) {
    return { nom: JOURS[date.getDay()], court: `${date.getDate()} ${MOIS_COURTS[date.getMonth()]}` };
  }

  /** « lundi 9 novembre 2026 » à partir d'un texte AAAA-MM-JJ. */
  function libelleDateLongue(iso) {
    const date = depuisISO(iso);
    return `${JOURS[date.getDay()]} ${date.getDate()} ${MOIS[date.getMonth()]} ${date.getFullYear()}`;
  }

  return {
    versISO,
    depuisISO,
    ajouterJours,
    lundiDeLaSemaine,
    joursOuvres,
    horaires,
    normaliserHeure,
    construireGrille,
    lignesVisibles,
    ecartEnSemaines,
    peutReculer,
    peutAvancer,
    libelleJour,
    libelleDateLongue,
  };
});
