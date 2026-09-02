const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Datastore = require('nedb-promises');

const app = express();

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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

// Bases de données en Fichiers JS (Sans compilation C++)
const dbUtilisateurs = Datastore.create({ filename: path.join(__dirname, 'users.db'), autoload: true });
const dbPhotos = Datastore.create({ filename: path.join(__dirname, 'photos.db'), autoload: true });
const dbAbonnements = Datastore.create({ filename: path.join(__dirname, 'abos.db'), autoload: true });

async function verifierConnexion(req, res, next) {
  const utilisateurId = req.headers['user-id'];
  if (!utilisateurId) return res.status(401).send('Connexion requise.');

  try {
    const user = await dbUtilisateurs.findOne({ _id: utilisateurId });
    if (!user) return res.status(401).send('Utilisateur introuvable.');
    if (user.est_banni === 1) return res.status(403).send('Vous êtes banni.');
    req.user = user;
    next();
  } catch (err) {
    res.status(500).send('Erreur serveur.');
  }
}

// Routes Authentification
app.post('/api/inscription', async (req, res) => {
  const { email, mot_de_passe, pseudo } = req.body;
  if (!email || !mot_de_passe) return res.status(400).send('Champs manquants.');
  
  const existe = await dbUtilisateurs.findOne({ email: email.toLowerCase() });
  if (existe) return res.status(400).send('Email déjà utilisé.');

  const nom = pseudo && pseudo.trim() !== '' ? pseudo : email.split('@')[0];
  const newUser = await dbUtilisateurs.insert({
    email: email.toLowerCase(),
    mot_de_passe,
    pseudo: nom,
    photo_profil: 'tigre.png',
    role: 'user',
    est_banni: 0
  });

  res.json({ id: newUser._id, pseudo: nom, role: 'user', photo_profil: 'tigre.png' });
});

app.post('/api/connexion', async (req, res) => {
  const { email, mot_de_passe } = req.body;
  const user = await dbUtilisateurs.findOne({ email: email.toLowerCase(), mot_de_passe });
  if (!user) return res.status(400).send('Identifiants incorrects.');
  if (user.est_banni === 1) return res.status(403).send('Compte banni.');

  res.json({ id: user._id, pseudo: user.pseudo, role: user.role, photo_profil: user.photo_profil || 'tigre.png' });
});

// Photo de profil
app.post('/api/avatar', verifierConnexion, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).send('Aucun fichier.');
  await dbUtilisateurs.update({ _id: req.user._id }, { $set: { photo_profil: req.file.filename } });
  res.json({ photo_profil: req.file.filename });
});

// Abonnements
app.post('/api/abonner', verifierConnexion, async (req, res) => {
  const { cible_id } = req.body;
  await dbAbonnements.insert({ suiveur_id: req.user._id, suivi_id: cible_id });
  res.send('Abonné !');
});

// Photos
app.post('/api/upload', verifierConnexion, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).send('Aucun fichier.');
  const est_prive = req.body.est_prive === 'true' ? 1 : 0;

  await dbPhotos.insert({
    auteur_id: req.user._id,
    pseudo: req.user.pseudo,
    nom_fichier: req.file.filename,
    est_prive
  });

  res.send('Photo envoyée.');
});

app.get('/api/photos', verifierConnexion, async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  let photos = [];
  
  if (isAdmin) {
    photos = await dbPhotos.find({});
  } else {
    photos = await dbPhotos.find({ $or: [{ est_prive: 0 }, { auteur_id: req.user._id }] });
  }

  res.json(photos.reverse());
});

// Suppression photo
app.delete('/api/photos/:id', verifierConnexion, async (req, res) => {
  const photo = await dbPhotos.findOne({ _id: req.params.id });
  if (!photo) return res.status(404).send('Introuvable.');
  if (photo.auteur_id !== req.user._id && req.user.role !== 'admin') {
    return res.status(403).send('Non autorisé.');
  }

  const pathFile = path.join(uploadDir, photo.nom_fichier);
  if (fs.existsSync(pathFile)) fs.unlinkSync(pathFile);

  await dbPhotos.remove({ _id: req.params.id }, {});
  res.send('Supprimé.');
});

// Ban Admin
app.post('/api/admin/ban', verifierConnexion, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Action réservée aux admins.');
  await dbUtilisateurs.update({ _id: req.body.user_id }, { $set: { est_banni: 1 } });
  res.send('Utilisateur banni.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));