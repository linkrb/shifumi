const BaseGame = require('./BaseGame');

const COLORS = ['red', 'blue', 'green', 'yellow'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];

class UnoGame extends BaseGame {
    constructor(gameId, creator, options = {}) {
        super(gameId, creator, options);
        this.gameType = 'uno';
        this.deck = [];
        this.hands = {};
        this.discardPile = [];
        this.currentColor = null;
        this.direction = 1; // 1 = clockwise, -1 = counter-clockwise
        this.turnIndex = 0;
        this.pendingDraw = 0; // For stacking +2/+4
        this.minPlayers = options.minPlayers || 2;
    }

    get maxPlayers() {
        return 4;
    }

    createDeck() {
        const deck = [];

        // Numbered and action cards for each color
        for (const color of COLORS) {
            // One 0 per color
            deck.push({ color, value: '0' });

            // Two of each 1-9 and action cards
            for (const value of VALUES.slice(1)) {
                deck.push({ color, value });
                deck.push({ color, value });
            }
        }

        // Wild cards (4 of each)
        for (let i = 0; i < 4; i++) {
            deck.push({ color: 'wild', value: 'wild' });
            deck.push({ color: 'wild', value: 'wild4' });
        }

        return deck;
    }

    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    drawCards(playerId, count) {
        const drawn = [];
        for (let i = 0; i < count; i++) {
            if (this.deck.length === 0) {
                this.reshuffleDeck();
            }
            if (this.deck.length > 0) {
                drawn.push(this.deck.pop());
            }
        }
        this.hands[playerId] = this.hands[playerId].concat(drawn);
        return drawn;
    }

    reshuffleDeck() {
        if (this.discardPile.length <= 1) return;

        const topCard = this.discardPile.pop();
        this.deck = this.shuffleDeck(this.discardPile);
        this.discardPile = [topCard];
    }

    dealCards() {
        this.deck = this.shuffleDeck(this.createDeck());
        this.hands = {};
        this.discardPile = [];

        // Deal 7 cards to each player
        for (const player of this.players) {
            this.hands[player.id] = [];
            this.drawCards(player.id, 7);
        }

        // Draw first card for discard pile (skip wild cards)
        let firstCard;
        do {
            firstCard = this.deck.pop();
            if (firstCard.color === 'wild') {
                this.deck.unshift(firstCard);
            }
        } while (firstCard.color === 'wild');

        this.discardPile.push(firstCard);
        this.currentColor = firstCard.color;

        // Apply effect if first card is an action card
        if (firstCard.value === 'reverse') {
            this.direction = -1;
        } else if (firstCard.value === 'skip') {
            this.turnIndex = 1;
        } else if (firstCard.value === 'draw2') {
            this.pendingDraw = 2;
        }
    }

    onGameStart() {
        this.dealCards();
        this.turnIndex = 0;
        this.direction = 1;

        // Send personalized game_start to each player
        this.players.forEach((player, index) => {
            this.sendTo(player, {
                type: 'game_start',
                gameId: this.id,
                gameType: this.gameType,
                playerId: player.id,
                playerIndex: index,
                hand: this.hands[player.id],
                discardTop: this.getDiscardTop(),
                currentColor: this.currentColor,
                turn: this.players[this.turnIndex].id,
                direction: this.direction,
                pendingDraw: this.pendingDraw,
                players: this.getPlayersInfo(),
                avatars: this.avatars,
                usernames: this.usernames,
                winRounds: this.winRounds
            });
        });
    }

    getDiscardTop() {
        return this.discardPile[this.discardPile.length - 1];
    }

    getPlayersInfo() {
        return this.players.map(p => ({
            id: p.id,
            username: this.usernames[p.id],
            avatarId: this.avatars[p.id],
            cardCount: this.hands[p.id].length
        }));
    }

    getCurrentPlayer() {
        return this.players[this.turnIndex];
    }

    isValidPlay(card, chosenColor) {
        const topCard = this.getDiscardTop();

        // Wild cards are always playable
        if (card.color === 'wild') {
            // Wild+4 requires no matching color cards (simplified: always allow)
            return true;
        }

        // Match color
        if (card.color === this.currentColor) {
            return true;
        }

        // Match value
        if (card.value === topCard.value) {
            return true;
        }

        return false;
    }

    findCardInHand(playerId, card) {
        return this.hands[playerId].findIndex(c =>
            c.color === card.color && c.value === card.value
        );
    }

    applyCardEffect(card, chosenColor) {
        // Set current color
        if (card.color === 'wild') {
            this.currentColor = chosenColor || 'red';
        } else {
            this.currentColor = card.color;
        }

        // Apply special effects
        switch (card.value) {
            case 'reverse':
                if (this.players.length === 2) {
                    // In 2-player, reverse acts like skip
                    this.nextTurn();
                } else {
                    this.direction *= -1;
                }
                break;
            case 'skip':
                this.nextTurn();
                break;
            case 'draw2':
                this.nextTurn();
                const nextPlayer = this.getCurrentPlayer();
                this.drawCards(nextPlayer.id, 2);
                this.sendTo(nextPlayer, {
                    type: 'cards_drawn',
                    cards: this.hands[nextPlayer.id].slice(-2),
                    reason: 'draw2'
                });
                break;
            case 'wild4':
                this.nextTurn();
                const targetPlayer = this.getCurrentPlayer();
                this.drawCards(targetPlayer.id, 4);
                this.sendTo(targetPlayer, {
                    type: 'cards_drawn',
                    cards: this.hands[targetPlayer.id].slice(-4),
                    reason: 'wild4'
                });
                break;
        }
    }

    nextTurn() {
        this.turnIndex = (this.turnIndex + this.direction + this.players.length) % this.players.length;
    }

    handleMove(ws, data) {
        const currentPlayer = this.getCurrentPlayer();

        // Check if it's player's turn
        if (ws.id !== currentPlayer.id) {
            this.sendTo(ws, { type: 'error', message: 'Ce n\'est pas votre tour' });
            return;
        }

        // Handle draw action
        if (data.action === 'draw') {
            const drawn = this.drawCards(ws.id, 1);
            this.sendTo(ws, {
                type: 'cards_drawn',
                cards: drawn,
                reason: 'draw'
            });
            this.nextTurn();
            this.broadcastGameState();
            return;
        }

        // Handle play card
        if (data.card) {
            const cardIndex = this.findCardInHand(ws.id, data.card);

            if (cardIndex === -1) {
                this.sendTo(ws, { type: 'error', message: 'Carte non trouvée' });
                return;
            }

            if (!this.isValidPlay(data.card, data.chosenColor)) {
                this.sendTo(ws, { type: 'error', message: 'Coup invalide' });
                return;
            }

            // Remove card from hand
            const [playedCard] = this.hands[ws.id].splice(cardIndex, 1);
            this.discardPile.push(playedCard);

            // Check for win
            if (this.hands[ws.id].length === 0) {
                this.handleRoundWin(ws.id);
                return;
            }

            // Apply card effects
            this.applyCardEffect(playedCard, data.chosenColor);
            this.nextTurn();
            this.broadcastGameState();
        }
    }

    handleRoundWin(winnerId) {
        this.scores[winnerId]++;

        this.broadcast({
            type: 'round_result',
            winner: winnerId,
            winnerName: this.usernames[winnerId],
            scores: this.scores,
            round: this.round
        });

        this.checkMatchWin(winnerId);
    }

    broadcastGameState() {
        this.players.forEach(player => {
            this.sendTo(player, {
                type: 'uno_update',
                hand: this.hands[player.id],
                discardTop: this.getDiscardTop(),
                currentColor: this.currentColor,
                turn: this.getCurrentPlayer().id,
                direction: this.direction,
                players: this.getPlayersInfo()
            });
        });
    }

    resetRound() {
        this.dealCards();
        this.turnIndex = 0;
        this.direction = 1;
        this.pendingDraw = 0;
    }

    getNewRoundData() {
        const data = {};
        this.players.forEach(player => {
            data[player.id] = {
                hand: this.hands[player.id],
                discardTop: this.getDiscardTop(),
                currentColor: this.currentColor,
                turn: this.getCurrentPlayer().id,
                direction: this.direction,
                players: this.getPlayersInfo()
            };
        });
        return { playerData: data };
    }

    handlePlayAgain(ws) {
        this.wantsRestart.add(ws.id);

        if (this.wantsRestart.size === this.players.length) {
            this.wantsRestart.clear();
            this.round++;

            if (this.gameWon) {
                Object.keys(this.scores).forEach(pid => this.scores[pid] = 0);
                this.gameWon = false;
                this.round = 1;
            }

            this.resetRound();

            // Send personalized new_round to each player
            this.players.forEach(player => {
                this.sendTo(player, {
                    type: 'new_round',
                    round: this.round,
                    hand: this.hands[player.id],
                    discardTop: this.getDiscardTop(),
                    currentColor: this.currentColor,
                    turn: this.getCurrentPlayer().id,
                    direction: this.direction,
                    players: this.getPlayersInfo()
                });
            });
        } else {
            // Notify others that this player wants to replay
            this.players.forEach(p => {
                if (p.id !== ws.id) {
                    this.sendTo(p, {
                        type: 'opponent_wants_replay',
                        playerId: ws.id,
                        username: this.usernames[ws.id],
                        count: this.wantsRestart.size,
                        needed: this.players.length
                    });
                }
            });
        }
    }
}

module.exports = UnoGame;
