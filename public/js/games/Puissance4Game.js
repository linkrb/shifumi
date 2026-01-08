import { BaseGame } from './BaseGame.js';
import { state, updateState } from '../state.js';
import { setStatus, shakeElement } from '../ui/views.js';

export class Puissance4Game extends BaseGame {
    constructor() {
        super('puissance4');
        this.container = document.getElementById('puissance4-area');
        this.cells = document.querySelectorAll('.p4-cell');
        this.turnIndicator = document.getElementById('p4-turn-indicator');
        this.init();
    }

    init() {
        this.cells.forEach(cell => {
            cell.addEventListener('click', () => this.handleCellClick(cell));
        });
    }

    handleCellClick(cell) {
        if (!state.isMyTurn) {
            shakeElement(this.turnIndicator);
            return;
        }

        const column = parseInt(cell.dataset.col);

        // Check if column is full
        const topCell = document.querySelector(`.p4-cell[data-index="${column}"]`);
        if (topCell && topCell.classList.contains('taken')) {
            shakeElement(this.turnIndicator);
            return;
        }

        this.sendMove({ move: column });
    }

    onGameStart(data) {
        updateState({ isMyTurn: data.turn === state.playerId });
        this.updateTurnIndicator();
        setStatus("La partie commence !");
    }

    onUpdate(data) {
        this.updateBoard(data.board, data.lastMove);
        updateState({ isMyTurn: data.turn === state.playerId });
        this.updateTurnIndicator();
    }

    onRoundResult(data) {
        if (data.board) {
            this.updateBoard(data.board);
        }
        updateState({ isMyTurn: false });
    }

    onNewRound(data) {
        this.reset();
        updateState({ isMyTurn: data.turn === state.playerId });
        this.updateTurnIndicator();
        setStatus("Nouvelle manche !");
    }

    updateBoard(board, lastMove = null) {
        board.forEach((val, idx) => {
            const cell = document.querySelector(`.p4-cell[data-index="${idx}"]`);
            if (!cell) return;

            if (val) {
                const wasEmpty = !cell.classList.contains('taken');
                cell.classList.add('taken');

                if (val === state.playerId) {
                    cell.classList.remove('yellow');
                    cell.classList.add('red');
                } else {
                    cell.classList.remove('red');
                    cell.classList.add('yellow');
                }

                if (wasEmpty && idx === lastMove) {
                    cell.classList.add('dropping');
                    setTimeout(() => cell.classList.remove('dropping'), 500);
                }
            }
        });
    }

    updateTurnIndicator() {
        if (state.isMyTurn) {
            this.turnIndicator.textContent = "C'est à votre tour ! (Rouge)";
            this.turnIndicator.style.color = "#FF6B6B";
            this.turnIndicator.style.border = "2px solid #FF6B6B";
        } else {
            this.turnIndicator.textContent = "Tour de l'adversaire (Jaune)";
            this.turnIndicator.style.color = "#FFD93D";
            this.turnIndicator.style.border = "2px solid #FFD93D";
        }
    }

    reset() {
        this.cells.forEach(cell => {
            cell.className = 'p4-cell';
            cell.removeAttribute('style');
        });
    }
}
