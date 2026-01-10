import { state, updateState } from '../state.js';
import { updateGameAvatars } from './views.js';

const resultOverlay = document.getElementById('result-overlay');
const myScoreEl = document.getElementById('my-score');
const opScoreEl = document.getElementById('op-score');
const replayBtn = document.getElementById('replay-btn');
const changeGameBtn = document.getElementById('change-game-btn');
const newGameBtn = document.getElementById('new-game-btn');
const replayStatus = document.getElementById('replay-status');

export function initResults() {
    replayBtn.addEventListener('click', () => {
        state.socket.send(JSON.stringify({
            type: 'play_again',
            gameId: state.gameId
        }));
        replayBtn.textContent = 'En attente...';
        replayBtn.disabled = true;
    });

    newGameBtn.addEventListener('click', () => {
        window.location.href = '/';
    });
}

export function showResult(data) {
    const movesDisplay = document.querySelector('.moves-display');
    const title = document.getElementById('result-title');

    if (state.currentGameType === 'shifumi') {
        movesDisplay.style.display = 'flex';
        const myMove = data.moves[state.playerId];
        const opId = Object.keys(data.moves).find(id => id !== state.playerId);
        const opMove = data.moves[opId];

        const assets = {
            rock: '/rock_user.png',
            paper: '/paper_user.png',
            scissors: '/scissors_user.png'
        };

        document.getElementById('my-move-display').innerHTML = `<img src="${assets[myMove]}" alt="${myMove}" class="move-display-icon">`;
        document.getElementById('op-move-display').innerHTML = `<img src="${assets[opMove]}" alt="${opMove}" class="move-display-icon">`;
    } else {
        movesDisplay.style.display = 'none';
        document.getElementById('my-move-display').innerHTML = '';
        document.getElementById('op-move-display').innerHTML = '';
    }

    if (data.winner === state.playerId) {
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
    const opId = Object.keys(data.scores).find(id => id !== state.playerId);
    updateState({
        myScore: data.scores[state.playerId],
        opScore: data.scores[opId]
    });
    myScoreEl.textContent = state.myScore;
    opScoreEl.textContent = state.opScore;

    setTimeout(() => {
        resultOverlay.style.display = 'flex';
    }, 500);
}

export function showGameWinner(data) {
    const title = document.getElementById('result-title');

    if (data.winner === state.playerId) {
        title.textContent = "VICTOIRE FINALE ! 🏆";
        title.style.color = "var(--success)";
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    } else {
        title.textContent = "DÉFAITE... 😢";
        title.style.color = "var(--danger)";
    }

    document.getElementById('my-move-display').innerHTML = '';
    document.getElementById('op-move-display').innerHTML = '';

    const opId = Object.keys(data.scores).find(id => id !== state.playerId);
    updateState({
        myScore: data.scores[state.playerId],
        opScore: data.scores[opId]
    });
    myScoreEl.textContent = state.myScore;
    opScoreEl.textContent = state.opScore;

    replayBtn.textContent = 'Rejouer';
    replayBtn.disabled = false;

    // Show "Changer de jeu" if in a session, otherwise show "Nouvelle Partie"
    if (state.sessionId) {
        changeGameBtn.style.display = 'block';
        newGameBtn.style.display = 'none';
    } else {
        changeGameBtn.style.display = 'none';
        newGameBtn.style.display = 'block';
    }

    resultOverlay.style.display = 'flex';
}

export function resetRoundUI() {
    resultOverlay.style.display = 'none';
    document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));

    replayBtn.textContent = 'Rejouer';
    replayBtn.disabled = false;
    changeGameBtn.style.display = 'none';
    newGameBtn.style.display = 'none';
    replayStatus.textContent = '';

    updateGameAvatars();
}

export function handleOpponentWantsReplay() {
    replayStatus.textContent = "L'adversaire veut rejouer...";
}
