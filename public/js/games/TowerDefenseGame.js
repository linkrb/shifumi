import { BaseGame } from './BaseGame.js';
import { state, updateState } from '../state.js';
import { setStatus, getAvatarPath, showView, escapeHtml } from '../ui/views.js';
import { addSystemChatMessage } from '../ui/chat.js';

const CELL_SIZE = 48;
const CELL_TYPES = { GRASS: 0, PATH: 1, BASE: 2, SPAWN: 3 };

// Couleurs par défaut (utilisées si pas d'assets)
const TOWER_COLORS = {
    archer: '#98D4BB',
    cannon: '#FF7F7F',
    ice: '#87CEEB',
    sniper: '#E6E6FA'
};

const ENEMY_COLORS = {
    basic: '#FFB5C5',
    fast: '#FFD93D',
    tank: '#9B59B6',
    boss: '#8B0000'
};

export class TowerDefenseGame extends BaseGame {
    constructor() {
        super('towerdefense');
        this.container = document.getElementById('td-area');
        this.canvas = document.getElementById('td-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        this.countdownOverlay = document.getElementById('countdown-overlay');
        this.countdownNumber = document.getElementById('countdown-number');
        this.countdownInterval = null;

        // État du jeu
        this.grid = null;
        this.gridSize = null;
        this.path = null;
        this.towerTypes = null;
        this.towers = [];
        this.enemies = [];
        this.projectiles = [];
        this.gold = 0;
        this.baseHealth = 0;
        this.wave = 0;
        this.totalWaves = 10;

        // UI state
        this.selectedTowerType = 'archer';
        this.hoveredCell = null;

        // Assets
        this.assets = {};
        this.assetsLoaded = false;

        this.init();
    }

    init() {
        this.loadAssets();

        // Canvas click handler
        if (this.canvas) {
            this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
            this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
            this.canvas.addEventListener('mouseleave', () => { this.hoveredCell = null; });
        }

        // Tower selection buttons
        document.querySelectorAll('.td-tower-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.tower;
                if (type) {
                    this.selectedTowerType = type;
                    document.querySelectorAll('.td-tower-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                }
            });
        });

        // Game over buttons
        document.getElementById('td-replay-btn')?.addEventListener('click', () => this.requestRematch());
        document.getElementById('td-home-btn')?.addEventListener('click', () => location.href = '/');
    }

    loadAssets() {
        const assetList = [
            { name: 'tower_archer', src: '/images/td/tower_archer.png' },
            { name: 'tower_cannon', src: '/images/td/tower_cannon.png' },
            { name: 'tower_ice', src: '/images/td/tower_ice.png' },
            { name: 'tower_sniper', src: '/images/td/tower_sniper.png' },
            { name: 'enemy_basic', src: '/images/td/enemy_basic.png' },
            { name: 'enemy_fast', src: '/images/td/enemy_fast.png' },
            { name: 'enemy_tank', src: '/images/td/enemy_tank.png' },
            { name: 'enemy_boss', src: '/images/td/enemy_boss.png' },
        ];

        let loaded = 0;
        assetList.forEach(asset => {
            const img = new Image();
            img.onload = () => {
                this.assets[asset.name] = img;
                loaded++;
                if (loaded === assetList.length) {
                    this.assetsLoaded = true;
                }
            };
            img.onerror = () => {
                loaded++;
                if (loaded === assetList.length) {
                    this.assetsLoaded = true;
                }
            };
            img.src = asset.src;
        });
    }

    handleCanvasClick(e) {
        if (state.tdGameStatus !== 'playing') return;

        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
        const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);

        // Vérifier si on peut placer une tour
        if (this.canPlaceTower(x, y)) {
            this.placeTower(x, y, this.selectedTowerType);
        }
    }

    handleCanvasHover(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
        const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);

        if (x >= 0 && x < this.gridSize?.width && y >= 0 && y < this.gridSize?.height) {
            this.hoveredCell = { x, y };
        } else {
            this.hoveredCell = null;
        }
    }

    canPlaceTower(x, y) {
        if (!this.grid || !this.gridSize) return false;
        if (x < 0 || x >= this.gridSize.width || y < 0 || y >= this.gridSize.height) return false;
        if (this.grid[y][x] !== CELL_TYPES.GRASS) return false;
        if (this.towers.some(t => t.x === x && t.y === y)) return false;

        const cost = this.towerTypes?.[this.selectedTowerType]?.cost || 0;
        return this.gold >= cost;
    }

    placeTower(x, y, towerType) {
        state.socket.send(JSON.stringify({
            type: 'make_move',
            gameId: state.gameId,
            type: 'place_tower',
            x,
            y,
            towerType
        }));
    }

    onGameStarting(data) {
        updateState({ tdGameStatus: 'countdown' });

        this.grid = data.grid;
        this.gridSize = data.gridSize;
        this.path = data.path;
        this.gold = data.gold;
        this.baseHealth = data.baseHealth;
        this.towerTypes = data.towerTypes;
        this.towers = [];
        this.enemies = [];
        this.projectiles = [];
        this.wave = 0;

        // Resize canvas
        if (this.canvas) {
            this.canvas.width = this.gridSize.width * CELL_SIZE;
            this.canvas.height = this.gridSize.height * CELL_SIZE;
        }

        showView('game');
        this.show();
        this.updateUI();
        this.render();
        this.startCountdown(data.countdown);
    }

    onGameStarted() {
        updateState({ tdGameStatus: 'playing' });
        setStatus("Vague 1 !");
    }

    onUpdate(data) {
        this.enemies = data.enemies || [];
        this.projectiles = data.projectiles || [];
        this.gold = data.gold;
        this.baseHealth = data.baseHealth;
        this.updateUI();
        this.render();
    }

    onTowerPlaced(data) {
        this.towers.push(data.tower);
        this.gold = data.gold;
        this.updateUI();

        if (data.placedBy !== state.playerId) {
            addSystemChatMessage(`${data.username} a placé une tour ${data.tower.type}`);
        }
    }

    onTowerSold(data) {
        this.towers = this.towers.filter(t => t.id !== data.towerId);
        this.gold = data.gold;
        this.updateUI();
    }

    onWaveStart(data) {
        this.wave = data.wave;
        this.totalWaves = data.totalWaves;
        this.updateUI();
        setStatus(`Vague ${data.wave}/${data.totalWaves}`);
        addSystemChatMessage(`Vague ${data.wave} - ${data.enemyCount} ennemis !`);
    }

    onWaveComplete(data) {
        this.wave = data.wave;
        this.gold = data.gold;
        this.updateUI();
        addSystemChatMessage(`Vague terminée ! Bonus: +${data.bonus} or`);
    }

    onEnemyKilled(data) {
        this.gold = data.gold;
        this.updateUI();
    }

    onBaseHit(data) {
        this.baseHealth = data.health;
        this.updateUI();
        // Flash rouge sur la base
        this.flashBase = Date.now();
    }

    onGameVictory(data) {
        updateState({ tdGameStatus: 'victory' });
        this.showGameOver(true, data);
    }

    onGameOver(data) {
        updateState({ tdGameStatus: 'gameover' });
        this.showGameOver(false, data);
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

    render() {
        if (!this.ctx || !this.gridSize) return;

        // Clear
        this.ctx.fillStyle = '#2d5a3d';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grille
        this.renderGrid();

        // Tours
        this.renderTowers();

        // Ennemis
        this.renderEnemies();

        // Projectiles
        this.renderProjectiles();

        // Hover preview
        this.renderHoverPreview();
    }

    renderGrid() {
        for (let y = 0; y < this.gridSize.height; y++) {
            for (let x = 0; x < this.gridSize.width; x++) {
                const cellType = this.grid[y][x];
                const px = x * CELL_SIZE;
                const py = y * CELL_SIZE;

                switch (cellType) {
                    case CELL_TYPES.PATH:
                        this.ctx.fillStyle = '#c4a77d';
                        this.ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                        break;
                    case CELL_TYPES.SPAWN:
                        this.ctx.fillStyle = '#e74c3c';
                        this.ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                        this.ctx.fillStyle = '#fff';
                        this.ctx.font = '12px Arial';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText('SPAWN', px + CELL_SIZE / 2, py + CELL_SIZE / 2 + 4);
                        break;
                    case CELL_TYPES.BASE:
                        const isFlashing = this.flashBase && (Date.now() - this.flashBase < 300);
                        this.ctx.fillStyle = isFlashing ? '#ff0000' : '#3498db';
                        this.ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                        this.ctx.fillStyle = '#fff';
                        this.ctx.font = '20px Arial';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText('🏠', px + CELL_SIZE / 2, py + CELL_SIZE / 2 + 6);
                        break;
                    default:
                        // Herbe
                        this.ctx.fillStyle = '#4a7c59';
                        this.ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                        this.ctx.strokeStyle = '#3d6b4a';
                        this.ctx.strokeRect(px, py, CELL_SIZE, CELL_SIZE);
                }
            }
        }
    }

    renderTowers() {
        this.towers.forEach(tower => {
            const px = tower.x * CELL_SIZE;
            const py = tower.y * CELL_SIZE;

            const assetName = `tower_${tower.type}`;
            if (this.assets[assetName]) {
                this.ctx.drawImage(this.assets[assetName], px, py, CELL_SIZE, CELL_SIZE);
            } else {
                // Fallback: forme géométrique
                this.ctx.fillStyle = TOWER_COLORS[tower.type] || '#888';
                this.ctx.beginPath();
                this.ctx.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, CELL_SIZE / 2 - 4, 0, Math.PI * 2);
                this.ctx.fill();

                // Contour
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();

                // Icône simple
                this.ctx.fillStyle = '#333';
                this.ctx.font = '16px Arial';
                this.ctx.textAlign = 'center';
                const icons = { archer: '🏹', cannon: '💣', ice: '❄️', sniper: '🎯' };
                this.ctx.fillText(icons[tower.type] || '?', px + CELL_SIZE / 2, py + CELL_SIZE / 2 + 6);
            }

            // Indicateur de portée au hover (optionnel)
            if (this.hoveredCell?.x === tower.x && this.hoveredCell?.y === tower.y) {
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, tower.range * CELL_SIZE, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        });
    }

    renderEnemies() {
        this.enemies.forEach(enemy => {
            const px = enemy.x * CELL_SIZE;
            const py = enemy.y * CELL_SIZE;
            const size = enemy.type === 'boss' ? CELL_SIZE * 1.5 : CELL_SIZE * 0.8;
            const offset = (CELL_SIZE - size) / 2;

            const assetName = `enemy_${enemy.type}`;
            if (this.assets[assetName]) {
                this.ctx.drawImage(this.assets[assetName], px + offset, py + offset, size, size);
            } else {
                // Fallback: cercle coloré
                this.ctx.fillStyle = enemy.slowed ? '#87CEEB' : (ENEMY_COLORS[enemy.type] || '#FFB5C5');
                this.ctx.beginPath();
                this.ctx.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, size / 2, 0, Math.PI * 2);
                this.ctx.fill();

                // Contour
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }

            // Barre de vie
            const hpRatio = enemy.hp / enemy.maxHp;
            const barWidth = size;
            const barHeight = 4;
            const barY = py + offset - 8;

            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(px + offset, barY, barWidth, barHeight);

            this.ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
            this.ctx.fillRect(px + offset, barY, barWidth * hpRatio, barHeight);
        });
    }

    renderProjectiles() {
        this.projectiles.forEach(proj => {
            const px = proj.x * CELL_SIZE + CELL_SIZE / 2;
            const py = proj.y * CELL_SIZE + CELL_SIZE / 2;

            const colors = {
                archer: '#8B4513',
                cannon: '#333',
                ice: '#87CEEB',
                sniper: '#FFD700'
            };

            this.ctx.fillStyle = colors[proj.type] || '#fff';
            this.ctx.beginPath();
            this.ctx.arc(px, py, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    renderHoverPreview() {
        if (!this.hoveredCell || state.tdGameStatus !== 'playing') return;

        const { x, y } = this.hoveredCell;
        const px = x * CELL_SIZE;
        const py = y * CELL_SIZE;

        if (this.canPlaceTower(x, y)) {
            // Preview vert
            this.ctx.fillStyle = 'rgba(46, 204, 113, 0.4)';
            this.ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

            // Portée preview
            const range = this.towerTypes?.[this.selectedTowerType]?.range || 3;
            this.ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, range * CELL_SIZE, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        } else if (this.grid[y]?.[x] === CELL_TYPES.GRASS) {
            // Preview rouge (pas assez d'or ou déjà occupé)
            this.ctx.fillStyle = 'rgba(231, 76, 60, 0.4)';
            this.ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
        }
    }

    updateUI() {
        // Or
        const goldEl = document.getElementById('td-gold');
        if (goldEl) goldEl.textContent = this.gold;

        // Vie de la base
        const healthEl = document.getElementById('td-health');
        if (healthEl) healthEl.textContent = this.baseHealth;

        // Vague
        const waveEl = document.getElementById('td-wave');
        if (waveEl) waveEl.textContent = `${this.wave}/${this.totalWaves}`;

        // Mettre à jour les boutons de tour (griser si pas assez d'or)
        document.querySelectorAll('.td-tower-btn').forEach(btn => {
            const type = btn.dataset.tower;
            const cost = this.towerTypes?.[type]?.cost || 0;
            btn.classList.toggle('disabled', this.gold < cost);
        });
    }

    showGameOver(victory, data) {
        const overlay = document.getElementById('td-gameover-overlay');
        const title = document.getElementById('td-result-title');
        const stats = document.getElementById('td-stats');

        if (victory) {
            title.textContent = 'VICTOIRE ! 🏆';
            title.style.color = '#FFD700';
            if (typeof confetti !== 'undefined') {
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            }
        } else {
            title.textContent = 'DÉFAITE...';
            title.style.color = '#FF6B6B';
        }

        stats.innerHTML = `
            <div class="td-stat">Vague atteinte: ${data.wave || this.wave}</div>
            <div class="td-stat">Or final: ${data.gold || this.gold}</div>
            <div class="td-stat">Vie restante: ${data.baseHealth || this.baseHealth}</div>
        `;

        overlay.style.display = 'flex';
    }

    reset() {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.countdownOverlay.style.display = 'none';
        const overlay = document.getElementById('td-gameover-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    requestRematch() {
        const btn = document.getElementById('td-replay-btn');
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
        this.reset();

        const btn = document.getElementById('td-replay-btn');
        if (btn) {
            btn.textContent = 'Rejouer';
            btn.disabled = false;
        }

        updateState({ tdGameStatus: 'waiting' });
        addSystemChatMessage('La partie recommence !');
    }

    show() {
        super.show();
        // Hide standard scoreboard
        const scoreBoard = document.querySelector('.score-board');
        if (scoreBoard) scoreBoard.style.display = 'none';
    }
}
