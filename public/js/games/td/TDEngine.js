import {
    GRID_WIDTH, GRID_HEIGHT,
    TOWER_TYPES, ENEMY_TYPES, SHOP_ITEMS,
    LEVELS, resolvePaths
} from './tdConfig.js';

export class TDEngine {
    constructor() {
        this.gold = 200;
        this.health = 20;
        this.maxHealth = 20;
        this.level = 0;
        this.wave = 0;
        this.waveInProgress = false;
        this.towers = [];
        this.enemies = [];
        this.projectiles = [];
        this.spawnQueue = [];
        this.lastSpawn = 0;
        this.enemyId = 0;
        this.gameSpeed = 1;
        this.buffs = { damage: false, slow: false };
        this.routes = [];
        this.initLevel();

        // Callbacks - wired by the orchestrator
        this.onEnemySpawned = null;      // (enemy)
        this.onEnemyDied = null;         // (enemy, index)
        this.onEnemyReachedBase = null;  // (enemy, index)
        this.onEnemyMoved = null;        // (enemy, now)
        this.onTowerFired = null;        // (tower, target, projectile)
        this.onProjectileHit = null;     // (proj, target, damage)
        this.onProjectileMissed = null;  // (proj, index)
        this.onProjectileMoved = null;   // (proj)
        this.onWaveStarted = null;       // (waveNumber)
        this.onWaveCompleted = null;     // (waveNumber)
        this.onHealthChanged = null;     // (health)
        this.onGoldChanged = null;       // (gold)
        this.onGameOver = null;          // ()
        this.onVictory = null;           // ()
        this.onLevelComplete = null;     // (level)
        this.onNuke = null;              // ()
        this.onSplashKill = null;        // (enemy, index)
        this.onBuffsChanged = null;      // (buffs)
    }

    initLevel() {
        const levelData = LEVELS[this.level];
        const resolved = resolvePaths(levelData.path);
        this.routes = resolved.routes;
        this.grid = this.createGrid(resolved.allTiles);
    }

    get currentLevelData() {
        return LEVELS[this.level];
    }

    get currentWaves() {
        return LEVELS[this.level].waves;
    }

    createGrid(allTiles) {
        const grid = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            grid[y] = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                grid[y][x] = { type: 'grass', tower: null };
            }
        }
        // Use route[0] to determine spawn/base (first and last point of first route)
        const route0 = this.routes[0] || allTiles;
        const spawnKey = `${route0[0].x},${route0[0].y}`;
        const baseKey = `${route0[route0.length - 1].x},${route0[route0.length - 1].y}`;

        allTiles.forEach(p => {
            if (grid[p.y] && grid[p.y][p.x]) {
                const key = `${p.x},${p.y}`;
                if (key === spawnKey) {
                    grid[p.y][p.x].type = 'spawn';
                } else if (key === baseKey) {
                    grid[p.y][p.x].type = 'base';
                } else {
                    grid[p.y][p.x].type = 'path';
                }
            }
        });
        return grid;
    }

    canPlaceTower(x, y, towerType) {
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
        const cell = this.grid[y][x];
        if (cell.type !== 'grass' || cell.tower || cell.hasTree) return false;
        return this.gold >= TOWER_TYPES[towerType].cost;
    }

    getTowerOrientation(x, y) {
        const neighbors = [
            { dx: 1, dy: 0, dir: 'right' },
            { dx: -1, dy: 0, dir: 'left' },
            { dx: 0, dy: 1, dir: 'down' },
            { dx: 0, dy: -1, dir: 'up' },
        ];

        for (const n of neighbors) {
            const nx = x + n.dx, ny = y + n.dy;
            if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
                const cell = this.grid[ny][nx];
                if (cell.type === 'path' || cell.type === 'spawn' || cell.type === 'base') {
                    if (n.dir === 'up') return 'back';
                    if (n.dir === 'left') return 'side';
                    if (n.dir === 'right') return 'left';
                    if (n.dir === 'down') return 'front';
                }
            }
        }
        return 'front';
    }

    placeTower(x, y, towerType, sprite, baseScaleX, baseScaleY) {
        const config = TOWER_TYPES[towerType];
        this.gold -= config.cost;

        const tower = {
            x, y,
            type: towerType,
            ...config,
            lastShot: 0,
            sprite,
            baseScaleX,
            baseScaleY,
            angle: 0
        };

        this.towers.push(tower);
        this.grid[y][x].tower = tower;
        return tower;
    }

    sellTower(tower) {
        const config = TOWER_TYPES[tower.type];
        const sellValue = Math.floor(config.cost * 0.6);
        this.gold += sellValue;

        this.grid[tower.y][tower.x].tower = null;

        const idx = this.towers.indexOf(tower);
        if (idx > -1) this.towers.splice(idx, 1);

        return sellValue;
    }

    startWave() {
        if (this.wave >= this.currentWaves.length) return;

        const waveConfig = this.currentWaves[this.wave];
        this.spawnQueue = [];

        waveConfig.forEach(group => {
            for (let i = 0; i < group.count; i++) {
                this.spawnQueue.push(group.type);
            }
        });

        // Shuffle
        for (let i = this.spawnQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
        }

        this.wave++;
        this.waveInProgress = true;

        if (this.onWaveStarted) this.onWaveStarted(this.wave);
    }

    spawnEnemy(type, sprite, body, hpBar, baseScaleX, baseScaleY) {
        const config = ENEMY_TYPES[type];
        const id = ++this.enemyId;

        let route;
        if (config.flying) {
            // Flying enemies go in a straight line from spawn to base
            const baseRoute = this.routes[0];
            const spawn = baseRoute[0];
            const base = baseRoute[baseRoute.length - 1];
            route = [spawn, base];
        } else {
            route = this.routes[id % this.routes.length];
        }
        const spawn = route[0];

        const enemy = {
            id,
            type,
            x: spawn.x,
            y: spawn.y,
            hp: config.hp,
            maxHp: config.hp,
            speed: config.speed,
            reward: config.reward,
            pathIndex: 0,
            route,
            flying: !!config.flying,
            slowUntil: 0,
            sprite,
            body,
            hpBar,
            baseScaleX,
            baseScaleY
        };

        this.enemies.push(enemy);
        return enemy;
    }

    update(delta, now) {
        const dt = (delta / 60) * this.gameSpeed;

        // Spawn
        const spawnInterval = 600 / this.gameSpeed;
        if (this.spawnQueue.length > 0 && now - this.lastSpawn > spawnInterval) {
            const type = this.spawnQueue.shift();
            this.lastSpawn = now;
            if (this.onEnemySpawned) this.onEnemySpawned(type);
        }

        // Check wave complete
        if (this.waveInProgress && this.spawnQueue.length === 0 && this.enemies.length === 0) {
            this.waveInProgress = false;
            this.gold += 10 + this.wave * 5;

            if (this.buffs.damage || this.buffs.slow) {
                this.buffs.damage = false;
                this.buffs.slow = false;
                if (this.onBuffsChanged) this.onBuffsChanged(this.buffs);
            }

            if (this.onWaveCompleted) this.onWaveCompleted(this.wave);

            if (this.wave >= this.currentWaves.length) {
                if (this.level >= LEVELS.length - 1) {
                    if (this.onVictory) this.onVictory();
                } else {
                    if (this.onLevelComplete) this.onLevelComplete(this.level);
                }
            }
        }

        this.updateEnemies(dt, now);
        this.updateTowers(now);
        this.updateProjectiles(dt, now);
    }

    updateEnemies(dt, now) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            let speed = enemy.speed;
            let isSlow = false;
            if (this.buffs.slow) {
                speed *= 0.5;
                isSlow = true;
            } else if (enemy.slowUntil > now) {
                speed *= 0.35;
                isSlow = true;
            }

            const target = enemy.route[enemy.pathIndex + 1];
            if (!target) {
                this.health--;
                const idx = i;
                this.enemies.splice(idx, 1);
                if (this.onEnemyReachedBase) this.onEnemyReachedBase(enemy, idx);
                if (this.health <= 0) {
                    if (this.onGameOver) this.onGameOver();
                }
                continue;
            }

            const dx = target.x - enemy.x;
            const dy = target.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.08) {
                enemy.pathIndex++;
            } else {
                const move = speed * dt * 0.35;
                enemy.x += (dx / dist) * move;
                enemy.y += (dy / dist) * move;
            }

            if (this.onEnemyMoved) this.onEnemyMoved(enemy, now, isSlow);
        }
    }

    updateTowers(now) {
        for (const tower of this.towers) {
            if (now - tower.lastShot < tower.cooldown / this.gameSpeed) continue;

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

            if (bestTarget) {
                tower.lastShot = now;
                this.fireProjectile(tower, bestTarget);
            }
        }
    }

    fireProjectile(tower, target) {
        const projectile = {
            x: tower.x,
            y: tower.y,
            targetId: target.id,
            damage: tower.damage,
            speed: tower.speed,
            type: tower.type,
            splash: tower.splash || 0,
            slow: tower.slow || 0,
            sprite: null
        };

        this.projectiles.push(projectile);
        if (this.onTowerFired) this.onTowerFired(tower, target, projectile);
    }

    updateProjectiles(dt, now) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            const target = this.enemies.find(e => e.id === proj.targetId);

            if (!target) {
                this.projectiles.splice(i, 1);
                if (this.onProjectileMissed) this.onProjectileMissed(proj, i);
                continue;
            }

            const dx = target.x - proj.x;
            const dy = target.y - proj.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.25) {
                this.handleHit(proj, target, now);
                this.projectiles.splice(i, 1);
                if (this.onProjectileMissed) this.onProjectileMissed(proj, i);
            } else {
                const move = proj.speed * dt * 0.025;
                proj.x += (dx / dist) * move;
                proj.y += (dy / dist) * move;
                if (this.onProjectileMoved) this.onProjectileMoved(proj, dt, target);
            }
        }
    }

    handleHit(proj, target, now) {
        const dmgMult = this.buffs.damage ? 1.5 : 1;
        const damage = proj.damage * dmgMult;
        target.hp -= damage;

        if (proj.slow) target.slowUntil = now + 2500;

        if (this.onProjectileHit) this.onProjectileHit(proj, target, damage);

        // Splash damage
        if (proj.splash > 0) {
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                if (enemy.id === target.id) continue;
                const d = Math.sqrt((enemy.x - target.x) ** 2 + (enemy.y - target.y) ** 2);
                if (d <= proj.splash) {
                    enemy.hp -= damage * 0.4;
                    if (enemy.hp <= 0) {
                        this.gold += enemy.reward;
                        this.enemies.splice(j, 1);
                        if (this.onSplashKill) this.onSplashKill(enemy, j);
                        // Adjust target index if needed
                    }
                }
            }
        }

        if (target.hp <= 0) {
            const idx = this.enemies.indexOf(target);
            if (idx > -1) {
                this.gold += target.reward;
                this.enemies.splice(idx, 1);
                if (this.onEnemyDied) this.onEnemyDied(target, idx);
            }
        }
    }

    // Shop actions
    buyHeart() {
        if (this.gold < SHOP_ITEMS.heart.cost) return false;
        this.gold -= SHOP_ITEMS.heart.cost;
        this.health = Math.min(this.health + 1, this.maxHealth);
        return true;
    }

    buyRepair() {
        if (this.gold < SHOP_ITEMS.repair.cost) return false;
        this.gold -= SHOP_ITEMS.repair.cost;
        this.health = Math.min(this.health + 5, this.maxHealth);
        return true;
    }

    buyNuke() {
        if (this.gold < SHOP_ITEMS.nuke.cost) return false;
        this.gold -= SHOP_ITEMS.nuke.cost;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            this.gold += enemy.reward;
            this.enemies.splice(i, 1);
            if (this.onEnemyDied) this.onEnemyDied(enemy, i);
        }
        if (this.onNuke) this.onNuke();
        return true;
    }

    activateDamageBuff() {
        if (this.gold < SHOP_ITEMS.damage.cost) return false;
        this.gold -= SHOP_ITEMS.damage.cost;
        this.buffs.damage = true;
        if (this.onBuffsChanged) this.onBuffsChanged(this.buffs);
        return true;
    }

    activateSlowBuff() {
        if (this.gold < SHOP_ITEMS.slow.cost) return false;
        this.gold -= SHOP_ITEMS.slow.cost;
        this.buffs.slow = true;
        if (this.onBuffsChanged) this.onBuffsChanged(this.buffs);
        return true;
    }

    nextLevel() {
        this.level++;
        this.wave = 0;
        this.waveInProgress = false;
        this.enemies = [];
        this.projectiles = [];
        this.spawnQueue = [];
        this.towers = [];
        this.buffs = { damage: false, slow: false };
        this.initLevel();
    }

    toggleSpeed() {
        this.gameSpeed = this.gameSpeed === 1 ? 2 : 1;
        return this.gameSpeed;
    }

    getEnemyCount() {
        return this.enemies.length + this.spawnQueue.length;
    }
}
