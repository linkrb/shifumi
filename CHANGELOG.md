# Journal des modifications

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Versionnage Sémantique](https://semver.org/lang/fr/).

## [Non publié]

## [1.2.0] - 2025-12-02

### Ajouté
- **Système de manches gagnantes** : Le créateur de la partie peut choisir le nombre de manches pour gagner (1, 3 ou Sans limite).
- **Indicateur de mode de jeu** : Affichage visuel du mode de jeu (ex: "Meilleur de 3") dans l'interface.
- **Modales personnalisées** : Remplacement des alertes natives par des modales stylisées pour les erreurs et déconnexions.

### Modifié
- Amélioration de la stabilité du serveur lors des déconnexions de joueurs.
- Mise à jour de l'écran de fin de partie pour distinguer la victoire d'une manche de la victoire finale.

## [1.1.0] - 2025-12-02

### Ajouté
- **Tchat en temps réel** : Les joueurs peuvent maintenant discuter pendant la partie.
- **Sélection de pseudo** : Les joueurs choisissent un pseudo avant de commencer la partie.
- **Affichage des pseudos** : Les pseudos des joueurs sont affichés dans le tableau des scores.

### Modifié
- Interface de tchat minimaliste avec design glassmorphism s'intégrant au thème pastel.
- Messages de tchat différenciés visuellement (Cyan pour soi, Gris pour l'adversaire).

### Corrigé
- Correction de la duplication des messages de tchat lors de l'envoi.

## [1.0.0] - 2025-12-02

### Ajouté
- **Attribution aléatoire d'avatar** : Option pour attribuer un avatar aléatoire si l'utilisateur passe la sélection.
- **Avatars en jeu** : Les avatars sélectionnés par les joueurs sont maintenant affichés à côté de leurs scores dans la vue du jeu.
- **Flux de connexion directe** : Les utilisateurs rejoignant via un lien direct (ex: `/game/XYZ`) sont maintenant invités à sélectionner un avatar avant d'entrer dans le lobby.

### Modifié
- **Améliorations visuelles** :
    - Les avatars sont affichés dans des cercles pastel (Jaune par défaut, Rose si sélectionné).
    - Amélioration du centrage et de la taille des avatars pour éviter qu'ils ne soient coupés.
    - Augmentation de la taille des boutons de choix de jeu (Pierre, Feuille, Ciseaux) et de leurs icônes pour une meilleure visibilité.
- **UI/UX** :
    - Ajout de l'écran "Sélection d'avatar" au flux principal.
    - Amélioration des retours lors de la création et de la connexion à une partie.

### Corrigé
- Correction d'un problème où les liens directs vers le jeu sautaient le processus de sélection d'avatar.
