# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kawaii Clash is a real-time multiplayer arcade game platform built with Node.js, Express, and WebSockets. It features a Japanese-inspired kawaii theme with customizable avatars, chat, emotes, and WebRTC audio/video capabilities.

### Supported Games
- **Shifumi** - Rock-Paper-Scissors (2 players)
- **Morpion** - Tic-Tac-Toe (2 players)
- **Puissance 4** - Connect Four (2 players)
- **Chess** - Full chess with chess.js validation (2 players)
- **Snake Battle** - Multiplayer snake with Survivor/Score modes (2-4 players)
- **Uno** - Card game with full rules (2-4 players)

## Commands

```bash
npm install    # Install dependencies
npm start      # Start production server
npm run dev    # Start dev server with auto-reload
```

Server runs on `http://localhost:3000` (configurable via PORT env var).

## Architecture

### Server Structure
```
server.js                 # Express + WebSocket entry point
├── handlers/
│   └── messageHandler.js # WebSocket message routing (central hub)
├── sessions/
│   └── Session.js        # Session management for multiplayer
├── games/
│   ├── BaseGame.js       # Abstract base class for all games
│   ├── ShifumiGame.js
│   ├── MorpionGame.js
│   ├── Puissance4Game.js
│   ├── ChessGame.js      # Uses chess.js for validation
│   ├── SnakeGame.js      # Real-time with 150ms tick loop
│   └── UnoGame.js        # Card game with deck management
└── utils/
    └── wsUtils.js        # safeSend, broadcastToGame helpers
```

### Client Structure (ES Modules)
```
public/
├── index.html            # SPA entry, loads main.js as module
├── style.css             # Responsive pastel theme
└── js/
    ├── main.js           # Entry point, WebSocket, message routing
    ├── state.js          # Centralized state management
    ├── webrtc/
    │   └── WebRTCManager.js  # Peer-to-peer audio/video
    ├── ui/
    │   ├── views.js      # View switching, avatars, status
    │   ├── chat.js       # Chat + emotes system
    │   ├── lobby.js      # Game creation/joining (legacy)
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

## Key Features

### Session System
- Persistent multi-game sessions (up to 4 players)
- Players can switch games without re-inviting
- Session IDs are 8-character uppercase codes
- Creator role management with fallback succession

### Spectator Mode
- Players joining during active game become spectators
- Spectators can see game progress and use chat/video
- Automatic promotion to active player after game ends

### WebRTC Audio/Video Chat
- Peer-to-peer connections via WebRTC
- Toggle camera and microphone independently
- Works within session system for all players/spectators
- Uses Google STUN servers for NAT traversal

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

2. **Client**: Create `public/js/games/NewGame.js` extending `BaseGame`
   - Implement `show()`, `hide()`, `onGameStart()`, `onUpdate()`, `onNewRound()`
   - Import and add to `games` object in `main.js`
   - Add HTML elements in `index.html`

## Key Patterns

- **State**: Client uses centralized `state.js` with `updateState()` helper
- **Messages**: Server games broadcast via `this.broadcast(data)`
- **Turn-based games**: Track `this.turn` (player ID), validate in `handleMove()`
- **Multiplayer games**: Support 2-4 players with proper player count validation
- **Snake**: Uses `setInterval` game loop at 150ms tick rate
- **Uno**: Personalizes data per player (each player sees only their hand)

## WebSocket Message Types

### Session Flow
- `create_session` / `join_session` / `select_game` / `back_to_lobby`

### Game Flow
- `game_start` / `make_move` / `round_result` / `game_over` / `play_again`

### WebRTC Signaling
- `webrtc_offer` / `webrtc_answer` / `webrtc_ice_candidate`

### Chat
- `chat_message` / `send_emote`

## Environment Variables

- `PORT` - Server port (default: 3000)
- `GEMINI_API_KEY` - For image generation script (optional)

## Dependencies

- **express** (4.18.2) - HTTP server
- **ws** (8.16.0) - WebSocket support
- **uuid** (9.0.1) - Session/Game ID generation
- **chess.js** (1.4.0) - Chess move validation
- **dotenv** (17.2.3) - Environment variables
