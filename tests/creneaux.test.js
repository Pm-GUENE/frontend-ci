// Tests unitaires de src/js/creneaux.js : semaine affichée, horaires et grille des créneaux.
// Rappel : le lundi 9 novembre 2026 est bien un lundi (le 14 est un samedi).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/js/creneaux.js');

const date = (iso) => C.depuisISO(iso);

describe('Dates', () => {
  test('versISO et depuisISO sont réciproques, sans décalage de fuseau', () => {
    assert.equal(C.versISO(date('2026-11-09')), '2026-11-09');
    assert.equal(C.versISO(date('2026-01-01')), '2026-01-01');
    assert.equal(C.versISO(date('2026-12-31')), '2026-12-31');
  });

  test('ajouterJours passe correctement d\'un mois à l\'autre', () => {
    assert.equal(C.versISO(C.ajouterJours(date('2026-11-30'), 1)), '2026-12-01');
    assert.equal(C.versISO(C.ajouterJours(date('2026-11-09'), -9)), '2026-10-31');
  });

  test('libelleJour donne le nom du jour et la date courte', () => {
    assert.deepEqual(C.libelleJour(date('2026-11-09')), { nom: 'lundi', court: '9 nov.' });
    assert.deepEqual(C.libelleJour(date('2026-12-04')), { nom: 'vendredi', court: '4 déc.' });
  });

  test('libelleDateLongue écrit la date en toutes lettres', () => {
    assert.equal(C.libelleDateLongue('2026-11-09'), 'lundi 9 novembre 2026');
    assert.equal(C.libelleDateLongue('2026-02-03'), 'mardi 3 février 2026');
  });
});

describe('Semaine affichée', () => {
  test('un jour de semaine ramène au lundi de la même semaine', () => {
    for (const jour of ['2026-11-09', '2026-11-11', '2026-11-13']) {
      assert.equal(C.versISO(C.lundiDeLaSemaine(date(jour))), '2026-11-09');
    }
  });

  test('le week-end propose la semaine suivante (la clinique est fermée)', () => {
    assert.equal(C.versISO(C.lundiDeLaSemaine(date('2026-11-14'))), '2026-11-16'); // samedi
    assert.equal(C.versISO(C.lundiDeLaSemaine(date('2026-11-15'))), '2026-11-16'); // dimanche
  });

  test('joursOuvres renvoie du lundi au vendredi, jamais le week-end', () => {
    const jours = C.joursOuvres(date('2026-11-09')).map(C.versISO);
    assert.deepEqual(jours, ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  });

  test('on ne peut pas reculer avant la semaine courante', () => {
    const courant = date('2026-11-09');
    assert.equal(C.peutReculer(courant, courant), false);
    assert.equal(C.peutReculer(date('2026-11-16'), courant), true);
  });

  test('on ne peut pas avancer au-delà du nombre maximal de semaines', () => {
    const courant = date('2026-11-09');
    assert.equal(C.peutAvancer(courant, courant, 8), true);
    assert.equal(C.peutAvancer(date('2026-12-28'), courant, 8), false); // 8e semaine
    assert.equal(C.peutAvancer(date('2026-12-21'), courant, 8), true); // 7e semaine
  });
});

describe('Horaires', () => {
  const heures = C.horaires();

  test('de 08:00 à 16:30 par pas de 30 minutes', () => {
    assert.equal(heures.length, 18);
    assert.equal(heures[0], '08:00');
    assert.equal(heures[1], '08:30');
    assert.equal(heures[heures.length - 1], '16:30');
  });

  test('17:00 n\'est pas un créneau (fermeture)', () => {
    assert.ok(!heures.includes('17:00'));
    assert.ok(heures.includes('12:00'));
  });

  test('normaliserHeure accepte le format de l\'API (HH:MM:SS)', () => {
    assert.equal(C.normaliserHeure('09:00:00'), '09:00');
    assert.equal(C.normaliserHeure('16:30'), '16:30');
  });
});

describe('Grille des créneaux', () => {
  const jours = C.joursOuvres(date('2026-11-09'));
  const heures = C.horaires();

  test('un créneau renvoyé par l\'API est libre, tous les autres sont indisponibles', () => {
    const libres = [
      { date: '2026-11-09', heure: '09:00:00' },
      { date: '2026-11-11', heure: '10:30:00' },
    ];
    const grille = C.construireGrille(libres, jours, heures);
    const cases = grille.flatMap((ligne) => ligne.cases);

    assert.equal(cases.filter((c) => c.libre).length, 2);
    assert.equal(cases.find((c) => c.date === '2026-11-09' && c.heure === '09:00').libre, true);
    assert.equal(cases.find((c) => c.date === '2026-11-11' && c.heure === '10:30').libre, true);
    assert.equal(cases.find((c) => c.date === '2026-11-09' && c.heure === '09:30').libre, false);
  });

  test('la grille a une ligne par horaire et cinq cases par ligne', () => {
    const grille = C.construireGrille([], jours, heures);
    assert.equal(grille.length, 18);
    assert.ok(grille.every((ligne) => ligne.cases.length === 5));
  });

  test('sans créneau libre, toute la grille est indisponible', () => {
    const grille = C.construireGrille([], jours, heures);
    assert.ok(grille.every((ligne) => ligne.cases.every((c) => !c.libre)));
  });

  test('un créneau d\'une autre semaine est ignoré', () => {
    const grille = C.construireGrille([{ date: '2026-11-16', heure: '09:00:00' }], jours, heures);
    assert.ok(grille.every((ligne) => ligne.cases.every((c) => !c.libre)));
  });

  test('lignesVisibles limite l\'affichage tant que la grille n\'est pas dépliée', () => {
    const grille = C.construireGrille([], jours, heures);
    assert.equal(C.lignesVisibles(grille, false, 4).length, 4);
    assert.equal(C.lignesVisibles(grille, true, 4).length, 18);
    assert.equal(C.lignesVisibles(grille, false, 4)[0].heure, '08:00');
  });
});
