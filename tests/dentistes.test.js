// Tests unitaires de src/js/dentistes.js : formulaire « Ajouter un dentiste » de l'espace administrateur.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/js/dentistes.js');

const saisie = (surcharge = {}) => ({
  nom: 'Moustapha Diaw',
  specialite: 'Chirurgien-dentiste',
  soinIds: [1, 2],
  ...surcharge,
});

describe('Affichage', () => {
  test('nomAffiche ajoute le titre « Dr »', () => {
    assert.equal(D.nomAffiche('Moustapha Diaw'), 'Dr Moustapha Diaw');
  });
});

describe('Sélection des motifs', () => {
  test('ajoute un motif absent et le retire s\'il est déjà choisi', () => {
    assert.deepEqual(D.basculerMotif([], 3), [3]);
    assert.deepEqual(D.basculerMotif([3], 3), []);
    assert.deepEqual(D.basculerMotif([1, 3], 2), [1, 2, 3]);
  });

  test('garde la liste triée, sans doublon', () => {
    assert.deepEqual(D.basculerMotif([5, 1], 3), [1, 3, 5]);
    assert.deepEqual(D.basculerMotif([1, 1, 2], 4), [1, 2, 4]);
  });

  test('ne modifie pas la liste d\'origine', () => {
    const origine = [1, 2];
    D.basculerMotif(origine, 3);
    assert.deepEqual(origine, [1, 2]);
  });
});

describe('Nom du dentiste', () => {
  test('accepte un prénom et un nom, avec accents, tirets et apostrophes', () => {
    for (const nom of ['Moustapha Diaw', 'Aïssatou Ndiaye-Sow', "Ibra N'Diaye", 'Cheikh Anta Diop', 'Awa Ndiaye']) {
      assert.equal(D.validerNouveauDentiste(saisie({ nom })).ok, true, nom);
    }
  });

  test('refuse un seul mot : il faut le prénom ET le nom, comme le backend', () => {
    for (const nom of ['Diaw', 'Moustapha', 'Jean-Pierre']) {
      const r = D.validerNouveauDentiste(saisie({ nom }));
      assert.equal(r.ok, false, nom);
      assert.match(r.erreurs.nom, /prénom et le nom/);
    }
  });

  test('refuse chiffres, symboles et vide', () => {
    for (const nom of ['', '   ', 'Moustapha Diaw2', 'Moustapha D1aw', 'Moustapha_Diaw', 'Dr. Diaw', 'Moustapha @Diaw']) {
      assert.equal(D.validerNouveauDentiste(saisie({ nom })).ok, false, nom);
    }
  });

  test('nettoie les espaces en trop et l\'apostrophe typographique avant envoi', () => {
    const r = D.validerNouveauDentiste(saisie({ nom: '  Ibra   N’Diaye  ' }));
    assert.equal(r.ok, true);
    assert.equal(r.valeurs.nom, "Ibra N'Diaye");
  });

  test('refuse plus de 100 caractères', () => {
    const long = `${'a'.repeat(60)} ${'b'.repeat(50)}`;
    const r = D.validerNouveauDentiste(saisie({ nom: long }));
    assert.equal(r.ok, false);
    assert.match(r.erreurs.nom, /trop long/);
  });
});

describe('Spécialité', () => {
  test('accepte une spécialité de 2 à 100 caractères', () => {
    assert.equal(D.validerNouveauDentiste(saisie({ specialite: 'Orthodontiste' })).ok, true);
    assert.equal(D.validerNouveauDentiste(saisie({ specialite: 'ab' })).ok, true);
    assert.equal(D.validerNouveauDentiste(saisie({ specialite: 'a'.repeat(100) })).ok, true);
  });

  test('refuse une spécialité vide, trop courte ou trop longue', () => {
    assert.match(D.validerNouveauDentiste(saisie({ specialite: '' })).erreurs.specialite, /spécialité/);
    assert.equal(D.validerNouveauDentiste(saisie({ specialite: ' a ' })).ok, false);
    const r = D.validerNouveauDentiste(saisie({ specialite: 'a'.repeat(101) }));
    assert.equal(r.ok, false);
    assert.match(r.erreurs.specialite, /trop longue/);
  });

  test('nettoie les espaces multiples', () => {
    assert.equal(D.validerNouveauDentiste(saisie({ specialite: '  Chirurgien   dentiste ' })).valeurs.specialite, 'Chirurgien dentiste');
  });
});

describe('Motifs proposés', () => {
  test('exige au moins un motif', () => {
    const r = D.validerNouveauDentiste(saisie({ soinIds: [] }));
    assert.equal(r.ok, false);
    assert.equal(r.erreurs.motifs, 'Choisissez au moins un motif.');
    assert.equal(D.validerNouveauDentiste(saisie({ soinIds: undefined })).ok, false);
  });

  test('envoie des identifiants triés, sans doublon', () => {
    assert.deepEqual(D.validerNouveauDentiste(saisie({ soinIds: [4, 1, 4, 2] })).valeurs.soinIds, [1, 2, 4]);
  });
});

describe('Formulaire complet', () => {
  test('un formulaire correct passe, sans aucune erreur', () => {
    const r = D.validerNouveauDentiste(saisie());
    assert.equal(r.ok, true);
    assert.deepEqual(r.erreurs, { nom: '', specialite: '', motifs: '' });
  });

  test('un formulaire vide signale les trois champs d\'un coup', () => {
    const r = D.validerNouveauDentiste({ nom: '', specialite: '', soinIds: [] });
    assert.equal(r.ok, false);
    assert.ok(r.erreurs.nom && r.erreurs.specialite && r.erreurs.motifs);
  });
});
