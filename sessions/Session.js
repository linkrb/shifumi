const { safeSend } = require('../utils/wsUtils');

class Session {
    constructor(sessionId, creator, options = {}) {
        this.id = sessionId;
        this.creatorId = creator.id;
        this.players = [creator];
        this.spectators = []; // Players who joined during a game
        this.usernames = { [creator.id]: options.username || 'Joueur 1' };
        this.avatars = { [creator.id]: options.avatarId };
        this.currentGame = null;
        this.status = 'waiting'; // waiting | choosing | in_game
        this.wantsToLobby = new Set();
        this.maxPlayersCount = 4; // Always 4, can join anytime
    }

    get maxPlayers() {
        return this.maxPlayersCount;
    }

    canJoin() {
        // Can join if not full (players + spectators)
        return (this.players.length + this.spectators.length) < this.maxPlayers;
    }

    isGameInProgress() {
        return this.status === 'in_game' && this.currentGame;
    }

    addPlayer(ws, options = {}) {
        this.players.push(ws);
        this.usernames[ws.id] = options.username || `Joueur ${this.players.length}`;
        this.avatars[ws.id] = options.avatarId;
        ws.sessionId = this.id;
    }

    addSpectator(ws, options = {}) {
        this.spectators.push(ws);
        this.usernames[ws.id] = options.username || `Spectateur ${this.spectators.length}`;
        this.avatars[ws.id] = options.avatarId;
        ws.sessionId = this.id;
    }

    promoteSpectators() {
        // Move all spectators to players (called when game ends)
        this.spectators.forEach(spec => {
            this.players.push(spec);
        });
        this.spectators = [];
    }

    removePlayer(ws) {
        this.players = this.players.filter(p => p.id !== ws.id);
        this.spectators = this.spectators.filter(p => p.id !== ws.id);
        delete this.usernames[ws.id];
        delete this.avatars[ws.id];
    }

    getPlayersInfo() {
        const players = this.players.map(p => ({
            id: p.id,
            username: this.usernames[p.id],
            avatar: this.avatars[p.id],
            isCreator: p.id === this.creatorId,
            isSpectator: false
        }));
        const spectators = this.spectators.map(p => ({
            id: p.id,
            username: this.usernames[p.id],
            avatar: this.avatars[p.id],
            isCreator: false,
            isSpectator: true
        }));
        return [...players, ...spectators];
    }

    getAllConnections() {
        return [...this.players, ...this.spectators];
    }

    broadcast(data) {
        // Send to all players and spectators
        this.getAllConnections().forEach(conn => {
            safeSend(conn, data);
        });
    }

    broadcastToPlayers(data) {
        // Send only to active players (not spectators)
        this.players.forEach(player => {
            safeSend(player, data);
        });
    }

    sendTo(ws, data) {
        safeSend(ws, data);
    }

    setGame(game) {
        this.currentGame = game;
        this.status = 'in_game';
    }

    clearGame() {
        this.currentGame = null;
        this.status = 'choosing';
        this.wantsToLobby.clear();
        // Promote spectators to players for the next game
        this.promoteSpectators();
    }

    requestBackToLobby(ws) {
        this.wantsToLobby.add(ws.id);

        // Notify other players
        this.players.forEach(player => {
            if (player.id !== ws.id) {
                this.sendTo(player, {
                    type: 'player_wants_lobby',
                    playerId: ws.id,
                    username: this.usernames[ws.id],
                    readyCount: this.wantsToLobby.size,
                    totalPlayers: this.players.length
                });
            }
        });

        // Check if all players want to go back
        if (this.wantsToLobby.size === this.players.length) {
            this.clearGame();
            this.broadcast({
                type: 'lobby_ready',
                players: this.getPlayersInfo(),
                creatorId: this.creatorId,
                maxPlayers: this.maxPlayers
            });
            return true;
        }
        return false;
    }

    onPlayerDisconnect(ws) {
        const disconnectedUsername = this.usernames[ws.id];
        const wasCreator = ws.id === this.creatorId;
        this.removePlayer(ws);

        // Transfer creator role if the creator left
        if (wasCreator && this.players.length > 0) {
            this.creatorId = this.players[0].id;
        } else if (wasCreator && this.players.length === 0 && this.spectators.length > 0) {
            // Promote first spectator to player and creator
            const newCreator = this.spectators.shift();
            this.players.push(newCreator);
            this.creatorId = newCreator.id;
        }

        // Notify remaining players and spectators
        this.getAllConnections().forEach(conn => {
            this.sendTo(conn, {
                type: 'session_player_left',
                playerId: ws.id,
                username: disconnectedUsername,
                players: this.getPlayersInfo(),
                creatorId: this.creatorId
            });
        });

        return this.players.length === 0 && this.spectators.length === 0;
    }
}

module.exports = Session;
