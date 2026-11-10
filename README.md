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

## Vie criminelle

- 3 personnages jouables (Adam le pilote, James le fou de la gâchette, Victoria la femme d'affaires), chacun avec son argent et sa position ; changement depuis la carte (bouton en haut à gauche) ou l'appli Persos.
- Arme à feu en main = visée directe. Pointer l'arme sur un vendeur = braquage de la caisse.
- Grenades (armurerie) ; coffres-forts dans la banque et la bijouterie à faire sauter.
- Objets à ramasser (rues, passants, braquages, coffres) avec un état en % ; appli Revente.
- Applis : AutoNéo (acheter des véhicules), Emplois (taxi, bus, livreur, vendeur), Commerces (revenus par heure), Clan, Joueurs (appels).
- Gangs : territoires des Rouges et des Verts, membres armés, guet-apens.
- Multijoueur : clans (pas de tir ami), chat vocal au micro selon la distance, appels.

## Missions et monde

- Histoire de 50 missions (braquages de bijouterie et de banque, grand braquage avec choix du plan), contrats illimités, petits boulots.
- Arme à feu en main : viseur affiché et visée automatique sur la cible la plus proche devant soi (cercle rouge).
- Carte : cliquer / toucher pour placer un point de passage (violet).
- Grande île de 3,65 km × 3,3 km (12 km²) : centre-ville de Néo Cité, villes de Port-Soleil et Sable-Rouge (armureries, banques, commerces), montagnes enneigées, désert, collines, forêts, routes ; mer à perte de vue, poissons qui suivent le joueur.
- Carte : zoom ×1 / ×3 / ×8, boutons « Armurerie / Banque / Supérette la plus proche ».
- Dégâts réalistes : impacts de balles, vitres qui éclatent, carrosserie qui se salit, fumée puis feu ; réparation à la carrosserie.
- Côtes : mer, plages, port, aéroport, base militaire (4 étoiles), île militaire interdite (5 étoiles), hélicoptère militaire qui attaque à 5 étoiles.
- Véhicules : bateaux, vedettes, avions, hélicoptères, tanks (en plus des voitures et motos). Hélico : Z/S avancer, Q/D tourner, Espace monter, Maj descendre. Avion : Z/S gaz, Q/D virer, Espace cabrer, Maj piquer.
- Mer : on nage (pas d'arme), les voitures coulent, poissons, requins (dangereux), baleines.
- Coiffeur, plus de passants.

## Parler aux gens

- Bouton MICRO (ou V) : le jeu écoute en continu ; parle à la personne en face de toi. Sans micro : bouton 💬 ou touche Entrée pour écrire.
- Chacun a un caractère (calme, sympa, peureux, agressif, parfois armé) et répond à voix haute avec une bulle : nom, métier, blagues, indique un lieu sur ta carte, te suit, se bat, sort une arme, fuit, donne son argent si tu le braques, appelle la police.
- Policiers à pied (arrestation, « je me rends », pot-de-vin), militaires (base, île interdite), membres de gang (vente d'armes, initiation pour rejoindre le gang), vendeurs (« je voudrais acheter », braquage à la voix avec une arme).
- Les gens t'adressent aussi la parole quand tu passes à côté.

## Police, arrestations et prison

- La police met du temps à arriver : 30 s à 1 étoile, 22 s à 2, 15 s à 3, 10 s à 4, 6 s à 5 (compte à rebours sous l'horloge).
- Un commissariat dans chaque ville. Arrestation : 1 étoile = amende de 150 $ ; 2-3 étoiles = on t'enlève tout (armes, objets, 30 % de l'argent) ; 4-5 étoiles = pénitencier (3 ou 5 minutes).
- Au pénitencier : dormir dans sa cellule réduit la peine, pas de téléphone ; un trou dans le mur du fond permet de s'évader (4 étoiles, les gardiens tirent).
- Visée sans point ni cercle rouge (viseur simple, aide à la visée invisible).

## Roue des armes, réapparition, chocs, effets lumineux

- **Roue des armes par catégories** (Tab) : 8 catégories (corps à corps, pistolets, mitraillettes, fusils à pompe, fusils d'assaut, précision, armes lourdes, lancer). Un clic sur une catégorie ouvre la liste de tes armes de ce type ; un clic sur l'arme l'équipe.
- **Après la mort ou une arrestation** : les gangs, la police, le FBI et les chiens te laissent tranquille, pas de guet-apens pendant 4 min, et tu es **protégé 8 s**.
- **Chocs en véhicule beaucoup moins mortels** : il faut un choc bien plus violent pour être blessé ou éjecté, les dégâts sont plafonnés, la voiture encaisse deux fois mieux, les balles blessent moins quand tu es au volant. La santé **remonte toute seule jusqu'à 50 %** après 7 s sans dégât.
- **Effets lumineux** la nuit et sous la pluie : halo (bloom) autour des néons, fenêtres, phares et lampadaires ; **routes mouillées** brillantes qui reflètent le ciel quand il pleut. Touche **G** pour les désactiver si ça rame.

## Eau, météo, corrections et performances

- **Les véhicules coulent vraiment** : une voiture ou une moto qui entre dans l'eau perd son moteur et s'enfonce (plus de « conduite sur l'eau »). À moto tu tombes à l'eau tout de suite et tu nages.
- **Nage et plongée** : dans l'eau, **Maj** (ou Ctrl) pour plonger, **ESPACE** pour remonter. Une **jauge d'air** bleue apparaît : environ 28 s sous l'eau, puis tu te noies si tu ne remontes pas. Vue bleutée sous l'eau, bulles, nage à l'horizontale.
- **Météo dynamique** : grand soleil, nuages, pluie, **orages** (éclairs et tonnerre), brouillard. Pluie visible autour de toi (pas à l'intérieur), ciel et lumière assombris, bruit de pluie, gerbes d'eau derrière les voitures rapides.
- **Mini-carte dans les autres pays** (terrain, routes, villes) et **ponts** affichés sur la mini-carte.
- **Corrections** : les forêts pouvaient disparaître d'un coup selon la direction de la caméra ; tout le décor de la carte était dessiné (et ombré) même à 5 km derrière toi. Le décor est maintenant découpé en blocs de 300 m et les forêts en blocs de 500 m, affichés seulement à proximité : environ **3× plus fluide** hors de la ville.

## Première personne, blessures par zone, armes, FBI, commerces, pays

- **Vue à la première personne** : touche **B** (bouton 👁 sur téléphone), à pied et en voiture. L'arme équipée est visible devant toi, la lunette zoome.
- **Blessures par zone** : **tête** ou **cœur** = mort ; **pied** ou **jambe** = la personne ne peut plus courir et boite ; **bras** = elle lâche son arme. Pour toi aussi : pied (plus de course), bras (tu vises moins bien), tête et cœur très dangereux. Les ennemis font plus mal.
- **15 accessoires d'armes** : silencieux, chargeur grande capacité, chargeur tambour, lunette, viseur holographique, poignée, crosse tactique, frein de bouche, viseur laser, lampe torche, peinture (12 couleurs), munitions perforantes, incendiaires, explosives, balles traçantes.
- **59 armes** : couteau de combat, couteau papillon, dague, hachette, marteau, matraque, pistolet de combat, revolver lourd, pistolet de détresse, PM compact, PM tactique, fusil à double canon, pompe tactique, carabine spéciale, fusil de bataille, sniper militaire, fusil anti-matériel, grenade fumigène, lacrymogène, mine de proximité… en plus de toutes les précédentes.
- **QG du FBI** au nord de Néo Cité : tours, grillage, agents fédéraux armés, SUV noirs, hélicoptère ; y entrer = 3 étoiles.
- **Commerces** : pharmacies (soins + blessures), fast-foods « Néo Burger », 6 stations-service « Néo Fuel » sur les routes (boutique, plein + lavage du véhicule).
- **5 pays** reliés par 5 ponts : Isla Dorada, Nordheim, Sakura-Shi, **Saharia** (désert, coupoles, palmiers ; couscous) et **Liberty City-sur-Mer** (mégapole de gratte-ciel ; burger XXL).

## Escalade et lieux plus réalistes

- **Grimper** : face à un mur, une clôture, un muret, un conteneur ou le toit d'un petit bâtiment (jusqu'à 7 m), appuie sur **ESPACE** (bouton saut sur téléphone) — l'indication « ESPACE : grimper » apparaît. Un mur fin est franchi (tu retombes de l'autre côté, gare à la hauteur), un bloc épais te laisse debout dessus. Le mur de la prison s'escalade… mais les gardiens réagissent.
- **Échelles de secours** sur le côté de nombreux immeubles (E) pour monter sur les **toits**, où l'on peut marcher, sauter (en parachute !) ou redescendre par l'échelle.
- **Base militaire** : héliport, drapeau, bunkers en sacs de sable, barbelés sur le grillage, radar qui tourne, citernes, stand de tir, camions militaires, soldats qui patrouillent.
- **Commissariats** : voitures de patrouille garées devant, antenne, plots, gyrophare bleu.
- **Prison** : second grillage extérieur avec barbelés, projecteurs qui balaient la cour la nuit (et pendant une évasion), bus pénitentiaire.

## Physique, armes personnalisées, banques, héros, ponts

- **Chocs** : à moto, un choc violent t'**éjecte** et les dégâts dépendent de la zone touchée (tête, torse, bras, jambe → tu boites). En voiture, un gros choc fait mal, et au-delà de ~110 km/h tu peux passer à travers le pare-brise. Se faire renverser : peu de dégâts à faible vitesse, beaucoup à grande vitesse (et du sang).
- **Motos plus puissantes** (superbike ~280 km/h), **avions** jusqu'à ~1000 km/h (chasseur), 900 km/h (avion de ligne), 830 km/h (jet).
- **Personnaliser ses armes** à l'armurerie (bouton ⚙ Modifier) : silencieux, chargeur grande capacité, lunette, poignée, viseur laser, peinture (or, camo, rose…). Visibles sur l'arme.
- **Ramasser les armes** : les policiers, soldats et gangsters neutralisés lâchent leur arme (anneau jaune) ; passe dessus pour la prendre.
- **Armes** : pistolet automatique, fusil d'assaut bullpup, fusil de précision semi-auto, mitrailleuse lourde. Explosifs plus chers.
- **Banques** : beaucoup plus de banques, avec une grande enseigne verte « € BANQUE » et le **€ vert** toujours sur la mini-carte. Nouveaux contrats **Braquage de banque** et **Gros braquage** (téléphone → Missions).
- **Héros** : chacun a sa personnalité et une **capacité spéciale** (touche **C**, ou bouton ⚡ sur téléphone ; jauge bleue) : Adam ralentit le temps en conduisant, James entre en **rage** (dégâts ×2, encaisse 3× moins), Victoria ralentit le temps en visant.
- **Ponts** géants (2,2 km, 1,4 km) qui relient Néo Cité aux 3 pays, désormais bien plus grands (2,6 km de large) avec collines, villages, forêts, routes. Chaque pays a sa **nourriture** et son bonus : tapas (endurance et vitesse), soupe de poisson (−40 % de dégâts), ramen (précision). Hot-dogs à Néo Cité.
- **Prison** : tenue orange pour le détenu, les gardiens font des rondes.

## Animaux réalistes, autres pays, reflets

- **Vrais animaux animés** (marche, galop, broute, attaque, mort) : vaches, taureaux, chevaux, ânes, alpagas dans les fermes ; cerfs et biches, renards, **loups** (ils attaquent en meute) dans la nature. Modèles « Ultimate Animated Animals » de **Quaternius**, licence **CC0** (domaine public).
- **Chiens** : les chiens policiers sont de vrais chiens animés, et des passants promènent leur chien en ville (Shiba, Husky). Tirer sur un chien : son maître hurle et la police arrive.
- **Autres pays** : au guichet **✈ VOYAGES** de l'aéroport, achète un billet pour **ISLA DORADA** (plages, palmiers, maisons colorées), **NORDHEIM** (neige, sapins, maisons de bois) ou **SAKURA-SHI** (cerisiers, temples, tours). Chaque pays a sa piste, ses habitants qui saluent dans leur langue, ses voitures et un café pour sauvegarder. Vol retour depuis la piste ($600). Impossible d'embarquer si tu es recherché.
- **Avions** : avion de ligne (aéroport) et avion de chasse (base militaire). **Fusil de chasse** à lunette.
- **Graphismes** : reflets du ciel sur la carrosserie, les vitres et le métal (mis à jour avec le soleil).

## Intérieurs, maison et monde agrandi

- **Entrer dans les immeubles** : la plupart des immeubles ont une porte d'entrée (E). Hall avec boîtes aux lettres et concierge, ascenseur, puis **appartement meublé** (salon avec télé, cuisine, chambre, salle de bain, vue sur la ville). Chaque appartement est **à vendre** : une fois acheté, tu peux y dormir et sauvegarder.
- **Ta maison** : une villa avec piscine au sud de Néo Cité (icône ⌂ verte), avec lit (sauvegarde), dressing, coffre-fort (munitions + parachute), télé, frigo, et **ta voiture** sous l'abri (Furia GT ; le garage permet de changer pour une voiture que tu as achetée). Appli **Maison** sur le téléphone.
- **Commissariat** : ordinateur de la police (effacer une étoile… ou se faire prendre, ou prendre une prime), vestiaire (uniforme), armurerie de la police (vol : 3 étoiles), machine à café.
- **Carte agrandie** vers l'est et le sud : 2 nouvelles villes (**Bellerive**, **Pinède**), 2 lacs (on peut nager), 3 fermes (champs, granges, silos), des milliers d'arbres en plus (sapins, feuillus, palmiers sur les plages), buissons.
- **Animaux** : vaches, chevaux, moutons dans les fermes ; cerfs, sangliers (ils chargent), lapins, renards dans la nature ; mouettes et pigeons qui volent. Ils fuient, saignent, et peuvent être chassés.
- **Encore plus** : armes (pistolet silencieux, fusil à canon scié, arbalète silencieuse, lance-flammes) et véhicules (ambulance, camion de pompiers, tracteur, voilier).

## Chutes et parachute

- **Dégâts de chute** selon la hauteur : rien sous 5 m, puis de plus en plus (6 m ≈ −7 PV, 10 m ≈ −35 PV, 15 m ≈ −90 PV), et **mort au-delà d'environ 20 m**. Une grosse chute te fait boiter. Tomber dans l'eau ne fait pas mal.
- **Parachute** : saute d'un hélico ou d'un avion en vol (tu reçois un parachute de bord), ou achète-en à l'armurerie ($300). En chute libre tu te diriges ; **ESPACE** ouvre le parachute ; Q/D pour tourner, Z pour aller plus vite, Maj pour descendre plus vite.

## Nouvelles armes

Pistolet lourd, taser (paralyse sans tuer), micro-SMG, fusil de combat, fusil à pompe automatique, mitrailleuse légère, sniper lourd, lance-grenades (explose à l'impact), cocktail Molotov (feu au sol pendant 8 s), bombe collante (se colle et explose après 4 s), machette, hache, poing américain.

## Prison (4-5 étoiles)

- **Peine** : 15 min (4 étoiles) ou 25 min (5 étoiles). Le pénitencier est indiqué sur la carte (bouton « ⛓ Prison »).
- **Vie de détenu** : ta cellule (dormir : −3 min et le temps passe), la cantine (manger), la cuisine, la buanderie (travailler : −1 min), la muscu, la cour avec les autres détenus en orange et le Caïd.
- **6 façons de sortir** :
  1. **Tunnel** : vole une cuillère à la cantine, puis creuse derrière le poster de ta cellule (attention aux gardiens).
  2. **Émeute** : vole 2 couteaux en cuisine et donne-les au Caïd ; le portail s'ouvre 90 s.
  3. **Camion de linge** : cache-toi sous les draps (les chiens peuvent te flairer).
  4. **Corde de draps** : 3 draps de la buanderie, de nuit (21 h – 5 h), par-dessus le mur ouest.
  5. **Gardien corrompu** : paie-le au poste de garde (ou au micro) ; la porte de service s'ouvre 70 s.
  6. **Avocat** : appelle-le au téléphone ($3 000), ta peine est divisée par deux.
- Si on t'attrape : retour en cellule, porte verrouillée et peine allongée.

## Véhicules

Marques inventées : Nordia V5, Akira NX, Kobi Pica, Rosso F8, Atlas Terra (SUV), Brava Ranch (pick-up), Furia GT (muscle car), Riviera (cabriolet), Regal (limousine), Néo Bus, Titan Cargo (camion), Vespina 125 (scooter), Iron Chopper, Sonik 150, Kaze H2R, Libellule (mini-hélico), hélico de police, Falcon X (jet privé), Wave Jet (jet-ski)… Tous dans la circulation, garés, ou à acheter dans l'appli AutoNéo.

## Son

Moteurs synthétisés selon le type (4 cylindres, V8, diesel, moto, scooter, V-twin) avec passage des vitesses, crissement des pneus, rotor d'hélico, réacteur de jet, écho des coups de feu et des explosions (plus fort en ville), bruits de pas (herbe / béton), ambiance (ville, vagues, vent, oiseaux, sirènes lointaines).

## Tirer sur les voitures

- **Pneus** : vise une roue pour la crever (bruit d'éclatement, poussière). La roue s'écrase, la voiture penche de ce côté, tire d'un côté, ralentit, et la jante frotte en faisant des étincelles. Pratique pour stopper la police ou une voiture qui fuit.
- **Carrosserie** : chaque balle laisse un trou bien visible, avec étincelles et bruit de métal ; les vitres touchées se brisent.
- La carrosserie (garage) répare tout : trous, vitres et pneus.

## Sang et blessures

- Chaque balle projette du sang dans la direction du tir, avec des éclaboussures au sol derrière la victime.
- **Zone touchée** : **jambe** → la personne boite, crie et laisse une traînée de gouttes (2e balle dans la jambe = elle tombe) ; **torse** → elle tombe et saigne, plusieurs balles la tuent ; **tête** → mort immédiate.
- Une **flaque de sang** se répand sous les corps.
- **Taches de sang sur les personnages**, à l'endroit exact de l'impact (tête, torse, jambe), avec coulure ; elles restent sur la personne.
- Les gouttes **retombent au sol** (gravité), le sang **gicle sur les murs** derrière la victime, et une personne blessée continue de saigner par petits jets.
- Se faire renverser par une voiture ou frapper au couteau / katana fait aussi saigner.
- **Écran** : les bords rougissent quand tu es touché, et restent rouges quand ta santé est basse.
- En visant, la visée assistée garde la hauteur de ton viseur : vise bas pour les jambes, haut pour la tête.
- **Toi aussi** : touché à la jambe tu boites (pas de sprint pendant 12 s), et tu laisses des gouttes quand tu es gravement blessé.

## Commissariats et garde à vue

- Les 3 commissariats ont un vrai intérieur : accueil avec policier, bureaux avec ordinateurs, casiers, avis de recherche et **2 cellules à barreaux**.
- Arrêté avec **2 étoiles** : 45 s de garde à vue ; **3 étoiles** : 75 s (armes, objets et 30 % du liquide confisqués).
- **S'évader** : appuie plusieurs fois sur **E** près de la porte pour crocheter la serrure. Si le policier t'entend, le crochetage repart à zéro (+15 s). Une fois dehors : 3 étoiles, toute la police te cherche.

## Armurerie, FBI et chiens policiers

- **Armurerie** : 4 boutiques d'armes (2 à Néo Cité, Port-Soleil, Sable-Rouge). Enseigne rouge « ARMES » qui tourne sur le toit, panneau au bord du trottoir, faisceau rouge visible de loin et **A rouge** toujours affiché sur la mini-carte. Appli **Armurerie** sur le téléphone : GPS vers la plus proche ou achat en ligne (livraison +15 %).
- **FBI** (3 étoiles et plus) : berlines noires banalisées avec gyrophares, les agents en costume descendent et tirent ; ils peuvent te menotter de près.
- **Agents secrets** : certains passants sont des policiers infiltrés qui se révèlent quand tu es recherché (2 étoiles et plus).
- **Chiens policiers** : des maîtres-chiens patrouillent, et à partir de 2 étoiles les voitures de police lâchent un chien ; il court plus vite que toi et mord. On peut le repousser (coup de pied) ou lui tirer dessus (+1 étoile).

## La carte complète

![Carte de Néo Cité](carte-neo-cite.jpg)

Version haute définition : [carte-neo-cite.png](carte-neo-cite.png) (5010×3900).

## Previews

Chaque branche poussée est publiée par GitHub Actions sur la branche `gh-pages` :

- `main` → https://adrien426.github.io/GTA5/
- toute autre branche → https://adrien426.github.io/GTA5/preview/<branche>/

Supprimer une branche supprime sa preview. Dans *Settings → Pages*, choisir « Deploy from a branch », branche `gh-pages`, dossier `/ (root)`.
