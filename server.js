const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

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

            games[gameId] = {
                id: gameId,
                gameType: gameType,
                players: [ws],
                moves: {}, // For Shifumi
                board: Array(9).fill(null), // For Morpion
                turn: ws.id, // For Morpion (creator starts)
                scores: { [ws.id]: 0 },
                avatars: { [ws.id]: data.avatarId },
                usernames: { [ws.id]: data.username || 'Joueur 1' },
                winRounds: winRounds,
                round: 1
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
            if (game && game.players.length < 2) {
                // Determine if joining player is compatible (though usually they just join by ID)
                // In this case, they accept the gameType of the room.

                game.players.push(ws);
                game.scores[ws.id] = 0;
                game.avatars[ws.id] = data.avatarId;
                game.usernames[ws.id] = data.username || 'Joueur 2';
                ws.gameId = data.gameId;

                // Notify both players
                game.players.forEach(player => {
                    safeSend(player, {
                        type: 'game_start',
                        gameId: game.id,
                        gameType: game.gameType,
                        playerId: player.id,
                        opponentId: game.players.find(p => p.id !== player.id).id,
                        avatars: game.avatars,
                        usernames: game.usernames,
                        winRounds: game.winRounds,
                        turn: game.turn // Send whose turn it is
                    });
                });
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
                    restartGame.board = Array(9).fill(null); // Reset board
                    restartGame.wantsRestart.clear();
                    restartGame.round++;

                    // Reset scores if game was won previously
                    if (restartGame.gameWon) {
                        Object.keys(restartGame.scores).forEach(pid => restartGame.scores[pid] = 0);
                        restartGame.gameWon = false;
                        restartGame.round = 1;
                    }

                    // Randomize start turn for Morpion or keep loser starts? Let's just swap or keep creator? 
                    // Simple: Creator always starts round 1, maybe swap for next rounds? 
                    // Let's swap start turn for fairness logic if updated, but for now keep it simple or swap
                    if (restartGame.gameType === 'morpion') {
                        // Swap turn logic: whoever didn't start last time? 
                        // Or just random. currently defaults to creator in object init.
                        // Let's set it to the winner of previous? Or loser? 
                        // We will just set it to players[0] for simplicity or current logic.
                        // Ideally: restartGame.turn = restartGame.players[ (restartGame.round % 2) ].id;
                        restartGame.turn = restartGame.players[(restartGame.round % 2)].id; // Swap starter
                    }


                    restartGame.players.forEach(player => {
                        safeSend(player, {
                            type: 'new_round',
                            round: restartGame.round,
                            turn: restartGame.turn // Important for Morpion
                        });
                    });
                } else {
                    const opponentRestart = restartGame.players.find(p => p.id !== ws.id);
                    if (opponentRestart) {
                        safeSend(opponentRestart, { type: 'opponent_wants_replay' });
                    }
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

function handleDisconnect(ws) {
    if (ws.gameId && games[ws.gameId]) {
        const game = games[ws.gameId];
        const opponent = game.players.find(p => p.id !== ws.id);

        if (opponent) {
            safeSend(opponent, { type: 'opponent_disconnected' });
        }

        delete games[ws.gameId];
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
