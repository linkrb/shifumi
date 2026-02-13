import {
    TILE_WIDTH, TILE_HEIGHT, GRID_WIDTH, GRID_HEIGHT,
    TOWER_TYPES, ENEMY_TYPES, toIso
} from './tdConfig.js';

export class TDRenderer {
    constructor() {
        this.app = null;
        this.assets = {};
        this.tileSprites = [];
        this.tileMap = {};
        this.groundLayer = null;
        this.rangeLayer = null;
        this.entityLayer = null;
        this.projectileLayer = null;
        this.effectLayer = null;
        this.offsetX = 0;
        this.offsetY = 0;
        this.mapScale = 1;
        this.particles = [];
        this.ghostSprite = null;
        this.ghostType = null;
        this.ghostOrientation = null;
        this.treeSprites = [];
    }

    async init(container) {
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.app = new PIXI.Application();
        await this.app.init({
            width,
            height,
            backgroundColor: 0x1a1a2e,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        container.insertBefore(this.app.canvas, container.firstChild);

        await this.loadAssets();

        this.groundLayer = new PIXI.Container();
        this.rangeLayer = new PIXI.Container();
        this.entityLayer = new PIXI.Container();
        this.projectileLayer = new PIXI.Container();
        this.effectLayer = new PIXI.Container();

        this.app.stage.addChild(this.groundLayer);
        this.app.stage.addChild(this.rangeLayer);
        this.app.stage.addChild(this.entityLayer);
        this.app.stage.addChild(this.projectileLayer);
        this.app.stage.addChild(this.effectLayer);

        this.calculateOffset();
    }

    calculateOffset() {
        const mapWidth = (GRID_WIDTH + GRID_HEIGHT) * (TILE_WIDTH / 2);
        const mapHeight = (GRID_WIDTH + GRID_HEIGHT) * (TILE_HEIGHT / 2);

        // Auto-scale to fit screen (minimal padding on mobile)
        const padX = this.app.screen.width < 600 ? 0 : 10;
        const padY = this.app.screen.width < 600 ? 0 : 10;
        const scaleX = (this.app.screen.width - padX * 2) / mapWidth;
        const scaleY = (this.app.screen.height - padY * 2) / mapHeight;
        this.mapScale = Math.min(scaleX, scaleY, 1.5);

        // Center diamond properly (non-square grid offset)
        const centerIsoX = (GRID_HEIGHT - GRID_WIDTH) * (TILE_WIDTH / 4);
        const centerIsoY = (GRID_WIDTH + GRID_HEIGHT - 2) * (TILE_HEIGHT / 4);

        this.offsetX = this.app.screen.width / 2 - centerIsoX * this.mapScale;
        this.offsetY = this.app.screen.height / 2 - centerIsoY * this.mapScale;

        [this.groundLayer, this.rangeLayer, this.entityLayer, this.projectileLayer, this.effectLayer].forEach(layer => {
            layer.x = this.offsetX;
            layer.y = this.offsetY;
            layer.scale.set(this.mapScale);
        });
    }

    handleResize(container) {
        this.app.renderer.resize(container.clientWidth, container.clientHeight);
        this.calculateOffset();
        this.app.stage.hitArea = this.app.screen;
    }

    async loadAssets() {
        const enemyAssets = ['enemy_basic', 'enemy_fast', 'enemy_tank', 'enemy_boss'];
        const towerTypes = ['archer', 'cannon', 'ice', 'sniper'];

        for (const name of enemyAssets) {
            try {
                const texture = await PIXI.Assets.load(`/images/td/${name}.png`);
                this.assets[name] = texture;
            } catch (e) { }
        }

        for (const type of towerTypes) {
            for (const variant of ['front', 'side', 'left', 'back']) {
                try {
                    const tex = await PIXI.Assets.load(`/images/td/tower_${type}_${variant}.png`);
                    this.assets[`tower_${type}_${variant}`] = tex;
                } catch (e) { }
            }
            try {
                const tex = await PIXI.Assets.load(`/images/td/tower_${type}.png`);
                this.assets[`tower_${type}`] = tex;
            } catch (e) { }
        }

        const tileAssets = ['tile_grass', 'tile_path', 'castle', 'coin', 'heart', 'tree'];
        for (const name of tileAssets) {
            try {
                const texture = await PIXI.Assets.load(`/images/td/${name}.png`);
                this.assets[name] = texture;
            } catch (e) { }
        }
    }

    clearStage() {
        // Remove all children from layers
        this.groundLayer.removeChildren();
        this.entityLayer.removeChildren();
        this.projectileLayer.removeChildren();
        this.effectLayer.removeChildren();
        this.rangeLayer.removeChildren();

        // Reset tracking arrays
        this.tileSprites = [];
        this.tileMap = {};
        this.particles = [];
        this.treeSprites = [];

        // Clean up ghost tower
        if (this.ghostSprite) {
            this.ghostSprite.destroy({ children: true });
            this.ghostSprite = null;
            this.ghostType = null;
            this.ghostOrientation = null;
        }
    }

    drawGround(grid) {
        for (let sum = 0; sum < GRID_WIDTH + GRID_HEIGHT - 1; sum++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const y = sum - x;
                if (y < 0 || y >= GRID_HEIGHT) continue;

                const iso = toIso(x, y);
                const cell = grid[y][x];

                let tile;
                const useSprites = this.assets.tile_grass && this.assets.tile_path;

                if (useSprites) {
                    let texture;
                    if (cell.type === 'grass') {
                        texture = this.assets.tile_grass;
                    } else if (cell.type === 'path' || cell.type === 'spawn' || cell.type === 'base') {
                        texture = this.assets.tile_path;
                    } else {
                        texture = this.assets.tile_grass;
                    }

                    tile = new PIXI.Sprite(texture);
                    tile.anchor.set(0.5, 0.5);
                    const tileRef = Math.max(TILE_WIDTH, TILE_HEIGHT);
                    tile.width = tileRef * 1.35;
                    tile.height = tileRef * 1.35;

                    if (cell.type === 'spawn') {
                        tile.tint = 0xffaaaa;
                    }
                } else {
                    let color = 0x5a8f6a;
                    let strokeColor = 0x4a7c59;

                    if (cell.type === 'path') {
                        color = 0xd4b896;
                        strokeColor = 0xc4a77d;
                    } else if (cell.type === 'spawn') {
                        color = 0xe74c3c;
                        strokeColor = 0xc0392b;
                    } else if (cell.type === 'base') {
                        color = 0x3498db;
                        strokeColor = 0x2980b9;
                    }

                    tile = new PIXI.Graphics();
                    // Grow diamond to eliminate sub-pixel gaps from scaling
                    const g = 4;
                    tile.poly([
                        0, -g,
                        TILE_WIDTH / 2 + g, TILE_HEIGHT / 2,
                        0, TILE_HEIGHT + g,
                        -TILE_WIDTH / 2 - g, TILE_HEIGHT / 2
                    ]);
                    tile.fill({ color });
                    tile.stroke({ width: 1, color: strokeColor, alpha: 0.15 });
                    tile.poly([
                        0, -g,
                        TILE_WIDTH / 2 + g, TILE_HEIGHT / 2,
                        0, 4,
                        -TILE_WIDTH / 2 - g, TILE_HEIGHT / 2
                    ]);
                    tile.fill({ color: 0xffffff, alpha: 0.1 });
                }

                tile.x = iso.x;
                tile.y = iso.y + (useSprites ? TILE_HEIGHT / 2 : 0);
                tile.gridX = x;
                tile.gridY = y;
                tile.eventMode = 'none';
                tile.alpha = 1;
                tile.originalTint = tile.tint || 0xffffff;

                this.groundLayer.addChild(tile);
                this.tileSprites.push(tile);

                if (cell.type === 'base') {
                    if (this.assets.castle) {
                        const castle = new PIXI.Sprite(this.assets.castle);
                        castle.anchor.set(0.5, 0.75);
                        const cRef = Math.max(TILE_WIDTH, TILE_HEIGHT);
                        castle.width = cRef * 1.8;
                        castle.height = cRef * 1.8;
                        castle.x = iso.x;
                        castle.y = iso.y + TILE_HEIGHT * 0.6;
                        this.entityLayer.addChild(castle);
                    } else {
                        const icon = new PIXI.Text({ text: '🏠', style: { fontSize: 26 } });
                        icon.anchor.set(0.5);
                        icon.x = iso.x;
                        icon.y = iso.y + TILE_HEIGHT / 2;
                        this.groundLayer.addChild(icon);
                    }
                } else if (cell.type === 'grass') {
                    const rand = Math.random();
                    if (rand < 0.22 && this.assets.tree) {
                        const tree = new PIXI.Sprite(this.assets.tree);
                        tree.anchor.set(0.5, 0.85);
                        const tRef = Math.max(TILE_WIDTH, TILE_HEIGHT);
                        tree.width = tRef * (0.9 + Math.random() * 0.4);
                        tree.height = tree.width;
                        tree.x = iso.x;
                        tree.y = iso.y + TILE_HEIGHT / 2;
                        tree.eventMode = 'none';
                        tree._windPhase = Math.random() * Math.PI * 2;
                        tree._windSpeed = 0.8 + Math.random() * 0.4;
                        tree._baseScaleX = tree.scale.x;
                        tree._baseSkew = 0;
                        this.entityLayer.addChild(tree);
                        this.treeSprites.push(tree);
                        // Mark cell so towers can't be placed here
                        cell.hasTree = true;
                    } else if (rand < 0.25 && !useSprites) {
                        const flowers = ['🌸', '🌼', '🌺'][Math.floor(Math.random() * 3)];
                        const deco = new PIXI.Text({ text: flowers, style: { fontSize: 10 } });
                        deco.anchor.set(0.5);
                        deco.x = iso.x + (Math.random() - 0.5) * 20;
                        deco.y = iso.y + TILE_HEIGHT / 2 + (Math.random() - 0.5) * 8;
                        deco.alpha = 0.7;
                        this.groundLayer.addChild(deco);
                    }
                } else if (cell.type === 'path' && !useSprites) {
                    if (Math.random() < 0.3) {
                        const pebble = new PIXI.Graphics();
                        pebble.circle(0, 0, 2 + Math.random() * 2);
                        pebble.fill({ color: 0x9a8a7a, alpha: 0.4 });
                        pebble.x = iso.x + (Math.random() - 0.5) * 25;
                        pebble.y = iso.y + TILE_HEIGHT / 2 + (Math.random() - 0.5) * 10;
                        this.groundLayer.addChild(pebble);
                    }
                }
            }
        }

        // Build tile lookup map
        this.tileMap = {};
        this.tileSprites.forEach(tile => {
            this.tileMap[`${tile.gridX},${tile.gridY}`] = tile;
        });
    }

    createTowerSprite(towerType, orientation) {
        const config = TOWER_TYPES[towerType];
        const assetKey = `tower_${towerType}_${orientation}`;
        const fallbackKey = `tower_${towerType}`;
        const texture = this.assets[assetKey]
            || this.assets[`tower_${towerType}_side`]
            || this.assets[`tower_${towerType}_front`]
            || this.assets[fallbackKey];

        let sprite;
        let baseScaleX, baseScaleY;

        if (texture) {
            sprite = new PIXI.Sprite(texture);
            sprite.anchor.set(0.5, 0.85);
            const tRef = Math.max(TILE_WIDTH, TILE_HEIGHT);
            sprite.width = tRef * 1.1;
            sprite.height = tRef * 1.1;
            // Flip horizontally to compensate for mirrored iso projection
            sprite.scale.x *= -1;
            baseScaleX = sprite.scale.x;
            baseScaleY = sprite.scale.y;
        } else {
            sprite = new PIXI.Container();

            const base = new PIXI.Graphics();
            base.roundRect(-20, -10, 40, 20, 5);
            base.fill({ color: 0x4a4a4a });
            sprite.addChild(base);

            const body = new PIXI.Graphics();
            body.circle(0, -25, 22);
            body.fill({ color: config.color });
            body.stroke({ width: 3, color: 0x333333 });
            sprite.addChild(body);

            const icons = { archer: '🏹', cannon: '💣', ice: '❄️', sniper: '🎯' };
            const icon = new PIXI.Text({ text: icons[towerType], style: { fontSize: 18 } });
            icon.anchor.set(0.5);
            icon.y = -25;
            sprite.addChild(icon);

            // Flip horizontally to compensate for mirrored iso projection
            sprite.scale.x *= -1;
            baseScaleX = sprite.scale.x;
            baseScaleY = sprite.scale.y;
        }

        return { sprite, baseScaleX, baseScaleY };
    }

    addTowerToStage(tower) {
        const iso = toIso(tower.x, tower.y);
        tower.sprite.x = iso.x;
        tower.sprite.y = iso.y + TILE_HEIGHT / 2;
        this.entityLayer.addChild(tower.sprite);
        this.sortEntities();
        this.createPlaceEffect(iso.x, iso.y + TILE_HEIGHT / 2);
    }

    removeTowerFromStage(tower) {
        this.entityLayer.removeChild(tower.sprite);
        const iso = toIso(tower.x, tower.y);
        this.createPlaceEffect(iso.x, iso.y + TILE_HEIGHT / 2);
    }

    createEnemySprite(type) {
        const config = ENEMY_TYPES[type];
        const container = new PIXI.Container();
        let body;
        let baseScaleX, baseScaleY;

        if (this.assets[`enemy_${type}`]) {
            body = new PIXI.Sprite(this.assets[`enemy_${type}`]);
            body.anchor.set(0.5, config.anchorY);
            const eRef = Math.max(TILE_WIDTH, TILE_HEIGHT);
            body.width = eRef * config.size * 0.9;
            body.height = eRef * config.size * 0.9;
            baseScaleX = body.scale.x;
            baseScaleY = body.scale.y;
        } else {
            body = new PIXI.Graphics();
            const size = 18 * config.size;
            body.circle(0, -size * 0.6, size);
            body.fill({ color: config.color });
            body.stroke({ width: 3, color: 0x333333 });

            const eyeSize = size * 0.25;
            body.circle(-size * 0.35, -size * 0.8, eyeSize);
            body.circle(size * 0.35, -size * 0.8, eyeSize);
            body.fill({ color: 0xffffff });
            body.circle(-size * 0.35, -size * 0.75, eyeSize * 0.5);
            body.circle(size * 0.35, -size * 0.75, eyeSize * 0.5);
            body.fill({ color: 0x333333 });

            baseScaleX = 1;
            baseScaleY = 1;
        }
        container.addChild(body);

        // HP bar
        const hpBar = new PIXI.Graphics();
        hpBar.y = -35 * config.size;
        container.addChild(hpBar);

        return { sprite: container, body, hpBar, baseScaleX, baseScaleY };
    }

    addEnemyToStage(enemy) {
        const iso = toIso(enemy.x, enemy.y);
        enemy.sprite.x = iso.x;
        enemy.sprite.y = iso.y + TILE_HEIGHT / 2;
        this.entityLayer.addChild(enemy.sprite);
        this.updateEnemyHpBar(enemy);
        this.sortEntities();
    }

    removeEnemyFromStage(enemy) {
        this.entityLayer.removeChild(enemy.sprite);
    }

    updateEnemyPosition(enemy) {
        const iso = toIso(enemy.x, enemy.y);

        // Determine facing from grid movement (not pixel position)
        if (enemy._prevGX !== undefined) {
            const dx = enemy.x - enemy._prevGX;
            const dy = enemy.y - enemy._prevGY;
            // Mirrored iso: screen_x = (y - x) * TW/2, so screenDx ∝ (dy - dx)
            const screenDx = dy - dx;
            if (Math.abs(screenDx) > 0.001) {
                enemy._facingLeft = screenDx < 0;
            }
        }
        enemy._prevGX = enemy.x;
        enemy._prevGY = enemy.y;

        enemy.sprite.x = iso.x;
        enemy.sprite.y = iso.y + TILE_HEIGHT / 2;
    }

    updateEnemyAnimation(enemy, now) {
        const bounce = Math.sin(now * 0.012 + enemy.id) * 0.5 + 0.5;
        enemy.body.y = bounce * -4;

        const stretch = 1 + Math.sin(now * 0.012 + enemy.id) * 0.08;
        const bsx = enemy.baseScaleX || 1;
        const bsy = enemy.baseScaleY || 1;
        const flipX = enemy._facingLeft ? -1 : 1;
        enemy.body.scale.set((bsx / stretch) * flipX, bsy * stretch);

        enemy.body.rotation = Math.sin(now * 0.006 + enemy.id * 1.5) * 0.1;
    }

    updateEnemyTint(enemy, isSlow) {
        enemy.body.tint = isSlow ? 0x87CEEB : 0xffffff;
    }

    updateEnemyHpBar(enemy) {
        const bar = enemy.hpBar;
        bar.clear();
        const width = 28;
        const height = 5;
        const ratio = Math.max(0, enemy.hp / enemy.maxHp);

        bar.roundRect(-width/2 - 1, -1, width + 2, height + 2, 2);
        bar.fill({ color: 0x222222 });
        bar.roundRect(-width/2, 0, width * ratio, height, 2);
        bar.fill({ color: ratio > 0.5 ? 0x2ecc71 : ratio > 0.25 ? 0xf39c12 : 0xe74c3c });
    }

    createProjectileSprite(towerType) {
        const colors = {
            archer: 0xFFD700,
            cannon: 0x333333,
            ice: 0x00FFFF,
            sniper: 0xFF4444
        };

        const sprite = new PIXI.Graphics();

        if (towerType === 'cannon') {
            sprite.circle(0, 0, 7);
            sprite.fill({ color: colors.cannon });
        } else if (towerType === 'ice') {
            sprite.star(0, 0, 6, 8, 4);
            sprite.fill({ color: colors.ice });
        } else {
            sprite.circle(0, 0, 5);
            sprite.fill({ color: colors[towerType] });
        }

        return sprite;
    }

    addProjectileToStage(proj, towerX, towerY) {
        const iso = toIso(towerX, towerY);
        proj.sprite.x = iso.x;
        proj.sprite.y = iso.y - 20;
        this.projectileLayer.addChild(proj.sprite);
    }

    removeProjectileFromStage(proj) {
        this.projectileLayer.removeChild(proj.sprite);
    }

    updateProjectilePosition(proj) {
        const iso = toIso(proj.x, proj.y);
        proj.sprite.x = iso.x;
        proj.sprite.y = iso.y;
    }

    // Tower shooting bounce animation
    animateTowerShot(tower) {
        if (!tower.sprite) return;
        const bsx = tower.baseScaleX || tower.sprite.scale.x;
        const bsy = tower.baseScaleY || tower.sprite.scale.y;
        tower.sprite.scale.set(bsx * 1.15, bsy * 1.15);
        setTimeout(() => {
            if (tower.sprite) tower.sprite.scale.set(bsx, bsy);
        }, 100);
    }

    createMuzzleFlash(tower, target) {
        const iso = toIso(tower.x, tower.y);
        const targetIso = toIso(target.x, target.y);

        const dx = targetIso.x - iso.x;
        const dy = targetIso.y - iso.y;
        const angle = Math.atan2(dy, dx);

        const colors = {
            archer: 0xFFFF00,
            cannon: 0xFF6600,
            ice: 0x00FFFF,
            sniper: 0xFF0000
        };

        const flash = new PIXI.Graphics();

        if (tower.type === 'cannon') {
            flash.circle(0, 0, 12);
            flash.fill({ color: colors.cannon, alpha: 0.8 });
            flash.circle(0, 0, 8);
            flash.fill({ color: 0xFFFF00, alpha: 0.9 });
        } else if (tower.type === 'sniper') {
            flash.moveTo(0, 0);
            flash.lineTo(Math.cos(angle) * 25, Math.sin(angle) * 15);
            flash.stroke({ width: 4, color: colors.sniper, alpha: 0.8 });
        } else {
            flash.star(0, 0, 4, 10, 5);
            flash.fill({ color: colors[tower.type] || 0xFFFFFF, alpha: 0.8 });
        }

        flash.x = iso.x + Math.cos(angle) * 15;
        flash.y = iso.y - 20 + Math.sin(angle) * 8;
        flash.life = 0.3;
        flash.vx = 0;
        flash.vy = 0;
        flash.isMuzzleFlash = true;
        this.effectLayer.addChild(flash);
        this.particles.push(flash);
    }

    createHitEffect(x, y, type) {
        const iso = toIso(x, y);
        const colors = { archer: 0xFFD700, cannon: 0xFF6600, ice: 0x00FFFF, sniper: 0xFF0000 };

        for (let i = 0; i < 6; i++) {
            const particle = new PIXI.Graphics();
            particle.circle(0, 0, 3);
            particle.fill({ color: colors[type] || 0xFFFFFF });
            particle.x = iso.x + (Math.random() - 0.5) * 20;
            particle.y = iso.y + (Math.random() - 0.5) * 20;
            particle.vx = (Math.random() - 0.5) * 4;
            particle.vy = (Math.random() - 0.5) * 4 - 2;
            particle.life = 1;
            this.effectLayer.addChild(particle);
            this.particles.push(particle);
        }
    }

    createDeathEffect(x, y) {
        const iso = toIso(x, y);

        for (let i = 0; i < 10; i++) {
            const particle = new PIXI.Graphics();
            particle.circle(0, 0, 5);
            particle.fill({ color: 0xFFD700 });
            particle.x = iso.x;
            particle.y = iso.y;
            particle.vx = (Math.random() - 0.5) * 6;
            particle.vy = -Math.random() * 5 - 2;
            particle.life = 1;
            this.effectLayer.addChild(particle);
            this.particles.push(particle);
        }

        const poof = new PIXI.Graphics();
        poof.circle(0, 0, 12);
        poof.fill({ color: 0xffffff, alpha: 0.4 });
        poof.x = iso.x;
        poof.y = iso.y;
        poof.life = 0.25;
        poof.vx = 0;
        poof.vy = 0;
        poof.isPoof = true;
        this.effectLayer.addChild(poof);
        this.particles.push(poof);
    }

    createPlaceEffect(x, y) {
        for (let i = 0; i < 8; i++) {
            const particle = new PIXI.Graphics();
            particle.circle(0, 0, 4);
            particle.fill({ color: 0x4ECDC4 });
            particle.x = x;
            particle.y = y;
            const angle = (i / 8) * Math.PI * 2;
            particle.vx = Math.cos(angle) * 3;
            particle.vy = Math.sin(angle) * 3;
            particle.life = 1;
            this.effectLayer.addChild(particle);
            this.particles.push(particle);
        }
    }

    createDamageEffect() {
        const flash = new PIXI.Graphics();
        flash.rect(0, 0, this.app.screen.width, this.app.screen.height);
        flash.fill({ color: 0xff0000, alpha: 0.3 });
        flash.life = 0.3;
        flash.vx = 0;
        flash.vy = 0;
        flash.isFlash = true;
        this.app.stage.addChild(flash);
        this.particles.push(flash);
    }

    createNukeFlash() {
        const flash = new PIXI.Graphics();
        flash.rect(0, 0, this.app.screen.width, this.app.screen.height);
        flash.fill({ color: 0xffffff, alpha: 0.5 });
        flash.life = 0.4;
        flash.vx = 0;
        flash.vy = 0;
        flash.isFlash = true;
        this.app.stage.addChild(flash);
        this.particles.push(flash);
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            if (p.isPoof) {
                p.scale.set(p.scale.x + dt * 0.15);
                p.alpha = p.life * 2;
            } else if (p.isFlash) {
                p.alpha = p.life;
            } else if (p.isMuzzleFlash) {
                p.alpha = p.life * 2;
                p.scale.set(p.life * 1.5);
            } else {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2;
                p.alpha = p.life;
                p.scale.set(p.life);
            }

            p.life -= dt * 0.04;

            if (p.life <= 0) {
                if (p.isFlash) {
                    this.app.stage.removeChild(p);
                } else {
                    this.effectLayer.removeChild(p);
                }
                this.particles.splice(i, 1);
            }
        }
    }

    updateWindAnimation(now) {
        for (const tree of this.treeSprites) {
            const wind = Math.sin(now * 0.001 * tree._windSpeed + tree._windPhase);
            const gust = Math.sin(now * 0.0025 + tree._windPhase * 2) * 0.3;
            tree.skew.x = (wind + gust) * 0.06;
            tree.scale.x = tree._baseScaleX * (1 + wind * 0.02);
        }
    }

    showRangePreview(x, y, towerType) {
        this.hideRangePreview();

        const iso = toIso(x, y);
        const range = TOWER_TYPES[towerType].range;

        const preview = new PIXI.Graphics();
        preview.circle(iso.x, iso.y + TILE_HEIGHT / 2, range * (TILE_WIDTH + TILE_HEIGHT) / 2 * 0.7);
        preview.fill({ color: 0x00ff00, alpha: 0.15 });
        preview.stroke({ width: 2, color: 0x00ff00, alpha: 0.4 });

        preview.name = 'rangePreview';
        this.rangeLayer.addChild(preview);
    }

    showTowerRangePreview(tower) {
        this.hideRangePreview();
        const config = TOWER_TYPES[tower.type];
        const iso = toIso(tower.x, tower.y);
        const preview = new PIXI.Graphics();
        preview.circle(iso.x, iso.y + TILE_HEIGHT / 2, config.range * (TILE_WIDTH + TILE_HEIGHT) / 2 * 0.7);
        preview.fill({ color: 0x4ECDC4, alpha: 0.12 });
        preview.stroke({ width: 2, color: 0x4ECDC4, alpha: 0.5 });
        preview.name = 'rangePreview';
        this.rangeLayer.addChild(preview);
    }

    hideRangePreview() {
        const preview = this.rangeLayer.getChildByName('rangePreview');
        if (preview) this.rangeLayer.removeChild(preview);
    }

    showGhostTower(x, y, towerType, orientation) {
        // Reuse existing ghost if same type+orientation, just reposition
        if (this.ghostSprite && this.ghostType === towerType && this.ghostOrientation === orientation) {
            const iso = toIso(x, y);
            this.ghostSprite.x = iso.x;
            this.ghostSprite.y = iso.y + TILE_HEIGHT / 2;
            this.ghostSprite.visible = true;
            return;
        }

        this.hideGhostTower();

        const { sprite } = this.createTowerSprite(towerType, orientation);
        sprite.alpha = 0.5;
        sprite.eventMode = 'none';

        const iso = toIso(x, y);
        sprite.x = iso.x;
        sprite.y = iso.y + TILE_HEIGHT / 2;

        this.entityLayer.addChild(sprite);
        this.ghostSprite = sprite;
        this.ghostType = towerType;
        this.ghostOrientation = orientation;
    }

    hideGhostTower() {
        if (this.ghostSprite) {
            this.entityLayer.removeChild(this.ghostSprite);
            this.ghostSprite.destroy({ children: true });
            this.ghostSprite = null;
            this.ghostType = null;
            this.ghostOrientation = null;
        }
    }

    setTileHoverTint(tile, canPlace) {
        tile.tint = canPlace ? 0x88ff88 : 0xff8888;
    }

    clearTileHoverTint(tile) {
        tile.tint = tile.originalTint || 0xffffff;
    }

    highlightTowerSprite(tower) {
        if (tower.sprite) tower.sprite.tint = 0xaaffaa;
    }

    unhighlightTowerSprite(tower) {
        if (tower.sprite) tower.sprite.tint = 0xffffff;
    }

    sortEntities() {
        this.entityLayer.children.sort((a, b) => a.y - b.y);
    }

    showFloatingDamage(x, y, amount, container) {
        const iso = toIso(x, y);
        const rect = this.app.canvas.getBoundingClientRect();
        const s = this.mapScale;

        const el = document.createElement('div');
        el.className = 'damage-number';
        el.textContent = `-${Math.floor(amount)}`;
        el.style.left = `${rect.left + this.offsetX + iso.x * s + (Math.random() - 0.5) * 30}px`;
        el.style.top = `${rect.top + this.offsetY + iso.y * s - 20}px`;

        container.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }

    showFloatingGold(x, y, amount, container) {
        const iso = toIso(x, y);
        const rect = this.app.canvas.getBoundingClientRect();
        const s = this.mapScale;

        const el = document.createElement('div');
        el.className = 'damage-number gold';
        el.textContent = `+${amount}💰`;
        el.style.left = `${rect.left + this.offsetX + iso.x * s}px`;
        el.style.top = `${rect.top + this.offsetY + iso.y * s - 30}px`;

        container.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }
}
