# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kawaii Clash is a real-time multiplayer arcade game platform built with Node.js, Express, and WebSockets. It supports multiple game modes including Shifumi (Rock-Paper-Scissors), Morpion (Tic-Tac-Toe), Puissance 4 (Connect Four), Chess, and Snake Battle.

## Commands

```bash
# Install dependencies
npm install

# Start production server
npm start

# Start development server with auto-reload
npm run dev
```

The server runs on `http://localhost:3000` by default (configurable via PORT env var).

## Architecture

### Server (`server.js`)
- Express HTTP server with WebSocket (ws) layer
- Single entry point handling all game logic
- Games stored in-memory in `games` object keyed by 8-char uppercase game ID
- Each game tracks: players (WebSocket connections), moves, board state, scores, avatars, usernames
- Message types: `create_game`, `join_game`, `make_move`, `chat_message`, `send_emote`, `play_again`, `start_game` (Snake), `change_direction` (Snake)
- Chess uses chess.js library for move validation and game state

### Client (`public/script.js`)
- Single-page application with view switching
- WebSocket connection to server for real-time communication
- State management via global variables
- Game type specific UI areas: `shifumiArea`, `morpionArea`, `puissance4Area`, `chessArea`, `snakeArea`
- Controls: keyboard (arrows, ZQSD, WASD), touch/swipe for Snake

### Game Flow
1. Player creates game -> Gets 8-char game ID
2. Share URL `/game/{gameId}` with opponent(s)
3. Opponent joins via URL -> Avatar selection -> Game starts
4. WebSocket messages sync game state between players
5. Round results broadcast to all players

### Key Functions
- `handleMessage(ws, data)` - Main message router (server.js:64)
- `resolveShifumiRound(game)` - Shifumi win logic (server.js:508)
- `checkMorpionWin(board)` - Morpion 3-in-a-row check (server.js:542)
- `checkPuissance4Win(board)` - Connect Four 4-in-a-row check (server.js:557)
- `updateSnakeGame(game)` - Snake game loop tick (server.js:730)

## Environment Variables

Copy `.env.example` to `.env`:
- `PORT` - Server port (default: 3000)
- `GEMINI_API_KEY` - For image generation script (optional)

## File Structure

- `server.js` - Main server and all game logic
- `public/` - Static frontend assets
  - `script.js` - Client-side game logic
  - `style.css` - Styles
  - `index.html` - SPA entry point
  - `avatars/` - Player avatar images
- `scripts/generate-image.js` - Gemini API image generator utility
