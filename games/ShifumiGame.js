const BaseGame = require('./BaseGame');

class ShifumiGame extends BaseGame {
    constructor(gameId, creator, options = {}) {
        super(gameId, creator, options);
        this.gameType = 'shifumi';
        this.moves = {};
    }

    handleMove(ws, data) {
        this.moves[ws.id] = data.move;

        // Notify opponent that a move was made
        const opponent = this.getOpponent(ws);
        if (opponent) {
            this.sendTo(opponent, { type: 'opponent_moved' });
        }

        // Check if both players have moved
        if (Object.keys(this.moves).length === 2) {
            this.resolveRound();
        }
    }

    resolveRound() {
        const p1 = this.players[0];
        const p2 = this.players[1];
        const m1 = this.moves[p1.id];
        const m2 = this.moves[p2.id];

        let winner = null;

        if (m1 !== m2) {
            if (
                (m1 === 'rock' && m2 === 'scissors') ||
                (m1 === 'paper' && m2 === 'rock') ||
                (m1 === 'scissors' && m2 === 'paper')
            ) {
                winner = p1.id;
            } else {
                winner = p2.id;
            }
            this.scores[winner]++;
        }

        this.broadcast({
            type: 'round_result',
            moves: this.moves,
            winner: winner,
            scores: this.scores
        });

        this.checkMatchWin(winner);
    }

    resetRound() {
        this.moves = {};
    }
}

module.exports = ShifumiGame;
