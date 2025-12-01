const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${window.location.host}`);

// State
let gameId = null;
let playerId = null;
let currentView = 'home';
let myScore = 0;
let opScore = 0;

// DOM Elements
const views = {
    home: document.getElementById('home'),
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
        joinGame(id);
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
            showView('game');
            setStatus("C'est parti ! Faites votre choix.");
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
    socket.send(JSON.stringify({ type: 'create_game' }));
});

document.getElementById('join-btn').addEventListener('click', () => {
    const input = document.getElementById('join-input').value;
    // Extract ID from URL if full URL pasted
    let id = input;
    if (input.includes('/game/')) {
        id = input.split('/game/')[1];
    }
    if (id) joinGame(id);
});

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
    socket.send(JSON.stringify({
        type: 'join_game',
        gameId: id
    }));
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

// Handle URL routing for direct access
if (window.location.pathname.startsWith('/game/')) {
    // Wait for connection to open
}
