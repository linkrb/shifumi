# Journal des modifications

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Versionnage Sémantique](https://semver.org/lang/fr/).

## [Non publié]

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
