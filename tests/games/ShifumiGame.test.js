import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ShifumiGame = require('../../games/ShifumiGame');
const { createMockWsPair } = require('../helpers/mockWs');

describe('ShifumiGame', () => {
    let ws1, ws2, game;

    beforeEach(() => {
        [ws1, ws2] = createMockWsPair();
        game = new ShifumiGame('game-1', ws1, { username: 'Alice', avatarId: 1 });
        game.addPlayer(ws2, { username: 'Bob', avatarId: 2 });
    });

    describe('initialization', () => {
        it('should set gameType to shifumi', () => {
            expect(game.gameType).toBe('shifumi');
        });

        it('should start with empty moves', () => {
            expect(game.moves).toEqual({});
        });
    });

    describe('handleMove', () => {
        it('should notify opponent when a move is made', () => {
            game.handleMove(ws1, { move: 'rock' });
            expect(ws2.getLastMessage().type).toBe('opponent_moved');
        });

        it('should not resolve until both players move', () => {
            game.handleMove(ws1, { move: 'rock' });
            // Only opponent_moved, no round_result yet
            expect(ws1.getMessages()).toHaveLength(0);
            expect(ws2.getMessages()).toHaveLength(1);
            expect(ws2.getLastMessage().type).toBe('opponent_moved');
        });
    });

    describe('round resolution', () => {
        it('rock beats scissors', () => {
            game.handleMove(ws1, { move: 'rock' });
            game.handleMove(ws2, { move: 'scissors' });

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result.winner).toBe(ws1.id);
            expect(result.moves[ws1.id]).toBe('rock');
            expect(result.moves[ws2.id]).toBe('scissors');
            expect(result.scores[ws1.id]).toBe(1);
        });

        it('scissors beats paper', () => {
            game.handleMove(ws1, { move: 'scissors' });
            game.handleMove(ws2, { move: 'paper' });

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result.winner).toBe(ws1.id);
        });

        it('paper beats rock', () => {
            game.handleMove(ws1, { move: 'paper' });
            game.handleMove(ws2, { move: 'rock' });

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result.winner).toBe(ws1.id);
        });

        it('player 2 wins when they have the winning move', () => {
            game.handleMove(ws1, { move: 'scissors' });
            game.handleMove(ws2, { move: 'rock' });

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result.winner).toBe(ws2.id);
            expect(result.scores[ws2.id]).toBe(1);
        });

        it('draw when same move', () => {
            game.handleMove(ws1, { move: 'rock' });
            game.handleMove(ws2, { move: 'rock' });

            const result = ws1.getMessages().find(m => m.type === 'round_result');
            expect(result.winner).toBeNull();
            expect(result.scores[ws1.id]).toBe(0);
            expect(result.scores[ws2.id]).toBe(0);
        });

        it('broadcasts result to both players', () => {
            game.handleMove(ws1, { move: 'rock' });
            game.handleMove(ws2, { move: 'scissors' });

            const result1 = ws1.getMessages().find(m => m.type === 'round_result');
            const result2 = ws2.getMessages().find(m => m.type === 'round_result');
            expect(result1).toEqual(result2);
        });
    });

    describe('resetRound', () => {
        it('should clear moves', () => {
            game.moves = { [ws1.id]: 'rock', [ws2.id]: 'paper' };
            game.resetRound();
            expect(game.moves).toEqual({});
        });
    });

    describe('score tracking', () => {
        it('should accumulate scores across rounds', () => {
            // Round 1: ws1 wins
            game.handleMove(ws1, { move: 'rock' });
            game.handleMove(ws2, { move: 'scissors' });
            expect(game.scores[ws1.id]).toBe(1);

            // Round 2: ws2 wins
            game.resetRound();
            game.handleMove(ws1, { move: 'rock' });
            game.handleMove(ws2, { move: 'paper' });
            expect(game.scores[ws2.id]).toBe(1);
            expect(game.scores[ws1.id]).toBe(1);
        });
    });
});
