import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const UnoGame = require('../../games/UnoGame');
const { createMockWsGroup } = require('../helpers/mockWs');

describe('UnoGame', () => {
    let players, game;

    beforeEach(() => {
        players = createMockWsGroup(2);
        game = new UnoGame('game-1', players[0], { username: 'Alice', avatarId: 1 });
        game.addPlayer(players[1], { username: 'Bob', avatarId: 2 });
    });

    describe('initialization', () => {
        it('should set gameType to uno', () => {
            expect(game.gameType).toBe('uno');
        });

        it('should support up to 4 players', () => {
            expect(game.maxPlayers).toBe(4);
        });

        it('should start with direction 1 (clockwise)', () => {
            expect(game.direction).toBe(1);
        });
    });

    describe('createDeck', () => {
        it('should create a 108-card deck', () => {
            const deck = game.createDeck();
            expect(deck).toHaveLength(108);
        });

        it('should have one 0 per color', () => {
            const deck = game.createDeck();
            const zeros = deck.filter(c => c.value === '0' && c.color !== 'wild');
            expect(zeros).toHaveLength(4); // One per color
        });

        it('should have two of each 1-9 per color', () => {
            const deck = game.createDeck();
            for (const color of ['red', 'blue', 'green', 'yellow']) {
                for (let v = 1; v <= 9; v++) {
                    const cards = deck.filter(c => c.color === color && c.value === String(v));
                    expect(cards).toHaveLength(2);
                }
            }
        });

        it('should have 4 wild and 4 wild4 cards', () => {
            const deck = game.createDeck();
            const wilds = deck.filter(c => c.value === 'wild');
            const wild4s = deck.filter(c => c.value === 'wild4');
            expect(wilds).toHaveLength(4);
            expect(wild4s).toHaveLength(4);
        });

        it('should have two of each action card per color', () => {
            const deck = game.createDeck();
            for (const color of ['red', 'blue', 'green', 'yellow']) {
                for (const action of ['skip', 'reverse', 'draw2']) {
                    const cards = deck.filter(c => c.color === color && c.value === action);
                    expect(cards).toHaveLength(2);
                }
            }
        });
    });

    describe('dealCards', () => {
        it('should deal 7 cards to each player', () => {
            game.dealCards();
            expect(game.hands[players[0].id]).toHaveLength(7);
            expect(game.hands[players[1].id]).toHaveLength(7);
        });

        it('should place a non-wild card on discard pile', () => {
            game.dealCards();
            expect(game.discardPile).toHaveLength(1);
            expect(game.discardPile[0].color).not.toBe('wild');
        });

        it('should set current color from first discard', () => {
            game.dealCards();
            expect(['red', 'blue', 'green', 'yellow']).toContain(game.currentColor);
            expect(game.currentColor).toBe(game.discardPile[0].color);
        });
    });

    describe('onGameStart', () => {
        it('should send personalized game_start to each player', () => {
            game.onGameStart();

            const msg1 = players[0].getLastMessage();
            expect(msg1.type).toBe('game_start');
            expect(msg1.hand).toHaveLength(7);
            expect(msg1.discardTop).toBeDefined();
            expect(msg1.currentColor).toBeDefined();
            expect(msg1.turn).toBeDefined();

            const msg2 = players[1].getLastMessage();
            expect(msg2.hand).toHaveLength(7);
            // Each player gets their own hand
            expect(msg1.hand).not.toEqual(msg2.hand);
        });
    });

    describe('isValidPlay', () => {
        beforeEach(() => {
            game.dealCards();
        });

        it('should allow wild card always', () => {
            expect(game.isValidPlay({ color: 'wild', value: 'wild' })).toBe(true);
            expect(game.isValidPlay({ color: 'wild', value: 'wild4' })).toBe(true);
        });

        it('should allow matching color', () => {
            game.currentColor = 'red';
            expect(game.isValidPlay({ color: 'red', value: '5' })).toBe(true);
        });

        it('should allow matching value', () => {
            const topCard = game.getDiscardTop();
            game.currentColor = 'red';
            expect(game.isValidPlay({ color: 'blue', value: topCard.value })).toBe(true);
        });

        it('should reject non-matching card', () => {
            game.currentColor = 'red';
            const topCard = game.getDiscardTop();
            // Find a value different from top card
            const otherValue = topCard.value === '5' ? '6' : '5';
            expect(game.isValidPlay({ color: 'blue', value: otherValue })).toBe(false);
        });
    });

    describe('handleMove - play card', () => {
        beforeEach(() => {
            game.onGameStart();
            players[0].clearMessages();
            players[1].clearMessages();
        });

        it('should reject move when not player turn', () => {
            const notCurrentPlayer = game.getCurrentPlayer().id === players[0].id ? players[1] : players[0];
            game.handleMove(notCurrentPlayer, { card: { color: 'red', value: '5' } });

            const msg = notCurrentPlayer.getLastMessage();
            expect(msg.type).toBe('error');
        });

        it('should reject card not in hand', () => {
            const currentWs = game.getCurrentPlayer().id === players[0].id ? players[0] : players[1];
            game.handleMove(currentWs, { card: { color: 'purple', value: '99' } });

            const msg = currentWs.getLastMessage();
            expect(msg.type).toBe('error');
        });

        it('should play a valid card and broadcast update', () => {
            const currentWs = game.getCurrentPlayer().id === players[0].id ? players[0] : players[1];
            const hand = game.hands[currentWs.id];

            // Find a playable card
            const playable = hand.find(c => game.isValidPlay(c));
            if (!playable) {
                // If no playable card, draw instead
                game.handleMove(currentWs, { action: 'draw' });
                const msg = currentWs.getLastMessage();
                expect(msg.type === 'cards_drawn' || msg.type === 'uno_update').toBe(true);
                return;
            }

            const chosenColor = playable.color === 'wild' ? 'red' : undefined;
            const handSizeBefore = hand.length;
            game.handleMove(currentWs, { card: playable, chosenColor });

            expect(game.hands[currentWs.id]).toHaveLength(handSizeBefore - 1);
        });
    });

    describe('handleMove - draw', () => {
        beforeEach(() => {
            game.onGameStart();
            players[0].clearMessages();
            players[1].clearMessages();
        });

        it('should draw a card and advance turn', () => {
            const currentWs = game.getCurrentPlayer().id === players[0].id ? players[0] : players[1];
            const handSizeBefore = game.hands[currentWs.id].length;
            const turnBefore = game.turnIndex;

            game.handleMove(currentWs, { action: 'draw' });

            expect(game.hands[currentWs.id]).toHaveLength(handSizeBefore + 1);
            expect(game.turnIndex).not.toBe(turnBefore);

            const msg = currentWs.getLastMessage();
            expect(msg.type === 'cards_drawn' || msg.type === 'uno_update').toBe(true);
        });
    });

    describe('special cards', () => {
        beforeEach(() => {
            game.dealCards();
            game.turnIndex = 0;
        });

        it('skip card should skip next player turn', () => {
            // Set up: put a skip card in player 0's hand and make it playable
            game.currentColor = 'red';
            game.discardPile.push({ color: 'red', value: '3' });
            game.hands[players[0].id] = [{ color: 'red', value: 'skip' }];

            const currentPlayer = game.getCurrentPlayer();
            game.handleMove(currentPlayer, { card: { color: 'red', value: 'skip' } });

            // After skip + nextTurn in handleMove, turn should be back to player 0
            expect(game.getCurrentPlayer().id).toBe(players[0].id);
        });

        it('reverse card should reverse direction in multiplayer', () => {
            // Need 3+ players for reverse to act as reverse (not skip)
            const p3 = createMockWsGroup(1)[0];
            game.addPlayer(p3, { username: 'Charlie', avatarId: 3 });
            game.dealCards();
            game.turnIndex = 0;
            game.direction = 1;

            game.currentColor = 'red';
            game.discardPile = [{ color: 'red', value: '3' }];
            game.hands[players[0].id] = [{ color: 'red', value: 'reverse' }, { color: 'red', value: '1' }];

            players[0].clearMessages();
            players[1].clearMessages();
            p3.clearMessages();

            const currentPlayer = game.getCurrentPlayer();
            game.handleMove(currentPlayer, { card: { color: 'red', value: 'reverse' } });

            expect(game.direction).toBe(-1);
        });

        it('reverse card should act as skip in 2 players', () => {
            game.turnIndex = 0;
            game.currentColor = 'red';
            game.discardPile.push({ color: 'red', value: '3' });
            game.hands[players[0].id] = [{ color: 'red', value: 'reverse' }, { color: 'red', value: '1' }];

            const currentPlayer = game.getCurrentPlayer();
            game.handleMove(currentPlayer, { card: { color: 'red', value: 'reverse' } });

            // In 2 players, reverse acts like skip, so turn comes back to player 0
            expect(game.getCurrentPlayer().id).toBe(players[0].id);
        });

        it('draw2 should make next player draw 2 cards', () => {
            game.turnIndex = 0;
            game.currentColor = 'red';
            game.discardPile.push({ color: 'red', value: '3' });
            game.hands[players[0].id] = [{ color: 'red', value: 'draw2' }, { color: 'red', value: '1' }];
            const p2HandSize = game.hands[players[1].id].length;

            const currentPlayer = game.getCurrentPlayer();
            game.handleMove(currentPlayer, { card: { color: 'red', value: 'draw2' } });

            expect(game.hands[players[1].id]).toHaveLength(p2HandSize + 2);
        });

        it('wild4 should make next player draw 4 cards', () => {
            game.turnIndex = 0;
            game.currentColor = 'red';
            game.discardPile.push({ color: 'red', value: '3' });
            game.hands[players[0].id] = [{ color: 'wild', value: 'wild4' }, { color: 'red', value: '1' }];
            const p2HandSize = game.hands[players[1].id].length;

            const currentPlayer = game.getCurrentPlayer();
            game.handleMove(currentPlayer, { card: { color: 'wild', value: 'wild4' }, chosenColor: 'blue' });

            expect(game.hands[players[1].id]).toHaveLength(p2HandSize + 4);
            expect(game.currentColor).toBe('blue');
        });

        it('wild card should set chosen color', () => {
            game.turnIndex = 0;
            game.currentColor = 'red';
            game.discardPile.push({ color: 'red', value: '3' });
            game.hands[players[0].id] = [{ color: 'wild', value: 'wild' }, { color: 'red', value: '1' }];

            const currentPlayer = game.getCurrentPlayer();
            game.handleMove(currentPlayer, { card: { color: 'wild', value: 'wild' }, chosenColor: 'green' });

            expect(game.currentColor).toBe('green');
        });
    });

    describe('victory detection', () => {
        it('should detect win when hand is empty', () => {
            game.dealCards();
            game.turnIndex = 0;

            game.currentColor = 'red';
            game.discardPile.push({ color: 'red', value: '3' });
            // Give player only one card that can be played
            game.hands[players[0].id] = [{ color: 'red', value: '5' }];

            players[0].clearMessages();
            players[1].clearMessages();

            const currentPlayer = game.getCurrentPlayer();
            game.handleMove(currentPlayer, { card: { color: 'red', value: '5' } });

            const result = players[0].getMessages().find(m => m.type === 'round_result');
            expect(result).toBeDefined();
            expect(result.winner).toBe(players[0].id);
            expect(result.scores[players[0].id]).toBe(1);
        });
    });

    describe('multiplayer support', () => {
        it('should support 4 players', () => {
            const fourPlayers = createMockWsGroup(4);
            const multiGame = new UnoGame('game-2', fourPlayers[0], { username: 'P1', avatarId: 1 });
            multiGame.addPlayer(fourPlayers[1], { username: 'P2', avatarId: 2 });
            multiGame.addPlayer(fourPlayers[2], { username: 'P3', avatarId: 3 });
            multiGame.addPlayer(fourPlayers[3], { username: 'P4', avatarId: 4 });

            expect(multiGame.players).toHaveLength(4);
            multiGame.onGameStart();

            // Each player should have 7 cards
            for (const p of fourPlayers) {
                expect(multiGame.hands[p.id]).toHaveLength(7);
            }
        });

        it('should cycle turns correctly with 3 players', () => {
            const threePlayers = createMockWsGroup(3);
            const triGame = new UnoGame('game-3', threePlayers[0], { username: 'P1', avatarId: 1 });
            triGame.addPlayer(threePlayers[1], { username: 'P2', avatarId: 2 });
            triGame.addPlayer(threePlayers[2], { username: 'P3', avatarId: 3 });

            // Reset direction and turnIndex explicitly (don't rely on dealCards)
            triGame.direction = 1;
            triGame.turnIndex = 0;
            triGame.nextTurn();
            expect(triGame.turnIndex).toBe(1);
            triGame.nextTurn();
            expect(triGame.turnIndex).toBe(2);
            triGame.nextTurn();
            expect(triGame.turnIndex).toBe(0);
        });
    });

    describe('resetRound', () => {
        it('should deal new cards and reset state', () => {
            game.onGameStart();
            game.direction = -1;
            game.turnIndex = 1;

            game.resetRound();

            expect(game.turnIndex).toBe(0);
            expect(game.direction).toBe(1);
            expect(game.pendingDraw).toBe(0);
            expect(game.hands[players[0].id]).toHaveLength(7);
            expect(game.hands[players[1].id]).toHaveLength(7);
        });
    });

    describe('handlePlayAgain', () => {
        it('should require all players to agree', () => {
            game.onGameStart();
            players[0].clearMessages();
            players[1].clearMessages();

            game.handlePlayAgain(players[0]);

            const msg = players[1].getLastMessage();
            expect(msg.type).toBe('opponent_wants_replay');
            expect(msg.count).toBe(1);
            expect(msg.needed).toBe(2);
        });

        it('should start new round when all agree', () => {
            game.onGameStart();
            players[0].clearMessages();
            players[1].clearMessages();

            game.handlePlayAgain(players[0]);
            game.handlePlayAgain(players[1]);

            const msg = players[0].getMessages().find(m => m.type === 'new_round');
            expect(msg).toBeDefined();
            expect(msg.round).toBe(2);
            expect(msg.hand).toHaveLength(7);
        });
    });

    describe('reshuffleDeck', () => {
        it('should reshuffle discard pile into deck when deck is empty', () => {
            game.dealCards();
            // Simulate empty deck
            game.deck = [];
            game.discardPile = [
                { color: 'red', value: '1' },
                { color: 'blue', value: '2' },
                { color: 'green', value: '3' },
            ];

            game.reshuffleDeck();

            // Top card stays in discard, rest go to deck
            expect(game.discardPile).toHaveLength(1);
            expect(game.discardPile[0]).toEqual({ color: 'green', value: '3' });
            expect(game.deck).toHaveLength(2);
        });
    });
});
