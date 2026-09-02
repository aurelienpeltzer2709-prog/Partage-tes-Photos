// Fonction pour supprimer une photo
async function supprimerPhoto(photoId) {
  if (!confirm('Voulez-vous vraiment supprimer cette photo ?')) return;

  const res = await fetch(`/api/photos/${photoId}`, {
    method: 'DELETE',
    headers: { 'user-id': currentUser.id }
  });

  if (res.ok) {
    chargerPhotos();
  } else {
    alert(await res.text());
  }
}

// Fonction pour activer le Tigre (ban)
async function activerTigre() {
  const code = prompt('Entrez le mot de passe du Tigre :');
  if (!code) return;

  const res = await fetch('/api/tigre/ban', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'user-id': currentUser.id 
    },
    body: JSON.stringify({ code_secret: code })
  });

  alert(await res.text());
  if (res.ok) {
    deconnexion();
  }
}