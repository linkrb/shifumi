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
let currentGameType = 'shifumi'; // 'shifumi' or 'morpion'
let isMyTurn = false; // For Morpion

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

            if (currentGameType === 'morpion') {
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

        case 'round_result':
            showResult(data);
            if (currentGameType === 'morpion' && data.winner !== undefined) {
                // Update board one last time to ensure sync (e.g. if winner move)
                if (data.board) updateMorpionBoard(data.board);
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
        // Optional: Provide visual feedback? The 'selected' class handles it.
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
    socket.send(JSON.stringify({
        type: 'create_game',
        avatarId: selectedAvatar,
        username: username,
        winRounds: selectedWinRounds,
        gameType: type
    }));
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

function updateTurnIndicator() {
    if (currentGameType !== 'morpion') return;

    if (isMyTurn) {
        turnIndicator.textContent = "C'est à votre tour ! (X)";
        turnIndicator.style.color = "var(--cyan)";
        turnIndicator.style.border = "2px solid var(--cyan)";
    } else {
        turnIndicator.textContent = "Tour de l'adversaire (O)";
        turnIndicator.style.color = "var(--pink)";
        turnIndicator.style.border = "2px solid var(--pink)";
    }
}

function resetMorpionBoard() {
    morpionCells.forEach(cell => {
        cell.className = 'cell';
        cell.textContent = '';
    });
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
    if (type === 'morpion') {
        shifumiArea.style.display = 'none';
        morpionArea.style.display = 'flex';
        // Hide standard status msg for morpion as we have turn indicator
        // statusMsg.style.display = 'none'; // Optional
    } else {
        shifumiArea.style.display = 'flex';
        morpionArea.style.display = 'none';
        // statusMsg.style.display = 'block';
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
    // Differentiate result display for Shifumi vs Morpion?
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
        // Morpion Result
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
