// Serveur de développement : sert le dossier src/ et transmet /api/ au backend,
// comme le fait Nginx en production. Aucune dépendance : `npm start`.
//   PORT         port du site (8080 par défaut)
//   BACKEND_URL  adresse du backend (http://127.0.0.1:8000 par défaut)
// Ce serveur n'écoute que sur 127.0.0.1 : il sert au développement, jamais à la production.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..', 'src');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Mêmes en-têtes de sécurité que nginx.conf : une page qui enfreindrait la politique CSP
// (script ou style en ligne, ressource externe) est ainsi repérée dès le développement.
// Un test vérifie que cette politique reste identique à celle de Nginx.
const ENTETES_SECURITE = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
};

/**
 * Fichier à servir pour une adresse demandée.
 * Retourne { statut: 200, fichier }, ou { statut: 400 } si l'adresse est mal formée
 * (par exemple « /%E0%A4%A », que decodeURIComponent refuse), ou { statut: 403 } si elle
 * cherche à sortir du dossier servi (« ../ »).
 */
function resoudreFichier(url, racine) {
  let adresse;
  try {
    adresse = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch (_) {
    return { statut: 400 };
  }
  if (adresse.includes('\0')) return { statut: 400 };

  const demande = adresse.endsWith('/') ? adresse + 'index.html' : adresse;
  const fichier = path.normalize(path.join(racine, demande));
  if (!fichier.startsWith(racine + path.sep)) return { statut: 403 };
  return { statut: 200, fichier };
}

function repondreTexte(reponse, statut, texte) {
  reponse.writeHead(statut, { 'Content-Type': 'text/plain; charset=utf-8' });
  reponse.end(texte);
}

function servirFichier(requete, reponse, racine) {
  const resultat = resoudreFichier(requete.url, racine);
  if (resultat.statut === 400) return repondreTexte(reponse, 400, 'Requête invalide');
  if (resultat.statut === 403) return repondreTexte(reponse, 403, 'Interdit');

  fs.readFile(resultat.fichier, (erreur, contenu) => {
    if (erreur) return repondreTexte(reponse, 404, 'Page introuvable');
    reponse.writeHead(200, {
      'Content-Type': TYPES[path.extname(resultat.fichier)] || 'application/octet-stream',
      'Cache-Control': 'no-cache', // en développement, toujours la dernière version des fichiers
    });
    reponse.end(contenu);
  });
}

function transmettreAuBackend(requete, reponse, backend) {
  const chemin = requete.url.replace(/^\/api/, '') || '/';
  const sortante = http.request(
    {
      hostname: backend.hostname,
      port: backend.port,
      path: chemin,
      method: requete.method,
      headers: { ...requete.headers, host: backend.host },
    },
    (reponseBackend) => {
      reponse.writeHead(reponseBackend.statusCode, reponseBackend.headers);
      reponseBackend.pipe(reponse);
    }
  );
  sortante.on('error', () => {
    reponse.writeHead(502, { 'Content-Type': 'application/json' });
    reponse.end(JSON.stringify({ detail: 'Backend injoignable' }));
  });
  requete.pipe(sortante);
}

/** Crée le serveur sans le démarrer (les tests le lancent sur un port libre). */
function creerServeur(options) {
  const racine = (options && options.racine) || RACINE;
  const backend = new URL((options && options.backend) || process.env.BACKEND_URL || 'http://127.0.0.1:8000');

  return http.createServer((requete, reponse) => {
    try {
      Object.entries(ENTETES_SECURITE).forEach(([nom, valeur]) => reponse.setHeader(nom, valeur));
      if (requete.url.startsWith('/api/')) transmettreAuBackend(requete, reponse, backend);
      else servirFichier(requete, reponse, racine);
    } catch (_) {
      // Une requête inattendue ne doit jamais arrêter le serveur.
      if (!reponse.headersSent) repondreTexte(reponse, 500, 'Erreur du serveur de développement');
      else reponse.end();
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
  creerServeur({ backend }).listen(port, '127.0.0.1', () => {
    console.log(`Site : http://localhost:${port}  (API transmise à ${new URL(backend).origin})`);
  });
}

module.exports = { resoudreFichier, creerServeur, RACINE, ENTETES_SECURITE };
