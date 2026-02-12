// ============== CONFIGURATION ==============
export const TILE_WIDTH = 40;
export const TILE_HEIGHT = 52;
export const GRID_WIDTH = 7;
export const GRID_HEIGHT = 12;

export const TOWER_TYPES = {
    archer: { cost: 50, damage: 20, range: 3, cooldown: 750, speed: 42, color: 0x98D4BB },
    cannon: { cost: 100, damage: 55, range: 2.5, cooldown: 1300, speed: 28, color: 0xFF7F7F, splash: 1.2 },
    ice: { cost: 75, damage: 8, range: 2.5, cooldown: 900, speed: 36, color: 0x87CEEB, slow: 0.5 },
    sniper: { cost: 150, damage: 100, range: 5, cooldown: 2000, speed: 60, color: 0xE6E6FA }
};

export const ENEMY_TYPES = {
    basic: { hp: 80, speed: 2.2, reward: 7, color: 0xFFB5C5, size: 0.9, anchorY: 0.65 },
    fast: { hp: 50, speed: 3.2, reward: 10, color: 0xFFD93D, size: 1.0, anchorY: 0.65 },
    tank: { hp: 280, speed: 1.2, reward: 25, color: 0x9B59B6, size: 1.1, anchorY: 0.65 },
    boss: { hp: 900, speed: 0.9, reward: 100, color: 0xC0392B, size: 1.5, anchorY: 0.85 }
};

// S-shaped path: starts going DOWN then zigzags
// x+y never decreases → path ALWAYS goes downward on screen
export const PATH = [
    {x:0, y:0},
    {x:0, y:1}, {x:0, y:2}, {x:0, y:3},
    {x:1, y:3}, {x:2, y:3}, {x:3, y:3}, {x:4, y:3}, {x:5, y:3}, {x:6, y:3},
    {x:6, y:4}, {x:6, y:5}, {x:6, y:6},
    {x:5, y:7}, {x:4, y:8}, {x:3, y:9}, {x:2, y:10}, {x:1, y:11},
    {x:2, y:11}, {x:3, y:11}, {x:4, y:11}, {x:5, y:11}, {x:6, y:11}
];

export const WAVES = [
    [{ type: 'basic', count: 5 }],
    [{ type: 'basic', count: 8 }],
    [{ type: 'basic', count: 5 }, { type: 'fast', count: 4 }],
    [{ type: 'fast', count: 12 }],
    [{ type: 'tank', count: 3 }, { type: 'basic', count: 8 }],
    [{ type: 'tank', count: 6 }, { type: 'fast', count: 6 }],
    [{ type: 'basic', count: 15 }, { type: 'fast', count: 10 }],
    [{ type: 'tank', count: 10 }],
    [{ type: 'fast', count: 20 }, { type: 'tank', count: 5 }],
    [{ type: 'boss', count: 1 }, { type: 'tank', count: 8 }, { type: 'fast', count: 15 }]
];

export const SHOP_ITEMS = {
    heart: { cost: 50, name: '+1 Vie' },
    repair: { cost: 150, name: 'Repair +5' },
    nuke: { cost: 250, name: 'Nuke' },
    damage: { cost: 100, name: 'Rage' },
    slow: { cost: 80, name: 'Blizzard' }
};

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
