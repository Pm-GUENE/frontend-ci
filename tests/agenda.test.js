// Tests unitaires de src/js/agenda.js : planning du dentiste, actions possibles, rappels et filtres.
// Rappel : le lundi 9 novembre 2026 est bien un lundi.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/js/agenda.js');

const JOURS = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
const HEURES = ['08:00', '08:30', '09:00', '09:30'];

// Rendez-vous type, comme renvoyé par GET /mes-rendez-vous
const rdv = (id, date, heure, statut, surcharge = {}) => ({
  id,
  patient_nom: 'Mamadou Sall',
  patient_tel: '771234567',
  date,
  heure: `${heure}:00`,
  statut,
  soin: { id: 1, libelle: 'détartrage' },
  actions_possibles: [],
  ...surcharge,
});

const caseDu = (agenda, date, heure) => agenda.flatMap((l) => l.cases).find((c) => c.date === date && c.heure === heure);

describe('Boutons d\'action sur un rendez-vous', () => {
  test('en attente : confirmer puis annuler, l\'annulation en dernier', () => {
    assert.deepEqual(A.actionsOrdonnees(['annule', 'confirme']), ['confirme', 'annule']);
  });

  test('confirmé après l\'heure : terminer puis annuler', () => {
    assert.deepEqual(A.actionsOrdonnees(['annule', 'termine']), ['termine', 'annule']);
  });

  test('aucune action pour un rendez-vous terminé ou annulé, ni pour une valeur absente', () => {
    assert.deepEqual(A.actionsOrdonnees([]), []);
    assert.deepEqual(A.actionsOrdonnees(undefined), []);
    assert.deepEqual(A.actionsOrdonnees(null), []);
  });

  test('ignore les statuts que le dentiste ne peut pas appliquer', () => {
    assert.deepEqual(A.actionsOrdonnees(['en_attente', 'confirme', 'inconnu']), ['confirme']);
  });

  test('libellés des boutons, longs et courts', () => {
    assert.equal(A.libelleAction('confirme'), 'Confirmer le rendez-vous');
    assert.equal(A.libelleAction('termine'), 'Marquer comme terminé');
    assert.equal(A.libelleAction('annule'), 'Annuler le rendez-vous');
    assert.equal(A.libelleActionCourt('confirme'), 'Confirmer');
    assert.equal(A.libelleActionCourt('annule'), 'Annuler');
  });
});

describe('Planning de la semaine', () => {
  const maintenant = new Date(2026, 10, 10, 8, 45); // mardi 10 novembre 2026, 08h45

  test('une ligne par horaire et une case par jour', () => {
    const agenda = A.construireAgenda([], JOURS, HEURES, maintenant);
    assert.equal(agenda.length, 4);
    assert.ok(agenda.every((ligne) => ligne.cases.length === 5));
    assert.equal(agenda[0].heure, '08:00');
  });

  test('une case prend le statut de son rendez-vous', () => {
    const agenda = A.construireAgenda([
      rdv(1, '2026-11-11', '08:00', 'en_attente'),
      rdv(2, '2026-11-12', '09:00', 'confirme'),
      rdv(3, '2026-11-13', '09:30', 'termine'),
    ], JOURS, HEURES, maintenant);
    assert.equal(caseDu(agenda, '2026-11-11', '08:00').etat, 'en_attente');
    assert.equal(caseDu(agenda, '2026-11-12', '09:00').etat, 'confirme');
    assert.equal(caseDu(agenda, '2026-11-13', '09:30').etat, 'termine');
    assert.equal(caseDu(agenda, '2026-11-11', '08:00').rdv.id, 1);
  });

  test('une case sans rendez-vous est « libre » dans le futur et « passée » une fois écoulée', () => {
    const agenda = A.construireAgenda([], JOURS, HEURES, maintenant);
    assert.equal(caseDu(agenda, '2026-11-09', '09:00').etat, 'passe'); // lundi, avant
    assert.equal(caseDu(agenda, '2026-11-10', '08:30').etat, 'passe'); // aujourd'hui, 08h30 < 08h45
    assert.equal(caseDu(agenda, '2026-11-10', '09:00').etat, 'libre'); // aujourd'hui, 09h00 > 08h45
    assert.equal(caseDu(agenda, '2026-11-12', '08:00').etat, 'libre');
  });

  test('un rendez-vous annulé libère son créneau dans le planning', () => {
    const agenda = A.construireAgenda([rdv(1, '2026-11-12', '08:00', 'annule')], JOURS, HEURES, maintenant);
    const c = caseDu(agenda, '2026-11-12', '08:00');
    assert.equal(c.etat, 'libre');
    assert.equal(c.rdv, null);
  });

  test('un créneau annulé puis repris par un autre patient montre le rendez-vous actif', () => {
    const agenda = A.construireAgenda([
      rdv(1, '2026-11-12', '08:00', 'annule'),
      rdv(2, '2026-11-12', '08:00', 'en_attente'),
    ], JOURS, HEURES, maintenant);
    assert.equal(caseDu(agenda, '2026-11-12', '08:00').rdv.id, 2);
    assert.equal(caseDu(agenda, '2026-11-12', '08:00').etat, 'en_attente');
  });

  test('un rendez-vous passé garde son statut (terminé) au lieu de « passé »', () => {
    const agenda = A.construireAgenda([rdv(1, '2026-11-09', '08:00', 'termine')], JOURS, HEURES, maintenant);
    assert.equal(caseDu(agenda, '2026-11-09', '08:00').etat, 'termine');
  });

  test('l\'heure de l\'API (HH:MM:SS) est reconnue', () => {
    const agenda = A.construireAgenda([rdv(1, '2026-11-11', '09:30', 'confirme', { heure: '09:30:00' })], JOURS, HEURES, maintenant);
    assert.equal(caseDu(agenda, '2026-11-11', '09:30').etat, 'confirme');
  });

  test('un rendez-vous hors de la semaine affichée est ignoré', () => {
    const agenda = A.construireAgenda([rdv(1, '2026-11-16', '08:00', 'confirme')], JOURS, HEURES, maintenant);
    assert.ok(agenda.flatMap((l) => l.cases).every((c) => c.rdv === null));
  });

  test('la légende couvre tous les états possibles d\'une case', () => {
    assert.deepEqual(A.LEGENDE.map((e) => e.etat), ['libre', 'en_attente', 'confirme', 'termine', 'passe']);
  });
});

describe('Nom abrégé dans les cases', () => {
  test('prénom suivi de l\'initiale du nom', () => {
    assert.equal(A.nomCourt('Mamadou Sall'), 'Mamadou S.');
    assert.equal(A.nomCourt('Aïssatou Diop-Ndiaye'), 'Aïssatou D.');
  });

  test('avec plusieurs prénoms, garde le premier et l\'initiale du dernier mot', () => {
    assert.equal(A.nomCourt('Cheikh Anta Diop'), 'Cheikh D.');
  });

  test('un seul mot reste entier, le vide reste vide, les espaces en trop sont ignorés', () => {
    assert.equal(A.nomCourt('Fatou'), 'Fatou');
    assert.equal(A.nomCourt(''), '');
    assert.equal(A.nomCourt(undefined), '');
    assert.equal(A.nomCourt('  Mamadou    sall  '), 'Mamadou S.');
  });
});

describe('Rappel à 15 minutes', () => {
  test('le message donne l\'heure, le patient et le motif', () => {
    const texte = A.messageRappel({ id: 1, date: '2026-11-11', heure: '11:00:00', patient_nom: 'Mamadou Sall', motif: 'détartrage' });
    assert.equal(texte, 'Rendez-vous à 11:00 avec Mamadou Sall (détartrage), dans moins de 15 minutes.');
  });
});

describe('Message quand un changement de statut est refusé', () => {
  test('un rendez-vous qui a changé entre-temps donne une phrase claire, sans jargon', () => {
    const texte = A.messageErreurAction(409, 'Changement de statut impossible : annule -> confirme');
    assert.match(texte, /a changé entre-temps/);
    assert.match(texte, /patient l'a peut-être annulé/);
    assert.doesNotMatch(texte, /->/);
  });

  test('« terminé » avant l\'heure garde le message précis du backend', () => {
    const message = "Un rendez-vous ne peut être terminé qu'après son heure";
    assert.equal(A.messageErreurAction(409, message), message);
  });

  test('les autres erreurs ne sont pas modifiées', () => {
    assert.equal(A.messageErreurAction(404, 'Rendez-vous introuvable'), 'Rendez-vous introuvable');
    assert.equal(A.messageErreurAction(403, 'Ce rendez-vous ne vous appartient pas'), 'Ce rendez-vous ne vous appartient pas');
    assert.equal(A.messageErreurAction(409, 'Autre conflit'), 'Autre conflit');
  });
});

describe('Filtres de la liste', () => {
  test('une date unique devient une période d\'un jour', () => {
    assert.deepEqual(A.parametresListe({ date: '2026-11-12', soinId: '', statut: '' }), { du: '2026-11-12', au: '2026-11-12' });
  });

  test('envoie le motif et le statut choisis, sans les filtres vides', () => {
    assert.deepEqual(A.parametresListe({ date: '', soinId: '4', statut: 'confirme' }), { soin_id: '4', statut: 'confirme' });
    assert.deepEqual(A.parametresListe({ date: '', soinId: '', statut: '' }), {});
  });

  test('combine les trois filtres', () => {
    assert.deepEqual(A.parametresListe({ date: '2026-11-12', soinId: '2', statut: 'en_attente' }),
      { du: '2026-11-12', au: '2026-11-12', soin_id: '2', statut: 'en_attente' });
  });

  test('filtresActifs détecte au moins un filtre', () => {
    assert.equal(A.filtresActifs({ date: '', soinId: '', statut: '' }), false);
    assert.equal(A.filtresActifs({ date: '', soinId: '', statut: 'annule' }), true);
    assert.equal(A.filtresActifs({ date: '2026-11-12', soinId: '', statut: '' }), true);
  });
});
