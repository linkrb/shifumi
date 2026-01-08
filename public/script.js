const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${window.location.host}`);

// State
let gameId = null;
let playerId = null;
let currentView = 'home';
let myScore = 0;
let opScore = 0;
let selectedAvatar = null;
let myAvatar = null;
let opAvatar = null;
let myUsername = 'Moi';
let opUsername = 'Adversaire';
let selectedWinRounds = 3; // Default: best of 3
let gameWinRounds = 3; // Actual game win rounds
let isCreatingGame = false; // Track if creating or joining
let currentGameType = 'shifumi'; // 'shifumi', 'morpion', 'puissance4', 'chess', 'snake'
let isMyTurn = false; // For Morpion

// Snake Battle State
let snakeMaxPlayers = 4;
let snakeGameMode = 'survivor';
let isGameCreator = false;
let snakeGameStatus = 'waiting';
let snakePlayers = {};
let snakeGameState = null;
let lastInputTime = 0;
let countdownInterval = null;

// DOM Elements
const views = {
    home: document.getElementById('home'),
    avatarSelection: document.getElementById('avatar-selection'),
    gameSelection: document.getElementById('game-selection'),
    lobby: document.getElementById('lobby'),
    game: document.getElementById('game')
};

const resultOverlay = document.getElementById('result-overlay');
const statusMsg = document.getElementById('status-msg');
const myScoreEl = document.getElementById('my-score');
const opScoreEl = document.getElementById('op-score');
const choiceBtns = document.querySelectorAll('.choice-btn');
const replayBtn = document.getElementById('replay-btn');
const newGameBtn = document.getElementById('new-game-btn');
const replayStatus = document.getElementById('replay-status');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatMessages = document.getElementById('chat-messages');

// Morpion Elements
const morpionArea = document.getElementById('morpion-area');
const shifumiArea = document.getElementById('shifumi-area');
const morpionCells = document.querySelectorAll('.cell');
const turnIndicator = document.getElementById('turn-indicator');

// Puissance 4 Elements
const puissance4Area = document.getElementById('puissance4-area');
const p4Cells = document.querySelectorAll('.p4-cell');
const p4TurnIndicator = document.getElementById('p4-turn-indicator');

// Chess Elements
const chessArea = document.getElementById('chess-area');
const chessBoard = document.getElementById('chess-board');
const chessTurnIndicator = document.getElementById('chess-turn-indicator');

// Snake Elements
const snakeArea = document.getElementById('snake-area');
const snakeCanvas = document.getElementById('snake-canvas');
const snakeCtx = snakeCanvas ? snakeCanvas.getContext('2d') : null;
const snakeScoreboard = document.getElementById('snake-scoreboard');
const snakeTimer = document.getElementById('snake-timer');
const snakeTimeRemaining = document.getElementById('snake-time-remaining');
const snakeLobbySection = document.getElementById('snake-lobby-section');
const standardLobbySection = document.getElementById('standard-lobby-section');
const snakePlayerList = document.getElementById('snake-player-list');
const startSnakeBtn = document.getElementById('start-snake-btn');
const snakeLobbyHint = document.getElementById('snake-lobby-hint');
const snakeOptions = document.getElementById('snake-options');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const snakeDeathOverlay = document.getElementById('snake-death-overlay');
const snakeGameoverOverlay = document.getElementById('snake-gameover-overlay');

// Snake Constants
const SNAKE_CELL_SIZE = 15;
const SNAKE_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1'];

// Chess State
let myColor = null; // 'w' or 'b'
let currentFen = null;
let selectedSquare = null;
let legalMoves = [];
let lastMoveSquares = { from: null, to: null };

// Message Modal Elements
const messageModal = document.getElementById('message-modal');
const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');
const messageBtn = document.getElementById('message-btn');

// Helper: Show Message Modal
function showMessage(title, text, action = null) {
    messageTitle.textContent = title;
    messageText.textContent = text;

    // Reset button
    messageBtn.onclick = () => {
        messageModal.style.display = 'none';
        if (action) action();
    };

    messageModal.style.display = 'flex';
}

// Helper: Switch View
function showView(viewName) {
    Object.values(views).forEach(el => el.classList.remove('active'));
    views[viewName].classList.add('active');
    currentView = viewName;
}

// Helper: Update Status
function setStatus(msg) {
    statusMsg.textContent = msg;
}

// WebSocket Events
socket.onopen = () => {
    console.log('Connected to server');
    // Check URL for game ID
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'game' && pathParts[2]) {
        const id = pathParts[2];
        // Don't join immediately, show avatar selection first
        document.getElementById('join-input').dataset.pendingJoin = id;
        showView('avatarSelection');
    }
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received:', data);

    switch (data.type) {
        case 'game_created':
            gameId = data.gameId;
            playerId = data.playerId;
            currentGameType = data.gameType;
            document.getElementById('game-url').value = `${window.location.origin}/game/${gameId}`;

            // Setup lobby based on game type
            if (currentGameType === 'snake') {
                snakeLobbySection.style.display = 'block';
                standardLobbySection.style.display = 'none';
                document.getElementById('lobby-title').textContent = 'En attente de joueurs...';
                isGameCreator = true;
                snakePlayers[playerId] = {
                    username: document.getElementById('username-input').value.trim() || 'Joueur 1',
                    avatar: selectedAvatar
                };
                updateSnakeLobby();
            } else {
                snakeLobbySection.style.display = 'none';
                standardLobbySection.style.display = 'block';
                document.getElementById('lobby-title').textContent = "En attente d'un adversaire...";
            }

            showView('lobby');
            // Update URL without reload
            window.history.pushState({}, '', `/game/${gameId}`);
            break;

        case 'game_start':
            gameId = data.gameId;
            if (!playerId) playerId = data.playerId; // For joiner

            // Set game settings
            gameWinRounds = data.winRounds;
            currentGameType = data.gameType;
            isMyTurn = (data.turn === playerId);

            updateGameModeUI(gameWinRounds);
            setupGameUI(currentGameType);

            // Set avatars
            myAvatar = data.avatars[playerId];
            opAvatar = data.avatars[data.opponentId];

            updateGameAvatars();
            updateUsernames(data.usernames, data.opponentId);
            showView('game');

            if (currentGameType === 'chess') {
                // Chess specific setup
                myColor = data.myColor;
                currentFen = data.fen;
                isMyTurn = (data.myColor === 'w'); // White starts
                initChessBoard();
                updateChessBoard(data.fen);
                updateTurnIndicator();
                setStatus("La partie commence !");
            } else if (currentGameType === 'morpion' || currentGameType === 'puissance4') {
                updateTurnIndicator();
                setStatus("La partie commence !");
            } else {
                setStatus("C'est parti ! Faites votre choix.");
            }
            break;

        case 'chat_message':
            addChatMessage(data.senderUsername, data.message, data.senderId === playerId);
            break;

        case 'emote_received':
            if (data.senderId !== playerId) {
                showFloatingEmote(data.emote, false);
            }
            break;

        case 'opponent_moved':
            // Only for Shifumi really, but safe to ignore for Morpion as board updates come separate
            if (currentGameType === 'shifumi') {
                setStatus("L'adversaire a joué. À vous !");
            }
            break;

        case 'morpion_update':
            updateMorpionBoard(data.board);
            isMyTurn = (data.turn === playerId);
            updateTurnIndicator();
            break;

        case 'puissance4_update':
            updatePuissance4Board(data.board, data.lastMove);
            isMyTurn = (data.turn === playerId);
            updateTurnIndicator();
            break;

        case 'chess_update':
            currentFen = data.fen;
            isMyTurn = (data.turn === myColor);
            lastMoveSquares = data.lastMove || { from: null, to: null };
            updateChessBoard(data.fen, data.isCheck);
            updateTurnIndicator(data.isCheck);
            // Clear selection after move
            selectedSquare = null;
            legalMoves = [];
            break;

        case 'round_result':
            showResult(data);
            if (currentGameType === 'morpion' && data.winner !== undefined) {
                // Update board one last time to ensure sync (e.g. if winner move)
                if (data.board) updateMorpionBoard(data.board);
                isMyTurn = false; // Stop input
            }
            if (currentGameType === 'puissance4' && data.winner !== undefined) {
                if (data.board) updatePuissance4Board(data.board);
                isMyTurn = false; // Stop input
            }
            if (currentGameType === 'chess') {
                isMyTurn = false; // Stop input
            }
            break;

        case 'game_won':
            showGameWinner(data);
            break;

        case 'new_round':
            resetRoundUI();
            if (currentGameType === 'morpion') {
                isMyTurn = (data.turn === playerId);
                updateTurnIndicator();
                resetMorpionBoard();
                setStatus("Nouvelle manche !");
            }
            if (currentGameType === 'puissance4') {
                isMyTurn = (data.turn === playerId);
                updateTurnIndicator();
                resetPuissance4Board();
                setStatus("Nouvelle manche !");
            }
            if (currentGameType === 'chess') {
                // Reset chess board
                currentFen = data.fen;
                isMyTurn = (myColor === 'w'); // White always starts
                selectedSquare = null;
                legalMoves = [];
                lastMoveSquares = { from: null, to: null };
                updateChessBoard(data.fen);
                updateTurnIndicator();
                setStatus("Nouvelle manche !");
            }
            break;

        case 'opponent_wants_replay':
            replayStatus.textContent = "L'adversaire veut rejouer...";
            break;

        case 'opponent_disconnected':
            showMessage("Oups !", "L'adversaire s'est déconnecté.", () => {
                location.href = '/';
            });
            break;

        case 'error':
            showMessage("Erreur", data.message, () => {
                location.href = '/';
            });
            break;

        // Snake Battle Messages
        case 'player_joined':
            // Update players list
            snakePlayers = {};
            data.players.forEach(p => {
                snakePlayers[p.id] = { username: p.username, avatar: p.avatar };
            });
            gameId = data.gameId;
            playerId = data.playerId;
            isGameCreator = (data.creatorId === playerId);
            snakeMaxPlayers = data.maxPlayers;
            snakeGameMode = data.snakeGameMode;
            currentGameType = 'snake';

            // Show snake lobby
            snakeLobbySection.style.display = 'block';
            standardLobbySection.style.display = 'none';
            document.getElementById('lobby-title').textContent = 'En attente de joueurs...';
            document.getElementById('game-url').value = `${window.location.origin}/game/${gameId}`;

            updateSnakeLobby();
            showView('lobby');
            break;

        case 'player_left':
            snakePlayers = {};
            data.players.forEach(p => {
                snakePlayers[p.id] = { username: p.username, avatar: p.avatar };
            });
            updateSnakeLobby();
            addSystemChatMessage(`${data.username} a quitté la partie`);
            break;

        case 'game_starting':
            snakeGameStatus = 'countdown';
            snakeGameState = {
                snakes: data.snakes,
                fruits: data.fruits,
                gridSize: data.gridSize
            };
            showView('game');
            setupGameUI('snake');

            // Show timer for score mode
            if (data.gameMode === 'score' && data.timerDuration) {
                snakeTimer.style.display = 'flex';
                updateSnakeTimer(data.timerDuration);
            } else {
                snakeTimer.style.display = 'none';
            }

            // Update scoreboard
            updateSnakeScoreboard(data.snakes);

            // Render initial state
            renderSnakeGame(snakeGameState);

            // Show countdown
            startCountdown(data.countdown);
            break;

        case 'game_started':
            snakeGameStatus = 'playing';
            setStatus("GO !");
            break;

        case 'snake_update':
            snakeGameState = {
                snakes: data.snakes,
                fruits: data.fruits,
                gridSize: snakeGameState.gridSize
            };
            renderSnakeGame(snakeGameState);
            updateSnakeScoreboard(data.snakes);
            if (data.timeRemaining !== null) {
                updateSnakeTimer(data.timeRemaining);
            }
            break;

        case 'snake_death':
            if (data.playerId === playerId) {
                showSnakeDeathOverlay(data.reason);
            } else {
                addSystemChatMessage(`${data.username} a été éliminé !`);
            }
            break;

        case 'game_over':
            snakeGameStatus = 'finished';
            showSnakeGameOver(data);
            break;
    }
};

// Actions
document.getElementById('create-btn').addEventListener('click', () => {
    isCreatingGame = true;
    document.getElementById('win-rounds-section').style.display = 'block';
    showView('avatarSelection');
});

document.getElementById('join-btn').addEventListener('click', () => {
    const input = document.getElementById('join-input').value;
    if (input) {
        isCreatingGame = false;
        document.getElementById('win-rounds-section').style.display = 'none';
        // Store input for later
        document.getElementById('join-input').dataset.pendingJoin = input;
        showView('avatarSelection');
    }
});

// Avatar Selection
document.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedAvatar = opt.dataset.id;
    });
});

// Win Rounds Selection
document.querySelectorAll('.win-round-option').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.win-round-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        const rounds = opt.dataset.rounds;
        // Correctly handle 'null' string for no limit
        selectedWinRounds = rounds === 'null' ? null : parseInt(rounds);
    });
});

document.getElementById('random-avatar-btn').addEventListener('click', () => {
    if (!selectedAvatar) {
        selectedAvatar = Math.floor(Math.random() * 8) + 1;
    }
    proceedToGameSelection();
});

// Game Type Selection
document.querySelectorAll('.game-option').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.game-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        currentGameType = opt.dataset.game;

        // Show/hide snake options
        if (snakeOptions) {
            snakeOptions.style.display = currentGameType === 'snake' ? 'block' : 'none';
        }

        // Hide win rounds for snake (it's single round)
        const winRoundsSection = document.getElementById('win-rounds-section');
        if (winRoundsSection) {
            winRoundsSection.style.display = currentGameType === 'snake' ? 'none' : 'block';
        }
    });
});

// Snake Player Count Selection
document.querySelectorAll('.player-count-option').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.player-count-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        snakeMaxPlayers = parseInt(opt.dataset.count);
    });
});

// Snake Mode Selection
document.querySelectorAll('.snake-mode-option').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.snake-mode-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        snakeGameMode = opt.dataset.mode;
    });
});

document.getElementById('start-game-btn').addEventListener('click', () => {
    // If no game type selected, maybe default or shake?
    if (!currentGameType) {
        // Select Shifumi by default if not selected?
        // Or default was already set.
        // Let's ensure one is visually selected.
        currentGameType = 'shifumi';
    }
    createGame(currentGameType);
});


function proceedToGameSelection() {
    const pendingJoin = document.getElementById('join-input').dataset.pendingJoin;

    if (pendingJoin) {
        // Joining: Skip Game selection, join directly
        let id = pendingJoin;
        if (pendingJoin.includes('/game/')) {
            id = pendingJoin.split('/game/')[1];
        }
        if (id) joinGame(id);
    } else {
        // Creating: Show Game Selection
        // Pre-select Shifumi by default
        if (!currentGameType) currentGameType = 'shifumi';
        document.querySelectorAll('.game-option').forEach(o => o.classList.remove('selected'));
        document.querySelector(`.game-option[data-game="${currentGameType}"]`).classList.add('selected');

        // Show Win Rounds (it's now on this screen)
        // document.getElementById('win-rounds-section').style.display = 'block'; // Should be always visible in this view now

        showView('gameSelection');
    }
}

function createGame(type) {
    const username = document.getElementById('username-input').value.trim() || 'Joueur 1';
    const payload = {
        type: 'create_game',
        avatarId: selectedAvatar,
        username: username,
        winRounds: selectedWinRounds,
        gameType: type
    };

    // Add snake-specific options
    if (type === 'snake') {
        payload.maxPlayers = snakeMaxPlayers;
        payload.snakeGameMode = snakeGameMode;
        isGameCreator = true;
    }

    socket.send(JSON.stringify(payload));
}

// Copy Button with modern Clipboard API
document.getElementById('copy-btn').addEventListener('click', async () => {
    const urlInput = document.getElementById('game-url');
    const btn = document.getElementById('copy-btn');
    const originalHTML = btn.innerHTML;

    try {
        await navigator.clipboard.writeText(urlInput.value);
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copié !
        `;
        setTimeout(() => {
            btn.innerHTML = originalHTML;
        }, 2000);
    } catch (err) {
        // Fallback for older browsers
        urlInput.select();
        document.execCommand('copy');
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copié !
        `;
        setTimeout(() => {
            btn.innerHTML = originalHTML;
        }, 2000);
    }
});

// Share Button with Web Share API
document.getElementById('share-btn').addEventListener('click', async () => {
    const url = document.getElementById('game-url').value;

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Kawaii Clash',
                text: 'Rejoins-moi pour une partie !',
                url: url
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Share failed:', err);
                copyToClipboard(url);
            }
        }
    } else {
        copyToClipboard(url);
    }
});

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('share-btn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copié !
        `;
        setTimeout(() => {
            btn.innerHTML = originalHTML;
        }, 2000);
    });
}

// Shifumi Logic
choiceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Deselect others
        choiceBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        const move = btn.dataset.move;
        socket.send(JSON.stringify({
            type: 'make_move',
            gameId: gameId,
            move: move
        }));

        setStatus("Choix envoyé. En attente de l'adversaire...");

        // Trigger combat animation if available
        const myAvatarImg = document.querySelector('#my-score').parentElement.querySelector('.player-avatar');
        if (myAvatarImg) {
            const combatSrc = getAvatarPath(myAvatar, 'combat');
            if (combatSrc) {
                myAvatarImg.src = combatSrc;
            }
        }
    });
});

// Morpion Logic
morpionCells.forEach(cell => {
    cell.addEventListener('click', () => {
        if (!isMyTurn) {
            // Visual feedback that it's not turn
            shakeElement(turnIndicator);
            return;
        }
        if (cell.classList.contains('taken')) return;

        const index = parseInt(cell.dataset.index);

        // Optimistic update? No, let's wait for server to allow it to keep sync clean
        // Or yes for responsiveness? 
        // Let's send it.
        socket.send(JSON.stringify({
            type: 'make_move',
            gameId: gameId,
            move: index
        }));
    });
});

function updateMorpionBoard(board) {
    board.forEach((val, idx) => {
        const cell = document.querySelector(`.cell[data-index="${idx}"]`);
        if (val) {
            cell.classList.add('taken');
            // Check if it's me or opponent
            if (val === playerId) {
                cell.classList.add('x'); // Assuming Creator/Me is X style, Opponent O style or vice versa. 
                // Wait, X and O is universal. 
                // Let's assume Player 1 (creator) is X, Player 2 is O.
                // But we don't know who is P1 easily in frontend without passing it. 
                // Let's just use "myself = Blue/X", "opponent = Red/O" ? 
                // Or simplified: Just render X or O based on ID.
                // We need consistent X/O assignment.
                // Let's rely on server for symbol? Or just assign consistent symbols.
                // Simplified: if val == me -> 'X' (or check ID order).
                // Actually server doesn't send "X" or "O", sends ID.
                // We can't consistently assign X/O without knowing who is P1/P2.
                // Hack: Use 'x' and 'o' classes based on whether it equals *my* ID or not?
                // No, that would swap symbols on each screen.
                // We need stable symbols.
                // Ideally server sends Board as ['X', 'O', null].
                // But server sends [clientID1, clientID2, null].
                // We can determine P1 vs P2?
                // Let's just make "Me" always Blue (X) and "Them" always Red (O) for local view? 
                // That's confusing if we talk about "Put X there".
                // Let's try to infer from data. 
                // Just using 'x' class for me, 'o' class for opponent for now. 

                if (val === playerId) {
                    cell.textContent = 'X';
                    cell.classList.add('x');
                } else {
                    cell.textContent = 'O';
                    cell.classList.add('o');
                }
            } else {
                // Opponent
                if (val === playerId) { // Logic error in copy paste above
                    // Should match ID
                }
                // Correct logic:
                if (val === playerId) {
                    cell.textContent = 'X';
                    cell.classList.add('x');
                } else {
                    cell.textContent = 'O';
                    cell.classList.add('o');
                }
            }
        }
    });
}
// Correction for X/O consistency: 
// To make it truly consistent (P1 always X, P2 always O), we need to know if we are P1 or P2.
// But we didn't store that. 
// For now, "Me = X" is fine for gameplay feeling.

function updateTurnIndicator(isCheck = false) {
    if (currentGameType === 'morpion') {
        if (isMyTurn) {
            turnIndicator.textContent = "C'est à votre tour ! (X)";
            turnIndicator.style.color = "var(--cyan)";
            turnIndicator.style.border = "2px solid var(--cyan)";
        } else {
            turnIndicator.textContent = "Tour de l'adversaire (O)";
            turnIndicator.style.color = "var(--pink)";
            turnIndicator.style.border = "2px solid var(--pink)";
        }
    } else if (currentGameType === 'puissance4') {
        if (isMyTurn) {
            p4TurnIndicator.textContent = "C'est à votre tour ! (Rouge)";
            p4TurnIndicator.style.color = "#FF6B6B";
            p4TurnIndicator.style.border = "2px solid #FF6B6B";
        } else {
            p4TurnIndicator.textContent = "Tour de l'adversaire (Jaune)";
            p4TurnIndicator.style.color = "#FFD93D";
            p4TurnIndicator.style.border = "2px solid #FFD93D";
        }
    } else if (currentGameType === 'chess') {
        const myColorName = myColor === 'w' ? 'Blancs' : 'Noirs';
        const opColorName = myColor === 'w' ? 'Noirs' : 'Blancs';

        chessTurnIndicator.className = 'turn-indicator';

        if (isCheck && isMyTurn) {
            chessTurnIndicator.textContent = "ÉCHEC ! À vous de jouer";
            chessTurnIndicator.classList.add('in-check');
        } else if (isCheck && !isMyTurn) {
            chessTurnIndicator.textContent = "Échec à l'adversaire !";
            chessTurnIndicator.classList.add('in-check');
        } else if (isMyTurn) {
            chessTurnIndicator.textContent = `C'est à vous ! (${myColorName})`;
            chessTurnIndicator.classList.add(myColor === 'w' ? 'white-turn' : 'black-turn');
        } else {
            chessTurnIndicator.textContent = `Tour de l'adversaire (${opColorName})`;
            chessTurnIndicator.classList.add(myColor === 'w' ? 'black-turn' : 'white-turn');
        }
    }
}

function resetMorpionBoard() {
    morpionCells.forEach(cell => {
        cell.className = 'cell';
        cell.textContent = '';
    });
}

// Puissance 4 Logic
p4Cells.forEach(cell => {
    cell.addEventListener('click', () => {
        if (!isMyTurn) {
            shakeElement(p4TurnIndicator);
            return;
        }

        const column = parseInt(cell.dataset.col);

        // Check if column is full (top cell of column is taken)
        const topCellOfColumn = document.querySelector(`.p4-cell[data-index="${column}"]`);
        if (topCellOfColumn && topCellOfColumn.classList.contains('taken')) {
            shakeElement(p4TurnIndicator);
            return;
        }

        socket.send(JSON.stringify({
            type: 'make_move',
            gameId: gameId,
            move: column
        }));
    });
});

function updatePuissance4Board(board, lastMove = null) {
    board.forEach((val, idx) => {
        const cell = document.querySelector(`.p4-cell[data-index="${idx}"]`);
        if (!cell) return;

        if (val) {
            const wasEmpty = !cell.classList.contains('taken');
            cell.classList.add('taken');

            // Determine color based on player
            if (val === playerId) {
                cell.classList.remove('yellow');
                cell.classList.add('red');
            } else {
                cell.classList.remove('red');
                cell.classList.add('yellow');
            }

            // Add drop animation for new pieces
            if (wasEmpty && idx === lastMove) {
                cell.classList.add('dropping');
                setTimeout(() => cell.classList.remove('dropping'), 500);
            }
        }
    });
}

function resetPuissance4Board() {
    p4Cells.forEach(cell => {
        cell.className = 'p4-cell';
        cell.removeAttribute('style');
    });
}

// ========================================
// CHESS FUNCTIONS
// ========================================

const CHESS_PIECES = {
    'wk': '♔', 'wq': '♕', 'wr': '♖', 'wb': '♗', 'wn': '♘', 'wp': '♙',
    'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

// Starting piece counts for calculating captures
const STARTING_PIECES = {
    'w': { 'k': 1, 'q': 1, 'r': 2, 'b': 2, 'n': 2, 'p': 8 },
    'b': { 'k': 1, 'q': 1, 'r': 2, 'b': 2, 'n': 2, 'p': 8 }
};

// Piece values for material calculation
const PIECE_VALUES = { 'q': 9, 'r': 5, 'b': 3, 'n': 3, 'p': 1, 'k': 0 };

function initChessBoard() {
    chessBoard.innerHTML = '';

    for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
            const square = document.createElement('div');
            const squareName = FILES[file] + RANKS[rank];
            const isLight = (rank + file) % 2 === 0;

            square.className = `chess-square ${isLight ? 'light' : 'dark'}`;
            square.dataset.square = squareName;

            square.addEventListener('click', () => handleChessSquareClick(squareName));

            chessBoard.appendChild(square);
        }
    }
}

function updateChessBoard(fen, isCheck = false) {
    const board = parseFen(fen);

    // Update captured pieces display
    updateCapturedPieces(fen);

    // Clear all squares
    document.querySelectorAll('.chess-square').forEach(sq => {
        sq.innerHTML = '';
        sq.classList.remove('selected', 'legal-move', 'has-piece', 'last-move', 'in-check');
    });

    // Place pieces
    for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
            const piece = board[rank][file];
            const squareName = FILES[file] + RANKS[rank];
            const squareEl = document.querySelector(`.chess-square[data-square="${squareName}"]`);

            if (piece && squareEl) {
                const pieceEl = document.createElement('span');
                pieceEl.className = `chess-piece ${piece.color === 'w' ? 'white' : 'black'}`;
                pieceEl.textContent = CHESS_PIECES[piece.color + piece.type];
                squareEl.appendChild(pieceEl);

                // Highlight king if in check
                if (isCheck && piece.type === 'k') {
                    // Find whose turn it is from FEN
                    const turnColor = fen.split(' ')[1];
                    if (piece.color === turnColor) {
                        squareEl.classList.add('in-check');
                    }
                }
            }
        }
    }

    // Highlight last move
    if (lastMoveSquares.from) {
        const fromSq = document.querySelector(`.chess-square[data-square="${lastMoveSquares.from}"]`);
        if (fromSq) fromSq.classList.add('last-move');
    }
    if (lastMoveSquares.to) {
        const toSq = document.querySelector(`.chess-square[data-square="${lastMoveSquares.to}"]`);
        if (toSq) toSq.classList.add('last-move');
    }

    // Re-apply selection and legal moves if any
    if (selectedSquare) {
        const selSq = document.querySelector(`.chess-square[data-square="${selectedSquare}"]`);
        if (selSq) selSq.classList.add('selected');

        legalMoves.forEach(move => {
            const moveSq = document.querySelector(`.chess-square[data-square="${move}"]`);
            if (moveSq) {
                moveSq.classList.add('legal-move');
                if (moveSq.querySelector('.chess-piece')) {
                    moveSq.classList.add('has-piece');
                }
            }
        });
    }
}

function parseFen(fen) {
    const board = [];
    const rows = fen.split(' ')[0].split('/');

    for (const row of rows) {
        const boardRow = [];
        for (const char of row) {
            if (isNaN(char)) {
                // It's a piece
                const color = char === char.toUpperCase() ? 'w' : 'b';
                const type = char.toLowerCase();
                boardRow.push({ color, type });
            } else {
                // Empty squares
                for (let i = 0; i < parseInt(char); i++) {
                    boardRow.push(null);
                }
            }
        }
        board.push(boardRow);
    }
    return board;
}

function handleChessSquareClick(squareName) {
    if (!isMyTurn) {
        shakeElement(chessTurnIndicator);
        return;
    }

    const clickedSquare = document.querySelector(`.chess-square[data-square="${squareName}"]`);
    const pieceOnSquare = clickedSquare.querySelector('.chess-piece');

    // If a square is already selected
    if (selectedSquare) {
        // If clicking on a legal move, make the move
        if (legalMoves.includes(squareName)) {
            socket.send(JSON.stringify({
                type: 'make_move',
                gameId: gameId,
                from: selectedSquare,
                to: squareName
            }));
            // Clear selection (will be cleared on update anyway)
            selectedSquare = null;
            legalMoves = [];
            return;
        }

        // If clicking on same square, deselect
        if (selectedSquare === squareName) {
            clearChessSelection();
            return;
        }

        // If clicking on another of my pieces, select that instead
        if (pieceOnSquare && isPieceMyColor(pieceOnSquare)) {
            selectChessSquare(squareName);
            return;
        }

        // Otherwise, just clear selection
        clearChessSelection();
        return;
    }

    // No square selected yet - select if it's my piece
    if (pieceOnSquare && isPieceMyColor(pieceOnSquare)) {
        selectChessSquare(squareName);
    }
}

function isPieceMyColor(pieceEl) {
    if (myColor === 'w') {
        return pieceEl.classList.contains('white');
    } else {
        return pieceEl.classList.contains('black');
    }
}

function selectChessSquare(squareName) {
    clearChessSelection();

    selectedSquare = squareName;
    const squareEl = document.querySelector(`.chess-square[data-square="${squareName}"]`);
    squareEl.classList.add('selected');

    // Calculate legal moves for this piece
    legalMoves = getLegalMovesForSquare(squareName);

    // Highlight legal moves
    legalMoves.forEach(move => {
        const moveSq = document.querySelector(`.chess-square[data-square="${move}"]`);
        if (moveSq) {
            moveSq.classList.add('legal-move');
            if (moveSq.querySelector('.chess-piece')) {
                moveSq.classList.add('has-piece');
            }
        }
    });
}

function clearChessSelection() {
    selectedSquare = null;
    legalMoves = [];

    document.querySelectorAll('.chess-square').forEach(sq => {
        sq.classList.remove('selected', 'legal-move', 'has-piece');
    });
}

function getLegalMovesForSquare(squareName) {
    // Parse current position to find legal moves
    // This is a simplified version - the server validates anyway
    const moves = [];
    const board = parseFen(currentFen);
    const file = FILES.indexOf(squareName[0]);
    const rank = RANKS.indexOf(squareName[1]);
    const piece = board[rank][file];

    if (!piece || piece.color !== myColor) return moves;

    // Generate pseudo-legal moves (server will validate)
    const directions = {
        'p': piece.color === 'w' ? [[-1, 0], [-2, 0], [-1, -1], [-1, 1]] : [[1, 0], [2, 0], [1, -1], [1, 1]],
        'n': [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
        'b': 'diagonal',
        'r': 'straight',
        'q': 'both',
        'k': [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1], [0, -2], [0, 2]] // Including castling
    };

    const addMove = (r, f) => {
        if (r >= 0 && r < 8 && f >= 0 && f < 8) {
            const targetSquare = FILES[f] + RANKS[r];
            const targetPiece = board[r][f];
            if (!targetPiece || targetPiece.color !== piece.color) {
                moves.push(targetSquare);
            }
        }
    };

    const addSlidingMoves = (dirs) => {
        for (const [dr, df] of dirs) {
            for (let i = 1; i < 8; i++) {
                const newR = rank + dr * i;
                const newF = file + df * i;
                if (newR < 0 || newR >= 8 || newF < 0 || newF >= 8) break;
                const target = board[newR][newF];
                if (!target) {
                    moves.push(FILES[newF] + RANKS[newR]);
                } else {
                    if (target.color !== piece.color) {
                        moves.push(FILES[newF] + RANKS[newR]);
                    }
                    break;
                }
            }
        }
    };

    const type = piece.type;
    if (type === 'p') {
        // Pawn moves
        const dir = piece.color === 'w' ? -1 : 1;
        const startRank = piece.color === 'w' ? 6 : 1;

        // Forward move
        if (rank + dir >= 0 && rank + dir < 8 && !board[rank + dir][file]) {
            moves.push(FILES[file] + RANKS[rank + dir]);
            // Double move from start
            if (rank === startRank && !board[rank + 2 * dir][file]) {
                moves.push(FILES[file] + RANKS[rank + 2 * dir]);
            }
        }
        // Captures
        for (const df of [-1, 1]) {
            const newF = file + df;
            const newR = rank + dir;
            if (newF >= 0 && newF < 8 && newR >= 0 && newR < 8) {
                const target = board[newR][newF];
                if (target && target.color !== piece.color) {
                    moves.push(FILES[newF] + RANKS[newR]);
                }
                // En passant would need additional FEN parsing
            }
        }
    } else if (type === 'n') {
        for (const [dr, df] of directions.n) {
            addMove(rank + dr, file + df);
        }
    } else if (type === 'k') {
        for (const [dr, df] of directions.k) {
            addMove(rank + dr, file + df);
        }
    } else if (type === 'b') {
        addSlidingMoves([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
    } else if (type === 'r') {
        addSlidingMoves([[-1, 0], [1, 0], [0, -1], [0, 1]]);
    } else if (type === 'q') {
        addSlidingMoves([[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]);
    }

    return moves;
}

function updateCapturedPieces(fen) {
    // Count current pieces on board
    const currentPieces = { 'w': {}, 'b': {} };
    const boardPart = fen.split(' ')[0];

    for (const char of boardPart) {
        if (char === '/' || !isNaN(char)) continue;
        const color = char === char.toUpperCase() ? 'w' : 'b';
        const type = char.toLowerCase();
        currentPieces[color][type] = (currentPieces[color][type] || 0) + 1;
    }

    // Calculate captured pieces (what's missing from starting position)
    const capturedByWhite = []; // Black pieces captured by white
    const capturedByBlack = []; // White pieces captured by black

    // Order: Queen, Rook, Bishop, Knight, Pawn (most valuable first)
    const pieceOrder = ['q', 'r', 'b', 'n', 'p'];

    for (const type of pieceOrder) {
        // Black pieces captured (by white)
        const blackStart = STARTING_PIECES['b'][type] || 0;
        const blackCurrent = currentPieces['b'][type] || 0;
        const blackCaptured = blackStart - blackCurrent;
        for (let i = 0; i < blackCaptured; i++) {
            capturedByWhite.push({ type, color: 'b' });
        }

        // White pieces captured (by black)
        const whiteStart = STARTING_PIECES['w'][type] || 0;
        const whiteCurrent = currentPieces['w'][type] || 0;
        const whiteCaptured = whiteStart - whiteCurrent;
        for (let i = 0; i < whiteCaptured; i++) {
            capturedByBlack.push({ type, color: 'w' });
        }
    }

    // Calculate material advantage
    let whiteMaterial = 0;
    let blackMaterial = 0;
    for (const type of pieceOrder) {
        whiteMaterial += (currentPieces['w'][type] || 0) * PIECE_VALUES[type];
        blackMaterial += (currentPieces['b'][type] || 0) * PIECE_VALUES[type];
    }
    const materialDiff = whiteMaterial - blackMaterial;

    // Update DOM
    const whiteCaptures = document.getElementById('white-captures');
    const blackCaptures = document.getElementById('black-captures');

    whiteCaptures.innerHTML = capturedByWhite.map(p =>
        `<span class="captured-piece black">${CHESS_PIECES['b' + p.type]}</span>`
    ).join('');

    blackCaptures.innerHTML = capturedByBlack.map(p =>
        `<span class="captured-piece white">${CHESS_PIECES['w' + p.type]}</span>`
    ).join('');

    // Add material advantage indicator
    if (materialDiff !== 0) {
        const advantage = Math.abs(materialDiff);
        if (materialDiff > 0) {
            whiteCaptures.innerHTML += `<span class="material-advantage">+${advantage}</span>`;
        } else {
            blackCaptures.innerHTML += `<span class="material-advantage">+${advantage}</span>`;
        }
    }
}

function shakeElement(el) {
    el.classList.add('shake'); // Need to add shake keyframes if not exists, but simple feedback is fine
    el.style.transform = "translateX(5px)";
    setTimeout(() => { el.style.transform = "translateX(-5px)"; }, 50);
    setTimeout(() => { el.style.transform = "translateX(5px)"; }, 100);
    setTimeout(() => { el.style.transform = "translateX(0)"; }, 150);
}


replayBtn.addEventListener('click', () => {
    socket.send(JSON.stringify({
        type: 'play_again',
        gameId: gameId
    }));
    replayBtn.textContent = 'En attente...';
    replayBtn.disabled = true;
});

newGameBtn.addEventListener('click', () => {
    window.location.href = '/';
});

function joinGame(id) {
    const username = document.getElementById('username-input').value.trim() || 'Joueur 2';
    socket.send(JSON.stringify({
        type: 'join_game',
        gameId: id,
        avatarId: selectedAvatar || (Math.floor(Math.random() * 8) + 1),
        username: username
    }));
}

function setupGameUI(type) {
    // Hide all game areas first
    shifumiArea.style.display = 'none';
    morpionArea.style.display = 'none';
    puissance4Area.style.display = 'none';
    chessArea.style.display = 'none';
    if (snakeArea) snakeArea.style.display = 'none';

    // Hide standard scoreboard for snake
    const scoreBoard = document.querySelector('.score-board');
    if (scoreBoard) {
        scoreBoard.style.display = type === 'snake' ? 'none' : 'flex';
    }

    if (type === 'morpion') {
        morpionArea.style.display = 'flex';
    } else if (type === 'puissance4') {
        puissance4Area.style.display = 'flex';
    } else if (type === 'chess') {
        chessArea.style.display = 'flex';
    } else if (type === 'snake') {
        if (snakeArea) snakeArea.style.display = 'flex';
    } else {
        shifumiArea.style.display = 'flex';
    }
}

function updateGameAvatars() {
    // Inject avatars into score board
    const myScoreContainer = document.querySelector('#my-score').parentElement;
    const opScoreContainer = document.querySelector('#op-score').parentElement;

    // Remove existing avatars if any
    myScoreContainer.querySelectorAll('.player-avatar').forEach(el => el.remove());
    opScoreContainer.querySelectorAll('.player-avatar').forEach(el => el.remove());

    const myAvatarImg = document.createElement('img');
    myAvatarImg.src = getAvatarPath(myAvatar, 'static');
    myAvatarImg.className = 'player-avatar';
    myScoreContainer.insertBefore(myAvatarImg, myScoreContainer.firstChild);

    const opAvatarImg = document.createElement('img');
    opAvatarImg.src = getAvatarPath(opAvatar, 'static');
    opAvatarImg.className = 'player-avatar';
    opScoreContainer.insertBefore(opAvatarImg, opScoreContainer.firstChild);
}

function getAvatarPath(id, type = 'static') {
    // Special case for Fox (Avatar 1)
    if (id == 1) {
        if (type === 'combat') return '/avatars/fox_combat.gif';
        return '/avatars/fox.png';
    }
    // Default
    if (type === 'combat') return null;
    return `/avatars/avatar_${id}.png`;
}

function showResult(data) {
    // Differentiate result display for Shifumi vs Morpion/Puissance4
    const movesDisplay = document.querySelector('.moves-display');
    if (currentGameType === 'shifumi') {
        movesDisplay.style.display = 'flex';
        const myMove = data.moves[playerId];
        const opId = Object.keys(data.moves).find(id => id !== playerId);
        const opMove = data.moves[opId];

        const assets = {
            rock: '/rock_user.png',
            paper: '/paper_user.png',
            scissors: '/scissors_user.png'
        };

        document.getElementById('my-move-display').innerHTML = `<img src="${assets[myMove]}" alt="${myMove}" class="move-display-icon">`;
        document.getElementById('op-move-display').innerHTML = `<img src="${assets[opMove]}" alt="${opMove}" class="move-display-icon">`;
    } else {
        // Morpion / Puissance4 Result
        // Hide the move display area entirely as it's irrelevant
        movesDisplay.style.display = 'none';
        document.getElementById('my-move-display').innerHTML = '';
        document.getElementById('op-move-display').innerHTML = '';
    }

    const title = document.getElementById('result-title');
    if (data.winner === playerId) {
        title.textContent = "Manche gagnée ! 🎉";
        title.style.color = "var(--success)";
    } else if (data.winner === null) {
        title.textContent = "Égalité ! 🤝";
        title.style.color = "var(--warning)";
    } else {
        title.textContent = "Manche perdue... 😢";
        title.style.color = "var(--danger)";
    }

    // Update scores
    // Find opponent ID again
    const opId = Object.keys(data.scores).find(id => id !== playerId);
    myScore = data.scores[playerId];
    opScore = data.scores[opId];
    myScoreEl.textContent = myScore;
    opScoreEl.textContent = opScore;

    setTimeout(() => {
        resultOverlay.style.display = 'flex';
    }, 500);
}

function resetRoundUI() {
    resultOverlay.style.display = 'none';
    choiceBtns.forEach(b => b.classList.remove('selected'));

    if (currentGameType === 'shifumi') {
        setStatus("Nouvelle manche ! Choisissez.");
    }

    replayBtn.textContent = 'Rejouer';
    replayBtn.disabled = false;
    newGameBtn.style.display = 'none';
    replayStatus.textContent = '';

    // Reset avatars to static state
    updateGameAvatars();
}

// Chat Functions
function sendChatMessage() {
    const text = chatInput.value.trim();
    if (text) {
        socket.send(JSON.stringify({
            type: 'chat_message',
            gameId: gameId,
            message: text
        }));
        chatInput.value = '';
    }
}

chatSendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

function addChatMessage(sender, text, isMe) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${isMe ? 'me' : 'opponent'}`;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'chat-name';
    nameSpan.textContent = isMe ? 'Moi' : sender;

    const textSpan = document.createElement('span');
    textSpan.className = 'chat-text';
    textSpan.textContent = text;

    msgDiv.appendChild(nameSpan);
    msgDiv.appendChild(textSpan);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Emote Functions
document.querySelectorAll('.emote-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const emote = btn.dataset.emote;
        socket.send(JSON.stringify({
            type: 'send_emote',
            gameId: gameId,
            emote: emote
        }));
        showFloatingEmote(emote, true);
    });
});

function showFloatingEmote(emote, isMe) {
    const el = document.createElement('div');
    el.textContent = emote;
    el.className = 'floating-emote';

    const randomX = (Math.random() - 0.5) * 100;
    const startX = isMe ? '70%' : '30%';

    el.style.left = `calc(${startX} + ${randomX}px)`;

    document.body.appendChild(el);

    setTimeout(() => {
        el.remove();
    }, 3000);
}

function updateUsernames(usernames, opponentId) {
    if (usernames) {
        myUsername = usernames[playerId];
        opUsername = usernames[opponentId];

        document.querySelector('#my-score').previousElementSibling.textContent = myUsername;
        document.querySelector('#op-score').previousElementSibling.textContent = opUsername;
    }
}

// Handle URL routing for direct access
if (window.location.pathname.startsWith('/game/')) {
    // Wait for connection to open
}

function updateGameModeUI(rounds) {
    const badge = document.getElementById('game-mode-badge');
    const icon = document.getElementById('mode-icon');
    const progress = document.getElementById('mode-progress');

    if (!rounds) {
        icon.textContent = '∞';
        progress.textContent = 'Sans limite';
    } else {
        icon.textContent = rounds;
        progress.textContent = rounds === 1 ? 'Partie rapide' : `Meilleur de ${rounds}`;
    }
}

function showGameWinner(data) {
    const title = document.getElementById('result-title');

    if (data.winner === playerId) {
        title.textContent = "VICTOIRE FINALE ! 🏆";
        title.style.color = "var(--success)";
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
        });
    } else {
        title.textContent = "DÉFAITE... 😢";
        title.style.color = "var(--danger)";
    }

    document.getElementById('my-move-display').innerHTML = '';
    document.getElementById('op-move-display').innerHTML = '';

    const opId = Object.keys(data.scores).find(id => id !== playerId);
    myScore = data.scores[playerId];
    opScore = data.scores[opId];
    myScoreEl.textContent = myScore;
    opScoreEl.textContent = opScore;

    replayBtn.textContent = 'Rejouer';
    replayBtn.disabled = false;
    newGameBtn.style.display = 'block';

    resultOverlay.style.display = 'flex';
}

// ========================================
// SNAKE BATTLE FUNCTIONS
// ========================================

function updateSnakeLobby() {
    if (!snakePlayerList) return;

    const playerCount = Object.keys(snakePlayers).length;
    document.getElementById('current-player-count').textContent = playerCount;
    document.getElementById('max-player-count').textContent = snakeMaxPlayers;

    // Build player list
    snakePlayerList.innerHTML = '';
    Object.entries(snakePlayers).forEach(([pid, player]) => {
        const div = document.createElement('div');
        div.className = 'lobby-player';
        div.innerHTML = `
            <img src="${getAvatarPath(player.avatar)}" class="lobby-avatar" alt="Avatar">
            <span class="lobby-username">${player.username}</span>
            ${isGameCreator && pid === playerId ? '<span class="creator-badge">Host</span>' : ''}
        `;
        snakePlayerList.appendChild(div);
    });

    // Show start button for creator if enough players
    if (startSnakeBtn) {
        if (isGameCreator && playerCount >= 2) {
            startSnakeBtn.style.display = 'block';
            snakeLobbyHint.style.display = 'none';
        } else {
            startSnakeBtn.style.display = 'none';
            snakeLobbyHint.style.display = 'block';
            if (isGameCreator) {
                snakeLobbyHint.textContent = 'En attente de joueurs (min. 2)...';
            } else {
                snakeLobbyHint.textContent = "En attente du lancement par l'hôte...";
            }
        }
    }
}

// Start Snake Button
if (startSnakeBtn) {
    startSnakeBtn.addEventListener('click', () => {
        socket.send(JSON.stringify({
            type: 'start_game',
            gameId: gameId
        }));
        startSnakeBtn.disabled = true;
        startSnakeBtn.textContent = 'Lancement...';
    });
}

function startCountdown(seconds) {
    countdownOverlay.style.display = 'flex';
    let count = seconds;

    const updateCount = () => {
        if (count > 0) {
            countdownNumber.textContent = count;
            countdownNumber.style.animation = 'none';
            countdownNumber.offsetHeight; // Trigger reflow
            countdownNumber.style.animation = 'countdownPulse 1s ease-out';
            count--;
        } else {
            countdownNumber.textContent = 'GO!';
            setTimeout(() => {
                countdownOverlay.style.display = 'none';
            }, 500);
            clearInterval(countdownInterval);
        }
    };

    updateCount();
    countdownInterval = setInterval(updateCount, 1000);
}

function renderSnakeGame(state) {
    if (!snakeCtx || !state) return;

    const { snakes, fruits, gridSize } = state;
    const cellSize = SNAKE_CELL_SIZE;

    // Clear canvas
    snakeCtx.fillStyle = '#1a1a2e';
    snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);

    // Draw grid (subtle)
    snakeCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    snakeCtx.lineWidth = 1;
    for (let x = 0; x <= gridSize.width; x++) {
        snakeCtx.beginPath();
        snakeCtx.moveTo(x * cellSize, 0);
        snakeCtx.lineTo(x * cellSize, gridSize.height * cellSize);
        snakeCtx.stroke();
    }
    for (let y = 0; y <= gridSize.height; y++) {
        snakeCtx.beginPath();
        snakeCtx.moveTo(0, y * cellSize);
        snakeCtx.lineTo(gridSize.width * cellSize, y * cellSize);
        snakeCtx.stroke();
    }

    // Draw fruits
    fruits.forEach(fruit => {
        snakeCtx.fillStyle = '#FF6B6B';
        snakeCtx.beginPath();
        snakeCtx.arc(
            fruit.x * cellSize + cellSize / 2,
            fruit.y * cellSize + cellSize / 2,
            cellSize / 2 - 2,
            0, Math.PI * 2
        );
        snakeCtx.fill();

        // Add shine
        snakeCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        snakeCtx.beginPath();
        snakeCtx.arc(
            fruit.x * cellSize + cellSize / 2 - 2,
            fruit.y * cellSize + cellSize / 2 - 2,
            cellSize / 6,
            0, Math.PI * 2
        );
        snakeCtx.fill();
    });

    // Draw snakes
    let colorIndex = 0;
    Object.entries(snakes).forEach(([pid, snake]) => {
        const color = snake.color || SNAKE_COLORS[colorIndex % SNAKE_COLORS.length];
        const isMe = pid === playerId;

        snake.segments.forEach((seg, i) => {
            if (i === 0) {
                // Head
                snakeCtx.fillStyle = snake.alive ? color : '#555';
                snakeCtx.fillRect(
                    seg.x * cellSize + 1,
                    seg.y * cellSize + 1,
                    cellSize - 2,
                    cellSize - 2
                );

                // Eyes
                if (snake.alive) {
                    snakeCtx.fillStyle = 'white';
                    const eyeSize = 3;
                    let eyeOffset1, eyeOffset2;

                    switch (snake.direction) {
                        case 'up':
                            eyeOffset1 = { x: 3, y: 3 };
                            eyeOffset2 = { x: cellSize - 6, y: 3 };
                            break;
                        case 'down':
                            eyeOffset1 = { x: 3, y: cellSize - 6 };
                            eyeOffset2 = { x: cellSize - 6, y: cellSize - 6 };
                            break;
                        case 'left':
                            eyeOffset1 = { x: 3, y: 3 };
                            eyeOffset2 = { x: 3, y: cellSize - 6 };
                            break;
                        case 'right':
                        default:
                            eyeOffset1 = { x: cellSize - 6, y: 3 };
                            eyeOffset2 = { x: cellSize - 6, y: cellSize - 6 };
                            break;
                    }

                    snakeCtx.beginPath();
                    snakeCtx.arc(
                        seg.x * cellSize + eyeOffset1.x,
                        seg.y * cellSize + eyeOffset1.y,
                        eyeSize, 0, Math.PI * 2
                    );
                    snakeCtx.arc(
                        seg.x * cellSize + eyeOffset2.x,
                        seg.y * cellSize + eyeOffset2.y,
                        eyeSize, 0, Math.PI * 2
                    );
                    snakeCtx.fill();
                }
            } else {
                // Body
                snakeCtx.fillStyle = snake.alive ? adjustColor(color, -20) : '#444';
                snakeCtx.fillRect(
                    seg.x * cellSize + 2,
                    seg.y * cellSize + 2,
                    cellSize - 4,
                    cellSize - 4
                );
            }
        });

        colorIndex++;
    });
}

function adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return '#' + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
}

function updateSnakeScoreboard(snakes) {
    if (!snakeScoreboard) return;

    snakeScoreboard.innerHTML = '';
    let colorIndex = 0;

    Object.entries(snakes).forEach(([pid, snake]) => {
        const player = snakePlayers[pid] || { username: 'Joueur', avatar: 1 };
        const color = snake.color || SNAKE_COLORS[colorIndex % SNAKE_COLORS.length];
        const isMe = pid === playerId;

        const div = document.createElement('div');
        div.className = `snake-player-score ${!snake.alive ? 'dead' : ''}`;
        div.style.borderLeftColor = color;
        div.innerHTML = `
            <img src="${getAvatarPath(player.avatar)}" class="score-avatar" alt="">
            <span class="score-name">${isMe ? 'Moi' : player.username}</span>
            <span class="score-value">${snake.score}</span>
        `;
        snakeScoreboard.appendChild(div);

        colorIndex++;
    });
}

function updateSnakeTimer(seconds) {
    if (!snakeTimeRemaining) return;

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    snakeTimeRemaining.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

    if (seconds <= 10) {
        snakeTimer.classList.add('warning');
    } else {
        snakeTimer.classList.remove('warning');
    }
}

function showSnakeDeathOverlay(reason) {
    const reasonText = {
        'wall': 'Collision avec un mur',
        'self': 'Tu t\'es mordu la queue !',
        'collision': 'Collision avec un autre serpent',
        'disconnect': 'Déconnexion'
    };

    document.getElementById('death-reason').textContent = reasonText[reason] || 'Éliminé';
    snakeDeathOverlay.style.display = 'flex';
}

function showSnakeGameOver(data) {
    snakeDeathOverlay.style.display = 'none';

    const title = document.getElementById('snake-result-title');
    const isWinner = data.winner === playerId;

    if (isWinner) {
        title.textContent = 'VICTOIRE ! 🏆';
        title.style.color = '#FFD700';
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
        });
    } else if (data.winner) {
        title.textContent = 'DÉFAITE...';
        title.style.color = '#FF6B6B';
    } else {
        title.textContent = 'ÉGALITÉ !';
        title.style.color = '#FFD93D';
    }

    // Build rankings
    const rankingsDiv = document.getElementById('snake-rankings');
    rankingsDiv.innerHTML = '';

    const medals = ['🥇', '🥈', '🥉', '4️⃣'];

    data.rankings.forEach((rank, i) => {
        const player = snakePlayers[rank.playerId] || { username: rank.username, avatar: 1 };
        const isMe = rank.playerId === playerId;

        const div = document.createElement('div');
        div.className = 'snake-ranking-item';
        div.innerHTML = `
            <span class="ranking-position">${medals[i] || (i + 1)}</span>
            <img src="${getAvatarPath(player.avatar)}" class="ranking-avatar" alt="">
            <span class="ranking-name">${isMe ? 'Moi' : player.username}</span>
            <span class="ranking-score">${rank.score} pts</span>
        `;
        rankingsDiv.appendChild(div);
    });

    snakeGameoverOverlay.style.display = 'flex';
}

// Snake Game Over Buttons
document.getElementById('snake-replay-btn')?.addEventListener('click', () => {
    location.reload();
});

document.getElementById('snake-home-btn')?.addEventListener('click', () => {
    location.href = '/';
});

// Snake Controls - Keyboard
document.addEventListener('keydown', (e) => {
    if (currentGameType !== 'snake' || snakeGameStatus !== 'playing') return;

    // Throttle inputs
    const now = Date.now();
    if (now - lastInputTime < 50) return;

    let direction = null;

    // Arrow keys
    switch (e.key) {
        case 'ArrowUp': direction = 'up'; break;
        case 'ArrowDown': direction = 'down'; break;
        case 'ArrowLeft': direction = 'left'; break;
        case 'ArrowRight': direction = 'right'; break;
    }

    // ZQSD (French layout)
    switch (e.key.toLowerCase()) {
        case 'z': direction = 'up'; break;
        case 's': direction = 'down'; break;
        case 'q': direction = 'left'; break;
        case 'd': direction = 'right'; break;
    }

    // WASD (US layout) - W and A only since Z/S/D overlap
    switch (e.key.toLowerCase()) {
        case 'w': direction = 'up'; break;
        case 'a': direction = 'left'; break;
    }

    if (direction) {
        e.preventDefault();
        lastInputTime = now;
        sendSnakeDirection(direction);
    }
});

// Snake Controls - Touch/Swipe
let touchStartX = 0;
let touchStartY = 0;

if (snakeCanvas) {
    snakeCanvas.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    snakeCanvas.addEventListener('touchend', (e) => {
        if (snakeGameStatus !== 'playing') return;

        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        const minSwipe = 30;

        let direction = null;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > minSwipe) direction = 'right';
            else if (deltaX < -minSwipe) direction = 'left';
        } else {
            if (deltaY > minSwipe) direction = 'down';
            else if (deltaY < -minSwipe) direction = 'up';
        }

        if (direction) {
            sendSnakeDirection(direction);
        }
    }, { passive: true });
}

// Snake Controls - Mobile Buttons
document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (snakeGameStatus !== 'playing') return;
        const direction = btn.dataset.dir;
        if (direction) {
            sendSnakeDirection(direction);
        }
    });
});

function sendSnakeDirection(direction) {
    socket.send(JSON.stringify({
        type: 'change_direction',
        gameId: gameId,
        direction: direction
    }));
}

function addSystemChatMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message system';
    msgDiv.style.cssText = 'align-self: center; background: #F0F0F0; color: #888; font-style: italic;';
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
