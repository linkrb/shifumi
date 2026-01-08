// Centralized state management
export const state = {
    // Connection
    socket: null,

    // Game identifiers
    gameId: null,
    playerId: null,

    // Game settings
    currentGameType: 'shifumi',
    gameWinRounds: 3,

    // Player info
    selectedAvatar: null,
    myAvatar: null,
    opAvatar: null,
    myUsername: 'Moi',
    opUsername: 'Adversaire',

    // Game state
    isMyTurn: false,
    myScore: 0,
    opScore: 0,

    // UI state
    currentView: 'home',
    isCreatingGame: false,
    selectedWinRounds: 3,

    // Snake specific
    snakeMaxPlayers: 4,
    snakeGameMode: 'survivor',
    isGameCreator: false,
    snakeGameStatus: 'waiting',
    snakePlayers: {},
    snakeGameState: null,

    // Chess specific
    myColor: null,
    currentFen: null,
    selectedSquare: null,
    legalMoves: [],
    lastMoveSquares: { from: null, to: null }
};

// State update helper
export function updateState(updates) {
    Object.assign(state, updates);
}

// Reset game state for new game
export function resetGameState() {
    state.myScore = 0;
    state.opScore = 0;
    state.isMyTurn = false;
    state.selectedSquare = null;
    state.legalMoves = [];
    state.lastMoveSquares = { from: null, to: null };
    state.snakeGameState = null;
    state.snakeGameStatus = 'waiting';
}
