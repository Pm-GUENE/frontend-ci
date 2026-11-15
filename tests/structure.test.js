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

describe('Espace dentiste (src/dentiste.html)', () => {
  const html = lire('src', 'dentiste.html');

  test('est en français, non indexée, avec un titre', () => {
    assert.match(html, /<html lang="fr">/);
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.match(html, /<title>Espace dentiste \| DentaRDV<\/title>/);
  });

  test('propose deux onglets accessibles : Planning et Liste', () => {
    assert.match(html, /role="tablist"/);
    assert.match(html, /<button[^>]+role="tab"[^>]+id="onglet-planning"[^>]+aria-selected="true"[^>]*>Planning<\/button>/);
    assert.match(html, /<button[^>]+role="tab"[^>]+id="onglet-liste"[^>]+aria-selected="false"[^>]*>Liste<\/button>/);
    assert.match(html, /id="panneau-planning"[^>]+role="tabpanel"/);
    assert.match(html, /id="panneau-liste"[^>]+role="tabpanel"/);
  });

  test('le planning a ses flèches de semaine, sa grille et sa légende', () => {
    assert.match(html, /id="semaine-precedente"/);
    assert.match(html, /id="semaine-suivante"/);
    assert.match(html, /id="grille-planning"/);
    assert.match(html, /id="legende"/);
  });

  test('affiche les demandes en attente, la pastille de comptage et la bannière de rappel', () => {
    assert.match(html, /Demandes en attente/);
    assert.match(html, /id="liste-demandes"/);
    assert.match(html, /id="pastille"/);
    assert.match(html, /id="bandeau-rappel"/);
  });

  test('la liste se filtre par date, motif et statut, avec les quatre statuts', () => {
    assert.match(html, /<label for="filtre-date">Date<\/label>/);
    assert.match(html, /<label for="filtre-motif">Motif<\/label>/);
    assert.match(html, /<label for="filtre-statut">Statut<\/label>/);
    for (const statut of ['en_attente', 'confirme', 'termine', 'annule']) {
      assert.match(html, new RegExp(`<option value="${statut}">`), `statut manquant : ${statut}`);
    }
    assert.match(html, /id="reinitialiser-filtres"/);
  });

  test('le détail d\'un rendez-vous montre le patient, son téléphone et le motif, avec les actions', () => {
    assert.match(html, /<dialog id="fenetre-detail"/);
    assert.match(html, /id="detail-patient"/);
    assert.match(html, /id="detail-tel"/);
    assert.match(html, /id="detail-motif"/);
    assert.match(html, /id="actions-detail"/);
  });

  test('toute annulation demande une confirmation', () => {
    assert.match(html, /<dialog id="fenetre-annulation-rdv"/);
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
    assert.deepEqual(scripts, ['creneaux.js', 'validation.js', 'statuts.js', 'session.js', 'agenda.js', 'api.js', 'dentiste.js']);
  });

  test('la connexion envoie le dentiste vers cette page, qui existe maintenant', () => {
    assert.match(lire('src', 'js', 'session.js'), /PAGE_DENTISTE = 'dentiste\.html'/);
    assert.ok(existe('src', 'dentiste.html'));
  });

  test('plus aucune page de destination de la connexion n\'est manquante', () => {
    for (const page of ['connexion.html', 'mot-de-passe.html', 'dentiste.html', 'admin.html']) {
      assert.ok(existe('src', page), `page manquante : ${page}`);
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

  test('le conteneur ne tourne pas en root et met à jour les paquets du système', () => {
    const dockerfile = lire('Dockerfile');
    assert.match(dockerfile, /^USER nginx$/m);
    assert.match(dockerfile, /apk upgrade --no-cache/);
    assert.match(dockerfile, /^HEALTHCHECK /m);
    // USER doit venir après les commandes qui ont besoin de root (apk, chown).
    assert.ok(dockerfile.indexOf('USER nginx') > dockerfile.indexOf('chown'), 'USER nginx doit être placé après chown');
  });

  test('le contexte de build exclut les fichiers inutiles à l\'image et les fichiers d\'environnement', () => {
    const ignore = lire('.dockerignore').split(/\r?\n/);
    for (const entree of ['.git', '.env', '.env.*', 'node_modules', 'tests', 'scripts', 'package.json', 'Jenkinsfile']) {
      assert.ok(ignore.includes(entree), `.dockerignore doit contenir ${entree}`);
    }
    assert.ok(!ignore.includes('src'), 'le site doit rester dans le contexte de build');
    assert.ok(!ignore.includes('nginx.conf'), 'la configuration Nginx doit rester dans le contexte de build');
  });

  test('le pipeline Jenkins est présent et enchaîne tests, audit, build, Trivy et publication', () => {
    assert.ok(existe('Jenkinsfile'), 'Jenkinsfile manquant');
    const jenkinsfile = lire('Jenkinsfile');
    for (const element of ['npm test', 'npm audit', 'docker build', 'aquasec/trivy:0.76.2 image', 'docker push']) {
      assert.ok(jenkinsfile.includes(element), `étape manquante dans le Jenkinsfile : ${element}`);
    }
  });
});

describe('Sécurité de Nginx (nginx.conf)', () => {
  const nginx = lire('nginx.conf');
  // Contenu de chaque bloc « location { ... } » (aucun bloc imbriqué dans ce fichier).
  const blocs = [...nginx.matchAll(/location[^{]*\{([^}]*)\}/g)].map((m) => m[1]);

  test('la version de Nginx n\'est pas annoncée et les envois volumineux sont refusés', () => {
    assert.match(nginx, /^\s*server_tokens off;/m);
    assert.match(nginx, /^\s*client_max_body_size 64k;/m);
  });

  test('les en-têtes de sécurité sont présents, avec « always »', () => {
    for (const entete of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy', 'Content-Security-Policy']) {
      assert.match(nginx, new RegExp(`add_header ${entete} "[^"]+" always;`), `en-tête manquant : ${entete}`);
    }
  });

  test('la politique CSP n\'autorise que les fichiers du site, sans script ni style en ligne', () => {
    const csp = nginx.match(/add_header Content-Security-Policy "([^"]+)"/)[1];
    for (const regle of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'"]) {
      assert.ok(csp.includes(regle), `règle CSP manquante : ${regle}`);
    }
    assert.ok(!csp.includes("'unsafe-inline'"), "la CSP ne doit pas autoriser 'unsafe-inline'");
    assert.ok(!csp.includes("'unsafe-eval'"), "la CSP ne doit pas autoriser 'unsafe-eval'");
  });

  test('aucun bloc location ne redéfinit add_header (il ferait perdre les en-têtes de sécurité)', () => {
    assert.ok(blocs.length >= 5, 'les blocs location doivent être trouvés');
    for (const bloc of blocs) {
      assert.ok(!/add_header/.test(bloc), `add_header dans un bloc location : ${bloc.trim().slice(0, 60)}`);
    }
  });

  test('les pages respectent la CSP : ni script en ligne, ni style en ligne, ni gestionnaire d\'événement en attribut', () => {
    for (const page of ['index.html', 'suivi.html', 'connexion.html', 'mot-de-passe.html', 'dentiste.html', 'admin.html']) {
      const html = lire('src', page);
      assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), `${page} : script en ligne`);
      assert.ok(!/<style[\s>]/i.test(html), `${page} : balise style`);
      assert.ok(!/\sstyle="/i.test(html), `${page} : attribut style`);
      assert.ok(!/\son[a-z]+="/i.test(html), `${page} : gestionnaire d'événement en attribut`);
      assert.ok(!/javascript:/i.test(html), `${page} : adresse javascript:`);
      for (const src of [...html.matchAll(/<(?:script|img)[^>]+src="([^"]+)"/g)].map((m) => m[1])) {
        assert.ok(!/^(https?:)?\/\//.test(src), `${page} : ressource externe ${src}`);
      }
    }
  });

  test('scripts, styles et pages sont revalidés à chaque visite ; seules les images sont gardées en cache', () => {
    const blocCode = nginx.match(/location ~\* \\\.\(css\|js\)\$ \{([^}]*)\}/);
    assert.ok(blocCode, 'bloc des fichiers css et js introuvable');
    assert.match(blocCode[1], /expires -1;/);

    const blocImages = nginx.match(/location ~\* \\\.\(png[^)]*\)\$ \{([^}]*)\}/);
    assert.ok(blocImages, 'bloc des images introuvable');
    assert.match(blocImages[1], /expires 7d;/);
    assert.ok(!/css|js\b/.test(nginx.match(/location ~\* \\\.\((png[^)]*)\)\$/)[1]), 'les scripts ne doivent pas être dans le bloc mis en cache');

    const blocPages = nginx.match(/location \/ \{([^}]*)\}/);
    assert.match(blocPages[1], /expires -1;/);
  });

  test('les appels à l\'API sont limités en débit, plus strictement pour la connexion', () => {
    assert.match(nginx, /limit_req_zone \$binary_remote_addr zone=api:\d+m rate=\d+r\/s;/);
    assert.match(nginx, /limit_req_zone \$cle_connexion zone=connexion:\d+m rate=\d+r\/m;/);
    assert.match(nginx, /~\^\/api\/connexion\s+\$binary_remote_addr;/);
    const blocApi = nginx.match(/location \/api\/ \{([^}]*)\}/)[1];
    assert.match(blocApi, /limit_req zone=api burst=\d+ nodelay;/);
    assert.match(blocApi, /limit_req zone=connexion burst=\d+ nodelay;/);
    assert.match(blocApi, /limit_req_status 429;/);
  });
});
