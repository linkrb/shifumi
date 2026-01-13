import { BaseGame } from './BaseGame.js';
import { state, updateState } from '../state.js';
import { setStatus, shakeElement } from '../ui/views.js';

const CHESS_PIECES = {
    'wk': '♔', 'wq': '♕', 'wr': '♖', 'wb': '♗', 'wn': '♘', 'wp': '♙',
    'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const STARTING_PIECES = {
    'w': { 'k': 1, 'q': 1, 'r': 2, 'b': 2, 'n': 2, 'p': 8 },
    'b': { 'k': 1, 'q': 1, 'r': 2, 'b': 2, 'n': 2, 'p': 8 }
};

const PIECE_VALUES = { 'q': 9, 'r': 5, 'b': 3, 'n': 3, 'p': 1, 'k': 0 };

export class ChessGame extends BaseGame {
    constructor() {
        super('chess');
        this.container = document.getElementById('chess-area');
        this.board = document.getElementById('chess-board');
        this.turnIndicator = document.getElementById('chess-turn-indicator');
    }

    initBoard() {
        this.board.innerHTML = '';

        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const square = document.createElement('div');
                const squareName = FILES[file] + RANKS[rank];
                const isLight = (rank + file) % 2 === 0;

                square.className = `chess-square ${isLight ? 'light' : 'dark'}`;
                square.dataset.square = squareName;
                square.addEventListener('click', () => this.handleSquareClick(squareName));

                this.board.appendChild(square);
            }
        }
    }

    onGameStart(data) {
        updateState({
            myColor: data.myColor,
            currentFen: data.fen,
            isMyTurn: data.myColor === 'w'
        });
        this.initBoard();
        this.updateBoard(data.fen);
        this.updateTurnIndicator();
        setStatus("La partie commence !");
    }

    onUpdate(data) {
        updateState({
            currentFen: data.fen,
            isMyTurn: data.turn === state.myColor,
            lastMoveSquares: data.lastMove || { from: null, to: null },
            selectedSquare: null,
            legalMoves: []
        });
        this.updateBoard(data.fen, data.isCheck);
        this.updateTurnIndicator(data.isCheck);
    }

    onRoundResult(data) {
        updateState({ isMyTurn: false });
    }

    onNewRound(data) {
        updateState({
            currentFen: data.fen,
            isMyTurn: state.myColor === 'w',
            selectedSquare: null,
            legalMoves: [],
            lastMoveSquares: { from: null, to: null }
        });
        this.updateBoard(data.fen);
        this.updateTurnIndicator();
        setStatus("Nouvelle manche !");
    }

    handleSquareClick(squareName) {
        if (!state.isMyTurn) {
            shakeElement(this.turnIndicator);
            return;
        }

        const clickedSquare = document.querySelector(`.chess-square[data-square="${squareName}"]`);
        const pieceOnSquare = clickedSquare.querySelector('.chess-piece');

        if (state.selectedSquare) {
            if (state.legalMoves.includes(squareName)) {
                this.sendMove({ from: state.selectedSquare, to: squareName });
                updateState({ selectedSquare: null, legalMoves: [] });
                return;
            }

            if (state.selectedSquare === squareName) {
                this.clearSelection();
                return;
            }

            if (pieceOnSquare && this.isPieceMyColor(pieceOnSquare)) {
                this.selectSquare(squareName);
                return;
            }

            this.clearSelection();
            return;
        }

        if (pieceOnSquare && this.isPieceMyColor(pieceOnSquare)) {
            this.selectSquare(squareName);
        }
    }

    isPieceMyColor(pieceEl) {
        return state.myColor === 'w'
            ? pieceEl.classList.contains('white')
            : pieceEl.classList.contains('black');
    }

    selectSquare(squareName) {
        this.clearSelection();
        updateState({ selectedSquare: squareName });

        const squareEl = document.querySelector(`.chess-square[data-square="${squareName}"]`);
        squareEl.classList.add('selected');

        const moves = this.getLegalMoves(squareName);
        updateState({ legalMoves: moves });

        moves.forEach(move => {
            const moveSq = document.querySelector(`.chess-square[data-square="${move}"]`);
            if (moveSq) {
                moveSq.classList.add('legal-move');
                if (moveSq.querySelector('.chess-piece')) {
                    moveSq.classList.add('has-piece');
                }
            }
        });
    }

    clearSelection() {
        updateState({ selectedSquare: null, legalMoves: [] });
        document.querySelectorAll('.chess-square').forEach(sq => {
            sq.classList.remove('selected', 'legal-move', 'has-piece');
        });
    }

    parseFen(fen) {
        const board = [];
        const rows = fen.split(' ')[0].split('/');

        for (const row of rows) {
            const boardRow = [];
            for (const char of row) {
                if (isNaN(char)) {
                    const color = char === char.toUpperCase() ? 'w' : 'b';
                    const type = char.toLowerCase();
                    boardRow.push({ color, type });
                } else {
                    for (let i = 0; i < parseInt(char); i++) {
                        boardRow.push(null);
                    }
                }
            }
            board.push(boardRow);
        }
        return board;
    }

    updateBoard(fen, isCheck = false) {
        const board = this.parseFen(fen);
        this.updateCapturedPieces(fen);

        document.querySelectorAll('.chess-square').forEach(sq => {
            sq.innerHTML = '';
            sq.classList.remove('selected', 'legal-move', 'has-piece', 'last-move', 'in-check');
        });

        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                const squareName = FILES[file] + RANKS[rank];
                const squareEl = document.querySelector(`.chess-square[data-square="${squareName}"]`);

                if (piece && squareEl) {
                    const pieceEl = document.createElement('span');
                    pieceEl.className = `chess-piece ${piece.color === 'w' ? 'white' : 'black'}`;
                    pieceEl.textContent = CHESS_PIECES[piece.color + piece.type];
                    squareEl.appendChild(pieceEl);

                    if (isCheck && piece.type === 'k') {
                        const turnColor = fen.split(' ')[1];
                        if (piece.color === turnColor) {
                            squareEl.classList.add('in-check');
                        }
                    }
                }
            }
        }

        if (state.lastMoveSquares.from) {
            const fromSq = document.querySelector(`.chess-square[data-square="${state.lastMoveSquares.from}"]`);
            if (fromSq) fromSq.classList.add('last-move');
        }
        if (state.lastMoveSquares.to) {
            const toSq = document.querySelector(`.chess-square[data-square="${state.lastMoveSquares.to}"]`);
            if (toSq) toSq.classList.add('last-move');
        }
    }

    updateCapturedPieces(fen) {
        const currentPieces = { 'w': {}, 'b': {} };
        const boardPart = fen.split(' ')[0];

        for (const char of boardPart) {
            if (char === '/' || !isNaN(char)) continue;
            const color = char === char.toUpperCase() ? 'w' : 'b';
            const type = char.toLowerCase();
            currentPieces[color][type] = (currentPieces[color][type] || 0) + 1;
        }

        const capturedByWhite = [];
        const capturedByBlack = [];
        const pieceOrder = ['q', 'r', 'b', 'n', 'p'];

        for (const type of pieceOrder) {
            const blackCaptured = (STARTING_PIECES['b'][type] || 0) - (currentPieces['b'][type] || 0);
            for (let i = 0; i < blackCaptured; i++) {
                capturedByWhite.push({ type, color: 'b' });
            }

            const whiteCaptured = (STARTING_PIECES['w'][type] || 0) - (currentPieces['w'][type] || 0);
            for (let i = 0; i < whiteCaptured; i++) {
                capturedByBlack.push({ type, color: 'w' });
            }
        }

        let whiteMaterial = 0, blackMaterial = 0;
        for (const type of pieceOrder) {
            whiteMaterial += (currentPieces['w'][type] || 0) * PIECE_VALUES[type];
            blackMaterial += (currentPieces['b'][type] || 0) * PIECE_VALUES[type];
        }
        const materialDiff = whiteMaterial - blackMaterial;

        const whiteCaptures = document.getElementById('white-captures');
        const blackCaptures = document.getElementById('black-captures');

        whiteCaptures.innerHTML = capturedByWhite.map(p =>
            `<span class="captured-piece black">${CHESS_PIECES['b' + p.type]}</span>`
        ).join('');

        blackCaptures.innerHTML = capturedByBlack.map(p =>
            `<span class="captured-piece white">${CHESS_PIECES['w' + p.type]}</span>`
        ).join('');

        if (materialDiff !== 0) {
            const advantage = Math.abs(materialDiff);
            if (materialDiff > 0) {
                whiteCaptures.innerHTML += `<span class="material-advantage">+${advantage}</span>`;
            } else {
                blackCaptures.innerHTML += `<span class="material-advantage">+${advantage}</span>`;
            }
        }
    }

    updateTurnIndicator(isCheck = false) {
        const myColorName = state.myColor === 'w' ? 'Blancs' : 'Noirs';
        const opColorName = state.myColor === 'w' ? 'Noirs' : 'Blancs';

        this.turnIndicator.className = 'turn-indicator';

        if (isCheck && state.isMyTurn) {
            this.turnIndicator.textContent = "ÉCHEC ! À vous de jouer";
            this.turnIndicator.classList.add('in-check');
        } else if (isCheck && !state.isMyTurn) {
            this.turnIndicator.textContent = "Échec à l'adversaire !";
            this.turnIndicator.classList.add('in-check');
        } else if (state.isMyTurn) {
            this.turnIndicator.textContent = `C'est à vous ! (${myColorName})`;
            this.turnIndicator.classList.add(state.myColor === 'w' ? 'white-turn' : 'black-turn');
        } else {
            this.turnIndicator.textContent = `Tour de l'adversaire (${opColorName})`;
            this.turnIndicator.classList.add(state.myColor === 'w' ? 'black-turn' : 'white-turn');
        }
    }

    getLegalMoves(squareName) {
        const moves = [];
        const fenParts = state.currentFen.split(' ');
        const board = this.parseFen(state.currentFen);
        const castlingRights = fenParts[2] || '-';
        const enPassantSquare = fenParts[3] || '-';

        const file = FILES.indexOf(squareName[0]);
        const rank = RANKS.indexOf(squareName[1]);
        const piece = board[rank][file];

        if (!piece || piece.color !== state.myColor) return moves;

        const addMove = (r, f) => {
            if (r >= 0 && r < 8 && f >= 0 && f < 8) {
                const target = board[r][f];
                if (!target || target.color !== piece.color) {
                    moves.push(FILES[f] + RANKS[r]);
                }
            }
        };

        const addSlidingMoves = (dirs) => {
            for (const [dr, df] of dirs) {
                for (let i = 1; i < 8; i++) {
                    const newR = rank + dr * i;
                    const newF = file + df * i;
                    if (newR < 0 || newR >= 8 || newF < 0 || newF >= 8) break;
                    const target = board[newR][newF];
                    if (!target) {
                        moves.push(FILES[newF] + RANKS[newR]);
                    } else {
                        if (target.color !== piece.color) {
                            moves.push(FILES[newF] + RANKS[newR]);
                        }
                        break;
                    }
                }
            }
        };

        const isSquareEmpty = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8 && !board[r][f];

        const type = piece.type;
        if (type === 'p') {
            const dir = piece.color === 'w' ? -1 : 1;
            const startRank = piece.color === 'w' ? 6 : 1;

            // Forward moves
            if (rank + dir >= 0 && rank + dir < 8 && !board[rank + dir][file]) {
                moves.push(FILES[file] + RANKS[rank + dir]);
                if (rank === startRank && !board[rank + 2 * dir][file]) {
                    moves.push(FILES[file] + RANKS[rank + 2 * dir]);
                }
            }

            // Captures (including en passant)
            for (const df of [-1, 1]) {
                const newF = file + df;
                const newR = rank + dir;
                if (newF >= 0 && newF < 8 && newR >= 0 && newR < 8) {
                    const targetSquare = FILES[newF] + RANKS[newR];
                    const target = board[newR][newF];

                    // Normal capture
                    if (target && target.color !== piece.color) {
                        moves.push(targetSquare);
                    }
                    // En passant capture
                    else if (targetSquare === enPassantSquare) {
                        moves.push(targetSquare);
                    }
                }
            }
        } else if (type === 'n') {
            const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
            for (const [dr, df] of knightMoves) addMove(rank + dr, file + df);
        } else if (type === 'k') {
            // Normal king moves
            const kingMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
            for (const [dr, df] of kingMoves) addMove(rank + dr, file + df);

            // Castling
            const kingRank = piece.color === 'w' ? 7 : 0;
            if (rank === kingRank && file === 4) {
                // Kingside castling (O-O)
                const kingsideCastle = piece.color === 'w' ? 'K' : 'k';
                if (castlingRights.includes(kingsideCastle)) {
                    if (isSquareEmpty(kingRank, 5) && isSquareEmpty(kingRank, 6)) {
                        moves.push(FILES[6] + RANKS[kingRank]); // g1 or g8
                    }
                }

                // Queenside castling (O-O-O)
                const queensideCastle = piece.color === 'w' ? 'Q' : 'q';
                if (castlingRights.includes(queensideCastle)) {
                    if (isSquareEmpty(kingRank, 3) && isSquareEmpty(kingRank, 2) && isSquareEmpty(kingRank, 1)) {
                        moves.push(FILES[2] + RANKS[kingRank]); // c1 or c8
                    }
                }
            }
        } else if (type === 'b') {
            addSlidingMoves([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
        } else if (type === 'r') {
            addSlidingMoves([[-1, 0], [1, 0], [0, -1], [0, 1]]);
        } else if (type === 'q') {
            addSlidingMoves([[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]);
        }

        return moves;
    }

    reset() {
        this.clearSelection();
    }
}
