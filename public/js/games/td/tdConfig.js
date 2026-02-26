// ============== CONFIGURATION ==============
export const TILE_WIDTH = 40;
export const TILE_HEIGHT = 52;
export const GRID_WIDTH = 7;
export const GRID_HEIGHT = 12;

export const TOWER_TYPES = {
    archer: { cost: 50, damage: 20, range: 3, cooldown: 750, speed: 42, color: 0x98D4BB },
    cannon: { cost: 100, damage: 55, range: 2.5, cooldown: 1300, speed: 28, color: 0xFF7F7F, splash: 1.2 },
    ice: { cost: 75, damage: 8, range: 2.5, cooldown: 900, speed: 36, color: 0x87CEEB, slow: 0.5, unlockedByWorld: 3 },
    sniper: { cost: 250, damage: 75, range: 4.5, cooldown: 2500, speed: 60, color: 0xE6E6FA },
    cemetery: { cost: 100, damage: 25, range: 2.8, cooldown: 3500, speed: 34, color: 0x4ECDC4, grasp: true, graspDuration: 2500, graspDot: 8, unlockedByWorld: 1 },
    wind: { cost: 125, damage: 15, range: 2.5, cooldown: 1200, speed: 38, color: 0xA8E6CF, pushback: 0.8, unlockedByWorld: 4 }
};

export const ENEMY_TYPES = {
    basic: { hp: 120, speed: 2.2, reward: 3, color: 0xFFB5C5, size: 0.9, anchorY: 0.65 },
    fast: { hp: 70, speed: 3.4, reward: 4, color: 0xFFD93D, size: 1.0, anchorY: 0.65 },
    tank: { hp: 400, speed: 1.2, reward: 10, color: 0x9B59B6, size: 1.1, anchorY: 0.65 },
    boss: { hp: 1400, speed: 0.9, reward: 40, color: 0xC0392B, size: 1.5, anchorY: 0.85 },
    flying: { hp: 90, speed: 2.7, reward: 5, color: 0xBB88FF, size: 0.85, anchorY: 0.5, flying: true }
};

// ============== LEVELS ==============
// All paths: x+y never decreases → path ALWAYS goes downward on screen (mirrored iso)
export const LEVELS = [
    {
        name: 'Prairie',
        theme: {
            id: 'prairie',
            tiles: { grass: 'tile_grass', path: 'tile_path' },
            decorations: ['tree', 'tree_pine'],
            decoRate: 0.22,
            enemies: {
                basic: 'enemy_basic',
                fast: 'enemy_fast',
                tank: 'enemy_tank',
                flying: 'enemy_flying',
                boss: 'enemy_boss'
            }
        },
        path: [
            {x:0, y:0},
            {x:0, y:1}, {x:0, y:2}, {x:0, y:3},
            {x:1, y:3}, {x:2, y:3}, {x:3, y:3}, {x:4, y:3}, {x:5, y:3}, {x:6, y:3},
            {x:6, y:4}, {x:6, y:5}, {x:6, y:6},
            {x:5, y:7}, {x:4, y:8}, {x:3, y:9}, {x:2, y:10}, {x:1, y:11},
            {x:2, y:11}, {x:3, y:11}, {x:4, y:11}, {x:5, y:11}, {x:6, y:11}
        ],
        waves: [
            [{ type: 'basic', count: 5 }],
            [{ type: 'basic', count: 8 }],
            [{ type: 'basic', count: 5 }, { type: 'fast', count: 4 }],
            [{ type: 'basic', count: 8 }, { type: 'tank', count: 2 }],
            [{ type: 'basic', count: 6 }, { type: 'fast', count: 5 }, { type: 'tank', count: 2 }],
            [{ type: 'fast', count: 12 }, { type: 'flying', count: 6 }, { type: 'tank', count: 3 }],
            [{ type: 'basic', count: 15 }, { type: 'fast', count: 8 }, { type: 'flying', count: 5 }, { type: 'tank', count: 3 }],
            [{ type: 'fast', count: 18 }, { type: 'flying', count: 10 }, { type: 'tank', count: 4 }],
            [{ type: 'tank', count: 8 }, { type: 'fast', count: 15 }, { type: 'flying', count: 6 }],
            [{ type: 'boss', count: 2 }, { type: 'tank', count: 6 }, { type: 'fast', count: 12 }, { type: 'flying', count: 8 }],
        ]
    },
    {
        name: 'Cimetière',
        theme: {
            id: 'cemetery',
            castleScale: 1.4,
            tileScale: 0.78,
            towerScale: 0.85,
            enemyScale: 0.85,
            enemyScales: { tank: 1.3, boss: 1.4 },
            tiles: { grass: 'tile_grass', path: 'tile_path' },
            decorations: [
                { name: 'tombstone', scale: 0.6, anchorY: 0.9 },
                { name: 'dead_tree', scale: 0.75, anchorY: 0.9 },
                { name: 'lamppost', scale: 0.95, anchorY: 0.9 }
            ],
            decoRate: 0.20,
            enemies: {
                basic: 'enemy_basic',
                fast: 'enemy_fast',
                tank: 'enemy_tank',
                flying: 'enemy_flying',
                boss: 'enemy_boss'
            }
        },
        path: [
            {x:6, y:0},
            {x:6, y:1}, {x:6, y:2},
            {x:5, y:3}, {x:4, y:4}, {x:3, y:5}, {x:2, y:6}, {x:1, y:7}, {x:0, y:8},
            {x:0, y:9}, {x:0, y:10},
            {x:1, y:10}, {x:2, y:10}, {x:3, y:10}, {x:4, y:10}, {x:5, y:10}, {x:6, y:10},
            {x:6, y:11}
        ],
        waves: [
            [{ type: 'basic', count: 8 }, { type: 'fast', count: 4 }],
            [{ type: 'tank', count: 3 }, { type: 'basic', count: 8 }],
            [{ type: 'basic', count: 12 }, { type: 'fast', count: 6 }],
            [{ type: 'tank', count: 4 }, { type: 'fast', count: 6 }],
            [{ type: 'basic', count: 10 }, { type: 'fast', count: 8 }, { type: 'tank', count: 3 }],
            [{ type: 'flying', count: 10 }, { type: 'fast', count: 12 }, { type: 'tank', count: 4 }],
            [{ type: 'basic', count: 15 }, { type: 'tank', count: 7 }, { type: 'flying', count: 6 }],
            [{ type: 'fast', count: 20 }, { type: 'flying', count: 12 }, { type: 'tank', count: 5 }],
            [{ type: 'tank', count: 10 }, { type: 'fast', count: 18 }, { type: 'flying', count: 8 }],
            [{ type: 'boss', count: 2 }, { type: 'tank', count: 8 }, { type: 'fast', count: 15 }, { type: 'flying', count: 10 }],
        ]
    },
    {
        name: 'Volcan',
        theme: {
            id: 'volcano',
            castleScale: 1.4,
            tileScale: 0.85,
            towerScale: 0.85,
            enemyScale: 0.85,
            enemyScales: { tank: 1.3, boss: 1.4 },
            tiles: { grass: 'tile_grass', path: 'tile_path' },
            decorations: [
                { name: 'geyser', scale: 0.7, anchorY: 0.9 },
                { name: 'fire_tree', scale: 0.75, anchorY: 0.9 },
                { name: 'lamppost', scale: 0.95, anchorY: 0.9 }
            ],
            decoRate: 0.20,
            enemies: {
                basic: 'enemy_basic',
                fast: 'enemy_fast',
                tank: 'enemy_tank',
                flying: 'enemy_flying',
                boss: 'enemy_boss'
            }
        },
        path: [
            {x:3, y:0}, {x:3, y:1}, {x:3, y:2}, {x:3, y:3},
            { fork: [
                [{x:3,y:4},{x:3,y:5},{x:3,y:6},{x:3,y:7},{x:3,y:8},{x:3,y:9},{x:4,y:9},{x:5,y:9},{x:6,y:9}],
                [{x:4,y:3},{x:5,y:3},{x:6,y:3},{x:6,y:4},{x:6,y:5},{x:6,y:6},{x:6,y:7},{x:6,y:8},{x:6,y:9}]
            ]},
            {x:6, y:10}, {x:6, y:11}
        ],
        waves: [
            [{ type: 'tank', count: 6 }, { type: 'basic', count: 8 }],
            [{ type: 'fast', count: 12 }, { type: 'tank', count: 4 }],
            [{ type: 'basic', count: 15 }, { type: 'fast', count: 8 }],
            [{ type: 'tank', count: 8 }, { type: 'flying', count: 4 }],
            [{ type: 'basic', count: 12 }, { type: 'fast', count: 10 }, { type: 'tank', count: 5 }],
            [{ type: 'flying', count: 12 }, { type: 'tank', count: 8 }, { type: 'fast', count: 10 }],
            [{ type: 'basic', count: 18 }, { type: 'fast', count: 15 }, { type: 'flying', count: 8 }, { type: 'tank', count: 6 }],
            [{ type: 'fast', count: 22 }, { type: 'flying', count: 14 }, { type: 'tank', count: 6 }],
            [{ type: 'tank', count: 12 }, { type: 'fast', count: 20 }, { type: 'flying', count: 10 }],
            [{ type: 'boss', count: 3 }, { type: 'tank', count: 10 }, { type: 'fast', count: 18 }, { type: 'flying', count: 12 }],
        ]
    },
    {
        name: 'Glacier',
        theme: {
            id: 'ice',
            castleScale: 1.1,
            castleAnchorY: 0.75,
            tileScale: 0.85,
            towerScale: 0.85,
            enemyScale: 1.2,
            enemyScales: { tank: 1.2, boss: 1.0 },
            tiles: { grass: 'tile_grass', path: 'tile_path' },
            decorations: [
                { name: 'snowy_tree', scale: 1.0, anchorY: 0.75 },
                { name: 'snowy_tree', scale: 0.85, anchorY: 0.75 },
                { name: 'ice_portal', scale: 0.7, anchorY: 0.75 }
            ],
            decoRate: 0.20,
            enemies: {
                basic:  'enemy_basic',
                fast:   'enemy_fast',
                tank:   'enemy_tank',
                flying: 'enemy_flying',
                boss:   'enemy_boss'
            }
        },
        path: [
            {x:0, y:0}, {x:0, y:1}, {x:0, y:2},
            {x:1, y:2}, {x:2, y:2}, {x:3, y:2}, {x:4, y:2}, {x:5, y:2}, {x:6, y:2},
            {x:6, y:3}, {x:6, y:4}, {x:6, y:5},
            {x:5, y:5}, {x:4, y:5}, {x:3, y:5}, {x:2, y:5}, {x:1, y:5}, {x:0, y:5},
            {x:0, y:6}, {x:0, y:7}, {x:0, y:8},
            {x:1, y:8}, {x:2, y:8}, {x:3, y:8}, {x:4, y:8}, {x:5, y:8}, {x:6, y:8},
            {x:6, y:9}, {x:6, y:10}, {x:6, y:11}
        ],
        waves: [
            [{ type: 'basic', count: 10 }, { type: 'fast', count: 4 }],
            [{ type: 'fast', count: 10 }, { type: 'basic', count: 8 }],
            [{ type: 'tank', count: 4 }, { type: 'basic', count: 10 }],
            [{ type: 'flying', count: 8 }, { type: 'fast', count: 8 }],
            [{ type: 'basic', count: 12 }, { type: 'tank', count: 5 }, { type: 'fast', count: 8 }],
            [{ type: 'flying', count: 12 }, { type: 'fast', count: 12 }, { type: 'tank', count: 4 }],
            [{ type: 'tank', count: 8 }, { type: 'flying', count: 10 }, { type: 'fast', count: 12 }],
            [{ type: 'basic', count: 20 }, { type: 'fast', count: 15 }, { type: 'flying', count: 8 }],
            [{ type: 'tank', count: 12 }, { type: 'fast', count: 18 }, { type: 'flying', count: 10 }],
            [{ type: 'boss', count: 3 }, { type: 'tank', count: 10 }, { type: 'flying', count: 14 }, { type: 'fast', count: 16 }],
        ]
    }
];

// Resolve a path with potential forks into concrete routes and flat tile list
export function resolvePaths(path) {
    // Separate segments into: prefix points, fork object, suffix points
    const points = [];    // simple {x,y} before any fork
    const forks = [];     // fork objects in order
    const segments = [];  // ordered list: { type:'points', data:[...] } | { type:'fork', data:[[...],[...]] }

    for (const seg of path) {
        if (seg.fork) {
            if (points.length > 0) {
                segments.push({ type: 'points', data: [...points] });
                points.length = 0;
            }
            segments.push({ type: 'fork', data: seg.fork });
        } else {
            points.push(seg);
        }
    }
    if (points.length > 0) {
        segments.push({ type: 'points', data: points });
    }

    // Build routes by expanding forks (cartesian product of all fork branches)
    let routes = [[]];
    for (const seg of segments) {
        if (seg.type === 'points') {
            routes = routes.map(r => [...r, ...seg.data]);
        } else {
            const newRoutes = [];
            for (const route of routes) {
                for (const branch of seg.data) {
                    newRoutes.push([...route, ...branch]);
                }
            }
            routes = newRoutes;
        }
    }

    // allTiles: flatten all segments (all branches included)
    const allTiles = [];
    const seen = new Set();
    for (const seg of segments) {
        const lists = seg.type === 'points' ? [seg.data] : seg.data;
        for (const list of lists) {
            for (const p of list) {
                const key = `${p.x},${p.y}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    allTiles.push(p);
                }
            }
        }
    }

    return { routes, allTiles };
}

// Backward-compatible aliases (level 0)
export const PATH = LEVELS[0].path;
export const WAVES = LEVELS[0].waves;

export const SHOP_ITEMS = {
    heart: { cost: 50, name: '+1 Vie' },
    repair: { cost: 150, name: 'Repair +5' },
    nuke: { cost: 250, name: 'Nuke' },
    damage: { cost: 100, name: 'Rage' },
    slow: { cost: 80, name: 'Blizzard' }
};

// ============== UNLOCK HELPERS ==============
export function getTowerUnlockedByWorld(levelIndex) {
    for (const [type, config] of Object.entries(TOWER_TYPES)) {
        if (config.unlockedByWorld === levelIndex) return type;
    }
    return null;
}

// ============== ISOMETRIC HELPERS ==============
// Mirrored iso so Y-axis goes down-right (path flows downward)
export function toIso(x, y) {
    return {
        x: (y - x) * (TILE_WIDTH / 2),
        y: (x + y) * (TILE_HEIGHT / 2)
    };
}

export function fromIso(isoX, isoY, offsetX, offsetY, scale = 1) {
    const localX = (isoX - offsetX) / scale;
    const localY = (isoY - offsetY) / scale;
    const x = (localY / (TILE_HEIGHT / 2) - localX / (TILE_WIDTH / 2)) / 2;
    const y = (localX / (TILE_WIDTH / 2) + localY / (TILE_HEIGHT / 2)) / 2;
    return { x: Math.floor(x), y: Math.floor(y) };
}
