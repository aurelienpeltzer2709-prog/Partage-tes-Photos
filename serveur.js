// Obtenir la liste de tous les membres pour le Panel Admin
app.get('/api/admin/users', verifierConnexion, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Réservé aux admins.');
  const users = await dbUtilisateurs.find({});
  res.json(users);
});

// Route de Bannissement / Débannissement Toggle
app.post('/api/admin/ban', verifierConnexion, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Réservé aux admins.');
  const target = await dbUtilisateurs.findOne({ _id: req.body.user_id });
  if (!target) return res.status(404).send('Introuvable.');
  
  const nouveauStatut = target.est_banni === 1 ? 0 : 1;
  await dbUtilisateurs.update({ _id: req.body.user_id }, { $set: { est_banni: nouveauStatut } });
  res.send('Statut mis à jour.');
});