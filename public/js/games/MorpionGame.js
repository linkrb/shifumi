import { BaseGame } from './BaseGame.js';
import { state, updateState } from '../state.js';
import { setStatus, shakeElement } from '../ui/views.js';

export class MorpionGame extends BaseGame {
    constructor() {
        super('morpion');
        this.container = document.getElementById('morpion-area');
        this.cells = document.querySelectorAll('.cell');
        this.turnIndicator = document.getElementById('turn-indicator');
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
        if (cell.classList.contains('taken')) return;

        const index = parseInt(cell.dataset.index);
        this.sendMove({ move: index });
    }

    onGameStart(data) {
        updateState({ isMyTurn: data.turn === state.playerId });
        this.updateTurnIndicator();
        setStatus("La partie commence !");
    }

    onUpdate(data) {
        this.updateBoard(data.board);
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

    updateBoard(board) {
        board.forEach((val, idx) => {
            const cell = this.cells[idx];
            if (val) {
                cell.classList.add('taken');
                if (val === state.playerId) {
                    cell.textContent = 'X';
                    cell.classList.add('x');
                } else {
                    cell.textContent = 'O';
                    cell.classList.add('o');
                }
            }
        });
    }

    updateTurnIndicator() {
        if (state.isMyTurn) {
            this.turnIndicator.textContent = "C'est à votre tour ! (X)";
            this.turnIndicator.style.color = "var(--cyan)";
            this.turnIndicator.style.border = "2px solid var(--cyan)";
        } else {
            this.turnIndicator.textContent = "Tour de l'adversaire (O)";
            this.turnIndicator.style.color = "var(--pink)";
            this.turnIndicator.style.border = "2px solid var(--pink)";
        }
    }

    reset() {
        this.cells.forEach(cell => {
            cell.className = 'cell';
            cell.textContent = '';
        });
    }
}
