const { safeSend, broadcastToGame } = require('../utils/wsUtils');

class BaseGame {
    constructor(gameId, creator, options = {}) {
        this.id = gameId;
        this.gameType = 'base';
        this.players = [creator];
        this.scores = { [creator.id]: 0 };
        this.avatars = { [creator.id]: options.avatarId };
        this.usernames = { [creator.id]: options.username || 'Joueur 1' };
        this.winRounds = options.winRounds || null;
        this.round = 1;
        this.gameWon = false;
        this.wantsRestart = new Set();
    }

    get maxPlayers() {
        return 2;
    }

    canJoin() {
        return this.players.length < this.maxPlayers;
    }

    addPlayer(ws, options = {}) {
        this.players.push(ws);
        this.scores[ws.id] = 0;
        this.avatars[ws.id] = options.avatarId;
        this.usernames[ws.id] = options.username || `Joueur ${this.players.length}`;
    }

    removePlayer(ws) {
        this.players = this.players.filter(p => p.id !== ws.id);
    }

    getOpponent(ws) {
        return this.players.find(p => p.id !== ws.id);
    }

    broadcast(data) {
        broadcastToGame(this, data);
    }

    sendTo(ws, data) {
        safeSend(ws, data);
    }

    // Called when game starts (both players joined)
    onGameStart() {
        this.players.forEach(player => {
            this.sendTo(player, {
                type: 'game_start',
                gameId: this.id,
                gameType: this.gameType,
                playerId: player.id,
                opponentId: this.getOpponent(player).id,
                avatars: this.avatars,
                usernames: this.usernames,
                winRounds: this.winRounds
            });
        });
    }

    // Override in subclasses
    handleMove(ws, data) {
        throw new Error('handleMove must be implemented');
    }

    // Override in subclasses
    resetRound() {
        throw new Error('resetRound must be implemented');
    }

    // Check if a player has won the match (best of N)
    checkMatchWin(winnerId) {
        if (this.winRounds && winnerId && this.scores[winnerId] >= this.winRounds) {
            this.gameWon = true;
            setTimeout(() => {
                this.broadcast({
                    type: 'game_won',
                    winner: winnerId,
                    scores: this.scores
                });
            }, 1000);
            return true;
        }
        return false;
    }

    // Handle play again request
    handlePlayAgain(ws) {
        this.wantsRestart.add(ws.id);

        if (this.wantsRestart.size === 2) {
            this.wantsRestart.clear();
            this.round++;

            if (this.gameWon) {
                // Reset scores for new match
                Object.keys(this.scores).forEach(pid => this.scores[pid] = 0);
                this.gameWon = false;
                this.round = 1;
            }

            this.resetRound();
            this.broadcast({
                type: 'new_round',
                round: this.round,
                ...this.getNewRoundData()
            });
        } else {
            const opponent = this.getOpponent(ws);
            if (opponent) {
                this.sendTo(opponent, { type: 'opponent_wants_replay' });
            }
        }
    }

    // Override to add game-specific data to new_round message
    getNewRoundData() {
        return {};
    }

    // Handle player disconnect
    onPlayerDisconnect(ws) {
        const opponent = this.getOpponent(ws);
        if (opponent) {
            this.sendTo(opponent, { type: 'opponent_disconnected' });
        }
    }
}

module.exports = BaseGame;
