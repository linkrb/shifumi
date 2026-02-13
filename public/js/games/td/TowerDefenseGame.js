import {
    GRID_WIDTH, GRID_HEIGHT,
    TOWER_TYPES, SHOP_ITEMS, LEVELS,
    fromIso
} from './tdConfig.js';
import { TDRenderer } from './TDRenderer.js';
import { TDEngine } from './TDEngine.js';

export class TowerDefenseGame {
    constructor() {
        this.renderer = new TDRenderer();
        this.engine = new TDEngine();
        this.container = null;
        this.selectedTower = 'archer';
        this.selectedPlacedTower = null;
        this.hoveredTile = null;
        this.shopOpen = false;
    }

    async init(container) {
        this.container = container || document.getElementById('game-container');

        await this.renderer.init(this.container);
        this.renderer.drawGround(this.engine.grid);

        this.wireCallbacks();
        this.setupInteraction();
        this.setupTowerButtons();
        this.setupWaveButton();
        this.setupSellButton();
        this.setupSpeedButton();
        this.setupShop();

        window.addEventListener('resize', () => this.renderer.handleResize(this.container));

        // Game loop
        this.renderer.app.ticker.add((ticker) => {
            const now = performance.now();
            this.engine.update(ticker.deltaTime, now);
            this.renderer.updateParticles((ticker.deltaTime / 60) * this.engine.gameSpeed);
            this.renderer.updateWindAnimation(now);
            this.renderer.sortEntities();
            this.updateEnemyCount();
        });

        this.updateUI();
    }

    wireCallbacks() {
        this.engine.onEnemySpawned = (type) => {
            const { sprite, body, hpBar, baseScaleX, baseScaleY } = this.renderer.createEnemySprite(type);
            const enemy = this.engine.spawnEnemy(type, sprite, body, hpBar, baseScaleX, baseScaleY);
            this.renderer.addEnemyToStage(enemy);
        };

        this.engine.onEnemyMoved = (enemy, now, isSlow) => {
            this.renderer.updateEnemyTint(enemy, isSlow);
            this.renderer.updateEnemyAnimation(enemy, now);
            this.renderer.updateEnemyPosition(enemy);
        };

        this.engine.onEnemyDied = (enemy) => {
            this.renderer.createDeathEffect(enemy.x, enemy.y);
            this.renderer.showFloatingGold(enemy.x, enemy.y, enemy.reward, this.container);
            this.renderer.removeEnemyFromStage(enemy);
            this.updateUI();
        };

        this.engine.onEnemyReachedBase = (enemy) => {
            this.renderer.removeEnemyFromStage(enemy);
            this.renderer.createDamageEffect();
            this.updateUI();
        };

        this.engine.onSplashKill = (enemy) => {
            this.renderer.createDeathEffect(enemy.x, enemy.y);
            this.renderer.removeEnemyFromStage(enemy);
        };

        this.engine.onTowerFired = (tower, target, projectile) => {
            this.renderer.animateTowerShot(tower);
            this.renderer.createMuzzleFlash(tower, target);
            projectile.sprite = this.renderer.createProjectileSprite(tower.type);
            this.renderer.addProjectileToStage(projectile, tower.x, tower.y);
        };

        this.engine.onProjectileHit = (proj, target, damage) => {
            this.renderer.removeProjectileFromStage(proj);
            this.renderer.updateEnemyHpBar(target);
            this.renderer.showFloatingDamage(target.x, target.y, damage, this.container);
            this.renderer.createHitEffect(target.x, target.y, proj.type);
        };

        this.engine.onProjectileMissed = (proj) => {
            this.renderer.removeProjectileFromStage(proj);
        };

        this.engine.onProjectileMoved = (proj, dt, target) => {
            this.renderer.updateProjectilePosition(proj);
            // Rotate sprite toward target
            if (target && proj.sprite) {
                const targetIso = this.renderer.toIso(target.x, target.y);
                const projIso = this.renderer.toIso(proj.x, proj.y);
                proj.sprite.rotation = Math.atan2(targetIso.y - projIso.y, targetIso.x - projIso.x);
            }
        };

        this.engine.onWaveStarted = (waveNumber) => {
            const announce = document.getElementById('wave-announce');
            announce.textContent = `🌊 Vague ${waveNumber}`;
            announce.classList.add('visible');
            setTimeout(() => announce.classList.remove('visible'), 1500);
            this.updateUI();
        };

        this.engine.onWaveCompleted = () => {
            this.updateUI();
        };

        this.engine.onBuffsChanged = () => {
            this.updateBuffsUI();
        };

        this.engine.onGameOver = () => {
            this.showGameOver();
        };

        this.engine.onLevelComplete = (level) => {
            this.showLevelTransition(level);
        };

        this.engine.onVictory = () => {
            this.showVictory();
        };

        this.engine.onNuke = () => {
            this.renderer.createNukeFlash();
        };
    }

    // ===== INTERACTION =====

    setupInteraction() {
        const app = this.renderer.app;

        app.stage.eventMode = 'static';
        app.stage.hitArea = app.screen;
        app.stage.cursor = 'default';

        app.stage.on('pointermove', (e) => {
            const pos = e.global;
            const grid = fromIso(pos.x, pos.y, this.renderer.offsetX, this.renderer.offsetY, this.renderer.mapScale);

            // Clear previous hover
            if (this.hoveredTile) {
                this.renderer.clearTileHoverTint(this.hoveredTile);
                this.hoveredTile = null;
                this.renderer.hideRangePreview();
                this.renderer.hideGhostTower();
                app.stage.cursor = 'default';
            }

            if (grid.x < 0 || grid.x >= GRID_WIDTH || grid.y < 0 || grid.y >= GRID_HEIGHT) return;

            const tile = this.renderer.tileMap[`${grid.x},${grid.y}`];
            if (!tile) return;

            const cell = this.engine.grid[grid.y][grid.x];
            if (cell.type === 'grass') {
                app.stage.cursor = 'pointer';
                if (!cell.tower) {
                    const canPlace = this.engine.canPlaceTower(grid.x, grid.y, this.selectedTower);
                    this.renderer.setTileHoverTint(tile, canPlace);
                    this.renderer.showRangePreview(grid.x, grid.y, this.selectedTower);
                    if (canPlace) {
                        const orientation = this.engine.getTowerOrientation(grid.x, grid.y);
                        this.renderer.showGhostTower(grid.x, grid.y, this.selectedTower, orientation);
                    }
                }
            }
            this.hoveredTile = tile;
        });

        app.stage.on('pointerdown', (e) => {
            const pos = e.global;
            const grid = fromIso(pos.x, pos.y, this.renderer.offsetX, this.renderer.offsetY, this.renderer.mapScale);

            if (grid.x < 0 || grid.x >= GRID_WIDTH || grid.y < 0 || grid.y >= GRID_HEIGHT) {
                this.hideTowerInfo();
                return;
            }
            this.handleTileClick(grid.x, grid.y);
        });

        app.stage.on('pointerleave', () => {
            if (this.hoveredTile) {
                this.renderer.clearTileHoverTint(this.hoveredTile);
                this.hoveredTile = null;
                this.renderer.hideRangePreview();
                this.renderer.hideGhostTower();
                app.stage.cursor = 'default';
            }
        });
    }

    handleTileClick(x, y) {
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return;

        const cell = this.engine.grid[y][x];

        // Click on existing tower -> show info panel
        if (cell.tower) {
            this.showTowerInfo(cell.tower);
            return;
        }

        this.hideTowerInfo();

        if (!this.engine.canPlaceTower(x, y, this.selectedTower)) return;

        const orientation = this.engine.getTowerOrientation(x, y);
        const { sprite, baseScaleX, baseScaleY } = this.renderer.createTowerSprite(this.selectedTower, orientation);
        const tower = this.engine.placeTower(x, y, this.selectedTower, sprite, baseScaleX, baseScaleY);
        this.renderer.addTowerToStage(tower);

        this.renderer.hideRangePreview();
        this.renderer.hideGhostTower();
        this.updateUI();
    }

    // ===== TOWER INFO PANEL =====

    showTowerInfo(tower) {
        if (this.selectedPlacedTower && this.selectedPlacedTower !== tower) {
            this.hideTowerInfo();
        }

        this.selectedPlacedTower = tower;
        const config = TOWER_TYPES[tower.type];
        const sellValue = Math.floor(config.cost * 0.6);

        const icons = { archer: '🏹', cannon: '💣', ice: '❄️', sniper: '🎯' };
        const names = { archer: 'Archer', cannon: 'Canon', ice: 'Glace', sniper: 'Sniper' };

        document.getElementById('tower-info-name').textContent = `${icons[tower.type]} ${names[tower.type]}`;
        document.getElementById('ti-dmg').textContent = config.damage;
        document.getElementById('ti-range').textContent = config.range;
        document.getElementById('ti-cd').textContent = (config.cooldown / 1000).toFixed(1) + 's';
        document.getElementById('sell-btn').textContent = `Vendre ${sellValue}💰`;
        document.getElementById('tower-info').classList.add('visible');

        this.renderer.showTowerRangePreview(tower);
        this.renderer.highlightTowerSprite(tower);
    }

    hideTowerInfo() {
        if (this.selectedPlacedTower) {
            this.renderer.unhighlightTowerSprite(this.selectedPlacedTower);
        }
        this.selectedPlacedTower = null;
        document.getElementById('tower-info').classList.remove('visible');
        this.renderer.hideRangePreview();
    }

    sellSelectedTower() {
        const tower = this.selectedPlacedTower;
        if (!tower) return;

        const sellValue = this.engine.sellTower(tower);
        this.renderer.removeTowerFromStage(tower);
        this.renderer.showFloatingGold(tower.x, tower.y, sellValue, this.container);

        this.hideTowerInfo();
        this.updateUI();
    }

    // ===== DOM SETUP =====

    setupTowerButtons() {
        document.querySelectorAll('.tower-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideTowerInfo();
                document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedTower = btn.dataset.tower;

                const info = document.getElementById('selection-info');
                const config = TOWER_TYPES[this.selectedTower];
                info.textContent = `${this.selectedTower.charAt(0).toUpperCase() + this.selectedTower.slice(1)} - Dégâts: ${config.damage} | Portée: ${config.range}`;
                info.classList.add('visible');
                setTimeout(() => info.classList.remove('visible'), 2000);
            });
        });
    }

    setupWaveButton() {
        document.getElementById('wave-btn').addEventListener('click', () => {
            if (!this.engine.waveInProgress && this.engine.wave < this.engine.currentWaves.length) {
                this.engine.startWave();
            }
        });
    }

    setupSpeedButton() {
        const btn = document.getElementById('speed-btn');
        btn.addEventListener('click', () => {
            const speed = this.engine.toggleSpeed();
            btn.textContent = `x${speed}`;
            btn.classList.toggle('fast', speed === 2);
        });
    }

    setupSellButton() {
        document.getElementById('sell-btn').addEventListener('click', () => {
            this.sellSelectedTower();
        });
    }

    setupShop() {
        document.getElementById('shop-btn').addEventListener('click', () => {
            this.shopOpen = !this.shopOpen;
            document.getElementById('shop-overlay').classList.toggle('visible', this.shopOpen);
            if (this.shopOpen) this.updateShopItems();
        });

        document.getElementById('shop-close').addEventListener('click', () => {
            this.shopOpen = false;
            document.getElementById('shop-overlay').classList.remove('visible');
        });

        document.querySelectorAll('.shop-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.item;
                let success = false;

                switch (type) {
                    case 'heart': success = this.engine.buyHeart(); break;
                    case 'repair': success = this.engine.buyRepair(); break;
                    case 'nuke': success = this.engine.buyNuke(); break;
                    case 'damage': success = this.engine.activateDamageBuff(); break;
                    case 'slow': success = this.engine.activateSlowBuff(); break;
                }

                if (success) {
                    this.updateUI();
                    this.updateShopItems();

                    item.style.background = 'rgba(78,205,196,0.3)';
                    setTimeout(() => item.style.background = '', 300);
                }
            });
        });
    }

    // ===== UI UPDATES =====

    updateUI() {
        document.getElementById('gold').textContent = this.engine.gold;
        document.getElementById('health').textContent = this.engine.health;
        document.getElementById('wave').textContent = this.engine.wave;
        this.updateEnemyCount();

        const levelEl = document.getElementById('level');
        if (levelEl) levelEl.textContent = `${this.engine.level + 1}`;

        const waves = this.engine.currentWaves;
        const waveBtn = document.getElementById('wave-btn');
        if (this.engine.wave >= waves.length) {
            waveBtn.textContent = 'Terminé ✓';
            waveBtn.disabled = true;
        } else if (this.engine.waveInProgress) {
            waveBtn.textContent = `Vague ${this.engine.wave} en cours...`;
            waveBtn.disabled = true;
        } else {
            waveBtn.textContent = `Vague ${this.engine.wave + 1} ▶`;
            waveBtn.disabled = false;
        }

        document.querySelectorAll('.tower-btn').forEach(btn => {
            const type = btn.dataset.tower;
            const cost = TOWER_TYPES[type].cost;
            btn.classList.toggle('disabled', this.engine.gold < cost);
        });
    }

    updateEnemyCount() {
        document.getElementById('enemies').textContent = this.engine.getEnemyCount();
    }

    updateShopItems() {
        document.querySelectorAll('.shop-item').forEach(item => {
            const type = item.dataset.item;
            const cost = SHOP_ITEMS[type].cost;
            const canAfford = this.engine.gold >= cost;
            const alreadyActive = (type === 'damage' && this.engine.buffs.damage) || (type === 'slow' && this.engine.buffs.slow);
            item.classList.toggle('disabled', !canAfford || alreadyActive);
        });
    }

    updateBuffsUI() {
        const container = document.getElementById('buffs');
        container.innerHTML = '';
        if (this.engine.buffs.damage) {
            const badge = document.createElement('div');
            badge.className = 'buff-badge damage';
            badge.textContent = '⚔️ Rage x1.5';
            container.appendChild(badge);
        }
        if (this.engine.buffs.slow) {
            const badge = document.createElement('div');
            badge.className = 'buff-badge slow';
            badge.textContent = '🧊 Blizzard';
            container.appendChild(badge);
        }
    }

    // ===== GAME OVER / VICTORY =====

    showGameOver() {
        document.getElementById('game-over-title').textContent = '💀 Défaite';
        document.getElementById('final-wave').textContent = this.engine.wave;
        document.getElementById('game-over').classList.add('visible');
    }

    showVictory() {
        const totalWaves = LEVELS.reduce((sum, l) => sum + l.waves.length, 0);
        document.getElementById('game-over-title').textContent = '🏆 Victoire !';
        document.getElementById('final-wave').textContent = `${totalWaves}/${totalWaves}`;
        document.getElementById('game-over').classList.add('visible');
    }

    showLevelTransition(completedLevel) {
        const nextLevel = LEVELS[completedLevel + 1];
        const overlay = document.getElementById('level-transition');
        if (!overlay) return;

        document.getElementById('level-transition-title').textContent =
            `Niveau ${completedLevel + 2} : ${nextLevel.name}`;
        overlay.classList.add('visible');

        const btn = document.getElementById('level-continue-btn');
        const handler = () => {
            btn.removeEventListener('click', handler);
            overlay.classList.remove('visible');
            this.startNextLevel();
        };
        btn.addEventListener('click', handler);
    }

    startNextLevel() {
        this.engine.nextLevel();

        this.renderer.clearStage();
        this.renderer.drawGround(this.engine.grid);
        this.renderer.calculateOffset();

        this.selectedPlacedTower = null;
        this.hoveredTile = null;
        this.updateUI();
    }
}
