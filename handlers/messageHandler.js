const { v4: uuidv4 } = require('uuid');
const { safeSend } = require('../utils/wsUtils');

const ShifumiGame = require('../games/ShifumiGame');
const MorpionGame = require('../games/MorpionGame');
const Puissance4Game = require('../games/Puissance4Game');
const ChessGame = require('../games/ChessGame');
const SnakeGame = require('../games/SnakeGame');

const GAME_CLASSES = {
    shifumi: ShifumiGame,
    morpion: MorpionGame,
    puissance4: Puissance4Game,
    chess: ChessGame,
    snake: SnakeGame
};

// Game storage
const games = {};

function handleMessage(ws, data) {
    switch (data.type) {
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

function createGame(ws, data) {
    const gameId = uuidv4().slice(0, 8).toUpperCase();
    const gameType = data.gameType || 'shifumi';
    const GameClass = GAME_CLASSES[gameType];

    if (!GameClass) {
        safeSend(ws, { type: 'error', message: 'Type de jeu inconnu' });
        return;
    }

    // Validate winRounds
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

    // For non-snake games, start immediately when 2 players join
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
    if (ws.gameId && games[ws.gameId]) {
        const game = games[ws.gameId];
        const shouldDelete = game.onPlayerDisconnect(ws);

        // Clean up empty games
        if (shouldDelete || game.players.length === 0) {
            if (game.tickInterval) clearInterval(game.tickInterval);
            delete games[ws.gameId];
        }
    }
}

module.exports = { handleMessage, handleDisconnect };
