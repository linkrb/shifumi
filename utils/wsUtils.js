const WebSocket = require('ws');

/**
 * Safely send data to a WebSocket client
 * @param {WebSocket} ws - WebSocket connection
 * @param {object} data - Data to send
 */
function safeSend(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(data));
        } catch (e) {
            console.error('Error sending message:', e);
        }
    }
}

/**
 * Broadcast data to all players in a game
 * @param {object} game - Game object with players array
 * @param {object} data - Data to broadcast
 */
function broadcastToGame(game, data) {
    game.players.forEach(player => safeSend(player, data));
}

module.exports = { safeSend, broadcastToGame };
