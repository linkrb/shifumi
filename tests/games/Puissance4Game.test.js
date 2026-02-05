import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Puissance4Game = require('../../games/Puissance4Game');
const { createMockWsPair } = require('../helpers/mockWs');

describe('Puissance4Game', () => {
    let ws1, ws2, game;

    beforeEach(() => {
        [ws1, ws2] = createMockWsPair();
        game = new Puissance4Game('game-1', ws1, { username: 'Alice', avatarId: 1 });
        game.addPlayer(ws2, { username: 'Bob', avatarId: 2 });
    });

    describe('initialization', () => {
        it('should set gameType to puissance4', () => {
            expect(game.gameType).toBe('puissance4');
        });

        it('should start with empty 6x7 board', () => {
            expect(game.board).toHaveLength(42);
            expect(game.board.every(c => c === null)).toBe(true);
        });

        it('should set creator as first turn', () => {
            expect(game.turn).toBe(ws1.id);
        });
    });

    describe('gravity', () => {
        it('should drop token to bottom of column', () => {
            game.handleMove(ws1, { move: 3 }); // column 3
            // Bottom row = row 5, index = 5*7+3 = 38
            expect(game.board[38]).toBe(ws1.id);
        });

        it('should stack tokens', () => {
            game.handleMove(ws1, { move: 3 });
            game.handleMove(ws2, { move: 3 });
            // First: row 5, index 38
            expect(game.board[38]).toBe(ws1.id);
            // Second: row 4, index 31
            expect(game.board[31]).toBe(ws2.id);
        });
    });

    describe('handleMove', () => {
        it('should reject move when not player turn', () => {
            game.handleMove(ws2, { move: 0 });
            expect(game.board.every(c => c === null)).toBe(true);
        });

        it('should reject invalid column', () => {
            game.handleMove(ws1, { move: -1 });
            expect(game.board.every(c => c === null)).toBe(true);

            game.handleMove(ws1, { move: 7 });
            expect(game.board.every(c => c === null)).toBe(true);
        });

        it('should reject full column', () => {
            // Fill column 0 (6 rows)
            for (let i = 0; i < 6; i++) {
                const current = i % 2 === 0 ? ws1 : ws2;
                game.turn = current.id;
                game.handleMove(current, { move: 0 });
            }
            const msgCount = ws1.messages.length;
            game.turn = ws1.id;
            game.handleMove(ws1, { move: 0 });
            // No new messages sent (move rejected silently)
            expect(ws1.messages.length).toBe(msgCount);
        });

        it('should alternate turns', () => {
            game.handleMove(ws1, { move: 0 });
            expect(game.turn).toBe(ws2.id);
            game.handleMove(ws2, { move: 1 });
            expect(game.turn).toBe(ws1.id);
        });

        it('should broadcast puissance4_update', () => {
            game.handleMove(ws1, { move: 3 });
            const msg = ws1.getLastMessage();
            expect(msg.type).toBe('puissance4_update');
            expect(msg.lastMove).toBe(38); // row 5, col 3
            expect(msg.turn).toBe(ws2.id);
        });
    });

    describe('win detection', () => {
        // Helper to play a sequence of columns
        function playMoves(moves) {
            for (const col of moves) {
                const current = game.turn === ws1.id ? ws1 : ws2;
                game.handleMove(current, { move: col });
            }
        }

        it('should detect horizontal win', () => {
            // ws1: cols 0,1,2,3 (interleaved with ws2 on row above)
            playMoves([0, 0, 1, 1, 2, 2, 3]); // ws1 plays 0,1,2,3 on bottom

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result.winner).toBe(ws1.id);
        });

        it('should detect vertical win', () => {
            // ws1 plays col 0 four times, ws2 plays col 1
            playMoves([0, 1, 0, 1, 0, 1, 0]); // ws1 gets 4 in col 0

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result.winner).toBe(ws1.id);
        });

        it('should detect diagonal ↘ win', () => {
            // Build a diagonal for ws1
            // col:  0  1  1  2  2  2  3  3  3  3
            playMoves([0, 1, 1, 2, 3, 2, 2, 3, 3, 6, 3]);
            // ws1: (5,0), (4,1), (3,2), (2,3) = diagonal ↘

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result).toBeDefined();
            expect(result.winner).toBe(ws1.id);
        });

        it('should detect diagonal ↙ win', () => {
            // Build a diagonal for ws1 going ↙
            playMoves([3, 2, 2, 1, 0, 1, 1, 0, 0, 6, 0]);

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result).toBeDefined();
            expect(result.winner).toBe(ws1.id);
        });
    });

    describe('draw', () => {
        it('should detect draw when board is full', () => {
            // Fill the board without any 4-in-a-row
            // Pattern per column: alternating players in groups of 3
            // This creates a board with no 4 in a row
            const cols = [];
            for (let col = 0; col < 7; col++) {
                for (let row = 0; row < 6; row++) {
                    cols.push(col);
                }
            }
            // We need a specific pattern that avoids 4 in a row
            // Reset game and manually fill the board
            game.board = Array(42).fill(null);

            // Fill with a checkerboard-like pattern that avoids 4 in a row
            // Use a known draw pattern
            const pattern = [
                ws1.id, ws2.id, ws1.id, ws2.id, ws1.id, ws2.id, ws1.id,
                ws1.id, ws2.id, ws1.id, ws2.id, ws1.id, ws2.id, ws1.id,
                ws2.id, ws1.id, ws2.id, ws1.id, ws2.id, ws1.id, ws2.id,
                ws1.id, ws2.id, ws1.id, ws2.id, ws1.id, ws2.id, ws1.id,
                ws1.id, ws2.id, ws1.id, ws2.id, ws1.id, ws2.id, ws1.id,
                ws2.id, ws1.id, ws2.id, ws1.id, ws2.id, ws1.id, ws2.id,
            ];
            game.board = pattern;
            game.turn = ws1.id;

            // Verify no winner
            expect(game.checkWin()).toBeNull();

            // Verify board is full
            expect(game.board.includes(null)).toBe(false);
        });
    });

    describe('resetRound', () => {
        it('should clear the board', () => {
            game.board[38] = ws1.id;
            game.resetRound();
            expect(game.board).toEqual(Array(42).fill(null));
        });

        it('should alternate starting player', () => {
            game.round = 1;
            game.resetRound();
            expect(game.turn).toBe(ws2.id);

            game.round = 2;
            game.resetRound();
            expect(game.turn).toBe(ws1.id);
        });
    });
});
