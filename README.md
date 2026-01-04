# Kawaii Clash

Une application web moderne et responsive pour jouer au Pierre-Feuille-Ciseaux en temps réel.

## Fonctionnalités

*   **Temps réel** : Jeu instantané via WebSockets.
*   **Facile à rejoindre** : Créez une partie et partagez simplement l'URL.
*   **Interface Moderne** : Design épuré, animations fluides et responsive.
*   **Système de jeu** :
    *   Choix cachés jusqu'au résultat.
    *   Score persistant pour la session.
    *   Gestion des déconnexions.

## Installation

1.  Assurez-vous d'avoir [Node.js](https://nodejs.org/) installé.
2.  Installez les dépendances :
    ```bash
    npm install
    ```

## Démarrage

Lancez le serveur :

```bash
npm start
```

L'application sera accessible à l'adresse : `http://localhost:3000`

## Comment jouer

1.  Ouvrez l'application dans votre navigateur.
2.  Cliquez sur **"Créer une partie"**.
3.  Copiez le lien généré et envoyez-le à votre adversaire.
4.  Une fois l'adversaire connecté, la partie commence !
5.  Choisissez Pierre, Feuille ou Ciseaux.
6.  Le résultat s'affiche une fois que les deux joueurs ont joué.
