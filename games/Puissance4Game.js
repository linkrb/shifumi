const BaseGame = require('./BaseGame');

const ROWS = 6;
const COLS = 7;

class Puissance4Game extends BaseGame {
    constructor(gameId, creator, options = {}) {
        super(gameId, creator, options);
        this.gameType = 'puissance4';
        this.board = Array(ROWS * COLS).fill(null);
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

        const column = data.move;
        if (column < 0 || column >= COLS) return;

        // Find lowest empty row in column (gravity)
        let row = -1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (this.board[r * COLS + column] === null) {
                row = r;
                break;
            }
        }

        if (row === -1) return; // Column full

        const index = row * COLS + column;
        this.board[index] = ws.id;
        const nextTurn = this.getOpponent(ws).id;

        // Notify board update
        this.broadcast({
            type: 'puissance4_update',
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

    getCell(row, col) {
        if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
        return this.board[row * COLS + col];
    }

    checkWin() {
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const cell = this.getCell(row, col);
                if (!cell) continue;

                // Horizontal
                if (col <= COLS - 4 &&
                    cell === this.getCell(row, col + 1) &&
                    cell === this.getCell(row, col + 2) &&
                    cell === this.getCell(row, col + 3)) {
                    return cell;
                }

                // Vertical
                if (row <= ROWS - 4 &&
                    cell === this.getCell(row + 1, col) &&
                    cell === this.getCell(row + 2, col) &&
                    cell === this.getCell(row + 3, col)) {
                    return cell;
                }

                // Diagonal ↘
                if (row <= ROWS - 4 && col <= COLS - 4 &&
                    cell === this.getCell(row + 1, col + 1) &&
                    cell === this.getCell(row + 2, col + 2) &&
                    cell === this.getCell(row + 3, col + 3)) {
                    return cell;
                }

                // Diagonal ↙
                if (row <= ROWS - 4 && col >= 3 &&
                    cell === this.getCell(row + 1, col - 1) &&
                    cell === this.getCell(row + 2, col - 2) &&
                    cell === this.getCell(row + 3, col - 3)) {
                    return cell;
                }
            }
        }
        return null;
    }

    resetRound() {
        this.board = Array(ROWS * COLS).fill(null);
        this.turn = this.players[(this.round % 2)].id;
    }

    getNewRoundData() {
        return { turn: this.turn };
    }
}

module.exports = Puissance4Game;
