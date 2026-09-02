const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur lors de la connexion à SQLite:', err.message);
  } else {
    console.log('Connexion réussie à la base SQLite.');
  }
});

module.exports = db;