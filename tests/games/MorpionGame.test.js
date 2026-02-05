import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const MorpionGame = require('../../games/MorpionGame');
const { createMockWsPair } = require('../helpers/mockWs');

describe('MorpionGame', () => {
    let ws1, ws2, game;

    beforeEach(() => {
        [ws1, ws2] = createMockWsPair();
        game = new MorpionGame('game-1', ws1, { username: 'Alice', avatarId: 1 });
        game.addPlayer(ws2, { username: 'Bob', avatarId: 2 });
    });

    describe('initialization', () => {
        it('should set gameType to morpion', () => {
            expect(game.gameType).toBe('morpion');
        });

        it('should start with empty board', () => {
            expect(game.board).toEqual(Array(9).fill(null));
        });

        it('should set creator as first turn', () => {
            expect(game.turn).toBe(ws1.id);
        });
    });

    describe('onGameStart', () => {
        it('should include turn in game_start message', () => {
            game.onGameStart();
            const msg = ws1.getLastMessage();
            expect(msg.type).toBe('game_start');
            expect(msg.turn).toBe(ws1.id);
        });
    });

    describe('handleMove', () => {
        it('should place a mark on the board', () => {
            game.handleMove(ws1, { move: 0 });
            expect(game.board[0]).toBe(ws1.id);
        });

        it('should reject move when not player turn', () => {
            game.handleMove(ws2, { move: 0 });
            expect(game.board[0]).toBeNull();
        });

        it('should reject move on occupied cell', () => {
            game.handleMove(ws1, { move: 0 });
            ws1.clearMessages();
            ws2.clearMessages();

            // Switch turn manually for testing
            game.turn = ws2.id;
            game.handleMove(ws2, { move: 0 });
            // Board should not change
            expect(game.board[0]).toBe(ws1.id);
        });

        it('should reject invalid index', () => {
            game.handleMove(ws1, { move: -1 });
            expect(game.board.every(c => c === null)).toBe(true);

            game.handleMove(ws1, { move: 9 });
            expect(game.board.every(c => c === null)).toBe(true);
        });

        it('should alternate turns', () => {
            game.handleMove(ws1, { move: 0 });
            expect(game.turn).toBe(ws2.id);

            game.handleMove(ws2, { move: 1 });
            expect(game.turn).toBe(ws1.id);
        });

        it('should broadcast morpion_update', () => {
            game.handleMove(ws1, { move: 4 });
            const msg = ws1.getLastMessage();
            expect(msg.type).toBe('morpion_update');
            expect(msg.board[4]).toBe(ws1.id);
            expect(msg.lastMove).toBe(4);
            expect(msg.turn).toBe(ws2.id);
        });
    });

    describe('win detection', () => {
        it('should detect row win', () => {
            // X X X
            // O O .
            // . . .
            game.handleMove(ws1, { move: 0 }); // X
            game.handleMove(ws2, { move: 3 }); // O
            game.handleMove(ws1, { move: 1 }); // X
            game.handleMove(ws2, { move: 4 }); // O
            game.handleMove(ws1, { move: 2 }); // X wins

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result.winner).toBe(ws1.id);
            expect(result.scores[ws1.id]).toBe(1);
        });

        it('should detect column win', () => {
            // X O .
            // X O .
            // X . .
            game.handleMove(ws1, { move: 0 }); // X
            game.handleMove(ws2, { move: 1 }); // O
            game.handleMove(ws1, { move: 3 }); // X
            game.handleMove(ws2, { move: 4 }); // O
            game.handleMove(ws1, { move: 6 }); // X wins

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result.winner).toBe(ws1.id);
        });

        it('should detect diagonal win', () => {
            // X O .
            // O X .
            // . . X
            game.handleMove(ws1, { move: 0 }); // X
            game.handleMove(ws2, { move: 1 }); // O
            game.handleMove(ws1, { move: 4 }); // X
            game.handleMove(ws2, { move: 3 }); // O
            game.handleMove(ws1, { move: 8 }); // X wins

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result.winner).toBe(ws1.id);
        });

        it('should detect anti-diagonal win', () => {
            // . O X
            // O X .
            // X . .
            game.handleMove(ws1, { move: 2 }); // X
            game.handleMove(ws2, { move: 1 }); // O
            game.handleMove(ws1, { move: 4 }); // X
            game.handleMove(ws2, { move: 3 }); // O
            game.handleMove(ws1, { move: 6 }); // X wins

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result.winner).toBe(ws1.id);
        });
    });

    describe('draw', () => {
        it('should detect draw when board is full', () => {
            // X O X
            // X X O
            // O X O
            game.handleMove(ws1, { move: 0 }); // X
            game.handleMove(ws2, { move: 1 }); // O
            game.handleMove(ws1, { move: 2 }); // X
            game.handleMove(ws2, { move: 5 }); // O
            game.handleMove(ws1, { move: 3 }); // X
            game.handleMove(ws2, { move: 6 }); // O
            game.handleMove(ws1, { move: 4 }); // X
            game.handleMove(ws2, { move: 8 }); // O
            game.handleMove(ws1, { move: 7 }); // X

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result.winner).toBeNull();
        });
    });

    describe('resetRound', () => {
        it('should clear the board', () => {
            game.board[0] = ws1.id;
            game.resetRound();
            expect(game.board).toEqual(Array(9).fill(null));
        });

        it('should alternate starting player', () => {
            // Round 1: turn starts with ws1 (round=1, index=1%2=1 → ws2)
            game.round = 1;
            game.resetRound();
            expect(game.turn).toBe(ws2.id);

            // Round 2: (round=2, index=2%2=0 → ws1)
            game.round = 2;
            game.resetRound();
            expect(game.turn).toBe(ws1.id);
        });
    });

    describe('getNewRoundData', () => {
        it('should include turn info', () => {
            const data = game.getNewRoundData();
            expect(data).toHaveProperty('turn');
        });
    });
});
