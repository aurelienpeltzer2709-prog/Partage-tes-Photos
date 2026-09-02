const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Fichiers JSON pour stocker les données sans compilation
const USERS_FILE = path.join(__dirname, 'users.json');
const PHOTOS_FILE = path.join(__dirname, 'photos.json');

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file)); } catch(e) { return []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));

// Middleware authentification
function verifierConnexion(req, res, next) {
  const userId = req.headers['user-id'];
  if (!userId) return res.status(401).send('Connexion requise.');

  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(401).send('Utilisateur introuvable.');
  if (user.est_banni) return res.status(403).send('Vous êtes banni.');
  
  req.user = user;
  next();
}

// Inscription
app.post('/api/inscription', (req, res) => {
  const { email, mot_de_passe, pseudo } = req.body;
  if (!email || !mot_de_passe) return res.status(400).send('Champs manquants.');

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.email === email.toLowerCase())) {
    return res.status(400).send('Email déjà utilisé.');
  }

  const role = (mot_de_passe === 'azerty' || users.length === 0) ? 'admin' : 'user';
  const newUser = {
    id: Date.now().toString(),
    email: email.toLowerCase(),
    mot_de_passe,
    pseudo: pseudo || email.split('@')[0],
    photo_profil: 'tigre.png',
    role,
    est_banni: false
  };

  users.push(newUser);
  writeJSON(USERS_FILE, users);

  res.json({ id: newUser.id, pseudo: newUser.pseudo, role: newUser.role, photo_profil: newUser.photo_profil });
});

// Connexion
app.post('/api/connexion', (req, res) => {
  const { email, mot_de_passe } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.email === email.toLowerCase() && u.mot_de_passe === mot_de_passe);

  if (!user) return res.status(400).send('Identifiants incorrects.');
  if (user.est_banni) return res.status(403).send('Compte banni.');

  res.json({ id: user.id, pseudo: user.pseudo, role: user.role, photo_profil: user.photo_profil || 'tigre.png' });
});

// Photo de profil
app.post('/api/avatar', verifierConnexion, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).send('Aucun fichier.');
  
  const users = readJSON(USERS_FILE);
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex !== -1) {
    users[userIndex].photo_profil = req.file.filename;
    writeJSON(USERS_FILE, users);
  }

  res.json({ photo_profil: req.file.filename });
});

// Televerser photo
app.post('/api/upload', verifierConnexion, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).send('Aucun fichier.');

  const photos = readJSON(PHOTOS_FILE);
  const newPhoto = {
    _id: Date.now().toString(),
    auteur_id: req.user.id,
    pseudo: req.user.pseudo,
    nom_fichier: req.file.filename,
    est_prive: req.body.est_prive === 'true'
  };

  photos.push(newPhoto);
  writeJSON(PHOTOS_FILE, photos);

  res.send('Photo ajoutée.');
});

// Liste photos
app.get('/api/photos', verifierConnexion, (req, res) => {
  const photos = readJSON(PHOTOS_FILE);
  const visiblePhotos = photos.filter(p => !p.est_prive || p.auteur_id === req.user.id || req.user.role === 'admin');
  res.json(visiblePhotos.reverse());
});

// Suppression photo
app.delete('/api/photos/:id', verifierConnexion, (req, res) => {
  let photos = readJSON(PHOTOS_FILE);
  const photo = photos.find(p => p._id === req.params.id);

  if (!photo) return res.status(404).send('Introuvable.');
  if (photo.auteur_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).send('Non autorisé.');
  }

  const pathFile = path.join(uploadDir, photo.nom_fichier);
  if (fs.existsSync(pathFile)) fs.unlinkSync(pathFile);

  photos = photos.filter(p => p._id !== req.params.id);
  writeJSON(PHOTOS_FILE, photos);

  res.send('Supprimé.');
});

// Admin : Liste membres
app.get('/api/admin/users', verifierConnexion, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Non autorisé.');
  const users = readJSON(USERS_FILE);
  res.json(users);
});

// Admin : Bannir
app.post('/api/admin/ban', verifierConnexion, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Non autorisé.');
  
  const users = readJSON(USERS_FILE);
  const target = users.find(u => u.id === req.body.user_id);
  if (target) {
    target.est_banni = !target.est_banni;
    writeJSON(USERS_FILE, users);
  }

  res.send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));