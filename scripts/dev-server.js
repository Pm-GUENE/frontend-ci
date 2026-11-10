// Serveur de développement : sert le dossier src/ et transmet /api/ au backend,
// comme le fait Nginx en production. Aucune dépendance : `npm start`.
//   PORT         port du site (8080 par défaut)
//   BACKEND_URL  adresse du backend (http://127.0.0.1:8000 par défaut)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 8080;
const BACKEND = new URL(process.env.BACKEND_URL || 'http://127.0.0.1:8000');
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

function transmettreAuBackend(requete, reponse) {
  const chemin = requete.url.replace(/^\/api/, '') || '/';
  const sortante = http.request(
    {
      hostname: BACKEND.hostname,
      port: BACKEND.port,
      path: chemin,
      method: requete.method,
      headers: { ...requete.headers, host: BACKEND.host },
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

function servirFichier(requete, reponse) {
  const adresse = decodeURIComponent(new URL(requete.url, 'http://localhost').pathname);
  const demande = adresse.endsWith('/') ? adresse + 'index.html' : adresse;
  const fichier = path.normalize(path.join(RACINE, demande));

  // Interdit de sortir du dossier src/ (../).
  if (!fichier.startsWith(RACINE + path.sep)) {
    reponse.writeHead(403);
    reponse.end('Interdit');
    return;
  }
  fs.readFile(fichier, (erreur, contenu) => {
    if (erreur) {
      reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      reponse.end('Page introuvable');
      return;
    }
    reponse.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream' });
    reponse.end(contenu);
  });
}

http
  .createServer((requete, reponse) => {
    if (requete.url.startsWith('/api/')) transmettreAuBackend(requete, reponse);
    else servirFichier(requete, reponse);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Site : http://localhost:${PORT}  (API transmise à ${BACKEND.origin})`);
  });
