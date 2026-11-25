# Musée des Monstres — Document de conception

Date : 25/11/2026 · Statut : en attente de validation

## 1. L'intention

Créer un jeu web original, jouable dans le navigateur sans installation, publiable sur les portails de jeux (CrazyGames, Poki…) et capable de générer un revenu grâce à la publicité intégrée au jeu.

Le concept : **un Zoo Tycoon avec des monstres**. Le joueur construit et gère un musée où sont exposés de vrais monstres vivants. Des visiteurs viennent les voir et paient. Les monstres mal soignés deviennent grincheux et s'évadent.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Une boucle de jeu claire : construire, accueillir des visiteurs, gagner de l'argent, obtenir de nouveaux monstres, agrandir.
- Compréhensible en moins de 30 secondes, sans tutoriel long.
- Envie de revenir : collectionner tous les monstres, découvrir ce qui sort des œufs.
- Un jeu léger (chargement rapide), qui tourne sur un ordinateur ordinaire.

**Non-objectifs (pas dans la première version)**
- Pas de multijoueur.
- Pas de version mobile optimisée (prévue plus tard).
- Pas de reproduction de monstres (prévue plus tard).
- Pas de publicité ni de sauvegarde en ligne dans le prototype.

**Anti-objectifs (ce qui serait un échec même si ça fonctionne)**
- Du gore ou de la violence : le jeu doit rester tout public. Un visiteur « croqué » s'enfuit en courant de façon comique, il ne meurt pas.
- Des évasions trop punitives, qui rendraient le jeu frustrant au lieu d'être drôle.
- Un jeu « payer pour gagner » ou bourré de publicités forcées. Les pubs restent **au choix du joueur**, en échange d'un bonus.
- Une copie de Zoo Tycoon : on reprend le genre, pas les graphismes, les noms ni l'interface.

## 3. Contraintes

- Fonctionne dans un navigateur de bureau récent (Chrome, Firefox, Edge).
- Pas de graphiste : tous les visuels doivent être produits sans dessinateur.
- Le jeu doit pouvoir être livré sous forme de fichiers statiques (un dossier HTML/JS) pour les portails.
- Les portails visent un public international : les textes doivent pouvoir être traduits (français et anglais).

## 4. Approches envisagées

| Approche | Avantages | Inconvénients |
|---|---|---|
| A. 3D low-poly (Three.js) | Monstres faisables en code, joli, se démarque | Plus de travail |
| **B. 2D vue de dessus en biais (Phaser)** — **choisie** | Léger, rapide à coder, style « tycoon classique » | Il faut des visuels pour tout |
| C. Moteur complet (Godot/Unity) | Outils puissants | Logiciel à apprendre, jeux lourds sur le web |

**Choix de l'utilisateur : B.**
Pour résoudre le problème des visuels sans graphiste *(choix du constructeur)*, tous les graphismes du prototype sont **dessinés en code** : formes vectorielles simples, style dessin animé plat, couleurs vives, contours épais. Ils sont générés au démarrage du jeu. Cette méthode permet des variantes faciles (couleurs, tailles, monstres rares), et chaque visuel pourra plus tard être remplacé par une vraie image sans toucher au reste du jeu.

## 5. Le jeu

### 5.1 La vue
- Un terrain en **grille isométrique** (cases en losange, vue de dessus en biais). Terrain du prototype : 40 × 40 cases *(choix du constructeur)*.
- La caméra se déplace (glisser à la souris ou flèches du clavier) et zoome (molette).

### 5.2 Construire
Le joueur choisit un élément dans une barre d'outils, puis le place sur la grille. Chaque élément a un prix.
- **Allées** : les visiteurs ne marchent que dessus. Elles partent de l'entrée du musée.
- **Enclos** : un rectangle dessiné à la souris, avec un **habitat** (lave, eau, obscurité, forêt, glace). Un enclos accueille un monstre de l'habitat correspondant.
- **Décorations** : statues, plantes, lampadaires. Elles rendent les visiteurs plus heureux autour d'elles.
- **Boutiques** : snack et boutique de souvenirs. Les visiteurs y dépensent de l'argent.
- **Gardiens** : du personnel qu'on embauche. Les gardiens se promènent et rattrapent les monstres évadés.
- Un outil **Démolir** rembourse la moitié du prix.

### 5.3 Les monstres (prototype : 5 espèces)

| Monstre | Habitat | Particularité |
|---|---|---|
| Dragonnet | Lave | Populaire, rapporte beaucoup, s'énerve vite |
| Kraken de poche | Eau | Calme, mais a besoin d'un grand enclos |
| Spectre | Obscurité | Peut traverser les clôtures s'il est malheureux |
| Golem de mousse | Forêt | Très patient, idéal pour débuter |
| Yéti | Glace | Adore les visiteurs, déteste la chaleur |

Chaque monstre a :
- un **bonheur** de 0 à 100 %, qui dépend de la taille de l'enclos, du bon habitat et de la nourriture (bouton « Nourrir », avec un coût). Le bonheur baisse avec le temps ;
- une **attractivité** : plus il est heureux et rare, plus il attire de visiteurs et plus ils restent longtemps.

### 5.4 Les évasions
- Si le bonheur d'un monstre passe sous 20 %, il risque de s'évader. Plus le bonheur est bas, plus le risque est élevé.
- Le monstre évadé erre dans le musée. Les visiteurs proches ont peur et partent en courant (comique). La réputation baisse.
- Le gardien le plus proche se dirige vers lui et le ramène. Le joueur peut aussi **cliquer sur le monstre** pour l'attraper lui-même.

### 5.5 Les visiteurs
- Ils arrivent par l'entrée, à un rythme qui dépend de la **réputation** du musée.
- Ils se promènent sur les allées, s'arrêtent devant les enclos, achètent à manger et des souvenirs, puis repartent.
- Ils paient un **billet d'entrée**. Le prix est réglable : trop cher, il en vient moins.
- Chaque visiteur a une **humeur** visible sous forme de petite bulle (cœur, ennui, faim, peur).

### 5.6 Les expéditions et les œufs
- Un bâtiment **Base d'expédition** permet d'envoyer une équipe dans un lieu : volcan, lagon, crypte, forêt ancienne, glacier.
- Une expédition coûte de l'argent et dure un certain temps (prototype : 1 à 3 minutes).
- Au retour, l'équipe ramène un **œuf mystère** du lieu visité. L'espèce est tirée au sort parmi celles de ce lieu, avec une petite chance d'obtenir une variante **rare** (couleur différente, plus attractive).
- L'œuf éclot dans une **Couveuse**. Le joueur place ensuite le monstre dans un enclos du bon habitat.

### 5.7 L'argent et la progression
- Revenus : billets, snack, souvenirs.
- Dépenses : construction, nourriture, salaires des gardiens, expéditions.
- La **réputation** (0 à 5 étoiles) dépend du bonheur des visiteurs, du nombre de monstres et des évasions récentes.
- **Objectifs** affichés à l'écran pour guider le joueur (« Atteindre 50 visiteurs », « Posséder 3 espèces »…).

### 5.8 L'interface
- En haut : argent, nombre de visiteurs, réputation, vitesse du jeu (pause, x1, x2, x3).
- En bas : la barre d'outils de construction.
- Un clic sur un monstre ou un visiteur ouvre une petite fiche d'informations.
- Les textes sont tous regroupés dans un fichier de langue (français pour commencer, anglais ensuite).

## 6. Monétisation (après le prototype)
Les portails versent une part des revenus publicitaires. On utilisera uniquement des **pubs récompensées**, que le joueur choisit de regarder :
- terminer une expédition tout de suite ;
- doubler les revenus pendant 5 minutes ;
- obtenir un œuf rare.
On pourra ajouter une courte pub entre deux sessions si le portail l'exige.

## 7. Étapes

1. **Prototype** (ce document) : tout ce qui est décrit en section 5, sans sauvegarde ni publicité. But : vérifier que le jeu est amusant.
2. **Version jouable complète** : sauvegarde automatique, plus de monstres et d'objets, équilibrage, sons, tutoriel léger, traduction anglaise.
3. **Publication** : intégration du kit du portail (pubs récompensées), tests, mise en ligne sur CrazyGames puis d'autres portails.
4. **Ensuite** : reproduction des monstres, version mobile, nouvelles zones.

## 8. Précisions *(choix du constructeur, à corriger si besoin)*
- **Début de partie :** un terrain vide avec l'entrée, une courte allée, une Base d'expédition, une Couveuse, un Golem de mousse déjà installé dans un petit enclos forêt, et 5 000 pièces.
- **Un monstre par enclos.** Un monstre éclos qui n'a pas d'enclos libre attend dans la Couveuse, qui peut en garder 3.
- **Boutiques et enclos** doivent toucher une allée pour être utilisés par les visiteurs.
- **Pas de game over :** le musée est un bac à sable. Si l'argent devient négatif, on ne peut plus rien acheter jusqu'à ce que les revenus remontent.

## 9. Laissé au constructeur
- Les valeurs chiffrées (prix, vitesses, probabilités) : à régler en jouant.
- L'organisation exacte du code et les outils de développement.
- Le dessin précis de chaque monstre, dans le style décrit en section 4.
- La recherche de chemin des visiteurs et des gardiens.
