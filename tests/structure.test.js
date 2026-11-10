// Tests de structure : ils vérifient que la page d'accueil et la configuration
// de déploiement sont cohérentes. Les tests unitaires des fonctions JavaScript
// s'ajouteront dans ce dossier au fur et à mesure des pages.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const lire = (...morceaux) => fs.readFileSync(path.join(racine, ...morceaux), 'utf8');
const existe = (...morceaux) => fs.existsSync(path.join(racine, ...morceaux));

describe('Page d\'accueil (src/index.html)', () => {
  const html = lire('src', 'index.html');

  test('est en français et adaptée au téléphone', () => {
    assert.match(html, /<html lang="fr">/);
    assert.match(html, /<meta name="viewport"/);
  });

  test('a un titre qui contient le nom de l\'application', () => {
    assert.match(html, /<title>[^<]*DentaRDV[^<]*<\/title>/);
  });

  test('propose les trois accès prévus dans l\'en-tête', () => {
    assert.match(html, /href="#dentistes"/, 'bouton Prendre rendez-vous');
    assert.match(html, /href="suivi\.html"/, 'lien Suivre mon rendez-vous');
    assert.match(html, /href="connexion\.html"/, 'lien Espace professionnel');
  });

  test('contient la section vers laquelle défile le bouton de réservation', () => {
    assert.match(html, /<section id="dentistes"/);
  });

  test('donne un texte alternatif à chaque image', () => {
    const images = html.match(/<img\b[^>]*>/g) || [];
    assert.ok(images.length > 0, 'au moins une image attendue');
    for (const image of images) {
      assert.match(image, /alt="[^"]+"/, `image sans texte alternatif : ${image}`);
    }
  });

  test('référence uniquement des feuilles de style, scripts et images qui existent', () => {
    const fichiers = [
      ...[...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    ];
    assert.ok(fichiers.length > 0);
    for (const fichier of fichiers) {
      assert.ok(existe('src', fichier), `fichier introuvable : src/${fichier}`);
    }
  });
});

describe('Déploiement', () => {
  test('le Dockerfile copie le site et la configuration Nginx', () => {
    const dockerfile = lire('Dockerfile');
    assert.match(dockerfile, /COPY nginx\.conf \/etc\/nginx\/conf\.d\/default\.conf/);
    assert.match(dockerfile, /COPY src\/ \/usr\/share\/nginx\/html\//);
  });

  test('Nginx expose /health et transmet /api/ au backend', () => {
    const nginx = lire('nginx.conf');
    assert.match(nginx, /location = \/health/);
    assert.match(nginx, /location \/api\//);
    assert.match(nginx, /proxy_pass \$backend_upstream/);
  });

  test('aucun secret n\'est versionné', () => {
    assert.ok(!existe('.env'), 'un fichier .env ne doit pas être dans le dépôt');
    assert.match(lire('.gitignore'), /^\.env$/m);
  });
});
