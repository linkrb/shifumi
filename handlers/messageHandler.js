const { v4: uuidv4 } = require('uuid');
const { safeSend } = require('../utils/wsUtils');

const ShifumiGame = require('../games/ShifumiGame');
const MorpionGame = require('../games/MorpionGame');
const Puissance4Game = require('../games/Puissance4Game');
const ChessGame = require('../games/ChessGame');
const SnakeGame = require('../games/SnakeGame');
const UnoGame = require('../games/UnoGame');
const Session = require('../sessions/Session');

const GAME_CLASSES = {
    shifumi: ShifumiGame,
    morpion: MorpionGame,
    puissance4: Puissance4Game,
    chess: ChessGame,
    snake: SnakeGame,
    uno: UnoGame
};

const MULTIPLAYER_GAMES = ['snake', 'uno'];

// Storage
const games = {};
const sessions = {};

function handleMessage(ws, data) {
    switch (data.type) {
        // Session handlers
        case 'create_session':
            createSession(ws, data);
            break;

        case 'join_session':
            joinSession(ws, data);
            break;

        case 'select_game':
            selectGame(ws, data);
            break;

        case 'back_to_lobby':
            backToLobby(ws);
            break;

        // Legacy game handlers (kept for backward compatibility)
        case 'create_game':
            createGame(ws, data);
            break;

        case 'join_game':
            joinGame(ws, data);
            break;

        case 'make_move':
            handleMove(ws, data);
            break;

        case 'change_direction':
            handleSnakeDirection(ws, data);
            break;

        case 'start_game':
            startSnakeGame(ws);
            break;

        case 'play_again':
            handlePlayAgain(ws);
            break;

        case 'chat_message':
            handleChat(ws, data);
            break;

        case 'send_emote':
            handleEmote(ws, data);
            break;
    }
}

// ================== SESSION HANDLERS ==================

function createSession(ws, data) {
    const sessionId = uuidv4().slice(0, 8).toUpperCase();

    const session = new Session(sessionId, ws, {
        avatarId: data.avatarId,
        username: data.username || 'Joueur 1'
    });

    sessions[sessionId] = session;
    ws.sessionId = sessionId;

    safeSend(ws, {
        type: 'session_created',
        sessionId: sessionId,
        playerId: ws.id,
        players: session.getPlayersInfo(),
        creatorId: session.creatorId,
        maxPlayers: session.maxPlayers
    });
}

function joinSession(ws, data) {
    const session = sessions[data.sessionId];

    if (!session) {
        safeSend(ws, { type: 'error', message: 'Session introuvable' });
        return;
    }

    if (!session.canJoin()) {
        safeSend(ws, { type: 'error', message: 'Session complète' });
        return;
    }

    const isSpectator = session.isGameInProgress();
    const playerCount = session.players.length + session.spectators.length;

    if (isSpectator) {
        // Game in progress - join as spectator
        session.addSpectator(ws, {
            avatarId: data.avatarId,
            username: data.username || `Spectateur ${session.spectators.length}`
        });
    } else {
        // No game in progress - join as player
        session.addPlayer(ws, {
            avatarId: data.avatarId,
            username: data.username || `Joueur ${playerCount + 1}`
        });
    }

    // Notify all players and spectators
    session.broadcast({
        type: 'session_joined',
        sessionId: session.id,
        playerId: ws.id,
        players: session.getPlayersInfo(),
        creatorId: session.creatorId,
        maxPlayers: session.maxPlayers,
        isSpectator: isSpectator,
        gameInProgress: isSpectator,
        currentGameType: session.currentGame ? session.currentGame.gameType : null
    });
}

function selectGame(ws, data) {
    const session = sessions[ws.sessionId];

    if (!session) {
        safeSend(ws, { type: 'error', message: 'Session introuvable' });
        return;
    }

    // Only creator can select game
    if (ws.id !== session.creatorId) {
        safeSend(ws, { type: 'error', message: 'Seul le créateur peut choisir le jeu' });
        return;
    }

    if (session.players.length < 2) {
        safeSend(ws, { type: 'error', message: 'En attente d\'un autre joueur' });
        return;
    }

    const gameType = data.gameType;
    const GameClass = GAME_CLASSES[gameType];

    if (!GameClass) {
        safeSend(ws, { type: 'error', message: 'Type de jeu inconnu' });
        return;
    }

    // Check player count compatibility
    const isMultiplayerGame = MULTIPLAYER_GAMES.includes(gameType);
    if (!isMultiplayerGame && session.players.length > 2) {
        safeSend(ws, { type: 'error', message: 'Ce jeu est limité à 2 joueurs.' });
        return;
    }

    // Create game within session
    const gameId = uuidv4().slice(0, 8).toUpperCase();
    const creatorWs = session.players.find(p => p.id === session.creatorId);

    const game = new GameClass(gameId, creatorWs, {
        avatarId: session.avatars[creatorWs.id],
        username: session.usernames[creatorWs.id],
        winRounds: data.winRounds,
        maxPlayers: data.maxPlayers,
        snakeGameMode: data.snakeGameMode,
        timerDuration: data.timerDuration
    });

    // Add other players to the game
    session.players.forEach(player => {
        if (player.id !== session.creatorId) {
            game.addPlayer(player, {
                avatarId: session.avatars[player.id],
                username: session.usernames[player.id]
            });
        }
        player.gameId = gameId;
    });

    games[gameId] = game;
    session.setGame(game);

    // Start the game
    if (gameType === 'snake') {
        // Snake has special multi-player lobby, handled separately
        session.players.forEach(player => {
            safeSend(player, {
                type: 'player_joined',
                gameId: gameId,
                playerId: player.id,
                newPlayerId: player.id,
                players: session.getPlayersInfo(),
                maxPlayers: game.maxPlayers,
                creatorId: session.creatorId,
                snakeGameMode: game.snakeGameMode,
                sessionId: session.id
            });
        });
        // Auto-start snake game
        setTimeout(() => game.startGame(), 500);
    } else if (gameType === 'uno') {
        // Uno has custom onGameStart with personalized hands
        game.onGameStart();
    } else {
        // Standard 2-player games - send game_start with all required data including turn
        session.players.forEach(player => {
            const opponent = session.players.find(p => p.id !== player.id);
            safeSend(player, {
                type: 'game_start',
                gameId: gameId,
                gameType: gameType,
                playerId: player.id,
                opponentId: opponent.id,
                avatars: session.avatars,
                usernames: session.usernames,
                winRounds: data.winRounds,
                turn: game.turn,
                sessionId: session.id
            });
        });
    }
}

function backToLobby(ws) {
    const session = sessions[ws.sessionId];
    if (!session) return;

    session.requestBackToLobby(ws);
}

// ================== LEGACY GAME HANDLERS ==================

function createGame(ws, data) {
    const gameId = uuidv4().slice(0, 8).toUpperCase();
    const gameType = data.gameType || 'shifumi';
    const GameClass = GAME_CLASSES[gameType];

    if (!GameClass) {
        safeSend(ws, { type: 'error', message: 'Type de jeu inconnu' });
        return;
    }

    let winRounds = parseInt(data.winRounds);
    if (winRounds !== 1 && winRounds !== 3) {
        winRounds = null;
    }

    const game = new GameClass(gameId, ws, {
        avatarId: data.avatarId,
        username: data.username || 'Joueur 1',
        winRounds: winRounds,
        maxPlayers: data.maxPlayers,
        snakeGameMode: data.snakeGameMode,
        timerDuration: data.timerDuration
    });

    games[gameId] = game;
    ws.gameId = gameId;

    safeSend(ws, {
        type: 'game_created',
        gameId: gameId,
        playerId: ws.id,
        gameType: gameType
    });
}

function joinGame(ws, data) {
    const game = games[data.gameId];

    if (!game) {
        safeSend(ws, { type: 'error', message: 'Partie introuvable' });
        return;
    }

    if (!game.canJoin()) {
        safeSend(ws, { type: 'error', message: 'Partie complète ou déjà commencée' });
        return;
    }

    game.addPlayer(ws, {
        avatarId: data.avatarId,
        username: data.username || `Joueur ${game.players.length + 1}`
    });
    ws.gameId = data.gameId;

    if (game.gameType !== 'snake' && game.players.length === 2) {
        game.onGameStart();
    }
}

function handleMove(ws, data) {
    const game = games[ws.gameId];
    if (game) {
        game.handleMove(ws, data);
    }
}

function handleSnakeDirection(ws, data) {
    const game = games[ws.gameId];
    if (game && game.gameType === 'snake') {
        game.changeDirection(ws.id, data.direction);
    }
}

function startSnakeGame(ws) {
    const game = games[ws.gameId];
    if (game && game.gameType === 'snake' && game.creatorId === ws.id) {
        game.startGame();
    }
}

function handlePlayAgain(ws) {
    const game = games[ws.gameId];
    if (game) {
        game.handlePlayAgain(ws);
    }
}

function handleChat(ws, data) {
    const game = games[ws.gameId];
    if (game) {
        const senderUsername = game.usernames[ws.id];
        game.broadcast({
            type: 'chat_message',
            senderId: ws.id,
            senderUsername: senderUsername,
            message: data.message
        });
    }
}

function handleEmote(ws, data) {
    const game = games[ws.gameId];
    if (game) {
        game.broadcast({
            type: 'emote_received',
            senderId: ws.id,
            emote: data.emote
        });
    }
}

function handleDisconnect(ws) {
    // Handle session disconnect
    if (ws.sessionId && sessions[ws.sessionId]) {
        const session = sessions[ws.sessionId];
        const shouldDelete = session.onPlayerDisconnect(ws);

        if (shouldDelete) {
            // Clean up session's current game if any
            if (session.currentGame && games[session.currentGame.id]) {
                if (session.currentGame.tickInterval) {
                    clearInterval(session.currentGame.tickInterval);
                }
                delete games[session.currentGame.id];
            }
            delete sessions[ws.sessionId];
        }
    }

    // Handle game disconnect (legacy or session game)
    if (ws.gameId && games[ws.gameId]) {
        const game = games[ws.gameId];
        const shouldDelete = game.onPlayerDisconnect(ws);

        if (shouldDelete || game.players.length === 0) {
            if (game.tickInterval) clearInterval(game.tickInterval);
            delete games[ws.gameId];
        }
    }
}

module.exports = { handleMessage, handleDisconnect };
