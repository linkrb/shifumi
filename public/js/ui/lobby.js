import { state, updateState } from '../state.js';
import { showView, getAvatarPath } from './views.js';

export function initLobby() {
    // Copy button
    document.getElementById('copy-btn').addEventListener('click', copyGameUrl);

    // Share button
    document.getElementById('share-btn').addEventListener('click', shareGameUrl);

    // Start snake button
    const startSnakeBtn = document.getElementById('start-snake-btn');
    if (startSnakeBtn) {
        startSnakeBtn.addEventListener('click', () => {
            state.socket.send(JSON.stringify({
                type: 'start_game',
                gameId: state.gameId
            }));
            startSnakeBtn.disabled = true;
            startSnakeBtn.textContent = 'Lancement...';
        });
    }
}

async function copyGameUrl() {
    const urlInput = document.getElementById('game-url');
    const btn = document.getElementById('copy-btn');
    const originalHTML = btn.innerHTML;

    try {
        await navigator.clipboard.writeText(urlInput.value);
        showCopiedFeedback(btn, originalHTML);
    } catch (err) {
        urlInput.select();
        document.execCommand('copy');
        showCopiedFeedback(btn, originalHTML);
    }
}

async function shareGameUrl() {
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
                await navigator.clipboard.writeText(url);
            }
        }
    } else {
        await navigator.clipboard.writeText(url);
        const btn = document.getElementById('share-btn');
        showCopiedFeedback(btn, btn.innerHTML);
    }
}

function showCopiedFeedback(btn, originalHTML) {
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

export function setupLobby(gameType) {
    const snakeLobbySection = document.getElementById('snake-lobby-section');
    const standardLobbySection = document.getElementById('standard-lobby-section');
    const lobbyTitle = document.getElementById('lobby-title');

    document.getElementById('game-url').value = `${window.location.origin}/game/${state.gameId}`;

    if (gameType === 'snake') {
        snakeLobbySection.style.display = 'block';
        standardLobbySection.style.display = 'none';
        lobbyTitle.textContent = 'En attente de joueurs...';
    } else {
        snakeLobbySection.style.display = 'none';
        standardLobbySection.style.display = 'block';
        lobbyTitle.textContent = "En attente d'un adversaire...";
    }

    showView('lobby');
    window.history.pushState({}, '', `/game/${state.gameId}`);
}

export function updateSnakeLobby() {
    const snakePlayerList = document.getElementById('snake-player-list');
    const startSnakeBtn = document.getElementById('start-snake-btn');
    const snakeLobbyHint = document.getElementById('snake-lobby-hint');

    if (!snakePlayerList) return;

    const playerCount = Object.keys(state.snakePlayers).length;
    document.getElementById('current-player-count').textContent = playerCount;
    document.getElementById('max-player-count').textContent = state.snakeMaxPlayers;

    // Build player list
    snakePlayerList.innerHTML = '';
    Object.entries(state.snakePlayers).forEach(([pid, player]) => {
        const div = document.createElement('div');
        div.className = 'lobby-player';
        div.innerHTML = `
            <img src="${getAvatarPath(player.avatar)}" class="lobby-avatar" alt="Avatar">
            <span class="lobby-username">${player.username}</span>
            ${state.isGameCreator && pid === state.playerId ? '<span class="creator-badge">Host</span>' : ''}
        `;
        snakePlayerList.appendChild(div);
    });

    // Show start button for creator if enough players
    if (startSnakeBtn) {
        if (state.isGameCreator && playerCount >= 2) {
            startSnakeBtn.style.display = 'block';
            snakeLobbyHint.style.display = 'none';
        } else {
            startSnakeBtn.style.display = 'none';
            snakeLobbyHint.style.display = 'block';
            snakeLobbyHint.textContent = state.isGameCreator
                ? 'En attente de joueurs (min. 2)...'
                : "En attente du lancement par l'hôte...";
        }
    }
}
