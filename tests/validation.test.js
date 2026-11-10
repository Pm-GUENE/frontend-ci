// Tests unitaires de src/js/validation.js : règles du formulaire de réservation
// (identiques à celles du backend) et messages d'erreur de l'API.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/js/validation.js');

describe('Nom du patient', () => {
  test('accepte des noms usuels, avec accents, tirets et apostrophes', () => {
    for (const nom of ['Mamadou SALL', 'Aïssatou Diop-Ndiaye', "N'Diaye Fall", 'Fatou', 'Cheikh Anta Diop']) {
      assert.equal(V.validerNom(nom).ok, true, nom);
    }
  });

  test('nettoie les espaces en trop avant envoi', () => {
    assert.equal(V.validerNom('  Mamadou    SALL  ').valeur, 'Mamadou SALL');
  });

  test('remplace l\'apostrophe typographique des téléphones par une apostrophe droite', () => {
    const resultat = V.validerNom('N’Diaye Fall');
    assert.equal(resultat.ok, true);
    assert.equal(resultat.valeur, "N'Diaye Fall");
  });

  test('refuse un nom vide ou d\'une seule lettre', () => {
    assert.equal(V.validerNom('').ok, false);
    assert.equal(V.validerNom('   ').ok, false);
    assert.equal(V.validerNom('A').ok, false);
    assert.equal(V.validerNom(undefined).ok, false);
  });

  test('refuse les chiffres et les symboles', () => {
    for (const nom of ['Mamadou123', 'Jean_Luc', 'Moussa@', '12345', '-Moussa', 'Moussa-']) {
      const resultat = V.validerNom(nom);
      assert.equal(resultat.ok, false, nom);
      assert.match(resultat.message, /lettres/);
    }
  });

  test('refuse un nom de plus de 100 caractères', () => {
    assert.equal(V.validerNom('a'.repeat(101)).ok, false);
    assert.equal(V.validerNom('a'.repeat(100)).ok, true);
  });
});

describe('Téléphone sénégalais', () => {
  test('accepte les écritures usuelles et renvoie 9 chiffres', () => {
    for (const tel of ['77 123 45 67', '771234567', '+221 77 123 45 67', '00221771234567',
      '221771234567', '(77) 123-45-67', '77.123.45.67', '33 821 00 00']) {
      assert.equal(V.validerTelephone(tel).ok, true, tel);
    }
    assert.equal(V.normaliserTelephone('+221 77 123 45 67'), '771234567');
    assert.equal(V.normaliserTelephone('00221 77 123 45 67'), '771234567');
  });

  test('refuse les numéros trop courts, trop longs ou mal commencés', () => {
    for (const tel of ['', '12345', '12345678', '87 123 45 67', '7712345678', '771234567890', 'abc', '77 123 45 6a']) {
      const resultat = V.validerTelephone(tel);
      assert.equal(resultat.ok, false, tel);
      assert.match(resultat.message, /77 123 45 67/);
    }
  });

  test('ne prend pas un 221 au début d\'un numéro de 9 chiffres pour un indicatif', () => {
    assert.equal(V.normaliserTelephone('221234567'), null);
  });

  test('formaterTelephone met le numéro en forme lisible', () => {
    assert.equal(V.formaterTelephone('771234567'), '77 123 45 67');
    assert.equal(V.formaterTelephone('338210000'), '33 821 00 00');
    assert.equal(V.formaterTelephone('123'), '123');
  });
});

describe('Motif de consultation', () => {
  test('accepte un identifiant de motif, refuse l\'absence de choix', () => {
    assert.deepEqual(V.validerMotif('4'), { ok: true, valeur: 4, message: '' });
    assert.equal(V.validerMotif('').ok, false);
    assert.equal(V.validerMotif('abc').ok, false);
    assert.equal(V.validerMotif('0').ok, false);
    assert.match(V.validerMotif('').message, /motif/);
  });
});

describe('Messages d\'erreur de l\'API', () => {
  test('reprend le texte du backend quand il en donne un', () => {
    assert.equal(
      V.extraireMessage(409, { detail: "Ce créneau vient d'être pris, choisissez-en un autre" }),
      "Ce créneau vient d'être pris, choisissez-en un autre"
    );
    assert.equal(
      V.extraireMessage(422, { detail: 'Ce dentiste ne propose pas ce motif de consultation' }),
      'Ce dentiste ne propose pas ce motif de consultation'
    );
  });

  test('lit aussi le format des erreurs de validation de FastAPI', () => {
    const corps = { detail: [{ type: 'value_error', msg: 'Value error, Le nom ne doit contenir que des lettres' }] };
    assert.equal(V.extraireMessage(422, corps), 'Le nom ne doit contenir que des lettres');
  });

  test('donne un message par défaut selon le code quand le corps est vide', () => {
    assert.match(V.extraireMessage(409, null), /créneau/);
    assert.match(V.extraireMessage(404, {}), /introuvable/);
    assert.match(V.extraireMessage(422, null), /invalides/);
    assert.match(V.extraireMessage(500, null), /indisponible/);
    assert.match(V.extraireMessage(503, null), /indisponible/);
  });

  test('signale une coupure réseau quand il n\'y a pas de code', () => {
    assert.match(V.extraireMessage(undefined, null), /Connexion impossible/);
  });
});
