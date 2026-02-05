let idCounter = 0;

function createMockWs(options = {}) {
    const id = `mock-ws-${++idCounter}`;
    const messages = [];

    return {
        id,
        readyState: 1, // WebSocket.OPEN
        sessionId: null,
        gameId: null,
        send(data) {
            messages.push(data);
        },
        messages,
        getMessages() {
            return messages.map(m => JSON.parse(m));
        },
        getLastMessage() {
            if (messages.length === 0) return null;
            return JSON.parse(messages[messages.length - 1]);
        },
        clearMessages() {
            messages.length = 0;
        },
        // Simulate closed connection
        close() {
            this.readyState = 3; // WebSocket.CLOSED
        },
    };
}

function createMockWsPair() {
    const ws1 = createMockWs();
    ws1.username = 'Player1';
    ws1.avatarId = 1;

    const ws2 = createMockWs();
    ws2.username = 'Player2';
    ws2.avatarId = 2;

    return [ws1, ws2];
}

function createMockWsGroup(count) {
    const players = [];
    for (let i = 0; i < count; i++) {
        const ws = createMockWs();
        ws.username = `Player${i + 1}`;
        ws.avatarId = i + 1;
        players.push(ws);
    }
    return players;
}

function resetIdCounter() {
    idCounter = 0;
}

module.exports = { createMockWs, createMockWsPair, createMockWsGroup, resetIdCounter };
