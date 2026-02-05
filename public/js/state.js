// Centralized state management
export const state = {
    // Connection
    socket: null,

    // Session identifiers
    sessionId: null,
    isSessionCreator: false,
    sessionPlayers: [],
    sessionMaxPlayers: 2,

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

    // Tower Defense specific
    tdGameStatus: 'waiting',
    tdPlayers: {},

    // Chess specific
    myColor: null,
    currentFen: null,
    selectedSquare: null,
    legalMoves: [],
    lastMoveSquares: { from: null, to: null },

    // Video chat
    cameraEnabled: false,
    micEnabled: false
};

// State update helper
export function updateState(updates) {
    Object.assign(state, updates);
}

// Reset game state for new game
export function resetGameState() {
    state.gameId = null;
    state.currentGameType = 'shifumi';
    state.gameWinRounds = 3;
    state.myScore = 0;
    state.opScore = 0;
    state.isMyTurn = false;
    state.myAvatar = null;
    state.opAvatar = null;

    // Chess specific
    state.myColor = null;
    state.currentFen = null;
    state.selectedSquare = null;
    state.legalMoves = [];
    state.lastMoveSquares = { from: null, to: null };

    // Snake specific
    state.snakeGameState = null;
    state.snakeGameStatus = 'waiting';
    state.snakePlayers = {};
    state.isGameCreator = false;

    // Tower Defense specific
    state.tdGameStatus = 'waiting';
    state.tdPlayers = {};
}
