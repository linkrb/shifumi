import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createMockWs, createMockWsGroup } = require('../helpers/mockWs');

// We need a fresh module for each test to reset internal state (games, sessions maps)
let handleMessage, handleDisconnect;

beforeEach(() => {
    vi.useFakeTimers();
    // Clear module cache to get fresh games/sessions maps
    const modulePath = require.resolve('../../handlers/messageHandler');
    delete require.cache[modulePath];
    const handler = require('../../handlers/messageHandler');
    handleMessage = handler.handleMessage;
    handleDisconnect = handler.handleDisconnect;
});

afterEach(() => {
    vi.useRealTimers();
});

describe('messageHandler', () => {
    describe('create_session', () => {
        it('should create a session and respond with session_created', () => {
            const ws = createMockWs();
            handleMessage(ws, {
                type: 'create_session',
                username: 'Alice',
                avatarId: 1,
            });

            const msg = ws.getLastMessage();
            expect(msg.type).toBe('session_created');
            expect(msg.sessionId).toBeDefined();
            expect(msg.sessionId).toHaveLength(8);
            expect(msg.playerId).toBe(ws.id);
            expect(msg.creatorId).toBeDefined();
        });
    });

    describe('join_session', () => {
        it('should join an existing session', () => {
            const ws1 = createMockWs();
            const ws2 = createMockWs();

            handleMessage(ws1, { type: 'create_session', username: 'Alice', avatarId: 1 });
            const sessionId = ws1.getLastMessage().sessionId;

            ws1.clearMessages();
            handleMessage(ws2, { type: 'join_session', sessionId, username: 'Bob', avatarId: 2 });

            const msg = ws2.getLastMessage();
            expect(msg.type).toBe('session_joined');
            expect(msg.sessionId).toBe(sessionId);
            expect(msg.players).toHaveLength(2);
        });

        it('should return error for invalid session', () => {
            const ws = createMockWs();
            handleMessage(ws, { type: 'join_session', sessionId: 'INVALID1' });

            expect(ws.getLastMessage().type).toBe('error');
        });

        it('should return error when session is full', () => {
            const players = createMockWsGroup(5);
            handleMessage(players[0], { type: 'create_session', username: 'P1', avatarId: 1 });
            const sessionId = players[0].getLastMessage().sessionId;

            handleMessage(players[1], { type: 'join_session', sessionId, username: 'P2', avatarId: 2 });
            handleMessage(players[2], { type: 'join_session', sessionId, username: 'P3', avatarId: 3 });
            handleMessage(players[3], { type: 'join_session', sessionId, username: 'P4', avatarId: 4 });

            // 5th player should fail
            handleMessage(players[4], { type: 'join_session', sessionId, username: 'P5', avatarId: 5 });
            expect(players[4].getLastMessage().type).toBe('error');
        });

        it('should join as spectator during active game', () => {
            const [ws1, ws2, ws3] = createMockWsGroup(3);
            handleMessage(ws1, { type: 'create_session', username: 'Alice', avatarId: 1 });
            const sessionId = ws1.getLastMessage().sessionId;

            handleMessage(ws2, { type: 'join_session', sessionId, username: 'Bob', avatarId: 2 });

            // Start a game
            handleMessage(ws1, {
                type: 'select_game',
                gameType: 'shifumi',
                winRounds: null,
            });

            // ws3 joins during game
            ws3.clearMessages();
            handleMessage(ws3, { type: 'join_session', sessionId, username: 'Carol', avatarId: 3 });

            const msg = ws3.getLastMessage();
            expect(msg.type).toBe('session_joined');
            expect(msg.isSpectator).toBeTruthy();
            expect(msg.gameInProgress).toBeTruthy();
        });
    });

    describe('select_game', () => {
        it('should start a game when creator selects', () => {
            const [ws1, ws2] = createMockWsGroup(2);
            handleMessage(ws1, { type: 'create_session', username: 'Alice', avatarId: 1 });
            const sessionId = ws1.getLastMessage().sessionId;
            handleMessage(ws2, { type: 'join_session', sessionId, username: 'Bob', avatarId: 2 });

            ws1.clearMessages();
            ws2.clearMessages();
            handleMessage(ws1, {
                type: 'select_game',
                gameType: 'shifumi',
                winRounds: null,
            });

            const msg1 = ws1.getLastMessage();
            expect(msg1.type).toBe('game_start');
            expect(msg1.gameType).toBe('shifumi');
        });

        it('should reject if non-creator tries to select', () => {
            const [ws1, ws2] = createMockWsGroup(2);
            handleMessage(ws1, { type: 'create_session', username: 'Alice', avatarId: 1 });
            const sessionId = ws1.getLastMessage().sessionId;
            handleMessage(ws2, { type: 'join_session', sessionId, username: 'Bob', avatarId: 2 });

            ws2.clearMessages();
            handleMessage(ws2, {
                type: 'select_game',
                gameType: 'shifumi',
            });

            expect(ws2.getLastMessage().type).toBe('error');
        });

        it('should reject 2-player game with 3+ players', () => {
            const [ws1, ws2, ws3] = createMockWsGroup(3);
            handleMessage(ws1, { type: 'create_session', username: 'Alice', avatarId: 1 });
            const sessionId = ws1.getLastMessage().sessionId;
            handleMessage(ws2, { type: 'join_session', sessionId, username: 'Bob', avatarId: 2 });
            handleMessage(ws3, { type: 'join_session', sessionId, username: 'Carol', avatarId: 3 });

            ws1.clearMessages();
            handleMessage(ws1, {
                type: 'select_game',
                gameType: 'morpion', // 2-player only
            });

            expect(ws1.getLastMessage().type).toBe('error');
        });

        it('should allow multiplayer game with 3+ players', () => {
            const [ws1, ws2, ws3] = createMockWsGroup(3);
            handleMessage(ws1, { type: 'create_session', username: 'Alice', avatarId: 1 });
            const sessionId = ws1.getLastMessage().sessionId;
            handleMessage(ws2, { type: 'join_session', sessionId, username: 'Bob', avatarId: 2 });
            handleMessage(ws3, { type: 'join_session', sessionId, username: 'Carol', avatarId: 3 });

            ws1.clearMessages();
            ws2.clearMessages();
            ws3.clearMessages();
            handleMessage(ws1, {
                type: 'select_game',
                gameType: 'uno',
            });

            const msg = ws1.getLastMessage();
            expect(msg.type).toBe('game_start');
            expect(msg.gameType).toBe('uno');
        });

        it('should reject unknown game type', () => {
            const [ws1, ws2] = createMockWsGroup(2);
            handleMessage(ws1, { type: 'create_session', username: 'Alice', avatarId: 1 });
            const sessionId = ws1.getLastMessage().sessionId;
            handleMessage(ws2, { type: 'join_session', sessionId, username: 'Bob', avatarId: 2 });

            ws1.clearMessages();
            handleMessage(ws1, {
                type: 'select_game',
                gameType: 'unknown_game',
            });

            expect(ws1.getLastMessage().type).toBe('error');
        });

        it('should reject if only 1 player', () => {
            const ws1 = createMockWs();
            handleMessage(ws1, { type: 'create_session', username: 'Alice', avatarId: 1 });

            ws1.clearMessages();
            handleMessage(ws1, {
                type: 'select_game',
                gameType: 'shifumi',
            });

            expect(ws1.getLastMessage().type).toBe('error');
        });

        it('should start snake game with auto-start', () => {
            const [ws1, ws2] = createMockWsGroup(2);
            handleMessage(ws1, { type: 'create_session', username: 'Alice', avatarId: 1 });
            const sessionId = ws1.getLastMessage().sessionId;
            handleMessage(ws2, { type: 'join_session', sessionId, username: 'Bob', avatarId: 2 });

            ws1.clearMessages();
            ws2.clearMessages();
            handleMessage(ws1, {
                type: 'select_game',
                gameType: 'snake',
                snakeGameMode: 'survivor',
            });

            // Snake sends player_joined first
            const msg = ws1.getLastMessage();
            expect(msg.type).toBe('player_joined');

            // After 500ms, game auto-starts
            vi.advanceTimersByTime(500);
            const startMsg = ws1.getMessages().find(m => m.type === 'game_starting');
            expect(startMsg).toBeDefined();
        });
    });

    describe('make_move', () => {
        it('should delegate move to the game', () => {
            const [ws1, ws2] = createMockWsGroup(2);
            handleMessage(ws1, { type: 'create_session', username: 'Alice', avatarId: 1 });
            const sessionId = ws1.getLastMessage().sessionId;
            handleMessage(ws2, { type: 'join_session', sessionId, username: 'Bob', avatarId: 2 });
            handleMessage(ws1, { type: 'select_game', gameType: 'shifumi' });

            ws1.clearMessages();
            ws2.clearMessages();
            handleMessage(ws1, { type: 'make_move', move: 'rock' });

            expect(ws2.getLastMessage().type).toBe('opponent_moved');
        });
    });

    describe('chat_message', () => {
        it('should broadcast chat message to all game players', () => {
            const [ws1, ws2] = createMockWsGroup(2);

            // Use legacy flow for simpler setup
            handleMessage(ws1, { type: 'create_game', gameType: 'shifumi', username: 'Alice', avatarId: 1 });
            const gameId = ws1.getLastMessage().gameId;

            handleMessage(ws2, { type: 'join_game', gameId, username: 'Bob', avatarId: 2 });
            ws1.clearMessages();
            ws2.clearMessages();

            handleMessage(ws1, { type: 'chat_message', message: 'Hello!' });

            const msg1 = ws1.getLastMessage();
            expect(msg1.type).toBe('chat_message');
            expect(msg1.message).toBe('Hello!');
            expect(msg1.senderUsername).toBe('Alice');

            expect(ws2.getLastMessage().type).toBe('chat_message');
        });
    });

    describe('send_emote', () => {
        it('should broadcast emote to all game players', () => {
            const [ws1, ws2] = createMockWsGroup(2);

            handleMessage(ws1, { type: 'create_game', gameType: 'shifumi', username: 'Alice', avatarId: 1 });
            const gameId = ws1.getLastMessage().gameId;
            handleMessage(ws2, { type: 'join_game', gameId, username: 'Bob', avatarId: 2 });
            ws1.clearMessages();
            ws2.clearMessages();

            handleMessage(ws1, { type: 'send_emote', emote: '😊' });

            const msg = ws1.getLastMessage();
            expect(msg.type).toBe('emote_received');
            expect(msg.emote).toBe('😊');
            expect(msg.senderId).toBe(ws1.id);
        });
    });

    describe('handleDisconnect', () => {
        it('should clean up session when last player disconnects', () => {
            const ws1 = createMockWs();
            handleMessage(ws1, { type: 'create_session', username: 'Alice', avatarId: 1 });
            const sessionId = ws1.getLastMessage().sessionId;

            handleDisconnect(ws1);

            // Trying to join should fail (session deleted)
            const ws2 = createMockWs();
            handleMessage(ws2, { type: 'join_session', sessionId });
            expect(ws2.getLastMessage().type).toBe('error');
        });

        it('should notify remaining players in session', () => {
            const [ws1, ws2] = createMockWsGroup(2);
            handleMessage(ws1, { type: 'create_session', username: 'Alice', avatarId: 1 });
            const sessionId = ws1.getLastMessage().sessionId;
            handleMessage(ws2, { type: 'join_session', sessionId, username: 'Bob', avatarId: 2 });

            ws2.clearMessages();
            handleDisconnect(ws1);

            const msg = ws2.getLastMessage();
            expect(msg.type).toBe('session_player_left');
        });

        it('should clean up legacy game on disconnect', () => {
            const [ws1, ws2] = createMockWsGroup(2);
            handleMessage(ws1, { type: 'create_game', gameType: 'shifumi', username: 'Alice', avatarId: 1 });
            const gameId = ws1.getLastMessage().gameId;
            handleMessage(ws2, { type: 'join_game', gameId, username: 'Bob', avatarId: 2 });

            ws2.clearMessages();
            handleDisconnect(ws1);

            const msg = ws2.getLastMessage();
            expect(msg.type).toBe('opponent_disconnected');
        });
    });

    describe('legacy game handlers', () => {
        it('should create a game via create_game', () => {
            const ws = createMockWs();
            handleMessage(ws, {
                type: 'create_game',
                gameType: 'morpion',
                username: 'Alice',
                avatarId: 1,
                winRounds: 3,
            });

            const msg = ws.getLastMessage();
            expect(msg.type).toBe('game_created');
            expect(msg.gameId).toBeDefined();
            expect(msg.gameType).toBe('morpion');
        });

        it('should join a game via join_game', () => {
            const [ws1, ws2] = createMockWsGroup(2);
            handleMessage(ws1, { type: 'create_game', gameType: 'shifumi', username: 'Alice', avatarId: 1 });
            const gameId = ws1.getLastMessage().gameId;

            handleMessage(ws2, { type: 'join_game', gameId, username: 'Bob', avatarId: 2 });

            // game_start should be sent to both for 2-player games
            const msg = ws1.getLastMessage();
            expect(msg.type).toBe('game_start');
        });

        it('should return error for invalid game ID', () => {
            const ws = createMockWs();
            handleMessage(ws, { type: 'join_game', gameId: 'INVALID1' });
            expect(ws.getLastMessage().type).toBe('error');
        });
    });

    describe('play_again', () => {
        it('should handle play_again via legacy flow', () => {
            const [ws1, ws2] = createMockWsGroup(2);
            handleMessage(ws1, { type: 'create_game', gameType: 'shifumi', username: 'Alice', avatarId: 1 });
            const gameId = ws1.getLastMessage().gameId;
            handleMessage(ws2, { type: 'join_game', gameId, username: 'Bob', avatarId: 2 });

            // Play a round
            handleMessage(ws1, { type: 'make_move', move: 'rock' });
            handleMessage(ws2, { type: 'make_move', move: 'scissors' });

            ws1.clearMessages();
            ws2.clearMessages();

            handleMessage(ws1, { type: 'play_again' });
            expect(ws2.getLastMessage().type).toBe('opponent_wants_replay');
        });
    });
});
