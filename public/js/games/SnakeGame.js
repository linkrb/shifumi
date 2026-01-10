import { BaseGame } from './BaseGame.js';
import { state, updateState } from '../state.js';
import { setStatus, getAvatarPath, showView } from '../ui/views.js';
import { addSystemChatMessage } from '../ui/chat.js';

const CELL_SIZE = 15;
const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1'];

export class SnakeGame extends BaseGame {
    constructor() {
        super('snake');
        this.container = document.getElementById('snake-area');
        this.canvas = document.getElementById('snake-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.scoreboard = document.getElementById('snake-scoreboard');
        this.timer = document.getElementById('snake-timer');
        this.timeRemaining = document.getElementById('snake-time-remaining');
        this.countdownOverlay = document.getElementById('countdown-overlay');
        this.countdownNumber = document.getElementById('countdown-number');
        this.deathOverlay = document.getElementById('snake-death-overlay');
        this.gameoverOverlay = document.getElementById('snake-gameover-overlay');

        this.countdownInterval = null;
        this.lastInputTime = 0;

        this.init();
    }

    init() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Touch controls
        if (this.canvas) {
            let touchStartX = 0, touchStartY = 0;

            this.canvas.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }, { passive: true });

            this.canvas.addEventListener('touchend', (e) => {
                if (state.snakeGameStatus !== 'playing') return;

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

                if (direction) this.sendDirection(direction);
            }, { passive: true });
        }

        // Mobile button controls
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (state.snakeGameStatus !== 'playing') return;
                const direction = btn.dataset.dir;
                if (direction) this.sendDirection(direction);
            });
        });

        // Game over buttons
        document.getElementById('snake-replay-btn')?.addEventListener('click', () => this.requestRematch());
        document.getElementById('snake-home-btn')?.addEventListener('click', () => location.href = '/');
    }

    handleKeydown(e) {
        if (state.currentGameType !== 'snake' || state.snakeGameStatus !== 'playing') return;

        const now = Date.now();
        if (now - this.lastInputTime < 50) return;

        let direction = null;

        switch (e.key) {
            case 'ArrowUp': direction = 'up'; break;
            case 'ArrowDown': direction = 'down'; break;
            case 'ArrowLeft': direction = 'left'; break;
            case 'ArrowRight': direction = 'right'; break;
        }

        switch (e.key.toLowerCase()) {
            case 'z': case 'w': direction = 'up'; break;
            case 's': direction = 'down'; break;
            case 'q': case 'a': direction = 'left'; break;
            case 'd': direction = 'right'; break;
        }

        if (direction) {
            e.preventDefault();
            this.lastInputTime = now;
            this.sendDirection(direction);
        }
    }

    sendDirection(direction) {
        state.socket.send(JSON.stringify({
            type: 'change_direction',
            gameId: state.gameId,
            direction: direction
        }));
    }

    onGameStarting(data) {
        updateState({
            snakeGameStatus: 'countdown',
            snakeGameState: {
                snakes: data.snakes,
                fruits: data.fruits,
                gridSize: data.gridSize
            }
        });

        showView('game');
        this.show();

        // Hide standard scoreboard
        const scoreBoard = document.querySelector('.score-board');
        if (scoreBoard) scoreBoard.style.display = 'none';

        if (data.gameMode === 'score' && data.timerDuration) {
            this.timer.style.display = 'flex';
            this.updateTimer(data.timerDuration);
        } else {
            this.timer.style.display = 'none';
        }

        this.updateScoreboard(data.snakes);
        this.render(state.snakeGameState);
        this.startCountdown(data.countdown);
    }

    onGameStarted() {
        updateState({ snakeGameStatus: 'playing' });
        setStatus("GO !");
    }

    onUpdate(data) {
        updateState({
            snakeGameState: {
                snakes: data.snakes,
                fruits: data.fruits,
                gridSize: state.snakeGameState.gridSize
            }
        });
        this.render(state.snakeGameState);
        this.updateScoreboard(data.snakes);
        if (data.timeRemaining !== null) {
            this.updateTimer(data.timeRemaining);
        }
    }

    onSnakeDeath(data) {
        if (data.playerId === state.playerId) {
            this.showDeathOverlay(data.reason);
        } else {
            addSystemChatMessage(`${data.username} a été éliminé !`);
        }
    }

    onGameOver(data) {
        updateState({ snakeGameStatus: 'finished' });
        this.showGameOver(data);
    }

    startCountdown(seconds) {
        this.countdownOverlay.style.display = 'flex';
        let count = seconds;

        const updateCount = () => {
            if (count > 0) {
                this.countdownNumber.textContent = count;
                this.countdownNumber.style.animation = 'none';
                this.countdownNumber.offsetHeight;
                this.countdownNumber.style.animation = 'countdownPulse 1s ease-out';
                count--;
            } else {
                this.countdownNumber.textContent = 'GO!';
                setTimeout(() => {
                    this.countdownOverlay.style.display = 'none';
                }, 500);
                clearInterval(this.countdownInterval);
            }
        };

        updateCount();
        this.countdownInterval = setInterval(updateCount, 1000);
    }

    render(gameState) {
        if (!this.ctx || !gameState) return;

        const { snakes, fruits, gridSize } = gameState;

        // Clear
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= gridSize.width; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * CELL_SIZE, 0);
            this.ctx.lineTo(x * CELL_SIZE, gridSize.height * CELL_SIZE);
            this.ctx.stroke();
        }
        for (let y = 0; y <= gridSize.height; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * CELL_SIZE);
            this.ctx.lineTo(gridSize.width * CELL_SIZE, y * CELL_SIZE);
            this.ctx.stroke();
        }

        // Fruits
        fruits.forEach(fruit => {
            this.ctx.fillStyle = '#FF6B6B';
            this.ctx.beginPath();
            this.ctx.arc(
                fruit.x * CELL_SIZE + CELL_SIZE / 2,
                fruit.y * CELL_SIZE + CELL_SIZE / 2,
                CELL_SIZE / 2 - 2,
                0, Math.PI * 2
            );
            this.ctx.fill();

            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(
                fruit.x * CELL_SIZE + CELL_SIZE / 2 - 2,
                fruit.y * CELL_SIZE + CELL_SIZE / 2 - 2,
                CELL_SIZE / 6,
                0, Math.PI * 2
            );
            this.ctx.fill();
        });

        // Snakes
        let colorIndex = 0;
        Object.entries(snakes).forEach(([pid, snake]) => {
            const color = snake.color || COLORS[colorIndex % COLORS.length];

            snake.segments.forEach((seg, i) => {
                if (i === 0) {
                    this.ctx.fillStyle = snake.alive ? color : '#555';
                    this.ctx.fillRect(
                        seg.x * CELL_SIZE + 1,
                        seg.y * CELL_SIZE + 1,
                        CELL_SIZE - 2,
                        CELL_SIZE - 2
                    );

                    if (snake.alive) {
                        this.ctx.fillStyle = 'white';
                        const eyeSize = 3;
                        let eyeOffset1, eyeOffset2;

                        switch (snake.direction) {
                            case 'up':
                                eyeOffset1 = { x: 3, y: 3 };
                                eyeOffset2 = { x: CELL_SIZE - 6, y: 3 };
                                break;
                            case 'down':
                                eyeOffset1 = { x: 3, y: CELL_SIZE - 6 };
                                eyeOffset2 = { x: CELL_SIZE - 6, y: CELL_SIZE - 6 };
                                break;
                            case 'left':
                                eyeOffset1 = { x: 3, y: 3 };
                                eyeOffset2 = { x: 3, y: CELL_SIZE - 6 };
                                break;
                            default:
                                eyeOffset1 = { x: CELL_SIZE - 6, y: 3 };
                                eyeOffset2 = { x: CELL_SIZE - 6, y: CELL_SIZE - 6 };
                        }

                        this.ctx.beginPath();
                        this.ctx.arc(seg.x * CELL_SIZE + eyeOffset1.x, seg.y * CELL_SIZE + eyeOffset1.y, eyeSize, 0, Math.PI * 2);
                        this.ctx.arc(seg.x * CELL_SIZE + eyeOffset2.x, seg.y * CELL_SIZE + eyeOffset2.y, eyeSize, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                } else {
                    this.ctx.fillStyle = snake.alive ? this.adjustColor(color, -20) : '#444';
                    this.ctx.fillRect(
                        seg.x * CELL_SIZE + 2,
                        seg.y * CELL_SIZE + 2,
                        CELL_SIZE - 4,
                        CELL_SIZE - 4
                    );
                }
            });

            colorIndex++;
        });
    }

    adjustColor(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.max(0, Math.min(255, (num >> 16) + amount));
        const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
        const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
        return '#' + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
    }

    updateScoreboard(snakes) {
        if (!this.scoreboard) return;

        this.scoreboard.innerHTML = '';
        let colorIndex = 0;

        Object.entries(snakes).forEach(([pid, snake]) => {
            const player = state.snakePlayers[pid] || { username: 'Joueur', avatar: 1 };
            const color = snake.color || COLORS[colorIndex % COLORS.length];
            const isMe = pid === state.playerId;

            const div = document.createElement('div');
            div.className = `snake-player-score ${!snake.alive ? 'dead' : ''}`;
            div.style.borderLeftColor = color;
            div.innerHTML = `
                <img src="${getAvatarPath(player.avatar)}" class="score-avatar" alt="">
                <span class="score-name">${isMe ? 'Moi' : player.username}</span>
                <span class="score-value">${snake.score}</span>
            `;
            this.scoreboard.appendChild(div);

            colorIndex++;
        });
    }

    updateTimer(seconds) {
        if (!this.timeRemaining) return;

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        this.timeRemaining.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

        if (seconds <= 10) {
            this.timer.classList.add('warning');
        } else {
            this.timer.classList.remove('warning');
        }
    }

    showDeathOverlay(reason) {
        const reasonText = {
            'wall': 'Collision avec un mur',
            'self': "Tu t'es mordu la queue !",
            'collision': 'Collision avec un autre serpent',
            'disconnect': 'Déconnexion'
        };

        document.getElementById('death-reason').textContent = reasonText[reason] || 'Éliminé';
        this.deathOverlay.style.display = 'flex';
    }

    showGameOver(data) {
        this.deathOverlay.style.display = 'none';

        const title = document.getElementById('snake-result-title');
        const isWinner = data.winner === state.playerId;

        if (isWinner) {
            title.textContent = 'VICTOIRE ! 🏆';
            title.style.color = '#FFD700';
            if (typeof confetti !== 'undefined') {
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            }
        } else if (data.winner) {
            title.textContent = 'DÉFAITE...';
            title.style.color = '#FF6B6B';
        } else {
            title.textContent = 'ÉGALITÉ !';
            title.style.color = '#FFD93D';
        }

        const rankingsDiv = document.getElementById('snake-rankings');
        rankingsDiv.innerHTML = '';
        const medals = ['🥇', '🥈', '🥉', '4️⃣'];

        data.rankings.forEach((rank, i) => {
            const player = state.snakePlayers[rank.playerId] || { username: rank.username, avatar: 1 };
            const isMe = rank.playerId === state.playerId;

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

        // Show "Changer de jeu" button if in a session
        const changeGameBtn = document.getElementById('snake-change-game-btn');
        if (changeGameBtn) {
            changeGameBtn.style.display = state.sessionId ? 'block' : 'none';
        }

        this.gameoverOverlay.style.display = 'flex';
    }

    reset() {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.deathOverlay.style.display = 'none';
        this.gameoverOverlay.style.display = 'none';
        this.countdownOverlay.style.display = 'none';
    }

    requestRematch() {
        const btn = document.getElementById('snake-replay-btn');
        if (btn) {
            btn.textContent = 'En attente...';
            btn.disabled = true;
        }

        state.socket.send(JSON.stringify({
            type: 'play_again',
            gameId: state.gameId
        }));
    }

    onPlayerWantsRematch(data) {
        addSystemChatMessage(`${data.username} veut rejouer ! (${data.readyCount}/${data.totalPlayers})`);
    }

    onGameRestarted(data) {
        // Reset UI
        this.reset();

        // Reset button state
        const btn = document.getElementById('snake-replay-btn');
        if (btn) {
            btn.textContent = 'Rejouer';
            btn.disabled = false;
        }

        updateState({
            snakeGameStatus: 'waiting',
            snakeGameState: null
        });

        addSystemChatMessage('La partie recommence !');
    }
}
