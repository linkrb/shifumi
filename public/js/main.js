import { state, updateState, resetGameState } from './state.js';
import { showView, setStatus, showMessage, updateGameAvatars, updateUsernames, updateGameModeUI } from './ui/views.js';
import { initChat, handleChatMessage, handleEmoteReceived } from './ui/chat.js';
import { initLobby, setupLobby, updateSnakeLobby } from './ui/lobby.js';
import { initResults, showResult, showGameWinner, resetRoundUI, handleOpponentWantsReplay } from './ui/results.js';

import { ShifumiGame } from './games/ShifumiGame.js';
import { MorpionGame } from './games/MorpionGame.js';
import { Puissance4Game } from './games/Puissance4Game.js';
import { ChessGame } from './games/ChessGame.js';
import { SnakeGame } from './games/SnakeGame.js';

// Game instances
const games = {
    shifumi: new ShifumiGame(),
    morpion: new MorpionGame(),
    puissance4: new Puissance4Game(),
    chess: new ChessGame(),
    snake: new SnakeGame()
};

let currentGame = null;

// WebSocket setup
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${window.location.host}`);
updateState({ socket });

socket.onopen = () => {
    console.log('Connected to server');
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'game' && pathParts[2]) {
        document.getElementById('join-input').dataset.pendingJoin = pathParts[2];
        showView('avatarSelection');
    }
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received:', data);
    handleMessage(data);
};

function handleMessage(data) {
    switch (data.type) {
        case 'game_created':
            updateState({
                gameId: data.gameId,
                playerId: data.playerId,
                currentGameType: data.gameType
            });

            if (data.gameType === 'snake') {
                updateState({
                    isGameCreator: true,
                    snakePlayers: {
                        [data.playerId]: {
                            username: document.getElementById('username-input').value.trim() || 'Joueur 1',
                            avatar: state.selectedAvatar
                        }
                    }
                });
            }

            setupLobby(data.gameType);
            break;

        case 'game_start':
            handleGameStart(data);
            break;

        case 'player_joined':
            handlePlayerJoined(data);
            break;

        case 'player_left':
            handlePlayerLeft(data);
            break;

        case 'game_starting':
            games.snake.onGameStarting(data);
            break;

        case 'game_started':
            games.snake.onGameStarted();
            break;

        case 'chat_message':
            handleChatMessage(data);
            break;

        case 'emote_received':
            handleEmoteReceived(data);
            break;

        case 'opponent_moved':
            if (currentGame) currentGame.onUpdate(data);
            break;

        case 'morpion_update':
            games.morpion.onUpdate(data);
            break;

        case 'puissance4_update':
            games.puissance4.onUpdate(data);
            break;

        case 'chess_update':
            games.chess.onUpdate(data);
            break;

        case 'snake_update':
            games.snake.onUpdate(data);
            break;

        case 'snake_death':
            games.snake.onSnakeDeath(data);
            break;

        case 'round_result':
            if (currentGame) currentGame.onRoundResult(data);
            showResult(data);
            break;

        case 'game_won':
            showGameWinner(data);
            break;

        case 'game_over':
            games.snake.onGameOver(data);
            break;

        case 'new_round':
            if (currentGame) currentGame.onNewRound(data);
            resetRoundUI();
            break;

        case 'opponent_wants_replay':
            handleOpponentWantsReplay();
            break;

        case 'opponent_disconnected':
            showMessage("Oups !", "L'adversaire s'est déconnecté.", () => location.href = '/');
            break;

        case 'error':
            showMessage("Erreur", data.message, () => location.href = '/');
            break;
    }
}

function handleGameStart(data) {
    updateState({
        gameId: data.gameId,
        playerId: data.playerId || state.playerId,
        currentGameType: data.gameType,
        gameWinRounds: data.winRounds,
        isMyTurn: data.turn === state.playerId,
        myAvatar: data.avatars[state.playerId],
        opAvatar: data.avatars[data.opponentId]
    });

    updateGameModeUI(data.winRounds);
    setupGameUI(data.gameType);
    updateGameAvatars();
    updateUsernames(data.usernames, data.opponentId);
    showView('game');

    currentGame = games[data.gameType];
    if (currentGame) {
        currentGame.onGameStart(data);
    }
}

function handlePlayerJoined(data) {
    const players = {};
    data.players.forEach(p => {
        players[p.id] = { username: p.username, avatar: p.avatar };
    });

    updateState({
        gameId: data.gameId,
        playerId: data.playerId,
        isGameCreator: data.creatorId === data.playerId,
        snakeMaxPlayers: data.maxPlayers,
        snakeGameMode: data.snakeGameMode,
        currentGameType: 'snake',
        snakePlayers: players
    });

    setupLobby('snake');
    updateSnakeLobby();
}

function handlePlayerLeft(data) {
    const players = {};
    data.players.forEach(p => {
        players[p.id] = { username: p.username, avatar: p.avatar };
    });
    updateState({ snakePlayers: players });
    updateSnakeLobby();
}

function setupGameUI(gameType) {
    // Hide all game areas
    Object.values(games).forEach(game => game.hide());

    // Show standard scoreboard for non-snake games
    const scoreBoard = document.querySelector('.score-board');
    if (scoreBoard) {
        scoreBoard.style.display = gameType === 'snake' ? 'none' : 'flex';
    }

    // Show the current game
    currentGame = games[gameType];
    if (currentGame) {
        currentGame.show();
    }
}

// UI Event Handlers
function initUI() {
    // Create game button
    document.getElementById('create-btn').addEventListener('click', () => {
        updateState({ isCreatingGame: true });
        document.getElementById('win-rounds-section').style.display = 'block';
        showView('avatarSelection');
    });

    // Join game button
    document.getElementById('join-btn').addEventListener('click', () => {
        const input = document.getElementById('join-input').value;
        if (input) {
            updateState({ isCreatingGame: false });
            document.getElementById('win-rounds-section').style.display = 'none';
            document.getElementById('join-input').dataset.pendingJoin = input;
            showView('avatarSelection');
        }
    });

    // Avatar selection
    document.querySelectorAll('.avatar-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            updateState({ selectedAvatar: opt.dataset.id });
        });
    });

    // Win rounds selection
    document.querySelectorAll('.win-round-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.win-round-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            const rounds = opt.dataset.rounds;
            updateState({ selectedWinRounds: rounds === 'null' ? null : parseInt(rounds) });
        });
    });

    // Random avatar / proceed button
    document.getElementById('random-avatar-btn').addEventListener('click', () => {
        if (!state.selectedAvatar) {
            updateState({ selectedAvatar: Math.floor(Math.random() * 8) + 1 });
        }
        proceedToGameSelection();
    });

    // Game type selection
    document.querySelectorAll('.game-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.game-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            updateState({ currentGameType: opt.dataset.game });

            const snakeOptions = document.getElementById('snake-options');
            const winRoundsSection = document.getElementById('win-rounds-section');

            if (snakeOptions) {
                snakeOptions.style.display = state.currentGameType === 'snake' ? 'block' : 'none';
            }
            if (winRoundsSection) {
                winRoundsSection.style.display = state.currentGameType === 'snake' ? 'none' : 'block';
            }
        });
    });

    // Snake player count
    document.querySelectorAll('.player-count-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.player-count-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            updateState({ snakeMaxPlayers: parseInt(opt.dataset.count) });
        });
    });

    // Snake game mode
    document.querySelectorAll('.snake-mode-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.snake-mode-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            updateState({ snakeGameMode: opt.dataset.mode });
        });
    });

    // Start game button
    document.getElementById('start-game-btn').addEventListener('click', () => {
        createGame(state.currentGameType || 'shifumi');
    });
}

function proceedToGameSelection() {
    const pendingJoin = document.getElementById('join-input').dataset.pendingJoin;

    if (pendingJoin) {
        let id = pendingJoin;
        if (pendingJoin.includes('/game/')) {
            id = pendingJoin.split('/game/')[1];
        }
        if (id) joinGame(id);
    } else {
        if (!state.currentGameType) updateState({ currentGameType: 'shifumi' });
        document.querySelectorAll('.game-option').forEach(o => o.classList.remove('selected'));
        const selected = document.querySelector(`.game-option[data-game="${state.currentGameType}"]`);
        if (selected) selected.classList.add('selected');
        showView('gameSelection');
    }
}

function createGame(gameType) {
    const username = document.getElementById('username-input').value.trim() || 'Joueur 1';
    const payload = {
        type: 'create_game',
        avatarId: state.selectedAvatar,
        username: username,
        winRounds: state.selectedWinRounds,
        gameType: gameType
    };

    if (gameType === 'snake') {
        payload.maxPlayers = state.snakeMaxPlayers;
        payload.snakeGameMode = state.snakeGameMode;
    }

    socket.send(JSON.stringify(payload));
}

function joinGame(id) {
    const username = document.getElementById('username-input').value.trim() || 'Joueur 2';
    socket.send(JSON.stringify({
        type: 'join_game',
        gameId: id,
        avatarId: state.selectedAvatar || (Math.floor(Math.random() * 8) + 1),
        username: username
    }));
}

// Initialize everything
initUI();
initChat();
initLobby();
initResults();
