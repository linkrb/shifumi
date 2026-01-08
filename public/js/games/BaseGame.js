import { state } from '../state.js';

export class BaseGame {
    constructor(gameType) {
        this.gameType = gameType;
        this.container = null;
    }

    // Called when game UI should be shown
    show() {
        if (this.container) {
            this.container.style.display = 'flex';
        }
    }

    // Called when game UI should be hidden
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    // Called when game starts
    onGameStart(data) {
        // Override in subclasses
    }

    // Called on game update message
    onUpdate(data) {
        // Override in subclasses
    }

    // Called on round result
    onRoundResult(data) {
        // Override in subclasses
    }

    // Called on new round
    onNewRound(data) {
        // Override in subclasses
    }

    // Reset game state
    reset() {
        // Override in subclasses
    }

    // Send move to server
    sendMove(moveData) {
        state.socket.send(JSON.stringify({
            type: 'make_move',
            gameId: state.gameId,
            ...moveData
        }));
    }
}
