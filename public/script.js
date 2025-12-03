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

// DOM Elements
const views = {
    home: document.getElementById('home'),
    avatarSelection: document.getElementById('avatar-selection'),
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
            document.getElementById('game-url').value = `${window.location.origin}/game/${gameId}`;
            showView('lobby');
            // Update URL without reload
            window.history.pushState({}, '', `/game/${gameId}`);
            break;

        case 'game_start':
            gameId = data.gameId;
            if (!playerId) playerId = data.playerId;

            // Set game settings
            gameWinRounds = data.winRounds;
            updateGameModeUI(gameWinRounds);

            // Set avatars
            myAvatar = data.avatars[playerId];
            opAvatar = data.avatars[data.opponentId];

            updateGameAvatars();
            updateUsernames(data.usernames, data.opponentId);
            showView('game');
            setStatus("C'est parti ! Faites votre choix.");
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
            setStatus("L'adversaire a joué. À vous !");
            break;

        case 'round_result':
            showResult(data);
            break;

        case 'game_won':
            showGameWinner(data);
            break;

        case 'new_round':
            resetRoundUI();
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
    proceedToGame();
});

function proceedToGame() {
    const pendingJoin = document.getElementById('join-input').dataset.pendingJoin;

    if (pendingJoin) {
        // Join Game
        let id = pendingJoin;
        if (pendingJoin.includes('/game/')) {
            id = pendingJoin.split('/game/')[1];
        }
        if (id) joinGame(id);
    } else {
        // Create Game
        const username = document.getElementById('username-input').value.trim() || 'Joueur 1';
        socket.send(JSON.stringify({
            type: 'create_game',
            avatarId: selectedAvatar,
            username: username,
            winRounds: selectedWinRounds
        }));
    }
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
                title: 'Shifumi Online',
                text: 'Rejoins-moi pour une partie de Shifumi !',
                url: url
            });
        } catch (err) {
            // User cancelled or error occurred
            if (err.name !== 'AbortError') {
                console.error('Share failed:', err);
                // Fallback: copy to clipboard
                copyToClipboard(url);
            }
        }
    } else {
        // Fallback for browsers without Web Share API
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
    });
});

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

function updateGameAvatars() {
    // Inject avatars into score board
    const myScoreContainer = document.querySelector('#my-score').parentElement;
    const opScoreContainer = document.querySelector('#op-score').parentElement;

    // Remove existing avatars if any
    myScoreContainer.querySelectorAll('.player-avatar').forEach(el => el.remove());
    opScoreContainer.querySelectorAll('.player-avatar').forEach(el => el.remove());

    const myAvatarImg = document.createElement('img');
    myAvatarImg.src = `/avatars/avatar_${myAvatar}.png`;
    myAvatarImg.className = 'player-avatar';
    myScoreContainer.insertBefore(myAvatarImg, myScoreContainer.firstChild);

    const opAvatarImg = document.createElement('img');
    opAvatarImg.src = `/avatars/avatar_${opAvatar}.png`;
    opAvatarImg.className = 'player-avatar';
    opScoreContainer.insertBefore(opAvatarImg, opScoreContainer.firstChild);
}

function showResult(data) {
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

    const title = document.getElementById('result-title');
    if (data.winner === playerId) {
        title.textContent = "Vous avez gagné ! 🎉";
        title.style.color = "var(--success)";
    } else if (data.winner === null) {
        title.textContent = "Égalité ! 🤝";
        title.style.color = "var(--warning)";
    } else {
        title.textContent = "Perdu... 😢";
        title.style.color = "var(--danger)";
    }

    // Update scores
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
    setStatus("Nouvelle manche ! Faites votre choix.");
    replayBtn.textContent = 'Rejouer';
    replayBtn.disabled = false;
    newGameBtn.style.display = 'none'; // Hide new game button for regular rounds
    replayStatus.textContent = '';
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
        // Removed optimistic update to avoid duplication (server broadcasts back)
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
        // Show local feedback immediately
        showFloatingEmote(emote, true);
    });
});

function showFloatingEmote(emote, isMe) {
    const el = document.createElement('div');
    el.textContent = emote;
    el.className = 'floating-emote';

    // Randomize position slightly
    const randomX = (Math.random() - 0.5) * 100; // -50 to +50 px
    const startX = isMe ? '70%' : '30%'; // Right side for me, left for opponent

    el.style.left = `calc(${startX} + ${randomX}px)`;

    document.body.appendChild(el);

    // Remove after animation
    setTimeout(() => {
        el.remove();
    }, 3000);
}

function updateUsernames(usernames, opponentId) {
    if (usernames) {
        myUsername = usernames[playerId];
        opUsername = usernames[opponentId];

        document.querySelector('#my-score').previousElementSibling.textContent = myUsername; // Was "Vous"
        document.querySelector('#op-score').previousElementSibling.textContent = opUsername; // Was "Adversaire"
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

    if (!rounds) { // Handle null or 0
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
        // Trigger Confetti
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

    // Update scores one last time
    myScore = data.scores[playerId];
    opScore = data.scores[data.opponentId];
    myScoreEl.textContent = myScore;
    opScoreEl.textContent = opScore;

    // Show both buttons for final victory
    replayBtn.textContent = 'Rejouer';
    replayBtn.disabled = false;
    newGameBtn.style.display = 'block';

    resultOverlay.style.display = 'flex';
}
