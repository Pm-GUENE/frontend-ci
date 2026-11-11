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

  test('donne un attribut alt à chaque image (vide seulement pour une image décorative)', () => {
    const images = html.match(/<img\b[^>]*>/g) || [];
    assert.ok(images.length > 0, 'au moins une image attendue');
    for (const image of images) {
      assert.match(image, /\salt="[^"]*"/, `image sans attribut alt : ${image}`);
    }
    // L'illustration principale n'est pas décorative : elle doit être décrite.
    const principale = images.find((image) => image.includes('hero.png'));
    assert.match(principale, /\salt="[^"]+"/, "l'illustration principale doit avoir un texte alternatif");
  });

  test('contient la fenêtre de réservation avec ses trois champs et ses deux étapes', () => {
    assert.match(html, /<dialog id="fenetre-reservation"/);
    assert.match(html, /<input[^>]+id="champ-nom"/);
    assert.match(html, /<input[^>]+id="champ-tel"/);
    assert.match(html, /<select id="champ-motif"/);
    assert.match(html, /id="etape-formulaire"/);
    assert.match(html, /id="etape-confirmation"/);
  });

  test('associe chaque champ du formulaire à son libellé', () => {
    for (const champ of ['champ-nom', 'champ-tel', 'champ-motif']) {
      assert.match(html, new RegExp(`<label for="${champ}">`), `libellé manquant pour ${champ}`);
    }
  });

  test('charge les scripts dans l\'ordre : la logique avant les écrans qui l\'utilisent', () => {
    const scripts = [...html.matchAll(/<script[^>]+src="js\/([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(scripts, ['creneaux.js', 'validation.js', 'api.js', 'accueil.js', 'reservation.js']);
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

describe('Page de suivi (src/suivi.html)', () => {
  const html = lire('src', 'suivi.html');

  test('est en français, adaptée au téléphone et a un titre', () => {
    assert.match(html, /<html lang="fr">/);
    assert.match(html, /<meta name="viewport"/);
    assert.match(html, /<title>[^<]*DentaRDV[^<]*<\/title>/);
  });

  test('demande le numéro de rendez-vous puis le téléphone, avec leurs libellés', () => {
    assert.match(html, /<label for="champ-numero">Numéro de rendez-vous<\/label>/);
    assert.match(html, /<label for="champ-tel-suivi">Téléphone<\/label>/);
    assert.ok(html.indexOf('champ-numero') < html.indexOf('champ-tel-suivi'), 'le numéro vient avant le téléphone');
  });

  test('prévoit les boutons Retour, Annuler et Reprendre un créneau, et la confirmation d\'annulation', () => {
    assert.match(html, /id="bouton-retour"/);
    assert.match(html, /id="bouton-annuler"/);
    assert.match(html, /id="lien-reprendre"/);
    assert.match(html, /<dialog id="fenetre-annulation"/);
    assert.match(html, /Oui, annuler/);
    assert.match(html, /Non, le garder/);
  });

  test('référence uniquement des fichiers qui existent, scripts dans le bon ordre', () => {
    const fichiers = [
      ...[...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    ];
    for (const fichier of fichiers) {
      assert.ok(existe('src', fichier), `fichier introuvable : src/${fichier}`);
    }
    const scripts = [...html.matchAll(/<script[^>]+src="js\/([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(scripts, ['creneaux.js', 'validation.js', 'statuts.js', 'api.js', 'suivi.js']);
  });

  test('l\'accueil et la confirmation de réservation pointent vers cette page', () => {
    assert.match(lire('src', 'index.html'), /href="suivi\.html"/);
    assert.match(lire('src', 'index.html'), /id="lien-suivi" href="suivi\.html"/);
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
