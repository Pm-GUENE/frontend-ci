// Tests unitaires de src/js/session.js : redirections après connexion, session,
// et règles de saisie des mots de passe.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/js/session.js');

// Réponse type de POST /connexion
const reponse = (role, doitChanger) => ({
  access_token: 'jeton.de.test',
  token_type: 'bearer',
  role,
  nom: role === 'admin' ? 'Administrateur' : 'Moustapha Diaw',
  doit_changer_mdp: doitChanger,
});

// Faux sessionStorage
function faussStockage(initial = {}) {
  const donnees = { ...initial };
  return {
    donnees,
    getItem: (cle) => (cle in donnees ? donnees[cle] : null),
    setItem: (cle, valeur) => { donnees[cle] = String(valeur); },
    removeItem: (cle) => { delete donnees[cle]; },
  };
}

const stockageBloque = {
  getItem() { throw new Error('bloqué'); },
  setItem() { throw new Error('bloqué'); },
  removeItem() { throw new Error('bloqué'); },
};

describe('Où envoyer la personne après la connexion', () => {
  test('un dentiste à sa première connexion doit d\'abord changer son mot de passe', () => {
    assert.equal(S.destination(S.sessionDepuisReponse(reponse('dentiste', true))), 'mot-de-passe.html');
  });

  test('un dentiste qui a déjà changé son mot de passe va dans son espace', () => {
    assert.equal(S.destination(S.sessionDepuisReponse(reponse('dentiste', false))), 'dentiste.html');
  });

  test('l\'administrateur va dans son espace, jamais au changement de mot de passe', () => {
    assert.equal(S.destination(S.sessionDepuisReponse(reponse('admin', false))), 'admin.html');
    assert.equal(S.destination(S.sessionDepuisReponse(reponse('admin', true))), 'admin.html');
  });

  test('sans session valide, on retourne à la connexion', () => {
    assert.equal(S.destination(null), 'connexion.html');
    assert.equal(S.destination({}), 'connexion.html');
    assert.equal(S.destination({ token: '', role: 'dentiste', nom: 'X' }), 'connexion.html');
    assert.equal(S.destination({ token: 'abc', role: 'inconnu', nom: 'X' }), 'connexion.html');
  });
});

describe('Réaction à un refus d\'accès du backend (401 ou 403)', () => {
  const admin = { token: 'x', role: 'admin', nom: 'Administrateur', doit_changer_mdp: false };
  const dentiste = { token: 'x', role: 'dentiste', nom: 'Fatou Diop', doit_changer_mdp: false };

  test('401 : la session a expiré, on déconnecte', () => {
    const r = S.reactionErreurAcces(401, { detail: 'Authentification requise' }, dentiste, true);
    assert.equal(r.type, 'deconnexion');
    assert.match(r.message, /session a expiré/);
  });

  test('403 dans l\'espace administrateur : déconnexion, jamais de renvoi vers admin.html (boucle sans fin)', () => {
    const r = S.reactionErreurAcces(403, { detail: "Accès réservé à l'administrateur" }, admin, true);
    assert.equal(r.type, 'deconnexion');
    assert.match(r.message, /Accès refusé/);
    // L'ancien code renvoyait vers S.destination(session), c'est-à-dire la page courante.
    assert.equal(S.destination(admin), 'admin.html');
    assert.equal(Object.values(r).includes('admin.html'), false);
  });

  test('403 « changer votre mot de passe » pour un dentiste : on l\'envoie changer son mot de passe', () => {
    const r = S.reactionErreurAcces(403, { detail: "Vous devez d'abord changer votre mot de passe" }, dentiste, true);
    assert.deepEqual(r, { type: 'mot_de_passe' });
  });

  test('403 de droits pour un dentiste (jeton d\'un autre rôle) : déconnexion', () => {
    const r = S.reactionErreurAcces(403, { detail: 'Accès réservé aux dentistes' }, dentiste, true);
    assert.equal(r.type, 'deconnexion');
  });

  test('403 sans détail lisible pendant un chargement : déconnexion plutôt que page bloquée', () => {
    assert.equal(S.reactionErreurAcces(403, null, dentiste, true).type, 'deconnexion');
    assert.equal(S.reactionErreurAcces(403, { detail: [{ msg: 'x' }] }, admin, true).type, 'deconnexion');
  });

  test('403 métier pendant une action : simple message, pas de déconnexion', () => {
    assert.equal(S.reactionErreurAcces(403, { detail: 'Ce rendez-vous ne vous appartient pas' }, dentiste, false), null);
  });

  test('403 de droits pendant une action : déconnexion quand même', () => {
    assert.equal(S.reactionErreurAcces(403, { detail: 'Accès réservé aux dentistes' }, dentiste, false).type, 'deconnexion');
    assert.deepEqual(S.reactionErreurAcces(403, { detail: "Vous devez d'abord changer votre mot de passe" }, dentiste, false), { type: 'mot_de_passe' });
  });

  test('les autres erreurs ne concernent pas la session', () => {
    for (const statut of [400, 404, 409, 422, 429, 500, 502, undefined]) {
      assert.equal(S.reactionErreurAcces(statut, { detail: 'x' }, dentiste, true), null, String(statut));
    }
  });

  test('un administrateur n\'est jamais envoyé au changement de mot de passe', () => {
    const r = S.reactionErreurAcces(403, { detail: "Vous devez d'abord changer votre mot de passe" }, admin, true);
    assert.equal(r.type, 'deconnexion');
  });
});

describe('Session', () => {
  test('sessionDepuisReponse garde le jeton, le rôle, le nom et l\'obligation de changer le mot de passe', () => {
    assert.deepEqual(S.sessionDepuisReponse(reponse('dentiste', true)), {
      token: 'jeton.de.test', role: 'dentiste', nom: 'Moustapha Diaw', doit_changer_mdp: true,
    });
  });

  test('un doit_changer_mdp absent ou douteux vaut faux', () => {
    assert.equal(S.sessionDepuisReponse({ ...reponse('dentiste'), doit_changer_mdp: undefined }).doit_changer_mdp, false);
    assert.equal(S.sessionDepuisReponse({ ...reponse('dentiste'), doit_changer_mdp: 'oui' }).doit_changer_mdp, false);
  });

  test('le stockage relit ce qu\'il a écrit, puis oublie après effacer', () => {
    const stockage = S.creerStockage(faussStockage());
    const session = S.sessionDepuisReponse(reponse('dentiste', false));
    assert.equal(stockage.lire(), null);
    assert.equal(stockage.ecrire(session), true);
    assert.deepEqual(stockage.lire(), session);
    stockage.effacer();
    assert.equal(stockage.lire(), null);
  });

  test('un contenu abîmé ou incomplet est ignoré, sans erreur', () => {
    assert.equal(S.creerStockage(faussStockage({ 'dentardv.session': '{pas du json' })).lire(), null);
    assert.equal(S.creerStockage(faussStockage({ 'dentardv.session': '{"role":"admin"}' })).lire(), null);
  });

  test('un stockage bloqué ne fait jamais planter la page', () => {
    const stockage = S.creerStockage(stockageBloque);
    assert.equal(stockage.lire(), null);
    assert.equal(stockage.ecrire(S.sessionDepuisReponse(reponse('admin', false))), false);
    assert.doesNotThrow(() => stockage.effacer());
    assert.doesNotThrow(() => stockage.poserMessage('x'));
    assert.equal(stockage.prendreMessage(), '');
  });

  test('un message n\'est affiché qu\'une seule fois', () => {
    const stockage = S.creerStockage(faussStockage());
    stockage.poserMessage('Votre session a expiré.');
    assert.equal(stockage.prendreMessage(), 'Votre session a expiré.');
    assert.equal(stockage.prendreMessage(), '');
  });
});

describe('Saisie à la connexion', () => {
  test('l\'identifiant est nettoyé et ne peut pas être vide', () => {
    assert.deepEqual(S.validerIdentifiant('  moustapha.diaw '), { ok: true, valeur: 'moustapha.diaw', message: '' });
    assert.equal(S.validerIdentifiant('').ok, false);
    assert.equal(S.validerIdentifiant('   ').ok, false);
    assert.equal(S.validerIdentifiant(undefined).ok, false);
    assert.match(S.validerIdentifiant('').message, /identifiant/);
  });

  test('le mot de passe n\'est jamais modifié (les espaces comptent) ni vérifié en longueur', () => {
    assert.equal(S.validerMotDePasseSaisi(' a ').valeur, ' a ');
    assert.equal(S.validerMotDePasseSaisi('a').ok, true);
    assert.equal(S.validerMotDePasseSaisi('').ok, false);
    assert.match(S.validerMotDePasseSaisi('').message, /mot de passe/);
  });
});

describe('Nouveau mot de passe', () => {
  test('accepte 8 caractères ou plus, identiques à leur confirmation', () => {
    assert.equal(S.validerNouveauMotDePasse('abcdefgh', 'abcdefgh').ok, true);
    assert.equal(S.validerNouveauMotDePasse('Un mot de passe plus long 2026', 'Un mot de passe plus long 2026').ok, true);
  });

  test('refuse un mot de passe de moins de 8 caractères', () => {
    const r = S.validerNouveauMotDePasse('abc1234', 'abc1234');
    assert.equal(r.ok, false);
    assert.match(r.erreurs.nouveau, /au moins 8 caractères/);
    assert.equal(r.erreurs.confirmation, '');
  });

  test('refuse un champ vide, pour le mot de passe comme pour la confirmation', () => {
    const r = S.validerNouveauMotDePasse('', '');
    assert.equal(r.ok, false);
    assert.match(r.erreurs.nouveau, /Choisissez/);
    assert.match(r.erreurs.confirmation, /Confirmez/);
  });

  test('refuse une confirmation différente', () => {
    const r = S.validerNouveauMotDePasse('abcdefgh', 'abcdefgi');
    assert.equal(r.ok, false);
    assert.equal(r.erreurs.nouveau, '');
    assert.match(r.erreurs.confirmation, /pas identiques/);
  });

  test('la casse et les espaces comptent dans la confirmation', () => {
    assert.equal(S.validerNouveauMotDePasse('Abcdefgh', 'abcdefgh').ok, false);
    assert.equal(S.validerNouveauMotDePasse('abcdefgh ', 'abcdefgh').ok, false);
  });

  test('refuse plus de 72 octets (limite de bcrypt), accents et émojis compris', () => {
    assert.equal(S.validerNouveauMotDePasse('a'.repeat(72), 'a'.repeat(72)).ok, true);
    assert.equal(S.validerNouveauMotDePasse('a'.repeat(73), 'a'.repeat(73)).ok, false);
    // 40 lettres accentuées = 80 octets alors qu'il n'y a que 40 caractères
    const accents = 'é'.repeat(40);
    const r = S.validerNouveauMotDePasse(accents, accents);
    assert.equal(r.ok, false);
    assert.match(r.erreurs.nouveau, /trop long/);
  });
});
