// Tests du serveur de développement (scripts/dev-server.js) : une adresse mal formée ou
// malveillante doit recevoir une erreur, sans jamais arrêter le serveur.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { resoudreFichier, creerServeur, RACINE, ENTETES_SECURITE } = require('../scripts/dev-server.js');

describe('Résolution du fichier à servir', () => {
  test('la racine du site renvoie index.html', () => {
    assert.deepEqual(resoudreFichier('/', RACINE), { statut: 200, fichier: path.join(RACINE, 'index.html') });
  });

  test('un fichier du site est résolu dans le dossier servi', () => {
    assert.deepEqual(resoudreFichier('/css/style.css', RACINE), { statut: 200, fichier: path.join(RACINE, 'css', 'style.css') });
    assert.equal(resoudreFichier('/suivi.html?essai=1', RACINE).fichier, path.join(RACINE, 'suivi.html'));
  });

  test('une adresse mal encodée renvoie 400 au lieu de lever une exception', () => {
    assert.deepEqual(resoudreFichier('/%E0%A4%A', RACINE), { statut: 400 });
    assert.deepEqual(resoudreFichier('/%', RACINE), { statut: 400 });
    assert.deepEqual(resoudreFichier('/%zz', RACINE), { statut: 400 });
  });

  test('un caractère nul dans l\'adresse est refusé', () => {
    assert.deepEqual(resoudreFichier('/index.html%00.png', RACINE), { statut: 400 });
  });

  test('une tentative de sortie du dossier servi est interdite', () => {
    assert.deepEqual(resoudreFichier('/..%2Fpackage.json', RACINE), { statut: 403 });
    assert.deepEqual(resoudreFichier('/..%2F..%2F..%2Fwindows%2Fwin.ini', RACINE), { statut: 403 });
    assert.deepEqual(resoudreFichier('/css/..%2F..%2FDockerfile', RACINE), { statut: 403 });
  });

  test('une barre oblique inversée ne permet pas non plus de sortir du dossier', () => {
    // Sous Windows, « ..\ » remonte d'un dossier : refus. Sous Linux, c'est un simple nom de fichier,
    // qui reste dans le dossier servi.
    const resultat = resoudreFichier('/..%5Cpackage.json', RACINE);
    assert.ok(resultat.statut === 403 || resultat.fichier.startsWith(RACINE + path.sep));
  });
});

describe('Serveur lancé', () => {
  let serveur;
  let base;

  before(async () => {
    serveur = creerServeur({ backend: 'http://127.0.0.1:9' }); // aucun backend : port inutilisé
    await new Promise((resolve) => serveur.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${serveur.address().port}`;
  });

  after(() => new Promise((resolve) => serveur.close(resolve)));

  test('sert la page d\'accueil', async () => {
    const reponse = await fetch(`${base}/`);
    assert.equal(reponse.status, 200);
    assert.match(reponse.headers.get('content-type'), /text\/html/);
    assert.match(await reponse.text(), /DentaRDV/);
  });

  test('reste en service après une adresse mal encodée', async () => {
    const invalide = await fetch(`${base}/%E0%A4%A`);
    assert.equal(invalide.status, 400);
    const ensuite = await fetch(`${base}/index.html`);
    assert.equal(ensuite.status, 200, 'le serveur doit toujours répondre');
  });

  test('refuse de sortir du dossier servi et répond 404 pour un fichier absent', async () => {
    assert.equal((await fetch(`${base}/..%2Fpackage.json`)).status, 403);
    assert.equal((await fetch(`${base}/absent.html`)).status, 404);
  });

  test('envoie les mêmes en-têtes de sécurité que Nginx, y compris sur les erreurs', async () => {
    const nginx = fs.readFileSync(path.join(__dirname, '..', 'nginx.conf'), 'utf8');
    const cspNginx = nginx.match(/add_header Content-Security-Policy "([^"]+)"/)[1];
    assert.equal(ENTETES_SECURITE['Content-Security-Policy'], cspNginx, 'la CSP du serveur de développement doit rester celle de Nginx');

    for (const adresse of ['/', '/css/style.css', '/absent.html', '/%E0%A4%A', '/api/dentistes']) {
      const reponse = await fetch(base + adresse);
      assert.equal(reponse.headers.get('content-security-policy'), cspNginx, adresse);
      assert.equal(reponse.headers.get('x-content-type-options'), 'nosniff', adresse);
      assert.equal(reponse.headers.get('x-frame-options'), 'DENY', adresse);
    }
  });

  test('répond 502 en JSON quand le backend est injoignable', async () => {
    const reponse = await fetch(`${base}/api/dentistes`);
    assert.equal(reponse.status, 502);
    assert.deepEqual(await reponse.json(), { detail: 'Backend injoignable' });
  });
});
