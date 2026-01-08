const BaseGame = require('./BaseGame');
const { Chess } = require('chess.js');

class ChessGame extends BaseGame {
    constructor(gameId, creator, options = {}) {
        super(gameId, creator, options);
        this.gameType = 'chess';
        this.engine = new Chess();
    }

    onGameStart() {
        this.players.forEach((player, index) => {
            // Creator (index 0) is white, joiner (index 1) is black
            const myColor = index === 0 ? 'w' : 'b';
            this.sendTo(player, {
                type: 'game_start',
                gameId: this.id,
                gameType: this.gameType,
                playerId: player.id,
                opponentId: this.getOpponent(player).id,
                avatars: this.avatars,
                usernames: this.usernames,
                winRounds: this.winRounds,
                myColor: myColor,
                fen: this.engine.fen()
            });
        });
    }

    handleMove(ws, data) {
        const playerIndex = this.players.findIndex(p => p.id === ws.id);
        const playerColor = playerIndex === 0 ? 'w' : 'b';

        if (this.engine.turn() !== playerColor) return;

        const moveData = {
            from: data.from,
            to: data.to
        };

        // Handle promotion
        if (data.promotion) {
            moveData.promotion = data.promotion;
        } else {
            // Auto-promote to queen
            const piece = this.engine.get(data.from);
            if (piece && piece.type === 'p') {
                const toRank = data.to[1];
                if ((piece.color === 'w' && toRank === '8') || (piece.color === 'b' && toRank === '1')) {
                    moveData.promotion = 'q';
                }
            }
        }

        let move;
        try {
            move = this.engine.move(moveData);
        } catch (e) {
            return; // Invalid move
        }

        if (!move) return;

        // Broadcast update
        this.broadcast({
            type: 'chess_update',
            fen: this.engine.fen(),
            turn: this.engine.turn(),
            lastMove: { from: move.from, to: move.to },
            isCheck: this.engine.isCheck(),
            isCheckmate: this.engine.isCheckmate(),
            isStalemate: this.engine.isStalemate(),
            isDraw: this.engine.isDraw()
        });

        // Check game end
        if (this.engine.isCheckmate()) {
            this.scores[ws.id]++;
            this.broadcast({
                type: 'round_result',
                winner: ws.id,
                scores: this.scores,
                reason: 'checkmate'
            });
            this.checkMatchWin(ws.id);
        } else if (this.engine.isStalemate() || this.engine.isDraw()) {
            this.broadcast({
                type: 'round_result',
                winner: null,
                scores: this.scores,
                reason: this.engine.isStalemate() ? 'stalemate' : 'draw'
            });
        }
    }

    resetRound() {
        this.engine = new Chess();
    }

    getNewRoundData() {
        return { fen: this.engine.fen() };
    }
}

module.exports = ChessGame;
