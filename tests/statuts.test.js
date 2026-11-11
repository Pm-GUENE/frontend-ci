// Tests unitaires de src/js/statuts.js : messages de la page de suivi du rendez-vous.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/js/statuts.js');

const DATE = 'mercredi 11 novembre 2026';

// Réponse type de GET /rendez-vous/{id}?tel=
const rendezVous = (statut, annulable = false) => ({
  id: 7,
  patient_nom: 'Mamadou Sall',
  patient_tel: '771234567',
  date: '2026-11-11',
  heure: '08:00:00',
  statut,
  dentiste: { id: 2, nom: 'Awa Ndiaye', specialite: 'Orthodontiste' },
  soin: { id: 4, libelle: 'appareil dentaire' },
  annulable,
});

describe('Libellés des statuts', () => {
  test('affiche les statuts du backend avec leurs accents', () => {
    assert.equal(S.libelleStatut('en_attente'), 'En attente');
    assert.equal(S.libelleStatut('confirme'), 'Confirmé');
    assert.equal(S.libelleStatut('termine'), 'Terminé');
    assert.equal(S.libelleStatut('annule'), 'Annulé');
  });

  test('ne plante pas sur un statut inconnu', () => {
    assert.equal(S.libelleStatut('autre'), 'Statut inconnu');
    assert.equal(S.libelleStatut(undefined), 'Statut inconnu');
  });
});

describe('Numéro de rendez-vous', () => {
  test('accepte un nombre entier positif, avec ou sans espaces autour', () => {
    assert.deepEqual(S.validerNumero('12'), { ok: true, valeur: 12, message: '' });
    assert.equal(S.validerNumero('  7 ').valeur, 7);
    assert.equal(S.validerNumero(3).ok, true);
  });

  test('refuse le vide, zéro, les lettres et les nombres négatifs ou décimaux', () => {
    for (const saisie of ['', '   ', '0', 'abc', 'A15245', '-3', '1.5', '12a', undefined, null]) {
      const resultat = S.validerNumero(saisie);
      assert.equal(resultat.ok, false, String(saisie));
      assert.match(resultat.message, /numéro de rendez-vous/);
    }
  });
});

describe('Message de suivi selon le statut', () => {
  test('en attente : le patient sait que le dentiste doit encore valider', () => {
    const m = S.messageSuivi(rendezVous('en_attente', true), DATE);
    assert.match(m.texte, /en attente de validation/);
    assert.match(m.texte, /validé prochainement par le dentiste/);
    assert.match(m.texte, /mercredi 11 novembre 2026 à 08:00/);
    assert.match(m.texte, /Dr Awa Ndiaye/);
    assert.equal(m.etiquette, 'En attente');
  });

  test('confirmé : message de confirmation', () => {
    const m = S.messageSuivi(rendezVous('confirme', true), DATE);
    assert.match(m.texte, /est confirmé\. À bientôt !/);
    assert.equal(m.etiquette, 'Confirmé');
  });

  test('annulé : message d\'annulation et proposition de reprendre un créneau', () => {
    const m = S.messageSuivi(rendezVous('annule'), DATE);
    assert.match(m.texte, /a été annulé/);
    assert.equal(m.peutReprendre, true);
    assert.equal(m.peutAnnuler, false);
  });

  test('terminé : consultation terminée, rien à faire', () => {
    const m = S.messageSuivi(rendezVous('termine'), DATE);
    assert.match(m.texte, /consultation .* est terminée/);
    assert.equal(m.peutAnnuler, false);
    assert.equal(m.peutReprendre, false);
  });

  test('l\'heure est affichée sans les secondes', () => {
    const m = S.messageSuivi({ ...rendezVous('confirme'), heure: '16:30:00' }, DATE);
    assert.match(m.texte, /à 16:30 /);
    assert.doesNotMatch(m.texte, /16:30:00/);
  });

  test('le bouton Annuler suit uniquement la décision du backend (champ annulable)', () => {
    assert.equal(S.messageSuivi(rendezVous('en_attente', true), DATE).peutAnnuler, true);
    assert.equal(S.messageSuivi(rendezVous('confirme', true), DATE).peutAnnuler, true);
    // Rendez-vous déjà passé : le backend renvoie annulable = false, même si le statut est « confirmé ».
    assert.equal(S.messageSuivi(rendezVous('confirme', false), DATE).peutAnnuler, false);
    assert.equal(S.messageSuivi(rendezVous('en_attente', false), DATE).peutAnnuler, false);
  });

  test('un statut inconnu renvoie un message prudent, sans bouton', () => {
    const m = S.messageSuivi(rendezVous('bizarre', true), DATE);
    assert.match(m.texte, /pas reconnu/);
    assert.equal(m.etiquette, 'Statut inconnu');
    assert.equal(m.peutReprendre, false);
  });
});
