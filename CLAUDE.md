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
