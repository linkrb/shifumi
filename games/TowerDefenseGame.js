const BaseGame = require('./BaseGame');

const GRID_SIZE = { width: 16, height: 12 };
const TICK_RATE = 100; // ms
const CELL_TYPES = { GRASS: 0, PATH: 1, BASE: 2, SPAWN: 3 };

// Chemin prédéfini (serpentin)
const DEFAULT_PATH = [
    { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
    { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 },
    { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 },
    { x: 8, y: 5 }, { x: 8, y: 4 }, { x: 8, y: 3 }, { x: 8, y: 2 },
    { x: 9, y: 2 }, { x: 10, y: 2 }, { x: 11, y: 2 }, { x: 12, y: 2 },
    { x: 12, y: 3 }, { x: 12, y: 4 }, { x: 12, y: 5 }, { x: 12, y: 6 },
    { x: 12, y: 7 }, { x: 12, y: 8 }, { x: 12, y: 9 },
    { x: 13, y: 9 }, { x: 14, y: 9 }, { x: 15, y: 9 }
];

// Types de tours
const TOWER_TYPES = {
    archer: { cost: 50, damage: 15, range: 3, cooldown: 800, projectileSpeed: 8 },
    cannon: { cost: 100, damage: 40, range: 2.5, cooldown: 1500, projectileSpeed: 5, splash: 1 },
    ice: { cost: 75, damage: 5, range: 2.5, cooldown: 1000, projectileSpeed: 6, slow: 0.5, slowDuration: 2000 },
    sniper: { cost: 150, damage: 80, range: 6, cooldown: 2500, projectileSpeed: 15 }
};

// Types d'ennemis par vague
const ENEMY_TYPES = {
    basic: { hp: 50, speed: 1, reward: 10 },
    fast: { hp: 30, speed: 2, reward: 15 },
    tank: { hp: 150, speed: 0.6, reward: 25 },
    boss: { hp: 500, speed: 0.4, reward: 100 }
};

// Configuration des vagues
const WAVES = [
    { enemies: [{ type: 'basic', count: 5 }], spawnDelay: 1500 },
    { enemies: [{ type: 'basic', count: 8 }], spawnDelay: 1200 },
    { enemies: [{ type: 'basic', count: 5 }, { type: 'fast', count: 3 }], spawnDelay: 1000 },
    { enemies: [{ type: 'fast', count: 8 }], spawnDelay: 800 },
    { enemies: [{ type: 'basic', count: 5 }, { type: 'tank', count: 2 }], spawnDelay: 1200 },
    { enemies: [{ type: 'tank', count: 5 }], spawnDelay: 1500 },
    { enemies: [{ type: 'basic', count: 10 }, { type: 'fast', count: 5 }], spawnDelay: 800 },
    { enemies: [{ type: 'fast', count: 8 }, { type: 'tank', count: 3 }], spawnDelay: 1000 },
    { enemies: [{ type: 'tank', count: 5 }, { type: 'fast', count: 5 }], spawnDelay: 900 },
    { enemies: [{ type: 'boss', count: 1 }, { type: 'basic', count: 10 }], spawnDelay: 1000 }
];

class TowerDefenseGame extends BaseGame {
    constructor(gameId, creator, options = {}) {
        super(gameId, creator, options);
        this.gameType = 'towerdefense';
        this.maxPlayersCount = Math.min(4, Math.max(2, options.maxPlayers || 4));
        this.gameStatus = 'waiting';
        this.creatorId = creator.id;

        // État du jeu
        this.gold = 200;
        this.baseHealth = 20;
        this.wave = 0;
        this.towers = [];
        this.enemies = [];
        this.projectiles = [];
        this.path = [...DEFAULT_PATH];
        this.grid = this.initGrid();

        // Spawn
        this.spawnQueue = [];
        this.lastSpawnTime = 0;
        this.currentSpawnDelay = 1000;

        // Game loop
        this.tickInterval = null;
        this.lastTickTime = 0;
        this.enemyIdCounter = 0;
        this.projectileIdCounter = 0;
    }

    get maxPlayers() {
        return this.maxPlayersCount;
    }

    canJoin() {
        return this.gameStatus === 'waiting' && this.players.length < this.maxPlayers;
    }

    initGrid() {
        const grid = [];
        for (let y = 0; y < GRID_SIZE.height; y++) {
            grid[y] = [];
            for (let x = 0; x < GRID_SIZE.width; x++) {
                grid[y][x] = CELL_TYPES.GRASS;
            }
        }
        // Marquer le chemin
        this.path.forEach((cell, index) => {
            if (index === 0) {
                grid[cell.y][cell.x] = CELL_TYPES.SPAWN;
            } else if (index === this.path.length - 1) {
                grid[cell.y][cell.x] = CELL_TYPES.BASE;
            } else {
                grid[cell.y][cell.x] = CELL_TYPES.PATH;
            }
        });
        return grid;
    }

    addPlayer(ws, options = {}) {
        super.addPlayer(ws, options);
        this.broadcastPlayerJoined(ws);
    }

    broadcastPlayerJoined(newPlayer) {
        this.players.forEach(player => {
            this.sendTo(player, {
                type: 'player_joined',
                gameId: this.id,
                playerId: player.id,
                newPlayerId: newPlayer.id,
                players: this.players.map(p => ({
                    id: p.id,
                    username: this.usernames[p.id],
                    avatar: this.avatars[p.id]
                })),
                maxPlayers: this.maxPlayers,
                creatorId: this.creatorId
            });
        });
    }

    onGameStart() {}

    startGame() {
        if (this.gameStatus !== 'waiting' || this.players.length < 2) return;

        this.gameStatus = 'countdown';

        this.broadcast({
            type: 'game_starting',
            countdown: 3,
            gridSize: GRID_SIZE,
            grid: this.grid,
            path: this.path,
            gold: this.gold,
            baseHealth: this.baseHealth,
            towerTypes: TOWER_TYPES
        });

        setTimeout(() => {
            this.gameStatus = 'playing';
            this.broadcast({ type: 'game_started' });
            this.tickInterval = setInterval(() => this.tick(), TICK_RATE);
            this.startWave();
        }, 3000);
    }

    startWave() {
        if (this.wave >= WAVES.length) {
            this.victory();
            return;
        }

        const waveConfig = WAVES[this.wave];
        this.spawnQueue = [];
        this.currentSpawnDelay = waveConfig.spawnDelay;

        // Construire la file d'attente de spawn
        waveConfig.enemies.forEach(group => {
            for (let i = 0; i < group.count; i++) {
                this.spawnQueue.push(group.type);
            }
        });
        // Mélanger légèrement
        this.shuffleArray(this.spawnQueue);

        this.broadcast({
            type: 'wave_start',
            wave: this.wave + 1,
            totalWaves: WAVES.length,
            enemyCount: this.spawnQueue.length
        });
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    tick() {
        if (this.gameStatus !== 'playing') return;

        const now = Date.now();
        const deltaTime = this.lastTickTime ? (now - this.lastTickTime) / 1000 : TICK_RATE / 1000;
        this.lastTickTime = now;

        // Spawn des ennemis
        this.handleSpawning(now);

        // Mise à jour des ennemis
        this.updateEnemies(deltaTime);

        // Mise à jour des tours (tir)
        this.updateTowers(now);

        // Mise à jour des projectiles
        this.updateProjectiles(deltaTime);

        // Vérifier fin de vague
        this.checkWaveEnd();

        // Broadcast état
        this.broadcast({
            type: 'td_update',
            enemies: this.enemies.map(e => ({
                id: e.id,
                type: e.type,
                x: e.x,
                y: e.y,
                hp: e.hp,
                maxHp: e.maxHp,
                slowed: e.slowUntil > now
            })),
            projectiles: this.projectiles.map(p => ({
                id: p.id,
                x: p.x,
                y: p.y,
                targetId: p.targetId,
                type: p.towerType
            })),
            gold: this.gold,
            baseHealth: this.baseHealth
        });
    }

    handleSpawning(now) {
        if (this.spawnQueue.length === 0) return;
        if (now - this.lastSpawnTime < this.currentSpawnDelay) return;

        const enemyType = this.spawnQueue.shift();
        this.spawnEnemy(enemyType);
        this.lastSpawnTime = now;
    }

    spawnEnemy(type) {
        const config = ENEMY_TYPES[type];
        const spawn = this.path[0];

        this.enemies.push({
            id: ++this.enemyIdCounter,
            type,
            x: spawn.x,
            y: spawn.y,
            hp: config.hp,
            maxHp: config.hp,
            speed: config.speed,
            reward: config.reward,
            pathIndex: 0,
            slowUntil: 0
        });
    }

    updateEnemies(deltaTime) {
        const now = Date.now();

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            // Calculer vitesse (avec slow)
            let speed = ENEMY_TYPES[enemy.type].speed;
            if (enemy.slowUntil > now) {
                speed *= 0.5;
            }

            // Mouvement vers le prochain point du chemin
            const target = this.path[enemy.pathIndex + 1];
            if (!target) {
                // Ennemi atteint la base
                this.baseHealth--;
                this.enemies.splice(i, 1);
                this.broadcast({ type: 'base_hit', health: this.baseHealth });

                if (this.baseHealth <= 0) {
                    this.gameOver();
                    return;
                }
                continue;
            }

            const dx = target.x - enemy.x;
            const dy = target.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.1) {
                enemy.pathIndex++;
            } else {
                const move = speed * deltaTime * 2;
                enemy.x += (dx / dist) * move;
                enemy.y += (dy / dist) * move;
            }
        }
    }

    updateTowers(now) {
        this.towers.forEach(tower => {
            if (now - tower.lastShot < tower.cooldown) return;

            // Trouver une cible à portée
            const target = this.findTarget(tower);
            if (target) {
                this.fireTower(tower, target, now);
            }
        });
    }

    findTarget(tower) {
        let bestTarget = null;
        let bestProgress = -1;

        for (const enemy of this.enemies) {
            const dx = enemy.x - tower.x;
            const dy = enemy.y - tower.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= tower.range && enemy.pathIndex > bestProgress) {
                bestTarget = enemy;
                bestProgress = enemy.pathIndex;
            }
        }
        return bestTarget;
    }

    fireTower(tower, target, now) {
        tower.lastShot = now;

        this.projectiles.push({
            id: ++this.projectileIdCounter,
            x: tower.x,
            y: tower.y,
            targetId: target.id,
            damage: tower.damage,
            speed: tower.projectileSpeed,
            towerType: tower.type,
            splash: tower.splash || 0,
            slow: tower.slow || 0,
            slowDuration: tower.slowDuration || 0
        });
    }

    updateProjectiles(deltaTime) {
        const now = Date.now();

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            const target = this.enemies.find(e => e.id === proj.targetId);

            if (!target) {
                this.projectiles.splice(i, 1);
                continue;
            }

            const dx = target.x - proj.x;
            const dy = target.y - proj.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.3) {
                // Impact
                this.handleProjectileHit(proj, target, now);
                this.projectiles.splice(i, 1);
            } else {
                const move = proj.speed * deltaTime;
                proj.x += (dx / dist) * move;
                proj.y += (dy / dist) * move;
            }
        }
    }

    handleProjectileHit(proj, target, now) {
        // Dégâts directs
        this.damageEnemy(target, proj.damage);

        // Slow
        if (proj.slow > 0) {
            target.slowUntil = now + proj.slowDuration;
        }

        // Splash damage
        if (proj.splash > 0) {
            this.enemies.forEach(enemy => {
                if (enemy.id === target.id) return;
                const dx = enemy.x - target.x;
                const dy = enemy.y - target.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= proj.splash) {
                    this.damageEnemy(enemy, proj.damage * 0.5);
                }
            });
        }
    }

    damageEnemy(enemy, damage) {
        enemy.hp -= damage;
        if (enemy.hp <= 0) {
            this.gold += enemy.reward;
            const index = this.enemies.indexOf(enemy);
            if (index > -1) {
                this.enemies.splice(index, 1);
            }
            this.broadcast({
                type: 'enemy_killed',
                enemyId: enemy.id,
                reward: enemy.reward,
                gold: this.gold
            });
        }
    }

    checkWaveEnd() {
        if (this.spawnQueue.length === 0 && this.enemies.length === 0 && this.gameStatus === 'playing') {
            this.wave++;

            // Bonus de fin de vague
            const waveBonus = 25 + (this.wave * 10);
            this.gold += waveBonus;

            this.broadcast({
                type: 'wave_complete',
                wave: this.wave,
                bonus: waveBonus,
                gold: this.gold
            });

            // Démarrer la prochaine vague après un délai
            setTimeout(() => {
                if (this.gameStatus === 'playing') {
                    this.startWave();
                }
            }, 5000);
        }
    }

    handleMove(ws, data) {
        if (data.type === 'place_tower') {
            this.placeTower(ws, data);
        } else if (data.type === 'sell_tower') {
            this.sellTower(ws, data);
        } else if (data.type === 'start_game' && ws.id === this.creatorId) {
            this.startGame();
        }
    }

    placeTower(ws, data) {
        const { x, y, towerType } = data;

        // Vérifications
        if (!TOWER_TYPES[towerType]) return;
        if (x < 0 || x >= GRID_SIZE.width || y < 0 || y >= GRID_SIZE.height) return;
        if (this.grid[y][x] !== CELL_TYPES.GRASS) return;
        if (this.towers.some(t => t.x === x && t.y === y)) return;

        const config = TOWER_TYPES[towerType];
        if (this.gold < config.cost) return;

        this.gold -= config.cost;

        const tower = {
            id: `${x}-${y}`,
            x,
            y,
            type: towerType,
            damage: config.damage,
            range: config.range,
            cooldown: config.cooldown,
            projectileSpeed: config.projectileSpeed,
            splash: config.splash || 0,
            slow: config.slow || 0,
            slowDuration: config.slowDuration || 0,
            lastShot: 0,
            placedBy: ws.id
        };

        this.towers.push(tower);

        this.broadcast({
            type: 'tower_placed',
            tower,
            gold: this.gold,
            placedBy: ws.id,
            username: this.usernames[ws.id]
        });
    }

    sellTower(ws, data) {
        const { towerId } = data;
        const index = this.towers.findIndex(t => t.id === towerId);
        if (index === -1) return;

        const tower = this.towers[index];
        const config = TOWER_TYPES[tower.type];
        const refund = Math.floor(config.cost * 0.5);

        this.gold += refund;
        this.towers.splice(index, 1);

        this.broadcast({
            type: 'tower_sold',
            towerId,
            refund,
            gold: this.gold,
            soldBy: ws.id
        });
    }

    victory() {
        this.gameStatus = 'victory';
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }

        this.broadcast({
            type: 'game_victory',
            wave: this.wave,
            gold: this.gold,
            baseHealth: this.baseHealth,
            players: this.players.map(p => ({
                id: p.id,
                username: this.usernames[p.id]
            }))
        });
    }

    gameOver() {
        this.gameStatus = 'gameover';
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }

        this.broadcast({
            type: 'game_over',
            wave: this.wave + 1,
            reason: 'base_destroyed'
        });
    }

    onPlayerDisconnect(ws) {
        this.removePlayer(ws);

        this.broadcast({
            type: 'player_left',
            playerId: ws.id,
            username: this.usernames[ws.id],
            players: this.players.map(p => ({
                id: p.id,
                username: this.usernames[p.id],
                avatar: this.avatars[p.id]
            }))
        });

        if (this.players.length === 0) {
            if (this.tickInterval) {
                clearInterval(this.tickInterval);
                this.tickInterval = null;
            }
        }

        return this.players.length === 0;
    }

    resetRound() {}

    handlePlayAgain(ws) {
        if (this.gameStatus !== 'victory' && this.gameStatus !== 'gameover') return;

        this.wantsRestart.add(ws.id);

        this.players.forEach(player => {
            if (player.id !== ws.id) {
                this.sendTo(player, {
                    type: 'player_wants_rematch',
                    playerId: ws.id,
                    username: this.usernames[ws.id],
                    readyCount: this.wantsRestart.size,
                    totalPlayers: this.players.length
                });
            }
        });

        if (this.wantsRestart.size === this.players.length) {
            this.restartGame();
        }
    }

    restartGame() {
        this.wantsRestart.clear();
        this.gameStatus = 'waiting';
        this.gold = 200;
        this.baseHealth = 20;
        this.wave = 0;
        this.towers = [];
        this.enemies = [];
        this.projectiles = [];
        this.spawnQueue = [];

        this.broadcast({
            type: 'game_restarted',
            players: this.players.map(p => ({
                id: p.id,
                username: this.usernames[p.id],
                avatar: this.avatars[p.id]
            })),
            maxPlayers: this.maxPlayers,
            creatorId: this.creatorId
        });

        setTimeout(() => this.startGame(), 500);
    }
}

module.exports = TowerDefenseGame;
