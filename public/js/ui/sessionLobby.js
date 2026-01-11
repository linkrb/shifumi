import { state, updateState } from '../state.js';
import { showView, getAvatarPath } from './views.js';

export function initSessionLobby() {
    // Game option selection
    document.querySelectorAll('.session-game-option').forEach(opt => {
        opt.addEventListener('click', () => {
            if (!state.isSessionCreator) return;

            const gameType = opt.dataset.game;
            const is2PlayerGame = gameType !== 'snake';

            // Check if game is compatible with player count
            if (is2PlayerGame && state.sessionPlayers.length > 2) {
                return; // Can't select 2-player game with > 2 players
            }

            document.querySelectorAll('.session-game-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');

            selectSessionGame(gameType);
        });
    });

    // Copy button for session URL
    document.getElementById('session-copy-btn')?.addEventListener('click', () => {
        const urlInput = document.getElementById('session-url');
        if (urlInput) {
            navigator.clipboard.writeText(urlInput.value);
            const btn = document.getElementById('session-copy-btn');
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg> Copié !`;
            setTimeout(() => {
                btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg> Copier`;
            }, 2000);
        }
    });
}

export function showSessionLobby(players, creatorId, waitingForPlayer = false) {
    showView('sessionLobby');

    const playersContainer = document.getElementById('session-players');
    const gamePicker = document.getElementById('session-game-picker');
    const waitingDiv = document.getElementById('session-waiting');
    const waitingPlayerDiv = document.getElementById('session-waiting-player');

    // Update players display
    playersContainer.innerHTML = '';

    // Add player count display
    if (state.sessionMaxPlayers > 2) {
        const countDiv = document.createElement('div');
        countDiv.className = 'session-player-count-display';
        countDiv.innerHTML = `<strong>${players.length}</strong> / ${state.sessionMaxPlayers} joueurs`;
        playersContainer.appendChild(countDiv);
    }

    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'session-player';
        const isMe = player.id === state.playerId;
        div.innerHTML = `
            <img src="${getAvatarPath(player.avatar)}" class="session-avatar" alt="">
            <span class="session-username">${isMe ? 'Moi' : player.username}</span>
            ${player.isCreator ? '<span class="session-host-badge">Hôte</span>' : ''}
        `;
        playersContainer.appendChild(div);
    });

    // Update game options availability
    updateGameOptionsAvailability(players.length);

    // Update session URL
    const sessionUrl = `${window.location.origin}/session/${state.sessionId}`;
    document.getElementById('session-url').value = sessionUrl;

    // Show appropriate UI based on role and player count
    const hasEnoughPlayers = players.length >= 2;
    const sessionFull = players.length >= state.sessionMaxPlayers;

    if (!hasEnoughPlayers) {
        // Waiting for at least 1 more player
        gamePicker.style.display = 'none';
        waitingDiv.style.display = 'none';
        waitingPlayerDiv.style.display = 'block';
    } else if (state.isSessionCreator) {
        // Creator can pick a game (show URL if session not full)
        gamePicker.style.display = 'block';
        waitingDiv.style.display = 'none';
        waitingPlayerDiv.style.display = sessionFull ? 'none' : 'block';
    } else {
        // Non-creator waits for game selection
        gamePicker.style.display = 'none';
        waitingDiv.style.display = 'block';
        waitingPlayerDiv.style.display = 'none';
    }
}

function updateGameOptionsAvailability(playerCount) {
    document.querySelectorAll('.session-game-option').forEach(opt => {
        const gameType = opt.dataset.game;
        const is2PlayerGame = gameType !== 'snake';

        if (is2PlayerGame && playerCount > 2) {
            opt.classList.add('disabled');
            opt.title = 'Limité à 2 joueurs';
        } else {
            opt.classList.remove('disabled');
            opt.title = '';
        }
    });
}

function selectSessionGame(gameType) {
    state.socket.send(JSON.stringify({
        type: 'select_game',
        gameType: gameType,
        winRounds: 3
    }));
}

export function requestBackToLobby() {
    state.socket.send(JSON.stringify({
        type: 'back_to_lobby'
    }));
}
