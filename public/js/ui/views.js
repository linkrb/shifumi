import { state, updateState } from '../state.js';

const views = {
    home: document.getElementById('home'),
    avatarSelection: document.getElementById('avatar-selection'),
    gameSelection: document.getElementById('game-selection'),
    lobby: document.getElementById('lobby'),
    game: document.getElementById('game')
};

export function showView(viewName) {
    Object.values(views).forEach(el => el.classList.remove('active'));
    views[viewName].classList.add('active');
    updateState({ currentView: viewName });
}

export function setStatus(msg) {
    const statusMsg = document.getElementById('status-msg');
    statusMsg.textContent = msg;
}

export function showMessage(title, text, action = null) {
    const modal = document.getElementById('message-modal');
    const titleEl = document.getElementById('message-title');
    const textEl = document.getElementById('message-text');
    const btn = document.getElementById('message-btn');

    titleEl.textContent = title;
    textEl.textContent = text;

    btn.onclick = () => {
        modal.style.display = 'none';
        if (action) action();
    };

    modal.style.display = 'flex';
}

export function getAvatarPath(id, type = 'static') {
    if (id == 1) {
        if (type === 'combat') return '/avatars/fox_combat.gif';
        return '/avatars/fox.png';
    }
    if (type === 'combat') return null;
    return `/avatars/avatar_${id}.png`;
}

export function updateGameAvatars() {
    const myScoreContainer = document.querySelector('#my-score').parentElement;
    const opScoreContainer = document.querySelector('#op-score').parentElement;

    myScoreContainer.querySelectorAll('.player-avatar').forEach(el => el.remove());
    opScoreContainer.querySelectorAll('.player-avatar').forEach(el => el.remove());

    const myAvatarImg = document.createElement('img');
    myAvatarImg.src = getAvatarPath(state.myAvatar, 'static');
    myAvatarImg.className = 'player-avatar';
    myScoreContainer.insertBefore(myAvatarImg, myScoreContainer.firstChild);

    const opAvatarImg = document.createElement('img');
    opAvatarImg.src = getAvatarPath(state.opAvatar, 'static');
    opAvatarImg.className = 'player-avatar';
    opScoreContainer.insertBefore(opAvatarImg, opScoreContainer.firstChild);
}

export function updateUsernames(usernames, opponentId) {
    if (usernames) {
        updateState({
            myUsername: usernames[state.playerId],
            opUsername: usernames[opponentId]
        });

        document.querySelector('#my-score').previousElementSibling.textContent = state.myUsername;
        document.querySelector('#op-score').previousElementSibling.textContent = state.opUsername;
    }
}

export function updateGameModeUI(rounds) {
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

export function shakeElement(el) {
    el.style.transform = 'translateX(5px)';
    setTimeout(() => { el.style.transform = 'translateX(-5px)'; }, 50);
    setTimeout(() => { el.style.transform = 'translateX(5px)'; }, 100);
    setTimeout(() => { el.style.transform = 'translateX(0)'; }, 150);
}
