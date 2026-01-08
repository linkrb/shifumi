const BaseGame = require('./BaseGame');

const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

class MorpionGame extends BaseGame {
    constructor(gameId, creator, options = {}) {
        super(gameId, creator, options);
        this.gameType = 'morpion';
        this.board = Array(9).fill(null);
        this.turn = creator.id;
    }

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
                winRounds: this.winRounds,
                turn: this.turn
            });
        });
    }

    handleMove(ws, data) {
        if (this.turn !== ws.id) return;

        const index = data.move;
        if (index < 0 || index > 8 || this.board[index] !== null) return;

        this.board[index] = ws.id;
        const nextTurn = this.getOpponent(ws).id;

        // Notify board update
        this.broadcast({
            type: 'morpion_update',
            board: this.board,
            lastMove: index,
            turn: nextTurn
        });

        // Check win
        const winner = this.checkWin();
        if (winner) {
            this.scores[winner]++;
            this.broadcast({
                type: 'round_result',
                winner: winner,
                scores: this.scores,
                board: this.board
            });
            this.checkMatchWin(winner);
        } else if (!this.board.includes(null)) {
            // Draw
            this.broadcast({
                type: 'round_result',
                winner: null,
                scores: this.scores,
                board: this.board
            });
        } else {
            this.turn = nextTurn;
        }
    }

    checkWin() {
        for (const [a, b, c] of WIN_LINES) {
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                return this.board[a];
            }
        }
        return null;
    }

    resetRound() {
        this.board = Array(9).fill(null);
        // Alternate starting player each round
        this.turn = this.players[(this.round % 2)].id;
    }

    getNewRoundData() {
        return { turn: this.turn };
    }
}

module.exports = MorpionGame;
