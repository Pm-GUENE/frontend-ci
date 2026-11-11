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

describe('Pages de connexion et de changement de mot de passe', () => {
  const connexion = lire('src', 'connexion.html');
  const motDePasse = lire('src', 'mot-de-passe.html');

  /** Fichiers référencés par une page (feuilles de style, scripts, images) : tous doivent exister. */
  function fichiersReferences(html) {
    return [
      ...[...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    ];
  }

  test('la connexion demande l\'identifiant et le mot de passe, avec leurs libellés', () => {
    assert.match(connexion, /<html lang="fr">/);
    assert.match(connexion, /<label for="champ-identifiant">Identifiant<\/label>/);
    assert.match(connexion, /<label for="champ-mdp">Mot de passe<\/label>/);
    assert.match(connexion, /autocomplete="username"/);
    assert.match(connexion, /autocomplete="current-password"/);
    assert.match(connexion, /Se connecter/);
  });

  test('la connexion indique quoi faire en cas de mot de passe oublié, sans réinitialisation automatique', () => {
    assert.match(connexion, /Mot de passe oublié \? Contactez l'administrateur de la clinique\./);
  });

  test('le changement de mot de passe demande le nouveau mot de passe et sa confirmation', () => {
    assert.match(motDePasse, /<h1 class="titre-page">Changer votre mot de passe<\/h1>/);
    assert.match(motDePasse, /<label for="champ-nouveau">Nouveau mot de passe<\/label>/);
    assert.match(motDePasse, /<label for="champ-confirmation">Confirmer le mot de passe<\/label>/);
    assert.match(motDePasse, /autocomplete="new-password"/);
    assert.match(motDePasse, /Enregistrer et continuer/);
    assert.match(motDePasse, /8 caractères au minimum/);
  });

  test('les champs de mot de passe ont un bouton pour afficher ou cacher la saisie', () => {
    assert.match(connexion, /id="afficher-mdp"/);
    assert.match(motDePasse, /id="afficher-nouveau"/);
    assert.match(motDePasse, /id="afficher-confirmation"/);
  });

  test('chaque page référence uniquement des fichiers qui existent', () => {
    for (const html of [connexion, motDePasse]) {
      for (const fichier of fichiersReferences(html)) {
        assert.ok(existe('src', fichier), `fichier introuvable : src/${fichier}`);
      }
    }
  });

  test('les scripts sont chargés dans l\'ordre : logique, API, puis écran', () => {
    const scripts = (html) => [...html.matchAll(/<script[^>]+src="js\/([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(scripts(connexion), ['validation.js', 'session.js', 'api.js', 'afficher-mdp.js', 'connexion.js']);
    assert.deepEqual(scripts(motDePasse), ['validation.js', 'session.js', 'api.js', 'afficher-mdp.js', 'mot-de-passe.js']);
  });

  test('l\'accueil mène à la page de connexion, qui existe maintenant', () => {
    assert.match(lire('src', 'index.html'), /href="connexion\.html"/);
    assert.ok(existe('src', 'connexion.html'));
  });

  test('la page de changement de mot de passe n\'est pas indexée par les moteurs de recherche', () => {
    assert.match(motDePasse, /<meta name="robots" content="noindex">/);
  });
});

describe('Espace administrateur (src/admin.html)', () => {
  const html = lire('src', 'admin.html');

  test('est en français, non indexée, avec un titre', () => {
    assert.match(html, /<html lang="fr">/);
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.match(html, /<title>Espace administrateur \| DentaRDV<\/title>/);
  });

  test('affiche la liste des dentistes, le bouton d\'ajout et la déconnexion', () => {
    assert.match(html, /<h1>Liste des dentistes<\/h1>/);
    assert.match(html, /id="ouvrir-ajout"/);
    assert.match(html, /Ajouter un dentiste/);
    assert.match(html, /id="deconnexion"/);
    assert.match(html, /id="liste-admin"/);
  });

  test('ne propose ni modification ni suppression de dentiste (hors périmètre de la version)', () => {
    assert.doesNotMatch(html, /Supprimer/i);
    assert.doesNotMatch(html, /Modifier/i);
  });

  test('le formulaire demande le nom, la spécialité et les motifs, sans identifiant ni mot de passe', () => {
    assert.match(html, /<label for="champ-nom-dentiste">Prénom\(s\) et nom<\/label>/);
    assert.match(html, /<label for="champ-specialite">Spécialité<\/label>/);
    assert.match(html, /<legend>Motifs proposés<\/legend>/);
    assert.match(html, /id="choix-motifs"/);
    assert.match(html, /Créer/);
    assert.doesNotMatch(html, /<label for="champ-identifiant-dentiste"/);
  });

  test('l\'écran « Dentiste créé » affiche identifiant et mot de passe avec un bouton Copier chacun', () => {
    assert.match(html, /<h2 id="titre-cree"[^>]*>Dentiste créé<\/h2>/);
    assert.match(html, /<label for="valeur-identifiant">Identifiant<\/label>/);
    assert.match(html, /<label for="valeur-mdp">Mot de passe temporaire<\/label>/);
    assert.match(html, /id="copier-identifiant"/);
    assert.match(html, /id="copier-mdp"/);
    assert.match(html, /Notez-le maintenant, il ne sera plus affichable !/);
    assert.match(html, /id="bouton-terminer">Terminer<\/button>/);
  });

  test('prévoit la confirmation avant de fermer sans avoir copié le mot de passe', () => {
    assert.match(html, /id="confirmation-fermeture"/);
    assert.match(html, /Vous n'avez pas copié le mot de passe\. Fermer quand même \?/);
  });

  test('référence uniquement des fichiers qui existent, scripts dans le bon ordre', () => {
    const fichiers = [
      ...[...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    ];
    for (const fichier of fichiers) {
      assert.ok(existe('src', fichier), `fichier introuvable : src/${fichier}`);
    }
    const scripts = [...html.matchAll(/<script[^>]+src="js\/([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(scripts, ['validation.js', 'session.js', 'dentistes.js', 'api.js', 'admin.js']);
  });

  test('l\'image d\'avatar utilisée par la liste existe', () => {
    assert.ok(existe('src', 'assets', 'avatar-medecin.png'));
    assert.match(lire('src', 'js', 'admin.js'), /assets\/avatar-medecin\.png/);
  });

  test('la connexion envoie l\'administrateur vers cette page, qui existe maintenant', () => {
    assert.match(lire('src', 'js', 'session.js'), /PAGE_ADMIN = 'admin\.html'/);
    assert.ok(existe('src', 'admin.html'));
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
