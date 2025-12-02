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
const replayStatus = document.getElementById('replay-status');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatMessages = document.getElementById('chat-messages');

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

        case 'opponent_moved':
            setStatus("L'adversaire a joué. À vous !");
            break;

        case 'round_result':
            showResult(data);
            break;

        case 'new_round':
            resetRoundUI();
            break;

        case 'opponent_wants_replay':
            replayStatus.textContent = "L'adversaire veut rejouer...";
            break;

        case 'opponent_disconnected':
            alert("L'adversaire s'est déconnecté.");
            location.href = '/';
            break;

        case 'error':
            alert(data.message);
            location.href = '/';
            break;
    }
};

// Actions
document.getElementById('create-btn').addEventListener('click', () => {
    showView('avatarSelection');
});

document.getElementById('join-btn').addEventListener('click', () => {
    const input = document.getElementById('join-input').value;
    if (input) {
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
            username: username
        }));
    }
}

document.getElementById('copy-btn').addEventListener('click', () => {
    const urlInput = document.getElementById('game-url');
    urlInput.select();
    document.execCommand('copy');
    const btn = document.getElementById('copy-btn');
    btn.textContent = 'Copié !';
    setTimeout(() => btn.textContent = 'Copier', 2000);
});

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
