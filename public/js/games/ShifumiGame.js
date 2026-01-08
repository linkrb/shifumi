import { BaseGame } from './BaseGame.js';
import { state } from '../state.js';
import { setStatus, getAvatarPath } from '../ui/views.js';

export class ShifumiGame extends BaseGame {
    constructor() {
        super('shifumi');
        this.container = document.getElementById('shifumi-area');
        this.choiceBtns = document.querySelectorAll('.choice-btn');
        this.init();
    }

    init() {
        this.choiceBtns.forEach(btn => {
            btn.addEventListener('click', () => this.makeChoice(btn));
        });
    }

    makeChoice(btn) {
        this.choiceBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        const move = btn.dataset.move;
        this.sendMove({ move });

        setStatus("Choix envoyé. En attente de l'adversaire...");

        // Combat animation
        const myAvatarImg = document.querySelector('#my-score').parentElement.querySelector('.player-avatar');
        if (myAvatarImg) {
            const combatSrc = getAvatarPath(state.myAvatar, 'combat');
            if (combatSrc) {
                myAvatarImg.src = combatSrc;
            }
        }
    }

    onGameStart(data) {
        setStatus("C'est parti ! Faites votre choix.");
    }

    onUpdate(data) {
        // opponent_moved message
        setStatus("L'adversaire a joué. À vous !");
    }

    onNewRound(data) {
        this.choiceBtns.forEach(b => b.classList.remove('selected'));
        setStatus("Nouvelle manche ! Choisissez.");
    }

    reset() {
        this.choiceBtns.forEach(b => b.classList.remove('selected'));
    }
}
