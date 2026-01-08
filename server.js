const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// SPA Routing: Serve index.html for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game state storage
const games = {};

// Snake Battle constants
const SNAKE_GRID_SIZE = { width: 30, height: 30 };
const SNAKE_TICK_RATE = 100; // ms (10 FPS)
const SNAKE_INITIAL_LENGTH = 3;
const SNAKE_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1'];
const SNAKE_START_POSITIONS = [
    { x: 5, y: 5, dir: 'right' },
    { x: 24, y: 24, dir: 'left' },
    { x: 5, y: 24, dir: 'right' },
    { x: 24, y: 5, dir: 'left' }
];

// Helper: Safe Send to prevent crashes
function safeSend(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(data));
        } catch (e) {
            console.error('Error sending message:', e);
        }
    }
}

wss.on('connection', (ws) => {
    ws.id = uuidv4();
    console.log(`Client connected: ${ws.id}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (e) {
            console.error('Invalid JSON:', e);
        }
    });

    ws.on('close', () => {
        handleDisconnect(ws);
    });
});

function handleMessage(ws, data) {
    switch (data.type) {
        case 'create_game':
            const gameId = uuidv4().slice(0, 8).toUpperCase();
            // Validate winRounds
            let winRounds = parseInt(data.winRounds);
            if (winRounds !== 1 && winRounds !== 3) {
                winRounds = null;
            }

            const gameType = data.gameType || 'shifumi'; // Default to shifumi

            // Board size depends on game type
            let boardSize = 9; // Default for Morpion
            if (gameType === 'puissance4') {
                boardSize = 42; // 6 rows × 7 columns
            }

            // Chess engine for chess games
            let chessEngine = null;
            if (gameType === 'chess') {
                chessEngine = new Chess();
            }

            games[gameId] = {
                id: gameId,
                gameType: gameType,
                players: [ws],
                moves: {}, // For Shifumi
                board: Array(boardSize).fill(null), // For Morpion/Puissance4
                chessEngine: chessEngine, // For Chess
                turn: ws.id, // For turn-based games (creator starts)
                scores: { [ws.id]: 0 },
                avatars: { [ws.id]: data.avatarId },
                usernames: { [ws.id]: data.username || 'Joueur 1' },
                winRounds: winRounds,
                round: 1,
                // Snake-specific properties
                ...(gameType === 'snake' && {
                    maxPlayers: Math.min(4, Math.max(2, data.maxPlayers || 4)),
                    snakeGameMode: data.snakeGameMode || 'survivor', // 'survivor' or 'score'
                    timerDuration: data.timerDuration || 120, // seconds for score mode
                    gameStatus: 'waiting', // 'waiting' | 'countdown' | 'playing' | 'finished'
                    creatorId: ws.id,
                    snakes: {},
                    fruits: [],
                    tickInterval: null,
                    timerStarted: null
                })
            };
            ws.gameId = gameId;
            safeSend(ws, {
                type: 'game_created',
                gameId: gameId,
                playerId: ws.id,
                gameType: gameType
            });
            break;

        case 'join_game':
            const game = games[data.gameId];
            // Max players: 2 for regular games, configurable for snake
            const maxPlayers = game?.gameType === 'snake' ? game.maxPlayers : 2;

            if (game && game.players.length < maxPlayers) {
                // For snake, check if game already started
                if (game.gameType === 'snake' && game.gameStatus !== 'waiting') {
                    safeSend(ws, { type: 'error', message: 'La partie a déjà commencé' });
                    break;
                }

                game.players.push(ws);
                game.scores[ws.id] = 0;
                game.avatars[ws.id] = data.avatarId;
                game.usernames[ws.id] = data.username || `Joueur ${game.players.length}`;
                ws.gameId = data.gameId;

                // Snake: broadcast player_joined to all existing players
                if (game.gameType === 'snake') {
                    game.players.forEach(player => {
                        safeSend(player, {
                            type: 'player_joined',
                            gameId: game.id,
                            playerId: player.id,
                            newPlayerId: ws.id,
                            players: game.players.map(p => ({
                                id: p.id,
                                username: game.usernames[p.id],
                                avatar: game.avatars[p.id]
                            })),
                            maxPlayers: game.maxPlayers,
                            creatorId: game.creatorId,
                            snakeGameMode: game.snakeGameMode
                        });
                    });
                } else {
                    // Regular 2-player game: notify both players with game_start
                    game.players.forEach(player => {
                        const startData = {
                            type: 'game_start',
                            gameId: game.id,
                            gameType: game.gameType,
                            playerId: player.id,
                            opponentId: game.players.find(p => p.id !== player.id).id,
                            avatars: game.avatars,
                            usernames: game.usernames,
                            winRounds: game.winRounds,
                            turn: game.turn // Send whose turn it is
                        };

                        // For chess, add color info and initial position
                        if (game.gameType === 'chess') {
                            // Creator (player 0) is white, joiner (player 1) is black
                            startData.myColor = player === game.players[0] ? 'w' : 'b';
                            startData.fen = game.chessEngine.fen();
                        }

                        safeSend(player, startData);
                    });
                }
            } else {
                safeSend(ws, { type: 'error', message: 'Partie introuvable ou complète' });
            }
            break;

        // ... chat and emote handlers remain the same ...
        case 'chat_message':
            const chatGame = games[ws.gameId];
            if (chatGame) {
                const senderUsername = chatGame.usernames[ws.id];
                chatGame.players.forEach(player => {
                    safeSend(player, {
                        type: 'chat_message',
                        senderId: ws.id,
                        senderUsername: senderUsername,
                        message: data.message
                    });
                });
            }
            break;

        case 'send_emote':
            const emoteGame = games[ws.gameId];
            if (emoteGame) {
                emoteGame.players.forEach(player => {
                    safeSend(player, {
                        type: 'emote_received',
                        senderId: ws.id,
                        emote: data.emote
                    });
                });
            }
            break;

        case 'make_move':
            const activeGame = games[ws.gameId];
            if (activeGame) {
                if (activeGame.gameType === 'morpion') {
                    // MORPION LOGIC
                    if (activeGame.turn !== ws.id) return; // Not your turn

                    const index = data.move; // 0-8
                    if (activeGame.board[index] === null) {
                        activeGame.board[index] = ws.id;

                        // Check win
                        const winner = checkMorpionWin(activeGame.board);

                        // Notify update
                        activeGame.players.forEach(p => {
                            safeSend(p, {
                                type: 'morpion_update',
                                board: activeGame.board,
                                lastMove: index,
                                turn: activeGame.players.find(pl => pl.id !== ws.id).id // Switch turn
                            });
                        });

                        if (winner) {
                            // Winner found
                            activeGame.scores[winner]++;
                            activeGame.gameWon = true; // Instant win for Morpion usually? Or rounds?
                            // Using standard round resolution for consistency
                            const result = {
                                type: 'round_result',
                                winner: winner,
                                scores: activeGame.scores,
                                board: activeGame.board
                            };
                            activeGame.players.forEach(player => safeSend(player, result));
                            checkGameWin(activeGame, winner);

                        } else if (!activeGame.board.includes(null)) {
                            // Draw
                            const result = {
                                type: 'round_result',
                                winner: null,
                                scores: activeGame.scores,
                                board: activeGame.board
                            };
                            activeGame.players.forEach(player => safeSend(player, result));
                        } else {
                            // Switch turn locally
                            activeGame.turn = activeGame.players.find(p => p.id !== ws.id).id;
                        }
                    }

                } else if (activeGame.gameType === 'puissance4') {
                    // PUISSANCE 4 LOGIC
                    if (activeGame.turn !== ws.id) return; // Not your turn

                    const column = data.move; // 0-6
                    if (column < 0 || column > 6) return; // Invalid column

                    // Find the lowest empty row in this column (gravity)
                    let row = -1;
                    for (let r = 5; r >= 0; r--) {
                        const idx = r * 7 + column;
                        if (activeGame.board[idx] === null) {
                            row = r;
                            break;
                        }
                    }

                    if (row === -1) return; // Column is full

                    const index = row * 7 + column;
                    activeGame.board[index] = ws.id;

                    // Check win
                    const winner = checkPuissance4Win(activeGame.board);

                    // Notify update
                    activeGame.players.forEach(p => {
                        safeSend(p, {
                            type: 'puissance4_update',
                            board: activeGame.board,
                            lastMove: index,
                            turn: activeGame.players.find(pl => pl.id !== ws.id).id // Switch turn
                        });
                    });

                    if (winner) {
                        // Winner found
                        activeGame.scores[winner]++;
                        const result = {
                            type: 'round_result',
                            winner: winner,
                            scores: activeGame.scores,
                            board: activeGame.board
                        };
                        activeGame.players.forEach(player => safeSend(player, result));
                        checkGameWin(activeGame, winner);

                    } else if (!activeGame.board.includes(null)) {
                        // Draw - board is full
                        const result = {
                            type: 'round_result',
                            winner: null,
                            scores: activeGame.scores,
                            board: activeGame.board
                        };
                        activeGame.players.forEach(player => safeSend(player, result));
                    } else {
                        // Switch turn locally
                        activeGame.turn = activeGame.players.find(p => p.id !== ws.id).id;
                    }

                } else if (activeGame.gameType === 'chess') {
                    // CHESS LOGIC
                    const chess = activeGame.chessEngine;

                    // Check if it's this player's turn
                    const playerColor = ws === activeGame.players[0] ? 'w' : 'b';
                    if (chess.turn() !== playerColor) return; // Not your turn

                    // Try to make the move
                    const moveData = {
                        from: data.from,
                        to: data.to
                    };

                    // Auto-promote to queen
                    if (data.promotion) {
                        moveData.promotion = data.promotion;
                    } else {
                        // Check if this is a pawn promotion move
                        const piece = chess.get(data.from);
                        if (piece && piece.type === 'p') {
                            const toRank = data.to[1];
                            if ((piece.color === 'w' && toRank === '8') || (piece.color === 'b' && toRank === '1')) {
                                moveData.promotion = 'q'; // Auto-promote to queen
                            }
                        }
                    }

                    let move;
                    try {
                        move = chess.move(moveData);
                    } catch (e) {
                        return; // Invalid move
                    }

                    if (!move) return; // Invalid move

                    // Broadcast update
                    activeGame.players.forEach(p => {
                        safeSend(p, {
                            type: 'chess_update',
                            fen: chess.fen(),
                            turn: chess.turn(),
                            lastMove: { from: move.from, to: move.to },
                            isCheck: chess.isCheck(),
                            isCheckmate: chess.isCheckmate(),
                            isStalemate: chess.isStalemate(),
                            isDraw: chess.isDraw()
                        });
                    });

                    // Check for game end
                    if (chess.isCheckmate()) {
                        // Current player (who just moved) wins
                        const winnerId = ws.id;
                        activeGame.scores[winnerId]++;
                        const result = {
                            type: 'round_result',
                            winner: winnerId,
                            scores: activeGame.scores,
                            reason: 'checkmate'
                        };
                        activeGame.players.forEach(player => safeSend(player, result));
                        checkGameWin(activeGame, winnerId);
                    } else if (chess.isStalemate() || chess.isDraw()) {
                        // Draw
                        const result = {
                            type: 'round_result',
                            winner: null,
                            scores: activeGame.scores,
                            reason: chess.isStalemate() ? 'stalemate' : 'draw'
                        };
                        activeGame.players.forEach(player => safeSend(player, result));
                    }

                } else {
                    // SHIFUMI LOGIC
                    activeGame.moves[ws.id] = data.move;

                    // Notify opponent that a move was made (without revealing it)
                    const opponent = activeGame.players.find(p => p.id !== ws.id);
                    if (opponent) {
                        safeSend(opponent, { type: 'opponent_moved' });
                    }

                    // Check if both players moved
                    if (Object.keys(activeGame.moves).length === 2) {
                        resolveShifumiRound(activeGame);
                    }
                }
            }
            break;

        case 'play_again':
            const restartGame = games[ws.gameId];
            if (restartGame) {
                if (!restartGame.wantsRestart) restartGame.wantsRestart = new Set();
                restartGame.wantsRestart.add(ws.id);

                if (restartGame.wantsRestart.size === 2) {
                    restartGame.moves = {};
                    // Reset board with appropriate size
                    const boardSize = restartGame.gameType === 'puissance4' ? 42 : 9;
                    restartGame.board = Array(boardSize).fill(null);
                    restartGame.wantsRestart.clear();
                    restartGame.round++;

                    // Reset chess engine if chess game
                    if (restartGame.gameType === 'chess') {
                        restartGame.chessEngine = new Chess();
                    }

                    // Reset scores if game was won previously
                    if (restartGame.gameWon) {
                        Object.keys(restartGame.scores).forEach(pid => restartGame.scores[pid] = 0);
                        restartGame.gameWon = false;
                        restartGame.round = 1;
                    }

                    // Swap starter each round for fairness (for turn-based games)
                    if (restartGame.gameType === 'morpion' || restartGame.gameType === 'puissance4') {
                        restartGame.turn = restartGame.players[(restartGame.round % 2)].id;
                    }

                    // Prepare new round data
                    const newRoundData = {
                        type: 'new_round',
                        round: restartGame.round,
                        turn: restartGame.turn
                    };

                    // For chess, add initial FEN
                    if (restartGame.gameType === 'chess') {
                        newRoundData.fen = restartGame.chessEngine.fen();
                    }

                    restartGame.players.forEach(player => {
                        safeSend(player, newRoundData);
                    });
                } else {
                    const opponentRestart = restartGame.players.find(p => p.id !== ws.id);
                    if (opponentRestart) {
                        safeSend(opponentRestart, { type: 'opponent_wants_replay' });
                    }
                }
            }
            break;

        case 'start_game':
            // Snake: creator starts the game
            const snakeGame = games[ws.gameId];
            if (snakeGame && snakeGame.gameType === 'snake' &&
                snakeGame.creatorId === ws.id &&
                snakeGame.gameStatus === 'waiting' &&
                snakeGame.players.length >= 2) {
                startSnakeGame(snakeGame);
            }
            break;

        case 'change_direction':
            // Snake: player changes direction
            const dirGame = games[ws.gameId];
            if (dirGame && dirGame.gameType === 'snake' &&
                dirGame.gameStatus === 'playing' &&
                dirGame.snakes[ws.id] && dirGame.snakes[ws.id].alive) {
                const newDir = data.direction;
                const currentDir = dirGame.snakes[ws.id].direction;
                // Prevent 180-degree turns
                if (!isOppositeDirection(currentDir, newDir)) {
                    dirGame.snakes[ws.id].nextDirection = newDir;
                }
            }
            break;
    }
}

function resolveShifumiRound(game) {
    const p1 = game.players[0];
    const p2 = game.players[1];
    const m1 = game.moves[p1.id];
    const m2 = game.moves[p2.id];

    let winner = null;

    if (m1 !== m2) {
        if (
            (m1 === 'rock' && m2 === 'scissors') ||
            (m1 === 'paper' && m2 === 'rock') ||
            (m1 === 'scissors' && m2 === 'paper')
        ) {
            winner = p1.id;
            game.scores[p1.id]++;
        } else {
            winner = p2.id;
            game.scores[p2.id]++;
        }
    }

    const result = {
        type: 'round_result',
        moves: game.moves,
        winner: winner,
        scores: game.scores
    };

    game.players.forEach(player => safeSend(player, result));

    checkGameWin(game, winner);
}

function checkMorpionWin(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

function checkPuissance4Win(board) {
    const ROWS = 6;
    const COLS = 7;

    // Helper to get cell value at (row, col)
    const getCell = (row, col) => {
        if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
        return board[row * COLS + col];
    };

    // Check all possible 4-in-a-row combinations
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cell = getCell(row, col);
            if (!cell) continue;

            // Check horizontal (→)
            if (col <= COLS - 4) {
                if (cell === getCell(row, col + 1) &&
                    cell === getCell(row, col + 2) &&
                    cell === getCell(row, col + 3)) {
                    return cell;
                }
            }

            // Check vertical (↓)
            if (row <= ROWS - 4) {
                if (cell === getCell(row + 1, col) &&
                    cell === getCell(row + 2, col) &&
                    cell === getCell(row + 3, col)) {
                    return cell;
                }
            }

            // Check diagonal (↘)
            if (row <= ROWS - 4 && col <= COLS - 4) {
                if (cell === getCell(row + 1, col + 1) &&
                    cell === getCell(row + 2, col + 2) &&
                    cell === getCell(row + 3, col + 3)) {
                    return cell;
                }
            }

            // Check diagonal (↙)
            if (row <= ROWS - 4 && col >= 3) {
                if (cell === getCell(row + 1, col - 1) &&
                    cell === getCell(row + 2, col - 2) &&
                    cell === getCell(row + 3, col - 3)) {
                    return cell;
                }
            }
        }
    }
    return null;
}

function checkGameWin(game, winner) {
    if (game.winRounds && winner) {
        if (game.scores[winner] >= game.winRounds) {
            game.gameWon = true;
            const gameResult = {
                type: 'game_won',
                winner: winner,
                scores: game.scores
            };
            setTimeout(() => {
                game.players.forEach(player => safeSend(player, gameResult));
            }, 1000);
        }
    }
}

// ========== SNAKE BATTLE FUNCTIONS ==========

function isOppositeDirection(current, next) {
    const opposites = { 'up': 'down', 'down': 'up', 'left': 'right', 'right': 'left' };
    return opposites[current] === next;
}

function initializeSnakes(game) {
    game.snakes = {};
    game.players.forEach((player, index) => {
        const startPos = SNAKE_START_POSITIONS[index];
        const segments = [];
        // Create initial snake segments
        for (let i = 0; i < SNAKE_INITIAL_LENGTH; i++) {
            let x = startPos.x;
            let y = startPos.y;
            // Extend backwards from head based on direction
            if (startPos.dir === 'right') x -= i;
            else if (startPos.dir === 'left') x += i;
            else if (startPos.dir === 'down') y -= i;
            else if (startPos.dir === 'up') y += i;
            segments.push({ x, y });
        }
        game.snakes[player.id] = {
            segments: segments,
            direction: startPos.dir,
            nextDirection: startPos.dir,
            alive: true,
            color: SNAKE_COLORS[index],
            score: 0,
            growing: false
        };
    });
}

function spawnFruit(game, count = 1) {
    for (let i = 0; i < count; i++) {
        let pos;
        let attempts = 0;
        do {
            pos = {
                x: Math.floor(Math.random() * SNAKE_GRID_SIZE.width),
                y: Math.floor(Math.random() * SNAKE_GRID_SIZE.height),
                value: 1
            };
            attempts++;
        } while (isPositionOccupied(game, pos) && attempts < 100);
        if (attempts < 100) {
            game.fruits.push(pos);
        }
    }
}

function isPositionOccupied(game, pos) {
    // Check if position is occupied by any snake segment
    for (const snake of Object.values(game.snakes)) {
        for (const seg of snake.segments) {
            if (seg.x === pos.x && seg.y === pos.y) return true;
        }
    }
    // Check fruits
    for (const fruit of game.fruits) {
        if (fruit.x === pos.x && fruit.y === pos.y) return true;
    }
    return false;
}

function startSnakeGame(game) {
    game.gameStatus = 'countdown';

    // Initialize snakes
    initializeSnakes(game);

    // Spawn initial fruits
    spawnFruit(game, 5);

    // Broadcast countdown start
    broadcastToGame(game, {
        type: 'game_starting',
        countdown: 3,
        snakes: sanitizeSnakes(game.snakes),
        fruits: game.fruits,
        gridSize: SNAKE_GRID_SIZE,
        gameMode: game.snakeGameMode,
        timerDuration: game.snakeGameMode === 'score' ? game.timerDuration : null
    });

    // Start game after countdown
    setTimeout(() => {
        game.gameStatus = 'playing';
        game.timerStarted = Date.now();

        broadcastToGame(game, { type: 'game_started' });

        // Start game loop
        game.tickInterval = setInterval(() => {
            updateSnakeGame(game);
        }, SNAKE_TICK_RATE);
    }, 3000);
}

function updateSnakeGame(game) {
    if (game.gameStatus !== 'playing') {
        clearInterval(game.tickInterval);
        return;
    }

    // 1. Apply direction changes
    Object.values(game.snakes).forEach(snake => {
        if (snake.alive) {
            snake.direction = snake.nextDirection;
        }
    });

    // 2. Move each snake
    Object.entries(game.snakes).forEach(([pid, snake]) => {
        if (snake.alive) {
            moveSnake(snake);
        }
    });

    // 3. Check collisions (walls, self, other snakes)
    checkSnakeCollisions(game);

    // 4. Check fruit consumption
    checkFruitConsumption(game);

    // 5. Check win condition
    const gameEnded = checkSnakeWinCondition(game);

    // 6. Broadcast state (if game not ended)
    if (!gameEnded) {
        broadcastToGame(game, {
            type: 'snake_update',
            snakes: sanitizeSnakes(game.snakes),
            fruits: game.fruits,
            timeRemaining: getTimeRemaining(game)
        });
    }
}

function moveSnake(snake) {
    const head = snake.segments[0];
    let newHead;

    switch (snake.direction) {
        case 'up':    newHead = { x: head.x, y: head.y - 1 }; break;
        case 'down':  newHead = { x: head.x, y: head.y + 1 }; break;
        case 'left':  newHead = { x: head.x - 1, y: head.y }; break;
        case 'right': newHead = { x: head.x + 1, y: head.y }; break;
    }

    // Add new head
    snake.segments.unshift(newHead);

    // Remove tail (unless growing from eating fruit)
    if (!snake.growing) {
        snake.segments.pop();
    } else {
        snake.growing = false;
    }
}

function checkSnakeCollisions(game) {
    const { snakes } = game;

    Object.entries(snakes).forEach(([pid, snake]) => {
        if (!snake.alive) return;

        const head = snake.segments[0];

        // Wall collision
        if (head.x < 0 || head.x >= SNAKE_GRID_SIZE.width ||
            head.y < 0 || head.y >= SNAKE_GRID_SIZE.height) {
            killSnake(game, pid, 'wall');
            return;
        }

        // Self collision (skip head)
        for (let i = 1; i < snake.segments.length; i++) {
            if (head.x === snake.segments[i].x && head.y === snake.segments[i].y) {
                killSnake(game, pid, 'self');
                return;
            }
        }

        // Other snake collision
        Object.entries(snakes).forEach(([otherId, otherSnake]) => {
            if (otherId === pid) return;

            for (const seg of otherSnake.segments) {
                if (head.x === seg.x && head.y === seg.y) {
                    killSnake(game, pid, 'collision');
                    return;
                }
            }
        });
    });
}

function killSnake(game, playerId, reason) {
    const snake = game.snakes[playerId];
    if (!snake || !snake.alive) return;

    snake.alive = false;

    broadcastToGame(game, {
        type: 'snake_death',
        playerId: playerId,
        reason: reason,
        username: game.usernames[playerId]
    });
}

function checkFruitConsumption(game) {
    Object.entries(game.snakes).forEach(([pid, snake]) => {
        if (!snake.alive) return;

        const head = snake.segments[0];

        for (let i = game.fruits.length - 1; i >= 0; i--) {
            const fruit = game.fruits[i];
            if (head.x === fruit.x && head.y === fruit.y) {
                // Eat fruit
                snake.score += fruit.value;
                snake.growing = true;
                game.fruits.splice(i, 1);

                // Spawn new fruit
                spawnFruit(game, 1);
                break;
            }
        }
    });
}

function checkSnakeWinCondition(game) {
    const aliveSnakes = Object.entries(game.snakes).filter(([_, s]) => s.alive);

    if (game.snakeGameMode === 'survivor') {
        // Last snake standing wins
        if (aliveSnakes.length <= 1) {
            const winnerId = aliveSnakes.length === 1 ? aliveSnakes[0][0] : null;
            endSnakeGame(game, winnerId);
            return true;
        }
    } else if (game.snakeGameMode === 'score') {
        // Timer expired
        if (getTimeRemaining(game) <= 0) {
            // Highest score wins
            const sortedPlayers = Object.entries(game.snakes)
                .sort((a, b) => b[1].score - a[1].score);
            const winnerId = sortedPlayers[0][0];
            endSnakeGame(game, winnerId);
            return true;
        }
    }
    return false;
}

function getTimeRemaining(game) {
    if (game.snakeGameMode !== 'score' || !game.timerStarted) return null;
    const elapsed = (Date.now() - game.timerStarted) / 1000;
    return Math.max(0, game.timerDuration - elapsed);
}

function endSnakeGame(game, winnerId) {
    game.gameStatus = 'finished';
    if (game.tickInterval) {
        clearInterval(game.tickInterval);
        game.tickInterval = null;
    }

    const finalScores = {};
    const rankings = [];
    Object.entries(game.snakes).forEach(([pid, snake]) => {
        finalScores[pid] = snake.score;
        rankings.push({
            playerId: pid,
            username: game.usernames[pid],
            score: snake.score,
            alive: snake.alive
        });
    });

    // Sort rankings by score (desc), then by alive status
    rankings.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.alive - a.alive;
    });

    broadcastToGame(game, {
        type: 'game_over',
        winner: winnerId,
        winnerUsername: winnerId ? game.usernames[winnerId] : null,
        scores: finalScores,
        rankings: rankings,
        gameMode: game.snakeGameMode
    });
}

function sanitizeSnakes(snakes) {
    const result = {};
    Object.entries(snakes).forEach(([pid, snake]) => {
        result[pid] = {
            segments: snake.segments,
            direction: snake.direction,
            alive: snake.alive,
            color: snake.color,
            score: snake.score
        };
    });
    return result;
}

function broadcastToGame(game, data) {
    game.players.forEach(player => safeSend(player, data));
}

function handleDisconnect(ws) {
    if (ws.gameId && games[ws.gameId]) {
        const game = games[ws.gameId];

        if (game.gameType === 'snake') {
            // Remove player from list
            game.players = game.players.filter(p => p.id !== ws.id);

            // Kill their snake if game is running
            if (game.snakes && game.snakes[ws.id]) {
                killSnake(game, ws.id, 'disconnect');
            }

            // Notify remaining players
            broadcastToGame(game, {
                type: 'player_left',
                playerId: ws.id,
                username: game.usernames[ws.id],
                players: game.players.map(p => ({
                    id: p.id,
                    username: game.usernames[p.id],
                    avatar: game.avatars[p.id]
                }))
            });

            // If not enough players left during game
            if (game.players.length < 2 && game.gameStatus === 'playing') {
                const lastPlayer = game.players[0];
                endSnakeGame(game, lastPlayer?.id || null);
            }

            // Clean up empty games
            if (game.players.length === 0) {
                if (game.tickInterval) clearInterval(game.tickInterval);
                delete games[ws.gameId];
            }
        } else {
            // Regular 2-player game disconnect
            const opponent = game.players.find(p => p.id !== ws.id);
            if (opponent) {
                safeSend(opponent, { type: 'opponent_disconnected' });
            }
            delete games[ws.gameId];
        }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
