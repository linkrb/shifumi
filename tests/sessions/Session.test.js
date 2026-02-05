import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Session = require('../../sessions/Session');
const { createMockWs, createMockWsGroup } = require('../helpers/mockWs');

describe('Session', () => {
    let ws1, session;

    beforeEach(() => {
        ws1 = createMockWs();
        session = new Session('TEST1234', ws1, { username: 'Alice', avatarId: 1 });
    });

    describe('constructor', () => {
        it('should create session with creator as first player', () => {
            expect(session.id).toBe('TEST1234');
            expect(session.players).toHaveLength(1);
            expect(session.players[0].id).toBe(ws1.id);
            expect(session.creatorId).toBe(ws1.id);
            expect(session.usernames[ws1.id]).toBe('Alice');
            expect(session.avatars[ws1.id]).toBe(1);
        });

        it('should start in waiting status', () => {
            expect(session.status).toBe('waiting');
        });

        it('should have no current game', () => {
            expect(session.currentGame).toBeNull();
        });

        it('should have max 4 players', () => {
            expect(session.maxPlayers).toBe(4);
        });
    });

    describe('canJoin', () => {
        it('should allow joining when not full', () => {
            expect(session.canJoin()).toBe(true);
        });

        it('should count players and spectators', () => {
            const players = createMockWsGroup(3);
            session.addPlayer(players[0], { username: 'B' });
            session.addPlayer(players[1], { username: 'C' });
            session.addPlayer(players[2], { username: 'D' });
            expect(session.canJoin()).toBe(false);
        });

        it('should deny when session is full with spectators', () => {
            const players = createMockWsGroup(3);
            session.addPlayer(players[0], { username: 'B' });
            session.addSpectator(players[1], { username: 'Spec1' });
            session.addSpectator(players[2], { username: 'Spec2' });
            expect(session.canJoin()).toBe(false);
        });
    });

    describe('addPlayer', () => {
        it('should add a player', () => {
            const ws2 = createMockWs();
            session.addPlayer(ws2, { username: 'Bob', avatarId: 2 });

            expect(session.players).toHaveLength(2);
            expect(session.usernames[ws2.id]).toBe('Bob');
            expect(ws2.sessionId).toBe('TEST1234');
        });

        it('should default username based on player count', () => {
            const ws2 = createMockWs();
            session.addPlayer(ws2, {});
            expect(session.usernames[ws2.id]).toBe('Joueur 2');
        });
    });

    describe('addSpectator', () => {
        it('should add a spectator', () => {
            const ws2 = createMockWs();
            session.addSpectator(ws2, { username: 'Spectator', avatarId: 3 });

            expect(session.spectators).toHaveLength(1);
            expect(session.usernames[ws2.id]).toBe('Spectator');
            expect(ws2.sessionId).toBe('TEST1234');
        });
    });

    describe('promoteSpectators', () => {
        it('should move all spectators to players', () => {
            const [ws2, ws3] = createMockWsGroup(2);
            session.addSpectator(ws2, { username: 'Spec1' });
            session.addSpectator(ws3, { username: 'Spec2' });

            session.promoteSpectators();

            expect(session.spectators).toHaveLength(0);
            expect(session.players).toHaveLength(3); // creator + 2 former spectators
        });
    });

    describe('removePlayer', () => {
        it('should remove from players', () => {
            const ws2 = createMockWs();
            session.addPlayer(ws2, { username: 'Bob' });
            session.removePlayer(ws2);

            expect(session.players).toHaveLength(1);
            expect(session.usernames[ws2.id]).toBeUndefined();
        });

        it('should remove from spectators', () => {
            const ws2 = createMockWs();
            session.addSpectator(ws2, { username: 'Spec' });
            session.removePlayer(ws2);

            expect(session.spectators).toHaveLength(0);
        });
    });

    describe('isGameInProgress', () => {
        it('should return false when no game', () => {
            expect(session.isGameInProgress()).toBe(false);
        });

        it('should return true when game is in progress', () => {
            session.setGame({ id: 'game-1' });
            expect(session.isGameInProgress()).toBeTruthy();
        });
    });

    describe('getPlayersInfo', () => {
        it('should return info for all players and spectators', () => {
            const ws2 = createMockWs();
            const ws3 = createMockWs();
            session.addPlayer(ws2, { username: 'Bob', avatarId: 2 });
            session.addSpectator(ws3, { username: 'Spec', avatarId: 3 });

            const info = session.getPlayersInfo();
            expect(info).toHaveLength(3);

            const creator = info.find(p => p.id === ws1.id);
            expect(creator.isCreator).toBe(true);
            expect(creator.isSpectator).toBe(false);

            const spectator = info.find(p => p.id === ws3.id);
            expect(spectator.isSpectator).toBe(true);
            expect(spectator.isCreator).toBe(false);
        });
    });

    describe('broadcast', () => {
        it('should send to players and spectators', () => {
            const ws2 = createMockWs();
            const ws3 = createMockWs();
            session.addPlayer(ws2, { username: 'Bob' });
            session.addSpectator(ws3, { username: 'Spec' });

            session.broadcast({ type: 'test' });

            expect(ws1.getLastMessage().type).toBe('test');
            expect(ws2.getLastMessage().type).toBe('test');
            expect(ws3.getLastMessage().type).toBe('test');
        });
    });

    describe('broadcastToPlayers', () => {
        it('should send only to active players', () => {
            const ws2 = createMockWs();
            const ws3 = createMockWs();
            session.addPlayer(ws2, { username: 'Bob' });
            session.addSpectator(ws3, { username: 'Spec' });

            session.broadcastToPlayers({ type: 'players_only' });

            expect(ws1.getLastMessage().type).toBe('players_only');
            expect(ws2.getLastMessage().type).toBe('players_only');
            expect(ws3.getMessages()).toHaveLength(0);
        });
    });

    describe('setGame / clearGame', () => {
        it('should set game and transition to in_game', () => {
            const mockGame = { id: 'game-1' };
            session.setGame(mockGame);

            expect(session.currentGame).toBe(mockGame);
            expect(session.status).toBe('in_game');
        });

        it('should clear game and transition to choosing', () => {
            const ws2 = createMockWs();
            session.addSpectator(ws2, { username: 'Spec' });
            session.setGame({ id: 'game-1' });

            session.clearGame();

            expect(session.currentGame).toBeNull();
            expect(session.status).toBe('choosing');
            // Spectators should be promoted
            expect(session.spectators).toHaveLength(0);
            expect(session.players).toHaveLength(2);
        });
    });

    describe('requestBackToLobby', () => {
        it('should notify other players', () => {
            const ws2 = createMockWs();
            session.addPlayer(ws2, { username: 'Bob' });

            session.requestBackToLobby(ws1);

            const msg = ws2.getLastMessage();
            expect(msg.type).toBe('player_wants_lobby');
            expect(msg.playerId).toBe(ws1.id);
            expect(msg.readyCount).toBe(1);
            expect(msg.totalPlayers).toBe(2);
        });

        it('should return to lobby when all players agree', () => {
            const ws2 = createMockWs();
            session.addPlayer(ws2, { username: 'Bob' });
            session.setGame({ id: 'game-1' });

            session.requestBackToLobby(ws1);
            const result = session.requestBackToLobby(ws2);

            expect(result).toBe(true);
            expect(session.status).toBe('choosing');
            expect(session.currentGame).toBeNull();

            const msg = ws1.getMessages().find(m => m.type === 'lobby_ready');
            expect(msg).toBeDefined();
        });

        it('should not return to lobby if not all agree', () => {
            const ws2 = createMockWs();
            session.addPlayer(ws2, { username: 'Bob' });
            session.setGame({ id: 'game-1' });

            const result = session.requestBackToLobby(ws1);
            expect(result).toBe(false);
            expect(session.status).toBe('in_game');
        });
    });

    describe('onPlayerDisconnect', () => {
        it('should remove disconnected player', () => {
            const ws2 = createMockWs();
            session.addPlayer(ws2, { username: 'Bob' });
            session.onPlayerDisconnect(ws2);

            expect(session.players).toHaveLength(1);
        });

        it('should transfer creator role when creator leaves', () => {
            const ws2 = createMockWs();
            session.addPlayer(ws2, { username: 'Bob' });

            session.onPlayerDisconnect(ws1);

            expect(session.creatorId).toBe(ws2.id);
        });

        it('should promote spectator to creator when creator leaves and no players', () => {
            const ws2 = createMockWs();
            session.addSpectator(ws2, { username: 'Spec' });

            session.onPlayerDisconnect(ws1);

            expect(session.creatorId).toBe(ws2.id);
            expect(session.players).toHaveLength(1);
            expect(session.players[0].id).toBe(ws2.id);
            expect(session.spectators).toHaveLength(0);
        });

        it('should notify remaining connections', () => {
            const ws2 = createMockWs();
            session.addPlayer(ws2, { username: 'Bob' });

            session.onPlayerDisconnect(ws1);

            const msg = ws2.getLastMessage();
            expect(msg.type).toBe('session_player_left');
            expect(msg.playerId).toBe(ws1.id);
            expect(msg.creatorId).toBe(ws2.id);
        });

        it('should return true when session is empty', () => {
            const result = session.onPlayerDisconnect(ws1);
            expect(result).toBe(true);
        });

        it('should return false when players remain', () => {
            const ws2 = createMockWs();
            session.addPlayer(ws2, { username: 'Bob' });
            const result = session.onPlayerDisconnect(ws1);
            expect(result).toBe(false);
        });
    });

    describe('state transitions', () => {
        it('should follow waiting → choosing → in_game flow', () => {
            expect(session.status).toBe('waiting');

            // Simulate game selection clears to choosing
            session.status = 'choosing';
            expect(session.status).toBe('choosing');

            // Set game transitions to in_game
            session.setGame({ id: 'game-1' });
            expect(session.status).toBe('in_game');

            // Clear game returns to choosing
            session.clearGame();
            expect(session.status).toBe('choosing');
        });
    });
});
