# Néo Cité

Jeu de ville ouverte en 3D dans le navigateur (Three.js, aucun build) : conduite, police et étoiles de recherche, armes, téléphone, base militaire, micro.

- `index.html` : le jeu
- `assets/` : modèle humain animé et animations
- `assets/models/` : modèles 3D issus du dossier Google Drive « 3D », convertis en GLB compressés (meshopt + textures WebP)
  - véhicules : Volvo V50 (berline, police), Kia Picanto (taxi, citadine), Honda NSX (sportive), Honda Sonic 150R (moto), Kawasaki Ninja H2R (superbike), hélicoptère de police
  - personnages : James, Adam (squelette Mixamo, animations partagées) — les seuls jouables
  - PNJ (`pnj_*.glb`) : pull, blond, femme en tailleur, agent, pilote, soldat — mélangés avec Adam et James, tenues de couleurs variées
  - armes : Deagle, AK-47, AUG, carabine, minigun, railgun
  - chaque `.glb` a un `.json` (dimensions, roues, volant) utilisé par le jeu ; les voitures ont aussi une version allégée `_lo` affichée au loin
- Modèles tiers (crédits) :
  - « Car Concept » © 2024 Darmstadt Graphics Group GmbH, modèle et textures Eric Chadwick — CC BY 4.0 (Khronos glTF Sample Assets)
  - Ferrari 458 Italia par vicent091036, distribué avec les exemples three.js

## Multijoueur

Cocher « Jouer en ligne » sur l'écran titre : tous les joueurs du salon public se retrouvent dans la même ville (ou dans un salon privé en saisissant le même code).
Connexion pair à pair WebRTC via [Trystero](https://github.com/dmotz/trystero) (signalisation par trackers WebTorrent et relais Nostr publics, aucun serveur à héberger).
Synchronisés : position, personnage, animations, arme et visée, véhicule (voiture ou moto), tirs, dégâts entre joueurs, K.O. La circulation et les passants restent propres à chaque joueur.

## Previews

Chaque branche poussée est publiée par GitHub Actions sur la branche `gh-pages` :

- `main` → https://adrien426.github.io/GTA5/
- toute autre branche → https://adrien426.github.io/GTA5/preview/<branche>/

Supprimer une branche supprime sa preview. Dans *Settings → Pages*, choisir « Deploy from a branch », branche `gh-pages`, dossier `/ (root)`.
