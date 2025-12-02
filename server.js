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
            // Validate winRounds (allow 1, 3, or null/undefined for no limit)
            // ParseInt ensures "3" becomes 3.
            let winRounds = parseInt(data.winRounds);
            if (winRounds !== 1 && winRounds !== 3) {
                winRounds = null; // Default to no limit if invalid or not provided
            }

            games[gameId] = {
                id: gameId,
                players: [ws],
                moves: {},
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
                playerId: ws.id
            });
            break;

        case 'join_game':
            const game = games[data.gameId];
            if (game && game.players.length < 2) {
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
                        playerId: player.id,
                        opponentId: game.players.find(p => p.id !== player.id).id,
                        avatars: game.avatars,
                        usernames: game.usernames,
                        winRounds: game.winRounds
                    });
                });
            } else {
                safeSend(ws, { type: 'error', message: 'Game not found or full' });
            }
            break;

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

        case 'make_move':
            const activeGame = games[ws.gameId];
            if (activeGame) {
                activeGame.moves[ws.id] = data.move;

                // Notify opponent that a move was made (without revealing it)
                const opponent = activeGame.players.find(p => p.id !== ws.id);
                if (opponent) {
                    safeSend(opponent, { type: 'opponent_moved' });
                }

                // Check if both players moved
                if (Object.keys(activeGame.moves).length === 2) {
                    resolveRound(activeGame);
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
                    restartGame.wantsRestart.clear();
                    restartGame.round++;

                    // Reset scores if game was won previously
                    if (restartGame.gameWon) {
                        Object.keys(restartGame.scores).forEach(pid => restartGame.scores[pid] = 0);
                        restartGame.gameWon = false;
                        restartGame.round = 1; // Reset round count too
                    }

                    restartGame.players.forEach(player => {
                        safeSend(player, { type: 'new_round', round: restartGame.round });
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

function resolveRound(game) {
    const p1 = game.players[0];
    const p2 = game.players[1];
    const m1 = game.moves[p1.id];
    const m2 = game.moves[p2.id];

    let winner = null; // null = draw, p1.id, or p2.id

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

    // Check for game winner if winRounds is set
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
            }, 1500); // Delay slightly after round result
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
