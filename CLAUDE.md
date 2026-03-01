# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kawaii Clash is a real-time multiplayer arcade game platform built with Node.js (>= 20), Express, and WebSockets. It features a Japanese-inspired kawaii theme with customizable avatars (8 options), chat, emotes, and WebRTC audio/video capabilities.

### Supported Games
- **Shifumi** - Rock-Paper-Scissors (2 players)
- **Morpion** - Tic-Tac-Toe (2 players)
- **Puissance 4** - Connect Four (2 players)
- **Chess** - Full chess with chess.js validation (2 players)
- **Snake Battle** - Multiplayer snake with Survivor/Score modes (2-4 players)
- **Uno** - Card game with full rules (2-4 players)

2-player games are restricted when session has >2 players. Multiplayer games (snake, uno) are listed in `MULTIPLAYER_GAMES` in `messageHandler.js`.

## Commands

```bash
npm install        # Install dependencies
npm start          # Start production server (node server.js)
npm run dev        # Start dev server with auto-reload (node --watch)
npm test           # Run all tests once (vitest run)
npm run test:watch # Run tests in watch mode (vitest)
```

Server runs on `http://localhost:3000` (configurable via PORT env var).

## Architecture

### Server Structure
```
server.js                 # Express + WebSocket entry point, SPA routing
├── handlers/
│   └── messageHandler.js # WebSocket message routing (central hub)
├── sessions/
│   └── Session.js        # Session lifecycle (waiting → choosing → in_game)
├── games/
│   ├── BaseGame.js       # Abstract base class for all games
│   ├── ShifumiGame.js
│   ├── MorpionGame.js
│   ├── Puissance4Game.js
│   ├── ChessGame.js      # Uses chess.js for validation
│   ├── SnakeGame.js      # Real-time with 150ms tick loop
│   └── UnoGame.js        # Card game with deck management
├── utils/
│   └── wsUtils.js        # safeSend, broadcastToGame helpers
└── scripts/
    └── generate-image.js # Gemini API image generator (CLI tool)
```

Root also contains Python asset processing scripts: `process_assets.py`, `process_avatars.py`, `process_hero.py`.

### Client Structure (ES Modules)
```
public/
├── index.html            # SPA entry, loads main.js as module
├── style.css             # Responsive pastel theme
├── avatars/              # Avatar images (avatar_2.png to avatar_8.png)
├── images/generated/     # AI-generated images output
└── js/
    ├── main.js           # Entry point, WebSocket, message routing
    ├── state.js          # Centralized state management
    ├── webrtc/
    │   └── WebRTCManager.js  # Peer-to-peer audio/video
    ├── ui/
    │   ├── views.js      # View switching, avatars, status
    │   ├── chat.js       # Chat + emotes system
    │   ├── lobby.js      # Game creation/joining (legacy flow)
    │   ├── sessionLobby.js   # Session-based game selection
    │   ├── results.js    # Round/game results display
    │   └── videoChat.js  # Video bubble UI management
    └── games/
        ├── BaseGame.js   # Abstract UI base class
        ├── ShifumiGame.js
        ├── MorpionGame.js
        ├── Puissance4Game.js
        ├── ChessGame.js
        ├── SnakeGame.js  # Canvas rendering, touch/keyboard
        └── UnoGame.js    # Card hand management
```

### URL Routing
SPA with catch-all `app.get('*')` serving `index.html`. Client-side routing:
- `/session/{id}` - Auto-join a session by ID
- `/game/{id}` - Auto-join a game by ID (legacy)

## Key Features

### Session System
- Persistent multi-game sessions (up to 4 players)
- Players can switch games without re-inviting
- Session IDs are 8-character uppercase codes (from UUID)
- Creator role management with fallback succession (first player or first spectator)
- Session states: `waiting` → `choosing` → `in_game`
- All players must agree to return to lobby (`wantsToLobby` set)

### Spectator Mode
- Players joining during active game become spectators
- Spectators can see game progress and use chat/video
- Automatic promotion to active player when game ends (`promoteSpectators()`)

### WebRTC Audio/Video Chat
- Peer-to-peer connections via WebRTC
- Toggle camera and microphone independently
- Works within session system for all players/spectators
- Uses Google STUN servers for NAT traversal
- New joiners initiate connections to existing peers

### Chat & Emotes
- Real-time in-game messaging (max 50 chars)
- Quick reaction emote bar (5 emotes)
- Floating emoji animations

### Best-of-N Rounds
- Configurable: Best-of-1, Best-of-3, or Unlimited
- Score tracking across rounds

## Adding a New Game

1. **Server**: Create `games/NewGame.js` extending `BaseGame`
   - Implement `handleMove()`, `resetRound()`, optionally `onGameStart()`
   - Add to `GAME_CLASSES` in `handlers/messageHandler.js`
   - If multiplayer (>2 players), add to `MULTIPLAYER_GAMES` array

2. **Client**: Create `public/js/games/NewGame.js` extending `BaseGame`
   - Implement `show()`, `hide()`, `onGameStart()`, `onUpdate()`, `onNewRound()`
   - Import and add to `games` object in `main.js`
   - Add game name to `gameNames` map in `showSpectatorView()` (main.js)
   - Add HTML elements in `index.html`

3. **Tests**: Create `tests/games/NewGame.test.js`
   - Use `createMockWsPair()` or `createMockWsGroup(n)` from `tests/helpers/mockWs.js`
   - Test: valid moves, invalid moves (wrong turn, illegal move), win detection, draw (if applicable), `resetRound()`
   - For real-time games (like Snake), use `vi.useFakeTimers()` to control the game loop
   - Run `npm test` to validate before committing

## Key Patterns

- **State**: Client uses centralized `state.js` with `updateState()` / `resetGameState()`
- **Messages**: Server games broadcast via `this.broadcast(data)`
- **Turn-based games**: Track `this.turn` (player ID), validate in `handleMove()`
- **Multiplayer games**: Support 2-4 players with proper player count validation
- **Snake**: Uses `setInterval` game loop at 150ms tick rate, auto-starts after 500ms delay
- **Uno**: Personalizes data per player (each player sees only their hand)
- **Legacy flow**: `create_game` / `join_game` still supported alongside sessions

## WebSocket Message Types

### Client → Server
- **Session**: `create_session` / `join_session` / `select_game` / `back_to_lobby`
- **Legacy**: `create_game` / `join_game`
- **Game**: `make_move` / `change_direction` (snake) / `start_game` (snake) / `play_again`
- **Chat**: `chat_message` / `send_emote`
- **WebRTC**: `webrtc_offer` / `webrtc_answer` / `webrtc_ice_candidate`

### Server → Client
- **Session**: `session_created` / `session_joined` / `lobby_ready` / `player_wants_lobby` / `session_player_left`
- **Legacy**: `game_created` / `player_joined` / `player_left`
- **Game**: `game_start` / `opponent_moved` / `new_round` / `round_result` / `game_won` / `opponent_wants_replay` / `opponent_disconnected`
- **Game-specific updates**: `morpion_update` / `puissance4_update` / `chess_update` / `snake_update` / `uno_update` / `cards_drawn`
- **Snake**: `game_starting` / `game_started` / `snake_death` / `game_over` / `player_wants_rematch` / `game_restarted`
- **Chat**: `chat_message` / `emote_received`
- **WebRTC**: `webrtc_offer` / `webrtc_answer` / `webrtc_ice_candidate` (forwarded)
- **Error**: `error`

## Tower Defense (Standalone)

The Tower Defense is a standalone single-player game at `/test-td-pixi.html`, built with PixiJS v8.

### TD Architecture
```
public/
├── test-td-pixi.html              # Entry point (HTML + CSS + bootstrap)
└── js/games/td/
    ├── tdConfig.js                 # TOWER_TYPES, ENEMY_TYPES, LEVELS, paths, shop, iso helpers
    ├── TDEngine.js                 # Pure game logic (no rendering), callback-driven
    ├── TDRenderer.js               # PixiJS rendering, sprites, particles, effects
    └── TowerDefenseGame.js         # Orchestrator: wires engine callbacks → renderer, DOM setup
```

### Key Concepts
- **Isometric grid**: 7x12, mirrored iso projection (`toIso`/`fromIso` in tdConfig)
- **Levels**: 3 themed levels (Prairie, Cimetière, Volcan) with unique paths, decorations, enemies
- **Forked paths**: Level 3 (Volcan) uses `{ fork: [[...], [...]] }` syntax; `resolvePaths()` resolves routes
- **Towers**: 5 types (archer, cannon, ice, sniper, wind). Wind is AoE pulse with pushback, unlockable
- **Tower XP**: Towers gain XP on hit (1 per hit), level up at thresholds (max level 3)
- **Unlock system**: Some towers (wind) require a one-time gold unlock via `unlockTower()`, gated by level
- **Enemies**: 5 types (basic, fast, tank, boss, flying). HP scales +12% per wave
- **Shop**: 5 consumables (heart, repair, nuke, rage buff, blizzard buff)
- **Engine/Renderer split**: TDEngine has no DOM/PixiJS dependencies; TowerDefenseGame wires callbacks

### TD Assets
```
public/images/td/
├── towers/{type}/tower_{type}_{orientation}.png    # front/side/left/back per tower
├── towers/{type}/tower_{type}_lvl{2,3}_{orientation}.png  # leveled variants
├── enemy_{type}.png                                # base enemy sprites
├── proj_{type}.png                                 # projectile sprites
├── levels/{theme}/                                 # themed tiles, decorations, enemies, castle
├── tile_grass.png, tile_path.png, castle.png       # base tiles
└── icon_*.png                                      # HUD icons
```

**Règles pour les assets image :**
- **Toujours redimensionner** avant d'intégrer dans le projet. Les images AI générées (Gemini) peuvent faire 1024–2048px — c'est beaucoup trop pour un sprite de jeu.
- Tailles cibles : `256×256` pour tours/ennemis/effets, `128×128` pour tuiles, `512×512` max pour décors larges
- Utiliser `rembg` (Python) pour supprimer les fonds + `PIL.Image.resize()` pour redimensionner
- Ne jamais committer un asset > 512px sans raison explicite

### Adding a New Tower
1. **tdConfig.js**: Add entry to `TOWER_TYPES` with cost, damage, range, cooldown, speed, color. Optional: `splash`, `slow`, `pushback`, `aoe`, `unlockCost`, `availableFromLevel`
2. **TDEngine.js**: If special behavior (like AoE), add handling in `updateTowers()`. Add callback if needed
3. **TDRenderer.js**: Add type to `towerTypes` array (asset loading), icon/color maps. Add visual effects if needed
4. **test-td-pixi.html**: Add `.tower-btn[data-tower="newtype"]` in tower bar, preview gradient CSS
5. **TowerDefenseGame.js**: Wire any new callbacks, update `icons`/`names` maps in `showTowerInfo` and `setupTowerButtons`

## La Brémanie (Narrative Layer) — branche `feat/bremanie`

Surcouche narrative sur le Tower Defense. Univers familial : **Romain** (le père/roi), **Nathan** (fils/héros), **Anna** (fille/archère).

### Architecture
```
public/bremanie/
├── bremanie.html              # Splash screen d'entrée (Cinzel Decorative, particles)
├── dialogue-test.html         # Page de test du moteur de dialogue
├── images/
│   ├── romain/                # 8 émotions × portrait rembg (neutral, determined, worried,
│   ├── nathan/                #   angry, proud, laughing, sad, surprised)
│   ├── anna/                  # Canvas normalisé 520×560, ancrage bas
│   └── scenes/                # Illustrations plein écran (anna_bow.png, nathan_field.png)
├── dialogues/                 # Scripts de dialogue en format texte
│   ├── README.md              # Documentation du format (référence)
│   ├── prologue/intro.txt
│   └── level1/intro.txt
└── js/
    ├── DialogueEngine.js      # Moteur de dialogue Fire Emblem style
    └── tdConfig/Engine/Renderer/TowerDefenseGame.js  # Copies isolées du TD
```

### DialogueEngine
- **Jouer une scène** : `await engine.load('prologue/intro', callback)`
- **Format script** : fichiers `.txt` lisibles, pas de JSON à la main
- **Directives** : `@bg image` (fond, persos visibles), `@scene image` (cinématique, persos cachés)
- **Narration** : ligne préfixée `>` → italique centré, sans namebox
- **Dialogue** : `char(side):emotion Texte` — côté mémorisé automatiquement
- **Émotions** : neutral, determined, worried, angry, proud, laughing, sad, surprised
- **Mobile-first** : tap pour avancer, skip typewriter au 1er tap

### Personnages & couleurs namebox
| Clé | Nom | Couleur |
|-----|-----|---------|
| `romain` | Romain | Bleu royal `#2d4f8a` |
| `nathan` | Nathan | Or `#6b4a12` |
| `anna` | Anna | Rouge `#7a1f1f` |

### Portraits
- Générés via Gemini (Fire Emblem style), rembg pour fond transparent
- Normalisés sur canvas uniforme avec ancrage bas (même position quelle que soit l'émotion)
- Miroir CSS `scaleX(-1)` sur les deux côtés (tous les persos regardent naturellement à gauche)

## Environment Variables

- `PORT` - Server port (default: 3000)
- `GEMINI_API_KEY` - For `scripts/generate-image.js` (optional, not used by server)

## Dependencies

- **express** (^4.18.2) - HTTP server
- **ws** (^8.16.0) - WebSocket support
- **uuid** (^9.0.1) - Session/Game ID generation
- **chess.js** (^1.4.0) - Chess move validation
- **dotenv** (^17.2.3) - Env vars (used only in `scripts/generate-image.js`)
- **vitest** (^4.0.18) - Test framework (devDependency)
