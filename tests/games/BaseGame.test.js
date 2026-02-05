import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const BaseGame = require('../../games/BaseGame');
const { createMockWs, createMockWsPair } = require('../helpers/mockWs');

// Concrete subclass for testing
class TestGame extends BaseGame {
    constructor(gameId, creator, options) {
        super(gameId, creator, options);
        this.gameType = 'test';
        this.roundReset = false;
    }
    handleMove() {}
    resetRound() {
        this.roundReset = true;
    }
}

describe('BaseGame', () => {
    let ws1, ws2;

    beforeEach(() => {
        [ws1, ws2] = createMockWsPair();
    });

    describe('constructor', () => {
        it('should initialize with creator as first player', () => {
            const game = new TestGame('game-1', ws1, { username: 'Alice', avatarId: 1 });
            expect(game.players).toHaveLength(1);
            expect(game.players[0].id).toBe(ws1.id);
            expect(game.scores[ws1.id]).toBe(0);
            expect(game.usernames[ws1.id]).toBe('Alice');
            expect(game.avatars[ws1.id]).toBe(1);
            expect(game.round).toBe(1);
            expect(game.gameWon).toBe(false);
        });

        it('should default username to "Joueur 1"', () => {
            const game = new TestGame('game-1', ws1, {});
            expect(game.usernames[ws1.id]).toBe('Joueur 1');
        });
    });

    describe('addPlayer', () => {
        it('should add a second player', () => {
            const game = new TestGame('game-1', ws1, { username: 'Alice' });
            game.addPlayer(ws2, { username: 'Bob', avatarId: 2 });

            expect(game.players).toHaveLength(2);
            expect(game.scores[ws2.id]).toBe(0);
            expect(game.usernames[ws2.id]).toBe('Bob');
        });

        it('should default username based on player count', () => {
            const game = new TestGame('game-1', ws1, {});
            game.addPlayer(ws2, {});
            expect(game.usernames[ws2.id]).toBe('Joueur 2');
        });
    });

    describe('removePlayer', () => {
        it('should remove a player', () => {
            const game = new TestGame('game-1', ws1, {});
            game.addPlayer(ws2, {});
            game.removePlayer(ws1);
            expect(game.players).toHaveLength(1);
            expect(game.players[0].id).toBe(ws2.id);
        });
    });

    describe('canJoin', () => {
        it('should allow joining when not full', () => {
            const game = new TestGame('game-1', ws1, {});
            expect(game.canJoin()).toBe(true);
        });

        it('should deny joining when full', () => {
            const game = new TestGame('game-1', ws1, {});
            game.addPlayer(ws2, {});
            expect(game.canJoin()).toBe(false);
        });
    });

    describe('maxPlayers', () => {
        it('should default to 2', () => {
            const game = new TestGame('game-1', ws1, {});
            expect(game.maxPlayers).toBe(2);
        });
    });

    describe('getOpponent', () => {
        it('should return the other player', () => {
            const game = new TestGame('game-1', ws1, {});
            game.addPlayer(ws2, {});
            expect(game.getOpponent(ws1).id).toBe(ws2.id);
            expect(game.getOpponent(ws2).id).toBe(ws1.id);
        });
    });

    describe('broadcast', () => {
        it('should send to all players', () => {
            const game = new TestGame('game-1', ws1, {});
            game.addPlayer(ws2, {});
            game.broadcast({ type: 'test' });

            expect(ws1.getLastMessage().type).toBe('test');
            expect(ws2.getLastMessage().type).toBe('test');
        });
    });

    describe('sendTo', () => {
        it('should send to a specific player', () => {
            const game = new TestGame('game-1', ws1, {});
            game.addPlayer(ws2, {});
            game.sendTo(ws1, { type: 'private' });

            expect(ws1.getLastMessage().type).toBe('private');
            expect(ws2.getMessages()).toHaveLength(0);
        });
    });

    describe('onGameStart', () => {
        it('should send game_start to both players', () => {
            const game = new TestGame('game-1', ws1, { username: 'Alice', avatarId: 1, winRounds: 3 });
            game.addPlayer(ws2, { username: 'Bob', avatarId: 2 });
            game.onGameStart();

            const msg1 = ws1.getLastMessage();
            expect(msg1.type).toBe('game_start');
            expect(msg1.playerId).toBe(ws1.id);
            expect(msg1.opponentId).toBe(ws2.id);
            expect(msg1.winRounds).toBe(3);

            const msg2 = ws2.getLastMessage();
            expect(msg2.type).toBe('game_start');
            expect(msg2.playerId).toBe(ws2.id);
            expect(msg2.opponentId).toBe(ws1.id);
        });
    });

    describe('checkMatchWin', () => {
        it('should return false when winRounds is null (unlimited)', () => {
            vi.useFakeTimers();
            const game = new TestGame('game-1', ws1, {});
            game.addPlayer(ws2, {});
            game.scores[ws1.id] = 10;
            expect(game.checkMatchWin(ws1.id)).toBe(false);
            vi.useRealTimers();
        });

        it('should return false when score is below threshold', () => {
            vi.useFakeTimers();
            const game = new TestGame('game-1', ws1, { winRounds: 3 });
            game.addPlayer(ws2, {});
            game.scores[ws1.id] = 2;
            expect(game.checkMatchWin(ws1.id)).toBe(false);
            vi.useRealTimers();
        });

        it('should return true and broadcast game_won when threshold reached', () => {
            vi.useFakeTimers();
            const game = new TestGame('game-1', ws1, { winRounds: 3 });
            game.addPlayer(ws2, {});
            game.scores[ws1.id] = 3;
            expect(game.checkMatchWin(ws1.id)).toBe(true);
            expect(game.gameWon).toBe(true);

            vi.advanceTimersByTime(1000);
            const msg = ws1.getLastMessage();
            expect(msg.type).toBe('game_won');
            expect(msg.winner).toBe(ws1.id);
            vi.useRealTimers();
        });

        it('should return false when winner is null (draw)', () => {
            const game = new TestGame('game-1', ws1, { winRounds: 3 });
            expect(game.checkMatchWin(null)).toBe(false);
        });
    });

    describe('handlePlayAgain', () => {
        it('should notify opponent when first player wants replay', () => {
            const game = new TestGame('game-1', ws1, {});
            game.addPlayer(ws2, {});
            game.handlePlayAgain(ws1);

            expect(ws2.getLastMessage().type).toBe('opponent_wants_replay');
        });

        it('should start new round when both players want replay', () => {
            const game = new TestGame('game-1', ws1, {});
            game.addPlayer(ws2, {});

            game.handlePlayAgain(ws1);
            ws1.clearMessages();
            ws2.clearMessages();

            game.handlePlayAgain(ws2);

            expect(game.round).toBe(2);
            expect(game.roundReset).toBe(true);
            const msg = ws1.getLastMessage();
            expect(msg.type).toBe('new_round');
            expect(msg.round).toBe(2);
        });

        it('should reset scores when replaying after game won', () => {
            const game = new TestGame('game-1', ws1, { winRounds: 1 });
            game.addPlayer(ws2, {});
            game.scores[ws1.id] = 1;
            game.gameWon = true;

            game.handlePlayAgain(ws1);
            game.handlePlayAgain(ws2);

            expect(game.scores[ws1.id]).toBe(0);
            expect(game.scores[ws2.id]).toBe(0);
            expect(game.gameWon).toBe(false);
            expect(game.round).toBe(1);
        });
    });

    describe('onPlayerDisconnect', () => {
        it('should notify opponent of disconnection', () => {
            const game = new TestGame('game-1', ws1, {});
            game.addPlayer(ws2, {});
            game.onPlayerDisconnect(ws1);

            expect(ws2.getLastMessage().type).toBe('opponent_disconnected');
        });
    });
});
