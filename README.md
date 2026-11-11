# frontend-ci : interface web de DentaRDV

Frontend de **DentaRDV**, une application de prise de rendez-vous pour une clinique dentaire au Sénégal.
Projet d'examen DevOps, Master 2 SI/SR, UADB, 2026-2027.

Ce dépôt contient uniquement le **frontend** : les pages web, leur serveur Nginx, le Dockerfile et les tests.
Le projet suit une architecture **multi-repo**, avec trois dépôts indépendants :

| Dépôt | Rôle |
|---|---|
| [`backend-ci`](https://github.com/Pm-GUENE/backend-ci) | API FastAPI, base de données, tests, Dockerfile, Jenkinsfile de CI |
| `frontend-ci` (ce dépôt) | Interface web (HTML, CSS, JavaScript servi par Nginx), tests, Dockerfile |
| [`deployment-cd`](https://github.com/Pm-GUENE/deployment-cd) | `docker-compose.yml`, `.env`, Jenkinsfile de déploiement |

Le suivi des tâches de l'équipe est sur le [board Trello du projet](https://trello.com/b/y8gXWUlb/dentardv-examen-devops-m2).

---

## 1. Le besoin

Une clinique dentaire prend souvent ses rendez-vous par téléphone, par WhatsApp ou sur place. Les conséquences sont connues : files d'attente, doubles réservations, créneaux oubliés et rendez-vous non honorés, sans suivi pour la clinique.

DentaRDV permet au patient de réserver en ligne un créneau libre, sans compte, et de suivre sa demande. Chaque dentiste gère son propre planning et est prévenu dès qu'un rendez-vous est pris. L'application concerne **une seule clinique**, qui compte plusieurs dentistes. Toute l'interface est en français.

---

## 2. Ce que fait le frontend

### Patient (sans compte)

- **Accueil** (`index.html`) : liste des dentistes avec leurs motifs de consultation et leurs créneaux libres de la semaine. Une barre de recherche filtre par nom de dentiste ou par motif. « Voir plus d'horaires » déplie la journée complète, de 08h00 à 16h30.
- **Réservation** (fenêtre ouverte par un clic sur un créneau libre) : nom, téléphone et motif. Le formulaire vérifie les données avant l'envoi. L'écran de confirmation donne le **numéro de rendez-vous** et précise que le dentiste doit encore confirmer.
- **Suivi** (`suivi.html`) : le patient saisit son numéro de rendez-vous et son téléphone, voit le statut (en attente, confirmé, annulé, terminé) et peut annuler tant que c'est possible. La page se met à jour toutes les 30 secondes.

### Dentiste (avec compte)

- **Connexion** (`connexion.html`) puis **changement de mot de passe obligatoire** à la première connexion (`mot-de-passe.html`).
- **Espace dentiste** (`dentiste.html`) :
  - onglet *Planning* : la semaine en grille, avec une couleur par statut, et le détail d'un rendez-vous au clic ;
  - bloc *Demandes en attente* : confirmer d'un clic ou annuler avec confirmation ;
  - onglet *Liste* : tous ses rendez-vous, filtrables par date, motif et statut ;
  - pastille de comptage des notifications et bannière de rappel pour un rendez-vous confirmé dans moins de 15 minutes ;
  - actualisation automatique toutes les 30 secondes.

### Administrateur

- **Espace administrateur** (`admin.html`) : liste des dentistes (nom, spécialité, identifiant, motifs) et création d'un compte. Le backend génère l'identifiant et un mot de passe temporaire, affiché **une seule fois** avec un bouton « Copier ». La fenêtre prévient si on la ferme sans avoir copié le mot de passe.

---

## 3. Technologies

| Outil | Rôle |
|---|---|
| **HTML, CSS, JavaScript** (sans framework) | Pages et comportement. Aucune dépendance à installer pour faire tourner le site |
| **Nginx** | Sert les pages et transmet les appels `/api/` au backend |
| **Docker** | Image du frontend (`nginx:alpine`) |
| **Node.js 20 ou plus** | Uniquement pour les tests (`node --test`) et le serveur de développement |
| **npm audit** | Scan de sécurité des dépendances (le projet n'en a aucune) |

Le choix d'un frontend sans framework est volontaire : l'application tient en quelques pages, le site se charge vite sur une connexion limitée, et la surface d'attaque côté dépendances est nulle.

---

## 4. Structure du dépôt

```
frontend-ci/
├── src/                      # Le site, copié tel quel dans l'image Docker
│   ├── index.html            # Accueil : dentistes, créneaux, réservation
│   ├── suivi.html            # Suivi et annulation d'un rendez-vous
│   ├── connexion.html        # Connexion dentiste et administrateur
│   ├── mot-de-passe.html     # Changement de mot de passe obligatoire
│   ├── dentiste.html         # Espace dentiste
│   ├── admin.html            # Espace administrateur
│   ├── css/style.css
│   ├── assets/               # Images
│   └── js/
│       ├── api.js            # Appels au backend (seul fichier qui utilise fetch)
│       ├── creneaux.js       # Dates, semaine affichée, grille des horaires
│       ├── validation.js     # Nom, téléphone, messages d'erreur de l'API
│       ├── statuts.js        # Statuts et messages de la page de suivi
│       ├── session.js        # Session, redirections par rôle, mots de passe
│       ├── agenda.js         # Planning du dentiste, actions, rappels, filtres
│       ├── dentistes.js      # Formulaire d'ajout d'un dentiste
│       └── accueil.js, reservation.js, suivi.js, connexion.js,
│           mot-de-passe.js, dentiste.js, admin.js, afficher-mdp.js
│                             # Un fichier par écran (affichage et événements)
├── tests/                    # Tests unitaires et tests de structure
├── scripts/dev-server.js     # Serveur de développement (site + proxy /api)
├── nginx.conf                # Configuration Nginx de l'image
├── Dockerfile
├── package.json
└── README.md
```

Les règles métier sont écrites dans des fichiers de logique pure (`creneaux.js`, `validation.js`, `statuts.js`, `session.js`, `agenda.js`, `dentistes.js`). Ils ne touchent ni au DOM ni au réseau, ce qui les rend testables avec Node. Les fichiers d'écran ne contiennent que l'affichage.

---

## 5. Lancer le site en local

### Prérequis

- Node.js 20 ou plus (`node --version`)
- Git
- Le **backend** lancé sur le port 8000 : voir le README de `backend-ci`

### Étapes

```bash
git clone https://github.com/Pm-GUENE/frontend-ci.git
cd frontend-ci
npm start
```

Ouvrir ensuite http://localhost:8080. `npm start` lance un petit serveur qui sert le dossier `src/` et transmet les appels `/api/` au backend, comme le fait Nginx en production. Il n'y a rien à installer : le projet n'a aucune dépendance.

| Variable | Rôle | Valeur par défaut |
|---|---|---|
| `PORT` | Port du site | `8080` |
| `BACKEND_URL` | Adresse du backend | `http://127.0.0.1:8000` |

Exemple pour changer le port : `PORT=9000 npm start` (sous PowerShell : `$env:PORT=9000; npm start`).

Les comptes de démonstration (administrateur et dentistes) sont créés par le backend au démarrage. Leurs identifiants sont dans le README de `backend-ci`.

---

## 6. Communication avec le backend

Le navigateur appelle toujours des adresses en `/api/...`. Nginx (ou le serveur de développement) retire le préfixe `/api` et transmet la requête au backend FastAPI. Il n'y a donc pas de problème de CORS et l'adresse du backend n'apparaît jamais dans le code du site.

| Page | Routes utilisées |
|---|---|
| Accueil et réservation | `GET /dentistes?q=`, `GET /creneaux?dentiste_id=&du=&au=`, `POST /rendez-vous` |
| Suivi | `GET /rendez-vous/{id}?tel=`, `PATCH /rendez-vous/{id}/annulation?tel=` |
| Connexion | `POST /connexion`, `PATCH /mot-de-passe` |
| Espace dentiste | `GET /mes-rendez-vous`, `GET /mes-notifications`, `PATCH /rendez-vous/{id}`, `GET /soins` |
| Espace administrateur | `GET /admin/dentistes`, `POST /admin/dentistes`, `GET /soins` |

Points à connaître :

- **Statuts** : le backend écrit `en_attente`, `confirme`, `termine`, `annule` (sans accent). Le frontend les affiche avec leurs accents (`statuts.js`).
- **Connexion** : le backend renvoie un jeton JWT. Il est gardé dans le `sessionStorage` de l'onglet, donc effacé à sa fermeture, et envoyé dans l'en-tête `Authorization: Bearer`. Un jeton expiré (erreur 401) renvoie à la connexion avec un message.
- **Règles de statut** : le frontend n'invente rien. Les boutons proposés sur un rendez-vous viennent du champ `actions_possibles` du backend (par exemple, « Terminé » n'apparaît qu'après l'heure du rendez-vous).
- **Suivi patient** : le numéro de rendez-vous et le téléphone gardés après une réservation passent par le `sessionStorage`, jamais par l'adresse de la page.

---

## 7. Tests

```bash
npm test
```

Les tests utilisent l'outil intégré à Node (`node --test`), sans bibliothèque. Ils se répartissent en deux familles.

**Tests unitaires** (règles métier de chaque fichier de logique) :

| Fichier | Ce qui est vérifié |
|---|---|
| `creneaux.test.js` | Semaine affichée (week-end ignoré), horaires de 08:00 à 16:30, grille des créneaux libres |
| `validation.test.js` | Nom et téléphone sénégalais (avec ou sans +221), messages d'erreur de l'API |
| `statuts.test.js` | Messages de suivi selon le statut, bouton « Annuler » décidé par le backend |
| `session.test.js` | Redirection selon le rôle, session, règles du nouveau mot de passe (8 caractères, 72 octets) |
| `agenda.test.js` | Couleur de chaque case du planning, boutons d'action, rappel, filtres, message de conflit |
| `dentistes.test.js` | Formulaire d'ajout d'un dentiste (prénom et nom, spécialité, au moins un motif) |

**Tests de structure** (`structure.test.js`) : chaque page a ses champs et ses libellés, charge ses scripts dans le bon ordre, ne référence que des fichiers qui existent, et le `Dockerfile` et Nginx contiennent ce qu'on attend (`/health`, proxy `/api/`, aucun secret versionné).

Scan de sécurité des dépendances :

```bash
npm run audit
```

Le projet n'a aucune dépendance, donc le scan renvoie « 0 vulnérabilité ».

---

## 8. Docker

### Construire et lancer l'image

```bash
docker build -t dentardv-frontend .
docker run --rm -p 8080:80 dentardv-frontend
```

Le site est alors sur http://localhost:8080 et le contrôle de santé sur http://localhost:8080/health (réponse `ok`).

### Ce que contient l'image

- `nginx:1.27-alpine` avec la configuration `nginx.conf` et le dossier `src/`.
- Un `HEALTHCHECK` Docker qui appelle `/health`.
- En-têtes de sécurité (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) et compression.

### Lien avec le backend

Nginx transmet `/api/` vers **`http://backend:8000`**. Le nom `backend` est celui du service défini dans le `docker-compose.yml` du dépôt `deployment-cd`. Lancée seule, l'image sert les pages, mais les appels `/api/` renvoient une erreur 502 faute de backend.

Nginx résout le nom `backend` à chaque requête (`resolver 127.0.0.11`). Il démarre donc même si le backend n'est pas prêt, et il suit les changements d'instances pendant une mise à jour sans interruption avec plusieurs instances du backend.

---

## 9. Intégration continue (Jenkins)

Le pipeline du frontend est écrit par Racine SABALY dans un `Jenkinsfile` à la racine du dépôt. Il suit les étapes demandées par le sujet, adaptées à un frontend :

1. **Checkout** du code.
2. **Dépendances** : `npm install`.
3. **Tests** : `npm test`.
4. **Scan du code et des dépendances** : `npm run audit`.
5. **Build** de l'image Docker.
6. **Scan de l'image** avec Trivy.
7. **Push** sur Docker Hub, avec le numéro de build comme tag, et `latest`.

Un push sur ce dépôt déclenche le pipeline par webhook GitHub. À la fin, le déploiement est relancé par le dépôt `deployment-cd`. L'agent Jenkins doit disposer de Node.js 20 ou plus (par exemple l'image `node:20-alpine`) et de Docker.

---

## 10. Sécurité et accessibilité

- **Aucun secret dans le dépôt** : le site ne contient ni mot de passe ni clé. Le `.gitignore` exclut `.env`.
- **Pas d'injection de HTML** : les données reçues de l'API (noms, motifs) sont insérées avec `textContent`, jamais interprétées comme du HTML.
- **Mot de passe temporaire** : affiché une seule fois dans l'espace administrateur, jamais stocké par le navigateur, et effacé de la page dès la fermeture de la fenêtre.
- **Messages d'erreur prudents** : une erreur de connexion ou de suivi ne dit pas lequel des deux champs est faux.
- **Accès protégé** : chaque espace vérifie la session et renvoie vers la bonne page si le rôle ne correspond pas.
- **Accessibilité** : champs reliés à leurs libellés, messages d'erreur annoncés (`role="alert"`), onglets utilisables au clavier, fenêtres natives `<dialog>` (focus géré, touche Échap), textes alternatifs sur les images, contour visible sur l'élément au clavier.
- **Adaptation au téléphone** : toutes les pages sont testées de 375 px à l'écran large, sans défilement horizontal.

---

## 11. Choix et limites

- **Créneaux de 30 minutes**, du lundi au vendredi, de 08h00 à 17h00. Les créneaux passés sont grisés.
- **Menu déroulant du motif** : l'apparence personnalisée (`appearance: base-select`) fonctionne dans Chrome et Edge récents. Firefox et Safari gardent le menu natif de leur système, avec le même fonctionnement.
- **Bouton « Copier »** (mot de passe temporaire) : l'API du presse-papiers exige une page sécurisée (`localhost` ou HTTPS). En HTTP sur une autre adresse, la page propose de copier à la main, et un `Ctrl+C` sur le champ compte aussi.
- **Pas de réinitialisation du mot de passe** : un dentiste qui l'oublie contacte l'administrateur de la clinique.
- **Pas d'e-mail ni de SMS** : les notifications se font dans l'application. Le patient n'est pas prévenu automatiquement, il revient sur la page de suivi.

---

## 12. Problèmes fréquents

| Symptôme | Cause probable et solution |
|---|---|
| « Impossible de charger les dentistes (erreur 404) » dans l'espace administrateur | Le backend local est en retard. Faire `git pull` dans `backend-ci` : les routes d'administration y ont été ajoutées après les routes publiques |
| « Backend injoignable » ou erreur 502 | Le backend n'est pas lancé sur le port 8000 (en local), ou le service ne s'appelle pas `backend` (avec Docker) |
| `Address already in use` au lancement de `npm start` | Le port 8080 est pris. Utiliser `PORT=9000 npm start` |
| La page de connexion ne garde pas la session | Navigation privée ou stockage bloqué : le navigateur refuse le `sessionStorage` |
| « Votre session a expiré » | Le jeton dure 8 heures. Se reconnecter |

---

## 13. Équipe

| Membre | Responsabilité |
|---|---|
| Papa Moussa GUENE | Organisation, cahier des charges, **frontend** |
| Mouhamadou SABALY | Backend et API |
| Racine SABALY | Jenkins et intégration continue |
| Adama SECK | Déploiement, Docker Compose |
| Diegane SECK | Tests et sécurité |

---

## Crédits

Illustrations et icônes : Canva et Flaticon. Le code de ce dépôt est un projet d'examen, sans licence de réutilisation.
