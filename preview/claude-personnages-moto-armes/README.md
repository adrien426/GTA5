# Néo Cité

Jeu de ville ouverte en 3D dans le navigateur (Three.js, aucun build) : conduite, police et étoiles de recherche, armes, téléphone, base militaire, micro.

- `index.html` : le jeu
- `assets/` : modèle humain animé et animations
- `assets/models/` : modèles 3D issus du dossier Google Drive « 3D », convertis en GLB compressés (meshopt + textures WebP)
  - véhicules : Volvo V50 (berline, police), Kia Picanto (taxi, citadine), Honda NSX (sportive), Honda Sonic 150R (moto), Kawasaki Ninja H2R (superbike), hélicoptère de police
  - personnages : James, Adam (squelette Mixamo, animations partagées)
  - armes : Deagle, AK-47, AUG, carabine, minigun, railgun
  - chaque `.glb` a un `.json` (dimensions, roues, volant) utilisé par le jeu

## Previews

Chaque branche poussée est publiée par GitHub Actions sur la branche `gh-pages` :

- `main` → https://adrien426.github.io/GTA5/
- toute autre branche → https://adrien426.github.io/GTA5/preview/<branche>/

Supprimer une branche supprime sa preview. Dans *Settings → Pages*, choisir « Deploy from a branch », branche `gh-pages`, dossier `/ (root)`.
