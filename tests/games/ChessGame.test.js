import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ChessGame = require('../../games/ChessGame');
const { createMockWsPair } = require('../helpers/mockWs');

describe('ChessGame', () => {
    let ws1, ws2, game;

    beforeEach(() => {
        [ws1, ws2] = createMockWsPair();
        game = new ChessGame('game-1', ws1, { username: 'Alice', avatarId: 1 });
        game.addPlayer(ws2, { username: 'Bob', avatarId: 2 });
    });

    describe('initialization', () => {
        it('should set gameType to chess', () => {
            expect(game.gameType).toBe('chess');
        });

        it('should initialize chess engine', () => {
            expect(game.engine).toBeDefined();
            expect(game.engine.turn()).toBe('w');
        });
    });

    describe('onGameStart', () => {
        it('should assign white to creator and black to joiner', () => {
            game.onGameStart();

            const msg1 = ws1.getLastMessage();
            expect(msg1.type).toBe('game_start');
            expect(msg1.myColor).toBe('w');

            const msg2 = ws2.getLastMessage();
            expect(msg2.myColor).toBe('b');
        });

        it('should include FEN in game_start', () => {
            game.onGameStart();
            const msg = ws1.getLastMessage();
            expect(msg.fen).toBeDefined();
            expect(msg.fen).toContain('rnbqkbnr');
        });
    });

    describe('handleMove', () => {
        it('should accept valid move (e2-e4)', () => {
            game.handleMove(ws1, { from: 'e2', to: 'e4' });

            const msg = ws1.getLastMessage();
            expect(msg.type).toBe('chess_update');
            expect(msg.turn).toBe('b');
            expect(msg.lastMove).toEqual({ from: 'e2', to: 'e4' });
        });

        it('should reject move when not player turn', () => {
            const msgCount = ws2.messages.length;
            game.handleMove(ws2, { from: 'e7', to: 'e5' });
            expect(ws2.messages.length).toBe(msgCount); // No new messages
        });

        it('should reject invalid move', () => {
            const msgCount = ws1.messages.length;
            game.handleMove(ws1, { from: 'e2', to: 'e5' }); // Can't move pawn 3 squares
            expect(ws1.messages.length).toBe(msgCount);
        });

        it('should alternate turns after valid moves', () => {
            game.handleMove(ws1, { from: 'e2', to: 'e4' });
            expect(game.engine.turn()).toBe('b');

            game.handleMove(ws2, { from: 'e7', to: 'e5' });
            expect(game.engine.turn()).toBe('w');
        });

        it('should broadcast check status', () => {
            // Set up a check position
            game.handleMove(ws1, { from: 'e2', to: 'e4' });
            game.handleMove(ws2, { from: 'f7', to: 'f6' });
            game.handleMove(ws1, { from: 'd1', to: 'h5' }); // Check!

            const msg = ws1.getLastMessage();
            expect(msg.type).toBe('chess_update');
            expect(msg.isCheck).toBe(true);
        });
    });

    describe('checkmate detection', () => {
        it('should detect Scholar\'s mate', () => {
            // 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
            game.handleMove(ws1, { from: 'e2', to: 'e4' });
            game.handleMove(ws2, { from: 'e7', to: 'e5' });
            game.handleMove(ws1, { from: 'f1', to: 'c4' });
            game.handleMove(ws2, { from: 'b8', to: 'c6' });
            game.handleMove(ws1, { from: 'd1', to: 'h5' });
            game.handleMove(ws2, { from: 'g8', to: 'f6' });
            game.handleMove(ws1, { from: 'h5', to: 'f7' }); // Checkmate!

            const messages = ws1.getMessages();
            const update = messages.find(m => m.type === 'chess_update' && m.isCheckmate);
            expect(update).toBeDefined();
            expect(update.isCheckmate).toBe(true);

            const result = messages.find(m => m.type === 'round_result');
            expect(result).toBeDefined();
            expect(result.winner).toBe(ws1.id);
            expect(result.reason).toBe('checkmate');
            expect(result.scores[ws1.id]).toBe(1);
        });
    });

    describe('stalemate detection', () => {
        it('should detect stalemate', () => {
            // Use a known stalemate position via FEN
            const { Chess } = require('chess.js');
            game.engine = new Chess('k7/8/1K6/8/8/8/8/7R w - - 0 1');
            // White plays Rh8 which is not stalemate... let me use a proper setup
            // Actually let's use: white King on b6, white Rook on a1, black King on a8
            game.engine = new Chess('k7/8/1K6/8/8/8/8/R7 w - - 0 1');
            // Ra1-a7 would be stalemate? No, let me think...
            // Black king on a8, white king b6, white queen c6 -> stalemate after Qc7?
            // Actually: K on a8, no other black pieces, White: K on c6, Q on b6
            // That's checkmate not stalemate.
            // Simple stalemate: Black K on a8, White K on a6, White Q on b6 - that's checkmate
            // Black K on h8, White K on f7, White Q on g6 - stalemate
            game.engine = new Chess('7k/8/6QK/8/8/8/8/8 b - - 0 1');
            // This is stalemate - black to move, king on h8 can't go anywhere
            expect(game.engine.isStalemate()).toBe(true);
        });
    });

    describe('draw detection', () => {
        it('should handle draw result', () => {
            const { Chess } = require('chess.js');
            // Set up stalemate position where white delivers it
            game.engine = new Chess('7k/8/5K1Q/8/8/8/8/8 w - - 0 1');
            // Qh6-g6 creates stalemate
            game.handleMove(ws1, { from: 'h6', to: 'g6' });

            const messages = ws1.getMessages();
            const result = messages.find(m => m.type === 'round_result');
            expect(result).toBeDefined();
            expect(result.winner).toBeNull();
            expect(result.reason).toBe('stalemate');
        });
    });

    describe('auto-promotion', () => {
        it('should auto-promote pawn to queen', () => {
            const { Chess } = require('chess.js');
            // White pawn on a7, kings far apart - no checkmate after promotion
            game.engine = new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
            game.handleMove(ws1, { from: 'a7', to: 'a8' });

            const update = ws1.getMessages().find(m => m.type === 'chess_update');
            expect(update).toBeDefined();
            // The move should have succeeded (pawn promoted to queen)
            expect(update.fen).toContain('Q');
        });
    });

    describe('resetRound', () => {
        it('should reset the chess engine', () => {
            game.handleMove(ws1, { from: 'e2', to: 'e4' });
            game.resetRound();
            expect(game.engine.turn()).toBe('w');
            expect(game.engine.fen()).toContain('rnbqkbnr');
        });
    });

    describe('getNewRoundData', () => {
        it('should include FEN', () => {
            const data = game.getNewRoundData();
            expect(data.fen).toBeDefined();
        });
    });
});
