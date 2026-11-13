# NOCTURNE — Port Lumière (POC)

Nouvelle expérience solo de ville ouverte, développée sur la branche `poc`. La version historique de Néo Cité reste sur `main`.

## Jouer

La publication GitHub Actions existante place cette branche dans `preview/poc/` sur GitHub Pages. En local, servir ce dossier par HTTP (`python -m http.server 8080`), puis ouvrir `http://localhost:8080`. WebGL 2 est nécessaire. L'ouverture par double-clic ne charge pas les modules.

## Contenu

- Quartier procédural d'environ 500 × 500 mètres, quais, parcs, boutiques et tours.
- Honda NSX de départ, Volvo V50 et Kia Picanto ; circulation et véhicules stationnés accessibles.
- Marche et course avec animations Mixamo, passants animés.
- Trois contrats de livraison, récompenses, progression du solde sauvegardée localement.
- Minicarte, carte agrandie, caméra à la troisième personne et vue subjective.
- Heure dorée ou nuit ; ombres, matériaux PBR, textures de sol, bloom et exposition cinéma.
- Clavier et commandes tactiles, résolution adaptative, pause et récupération du véhicule.
- Ressources 3D et moteur servis localement ; seules les polices typographiques utilisent Google Fonts, avec polices de secours.

Il s'agit d'un prototype jouable, pas d'un jeu AAA photoréaliste. Le monde, les missions et la conduite sont nouveaux ; les modèles optimisés et les animations proviennent des ressources existantes du propriétaire.

## Commandes

| Action | Clavier |
| --- | --- |
| Déplacement / conduite | ZQSD, WASD, flèches |
| Monter / descendre à l'arrêt | E |
| Course à pied | Maj gauche |
| Frein à main | Espace |
| Changer de caméra | C |
| Regarder | Glisser la souris / le doigt sur la scène |
| Agrandir la carte | M |
| Pause | Échap |

Sur téléphone : joystick à gauche et boutons à droite. Le joystick accélère/freine en voiture et déplace le personnage à pied. Bouton SON pour activer le moteur.

## Fichiers

`index.html` : interface et importmap ; `style.css` : affichage responsive ; `game.js` : monde, chargement et simulation ; `vendor/three` : sous-ensemble de Three.js 0.170.0 ; `assets/` : modèles, métadonnées, animations, textures.

## Vérifications effectuées

- Syntaxe JavaScript et résolution de tous les imports locaux.
- Décodage des GLB compressés Meshopt, présence des prototypes de roues.
- Correspondance des pistes Idle / Walk / Run avec les os de James, Adam et du personnage féminin.
- Vérification des chemins et des points de mission hors des bâtiments.
- La prévisualisation dans le navigateur de développement a été tentée, mais WebGL est désactivé dans cet environnement. Le rendu GPU, les performances et les interactions en jeu restent à vérifier sur un appareil avec WebGL.

Voir `CREDITS-POC.md` pour les ressources.

## Correctif de chargement GLB

Le modèle Casual publié dans le premier commit était tronqué (786 444 octets sur 802 788). Il a été remplacé par le binaire complet, dont le SHA Git est vérifié avant publication. Le chargeur vérifie désormais la signature, la version et la longueur déclarée de chaque GLB avant son décodage, et indique le chemin du modèle si une erreur survient. Le script du jeu et le modèle corrigé utilisent une URL versionnée pour éviter le cache de la version défectueuse.
