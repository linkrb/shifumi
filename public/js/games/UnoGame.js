import { state, updateState } from '../state.js';
import { BaseGame } from './BaseGame.js';

const COLOR_EMOJIS = {
    red: '🔴',
    blue: '🔵',
    green: '🟢',
    yellow: '🟡',
    wild: '🌈'
};

const VALUE_DISPLAY = {
    'skip': '🚫',
    'reverse': '🔄',
    'draw2': '+2',
    'wild': '🌈',
    'wild4': '+4'
};

export class UnoGame extends BaseGame {
    constructor() {
        super('uno');
        this.container = document.getElementById('uno-area');
        this.hand = [];
        this.discardTop = null;
        this.currentColor = null;
        this.players = [];
        this.pendingCard = null;
    }

    show() {
        if (this.container) {
            this.container.style.display = 'flex';
        }
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    onGameStart(data) {
        this.hand = data.hand || [];
        this.discardTop = data.discardTop;
        this.currentColor = data.currentColor;
        this.players = data.players || [];
        updateState({ isMyTurn: data.turn === state.playerId });

        this.render();
        this.updateTurnIndicator(data.turn);
        this.setupEventListeners();
    }

    onUpdate(data) {
        this.hand = data.hand || [];
        this.discardTop = data.discardTop;
        this.currentColor = data.currentColor;
        this.players = data.players || [];
        updateState({ isMyTurn: data.turn === state.playerId });

        this.render();
        this.updateTurnIndicator(data.turn);
    }

    onNewRound(data) {
        this.hand = data.hand || [];
        this.discardTop = data.discardTop;
        this.currentColor = data.currentColor;
        this.players = data.players || [];
        updateState({ isMyTurn: data.turn === state.playerId });

        this.render();
        this.updateTurnIndicator(data.turn);
    }

    onCardsDrawn(data) {
        // Cards are added to hand via next uno_update
        const reason = data.reason === 'draw' ? 'Vous avez pioché' :
                       data.reason === 'draw2' ? 'Vous piochez +2' :
                       'Vous piochez +4';
        this.showNotification(`${reason}: ${data.cards.length} carte(s)`);
    }

    render() {
        this.renderOpponents();
        this.renderDiscardPile();
        this.renderHand();
    }

    renderOpponents() {
        const container = document.getElementById('uno-opponents');
        if (!container) return;

        container.innerHTML = '';

        this.players.forEach(player => {
            if (player.id === state.playerId) return;

            const div = document.createElement('div');
            div.className = 'uno-opponent';
            div.innerHTML = `
                <span class="uno-opponent-name">${player.username}</span>
                <span class="uno-opponent-cards">${player.cardCount} 🃏</span>
            `;
            container.appendChild(div);
        });
    }

    renderDiscardPile() {
        const container = document.getElementById('uno-discard');
        if (!container || !this.discardTop) return;

        container.innerHTML = '';
        const card = this.createCardElement(this.discardTop, false);
        card.classList.add('discard-card');

        // Show current color indicator for wild cards
        if (this.discardTop.color === 'wild' && this.currentColor) {
            const colorIndicator = document.createElement('div');
            colorIndicator.className = `uno-color-indicator ${this.currentColor}`;
            colorIndicator.textContent = COLOR_EMOJIS[this.currentColor];
            container.appendChild(colorIndicator);
        }

        container.appendChild(card);
    }

    renderHand() {
        const container = document.getElementById('uno-hand');
        if (!container) return;

        container.innerHTML = '';

        this.hand.forEach((card, index) => {
            const cardEl = this.createCardElement(card, true);
            cardEl.dataset.index = index;

            // Highlight playable cards
            if (state.isMyTurn && this.isPlayable(card)) {
                cardEl.classList.add('playable');
            }

            container.appendChild(cardEl);
        });
    }

    createCardElement(card, clickable) {
        const el = document.createElement('div');
        el.className = `uno-card ${card.color}`;

        const value = VALUE_DISPLAY[card.value] || card.value;
        el.innerHTML = `<span class="uno-card-value">${value}</span>`;

        if (clickable) {
            el.addEventListener('click', () => this.handleCardClick(card));
        }

        return el;
    }

    isPlayable(card) {
        if (!this.discardTop) return false;

        // Wild cards always playable
        if (card.color === 'wild') return true;

        // Match current color
        if (card.color === this.currentColor) return true;

        // Match value
        if (card.value === this.discardTop.value) return true;

        return false;
    }

    handleCardClick(card) {
        if (!state.isMyTurn) {
            this.showNotification("Ce n'est pas votre tour !");
            return;
        }

        if (!this.isPlayable(card)) {
            this.showNotification("Carte non jouable !");
            return;
        }

        // If wild card, show color picker
        if (card.color === 'wild') {
            this.pendingCard = card;
            this.showColorPicker();
            return;
        }

        this.playCard(card);
    }

    playCard(card, chosenColor = null) {
        this.sendMove({ card, chosenColor });
    }

    handleDraw() {
        if (!state.isMyTurn) {
            this.showNotification("Ce n'est pas votre tour !");
            return;
        }

        this.sendMove({ action: 'draw' });
    }

    showColorPicker() {
        const picker = document.getElementById('color-picker');
        if (picker) {
            picker.style.display = 'flex';
        }
    }

    hideColorPicker() {
        const picker = document.getElementById('color-picker');
        if (picker) {
            picker.style.display = 'none';
        }
    }

    selectColor(color) {
        this.hideColorPicker();
        if (this.pendingCard) {
            this.playCard(this.pendingCard, color);
            this.pendingCard = null;
        }
    }

    updateTurnIndicator(turnPlayerId) {
        const indicator = document.getElementById('uno-turn');
        if (!indicator) return;

        const isMyTurn = turnPlayerId === state.playerId;
        const player = this.players.find(p => p.id === turnPlayerId);

        if (isMyTurn) {
            indicator.textContent = "C'est votre tour !";
            indicator.className = 'uno-turn my-turn';
        } else if (player) {
            indicator.textContent = `Tour de ${player.username}`;
            indicator.className = 'uno-turn';
        }
    }

    showNotification(message) {
        const notification = document.getElementById('uno-notification');
        if (notification) {
            notification.textContent = message;
            notification.classList.add('show');
            setTimeout(() => notification.classList.remove('show'), 2000);
        }
    }

    setupEventListeners() {
        // Draw pile click
        const deck = document.getElementById('uno-deck');
        if (deck) {
            deck.onclick = () => this.handleDraw();
        }

        // Color picker buttons
        document.querySelectorAll('#color-picker button').forEach(btn => {
            btn.onclick = () => this.selectColor(btn.dataset.color);
        });
    }

    reset() {
        this.hand = [];
        this.discardTop = null;
        this.currentColor = null;
        this.players = [];
        this.pendingCard = null;
    }
}
