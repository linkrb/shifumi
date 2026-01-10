const { safeSend } = require('../utils/wsUtils');

class Session {
    constructor(sessionId, creator, options = {}) {
        this.id = sessionId;
        this.creatorId = creator.id;
        this.players = [creator];
        this.usernames = { [creator.id]: options.username || 'Joueur 1' };
        this.avatars = { [creator.id]: options.avatarId };
        this.currentGame = null;
        this.status = 'waiting'; // waiting | choosing | in_game
        this.wantsToLobby = new Set();
        this.maxPlayersCount = Math.min(4, Math.max(2, options.maxPlayers || 2));
    }

    get maxPlayers() {
        return this.maxPlayersCount;
    }

    canJoin() {
        return this.players.length < this.maxPlayers && this.status === 'waiting';
    }

    addPlayer(ws, options = {}) {
        this.players.push(ws);
        this.usernames[ws.id] = options.username || `Joueur ${this.players.length}`;
        this.avatars[ws.id] = options.avatarId;
        ws.sessionId = this.id;
    }

    removePlayer(ws) {
        this.players = this.players.filter(p => p.id !== ws.id);
        delete this.usernames[ws.id];
        delete this.avatars[ws.id];
    }

    getPlayersInfo() {
        return this.players.map(p => ({
            id: p.id,
            username: this.usernames[p.id],
            avatar: this.avatars[p.id],
            isCreator: p.id === this.creatorId
        }));
    }

    broadcast(data) {
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
        this.removePlayer(ws);

        // Notify remaining players
        this.players.forEach(player => {
            this.sendTo(player, {
                type: 'session_player_left',
                playerId: ws.id,
                username: disconnectedUsername,
                players: this.getPlayersInfo()
            });
        });

        return this.players.length === 0;
    }
}

module.exports = Session;
