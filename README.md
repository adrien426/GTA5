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
| Saut à pied / frein à main en voiture | Espace |
| Frapper / tirer avec l’arme équipée | F |
| Téléphone (garage / armes) | P |
| Hélicoptère : monter / descendre | Espace / Maj gauche |
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

## Collisions, actions et téléphone

- Le joueur et les PNJ ont des volumes de collision ; les déplacements sont découpés en sous-pas pour éviter de traverser un personnage en sprintant. Les PNJ évitent aussi le joueur, les autres PNJ et les véhicules.
- Espace à pied : saut avec gravité et réception au sol. F : coup de poing devant le personnage, avec les animations Lead Jab / Jab Cross du Drive ; les dégâts arrivent à la phase de contact de l’animation.
- P ou le bouton TÉLÉPHONE : ouvrir le téléphone. L’application GARAGE livre une Honda NSX, une Kawasaki Ninja H2R ou un hélicoptère sur une route libre. Un repère bleu indique le dernier véhicule livré. E permet de monter à proximité. E ou G permet de sortir, même en mouvement ou en vol : le joueur chute, fait une roulade à la réception et perd de la vie.
- Hélicoptère : Z/S ou haut/bas pour avancer/reculer, Q/D pour tourner, Espace pour monter, Maj gauche pour descendre. Les boutons tactiles FREIN / SPRINT deviennent MONTER / DESCENDRE.
- Application ARMES : poings, pistolet ou AK-47. Les modèles sont chargés à la demande ; l’équipement ferme le téléphone et active la pose de visée adaptée au squelette de James. À pied, le glissement de la souris ou du doigt oriente la visée ; F, clic gauche ou ACTION déclenche un coup ou un tir. Maintenir F / ACTION permet d’enchaîner. Les bâtiments et véhicules arrêtent les tirs. Les coups et tirs ne sont pas utilisables au volant.
- La simulation est suspendue lorsque le téléphone est ouvert. Fermer par P, Échap ou la croix. Un message dans le téléphone explique les échecs de chargement ou l’absence d’emplacement libre.
- Sur téléphone : bouton ACTION pour frapper/tirer ; le bouton de frein devient SAUTER à pied.

### Vérifications des actions

Avec Node.js 24, depuis la racine du dépôt :

```sh
node tests/mechanics.test.mjs
node --experimental-vm-modules tests/gameplay.test.mjs
```

Le second contrôle exécute le vrai module de jeu et décode les 13 modèles GLB utilisés, avec un rendu et un DOM simulés. Il vérifie les collisions, le saut, les coups et tirs, les armes, les livraisons des trois véhicules, la montée et la descente de l’hélicoptère, les sorties en mouvement / en vol, les roulades, les dégâts, la visibilité en première personne et les événements clavier / tactiles d’attaque. Cela ne remplace pas une vérification du rendu WebGL ou de l’ergonomie sur un appareil réel.

## Animations Drive, première personne et sorties en mouvement

`assets/player-actions.json` contient les clips Lead Jab, Jab Cross, Rifle Aiming Idle, Firing Rifle, Falling To Roll, Run To Rolling, Jump et Falling du dossier ANIMATION du propriétaire. Les rotations sont adaptées hors ligne, en espace monde, de la pose de référence des FBX vers celle du GLB James. Les positions sont converties de centimètres en mètres ; la physique garde le contrôle des déplacements dans les airs. Les identifiants Drive et empreintes SHA-256 des sources figurent dans `assets/player-actions.sources.json`.

La visée et le recul utilisent ces clips. En mouvement, leurs pistes du haut du corps sont combinées avec des pistes de locomotion limitées au bas du corps. Les coups utilisent leurs propres clips complets. Le personnage ne reçoit plus de rotations manuelles des bras pendant le combat.

C bascule entre troisième et première personne. À pied en première personne, le corps entier est masqué, même à l’arrêt, pendant un déplacement ou une roulade. La caméra se place directement à hauteur des yeux et garde un axe vertical fixe, indépendamment des animations de la tête. L’arme a son propre modèle de vue, sans visage ou corps visible.

Les tirs utilisent un rayon de visée depuis la caméra, puis un trajet depuis le point de tir vers la cible. Un traceur, un éclat et l’indicateur TIR / TOUCHÉ donnent un retour visible ; les bâtiments et véhicules peuvent arrêter le projectile. Les coups attendent leur phase de contact avant de vérifier une cible proche devant le joueur.

E / G et le bouton SORTIR autorisent la sortie d’un véhicule en mouvement ou d’un hélicoptère en vol si l’espace latéral est libre. Le véhicule abandonné conserve son élan puis ralentit ; l’hélicoptère redescend. Le joueur hérite d’une partie de la vitesse, chute et joue la roulade à la réception. La jauge VIE diminue selon la vitesse de sortie et le choc à l’atterrissage. À zéro, le joueur est remis sur pied après un bref K.O.
