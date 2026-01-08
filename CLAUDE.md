# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kawaii Clash is a real-time multiplayer arcade game platform built with Node.js, Express, and WebSockets. It supports multiple game modes: Shifumi (Rock-Paper-Scissors), Morpion (Tic-Tac-Toe), Puissance 4 (Connect Four), Chess, and Snake Battle.

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
server.js                 # Express + WebSocket entry point (~40 lines)
├── handlers/
│   └── messageHandler.js # WebSocket message routing
├── games/
│   ├── BaseGame.js       # Abstract base class for all games
│   ├── ShifumiGame.js
│   ├── MorpionGame.js
│   ├── Puissance4Game.js
│   ├── ChessGame.js      # Uses chess.js for validation
│   └── SnakeGame.js      # Multi-player with game loop
└── utils/
    └── wsUtils.js        # safeSend, broadcastToGame helpers
```

### Client Structure (ES Modules)
```
public/
├── index.html            # SPA entry, loads main.js as module
└── js/
    ├── main.js           # Entry point, WebSocket, message routing
    ├── state.js          # Centralized state management
    ├── ui/
    │   ├── views.js      # View switching, avatars, status
    │   ├── chat.js       # Chat + emotes
    │   ├── lobby.js      # Game creation/joining lobby
    │   └── results.js    # Round/game results display
    └── games/
        ├── BaseGame.js   # Abstract UI base class
        ├── ShifumiGame.js
        ├── MorpionGame.js
        ├── Puissance4Game.js
        ├── ChessGame.js
        └── SnakeGame.js  # Canvas rendering, touch/keyboard controls
```

### Adding a New Game

1. **Server**: Create `games/NewGame.js` extending `BaseGame`
   - Implement `handleMove()`, `resetRound()`, optionally `onGameStart()`
   - Add to `GAME_CLASSES` in `handlers/messageHandler.js`

2. **Client**: Create `public/js/games/NewGame.js` extending `BaseGame`
   - Implement `show()`, `hide()`, `onGameStart()`, `onUpdate()`, `onNewRound()`
   - Import and add to `games` object in `main.js`
   - Add HTML elements in `index.html`

### Key Patterns

- **State**: Client uses centralized `state.js` with `updateState()` helper
- **Messages**: Server games broadcast via `this.broadcast(data)`
- **Turn-based games**: Track `this.turn` (player ID), validate in `handleMove()`
- **Snake**: Uses `setInterval` game loop at 100ms tick rate

## Environment Variables

- `PORT` - Server port (default: 3000)
- `GEMINI_API_KEY` - For image generation script (optional)
