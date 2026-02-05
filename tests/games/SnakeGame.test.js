import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SnakeGame = require('../../games/SnakeGame');
const { createMockWs, createMockWsGroup } = require('../helpers/mockWs');

describe('SnakeGame', () => {
    let players, game;

    beforeEach(() => {
        vi.useFakeTimers();
        players = createMockWsGroup(2);
        game = new SnakeGame('game-1', players[0], {
            username: 'Player1',
            avatarId: 1,
            maxPlayers: 4,
            snakeGameMode: 'survivor',
        });
        game.addPlayer(players[1], { username: 'Player2', avatarId: 2 });
    });

    afterEach(() => {
        if (game.tickInterval) clearInterval(game.tickInterval);
        vi.useRealTimers();
    });

    describe('initialization', () => {
        it('should set gameType to snake', () => {
            expect(game.gameType).toBe('snake');
        });

        it('should default to survivor mode', () => {
            expect(game.snakeGameMode).toBe('survivor');
        });

        it('should support up to 4 players', () => {
            expect(game.maxPlayers).toBe(4);
        });

        it('should start in waiting status', () => {
            expect(game.gameStatus).toBe('waiting');
        });
    });

    describe('canJoin', () => {
        it('should allow joining in waiting state', () => {
            expect(game.canJoin()).toBe(true); // 2/4 players
        });

        it('should not allow joining when game started', () => {
            game.gameStatus = 'playing';
            expect(game.canJoin()).toBe(false);
        });
    });

    describe('initializeSnakes', () => {
        it('should create snakes for all players', () => {
            game.initializeSnakes();
            expect(Object.keys(game.snakes)).toHaveLength(2);
            expect(game.snakes[players[0].id]).toBeDefined();
            expect(game.snakes[players[1].id]).toBeDefined();
        });

        it('should set correct starting positions', () => {
            game.initializeSnakes();
            const snake1 = game.snakes[players[0].id];
            // Player 1 starts at (5,5) going right with length 3
            expect(snake1.segments[0]).toEqual({ x: 5, y: 5 });
            expect(snake1.direction).toBe('right');
            expect(snake1.segments).toHaveLength(3);
            expect(snake1.alive).toBe(true);
        });

        it('should assign different colors', () => {
            game.initializeSnakes();
            const s1 = game.snakes[players[0].id];
            const s2 = game.snakes[players[1].id];
            expect(s1.color).not.toBe(s2.color);
        });
    });

    describe('startGame', () => {
        it('should not start with fewer than 2 players', () => {
            const solo = new SnakeGame('game-2', players[0], { username: 'Solo' });
            solo.startGame();
            expect(solo.gameStatus).toBe('waiting');
        });

        it('should broadcast game_starting', () => {
            game.startGame();
            const msg = players[0].getLastMessage();
            expect(msg.type).toBe('game_starting');
            expect(msg.countdown).toBe(3);
            expect(msg.snakes).toBeDefined();
            expect(msg.fruits).toBeDefined();
        });

        it('should transition to playing after countdown', () => {
            game.startGame();
            expect(game.gameStatus).toBe('countdown');

            vi.advanceTimersByTime(3000);
            expect(game.gameStatus).toBe('playing');

            const messages = players[0].getMessages();
            const started = messages.find(m => m.type === 'game_started');
            expect(started).toBeDefined();
        });
    });

    describe('changeDirection', () => {
        it('should accept valid direction change', () => {
            game.startGame();
            vi.advanceTimersByTime(3000); // Start game

            game.changeDirection(players[0].id, 'up');
            expect(game.snakes[players[0].id].nextDirection).toBe('up');
        });

        it('should reject opposite direction (no 180° turn)', () => {
            game.startGame();
            vi.advanceTimersByTime(3000);

            // Player 1 starts going right, can't go left
            game.changeDirection(players[0].id, 'left');
            expect(game.snakes[players[0].id].nextDirection).toBe('right');
        });

        it('should ignore direction change when not playing', () => {
            game.initializeSnakes();
            game.gameStatus = 'countdown';
            game.changeDirection(players[0].id, 'up');
            expect(game.snakes[players[0].id].nextDirection).toBe('right');
        });
    });

    describe('handleMove', () => {
        it('should delegate change_direction type', () => {
            game.startGame();
            vi.advanceTimersByTime(3000);

            game.handleMove(players[0], { type: 'change_direction', direction: 'up' });
            expect(game.snakes[players[0].id].nextDirection).toBe('up');
        });
    });

    describe('collisions', () => {
        it('should kill snake on wall collision', () => {
            game.initializeSnakes();
            game.gameStatus = 'playing';
            game.fruits = []; // No fruits to interfere

            // Move snake1 towards left wall
            const snake = game.snakes[players[0].id];
            snake.segments = [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }];
            snake.direction = 'left';
            snake.nextDirection = 'left';

            game.tick();
            expect(snake.alive).toBe(false);

            const deathMsg = players[0].getMessages().find(m => m.type === 'snake_death');
            expect(deathMsg).toBeDefined();
            expect(deathMsg.reason).toBe('wall');
        });

        it('should kill snake on self collision', () => {
            game.initializeSnakes();
            game.gameStatus = 'playing';
            game.fruits = [];

            const snake = game.snakes[players[0].id];
            // Snake curled in a loop: head at (5,4), going down to (5,5) which is body
            // After move: new head = (5,5), body = (5,4),(6,4),(6,5),(5,5)
            // But tail pops, so body becomes (5,4),(6,4),(6,5) — no collision with (5,5)
            // Need 5+ segments so tail doesn't pop far enough
            snake.segments = [
                { x: 5, y: 4 },  // head
                { x: 6, y: 4 },
                { x: 6, y: 5 },
                { x: 5, y: 5 },  // will collide here
                { x: 4, y: 5 },
            ];
            snake.direction = 'down';
            snake.nextDirection = 'down';
            // Head moves to (5,5). Tail (4,5) pops. Body: (5,4),(6,4),(6,5),(5,5)
            // New head (5,5) matches old segment[3] (5,5) which is now at index 3

            game.tick();
            expect(snake.alive).toBe(false);
        });

        it('should kill snake on collision with other snake', () => {
            game.initializeSnakes();
            game.gameStatus = 'playing';
            game.fruits = [];

            const snake1 = game.snakes[players[0].id];
            const snake2 = game.snakes[players[1].id];

            // Position snake1 head to move into snake2 body
            // After tick: snake1 head moves right to (11,10)
            // snake2 moves down: new head (15,13), tail pops (15,10)
            // snake2 body after move: (15,13),(15,12),(15,11)
            // But we need snake1 to hit snake2. Let's place snake2 stationary-like
            snake1.segments = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
            snake1.direction = 'right';
            snake1.nextDirection = 'right';

            // snake2 going up, body spans across (11,10)
            // After move: snake2 head (11,8) -> (11,7), body becomes (11,7),(11,8),(11,9),(11,10) with tail pop -> (11,7),(11,8),(11,9)
            // That loses (11,10). Need snake2 long enough.
            snake2.segments = [
                { x: 11, y: 8 },
                { x: 11, y: 9 },
                { x: 11, y: 10 },
                { x: 11, y: 11 },
            ];
            snake2.direction = 'up';
            snake2.nextDirection = 'up';
            // After move: head (11,7), body = (11,7),(11,8),(11,9),(11,10) tail pops (11,11)
            // snake1 head goes to (11,10) which is still in snake2's body

            game.tick();
            expect(snake1.alive).toBe(false);
        });
    });

    describe('fruit consumption', () => {
        it('should grow snake and increase score when eating fruit', () => {
            game.initializeSnakes();
            game.gameStatus = 'playing';

            const snake = game.snakes[players[0].id];
            snake.segments = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
            snake.direction = 'right';
            snake.nextDirection = 'right';

            // Place fruit at (6,5) where snake head will move
            game.fruits = [{ x: 6, y: 5, value: 1 }];

            game.tick(); // Eats fruit, sets growing=true

            expect(snake.score).toBe(1);
            expect(snake.growing).toBe(true);

            // Growth happens on next tick (tail not popped)
            const lengthBefore = snake.segments.length;
            game.tick();
            expect(snake.segments.length).toBe(lengthBefore + 1);
        });
    });

    describe('win condition - survivor mode', () => {
        it('should end game when only one snake alive', () => {
            game.initializeSnakes();
            game.gameStatus = 'playing';
            game.fruits = [];

            // Kill snake2
            game.snakes[players[1].id].alive = false;

            game.checkWinCondition();
            // checkWinCondition calls endGame which checks alive count
            // But we need to trigger it properly - let's kill via tick
            game.snakes[players[1].id].alive = true; // reset

            // Position snake2 to hit wall
            const snake2 = game.snakes[players[1].id];
            snake2.segments = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
            snake2.direction = 'left';
            snake2.nextDirection = 'left';

            game.tick();

            expect(game.gameStatus).toBe('finished');
            const gameOver = players[0].getMessages().find(m => m.type === 'game_over');
            expect(gameOver).toBeDefined();
            expect(gameOver.winner).toBe(players[0].id);
        });
    });

    describe('win condition - score mode', () => {
        it('should end game when timer expires', () => {
            const scoreGame = new SnakeGame('game-2', players[0], {
                username: 'P1',
                avatarId: 1,
                snakeGameMode: 'score',
                timerDuration: 10,
            });
            scoreGame.addPlayer(players[1], { username: 'P2', avatarId: 2 });
            players[0].clearMessages();
            players[1].clearMessages();

            scoreGame.startGame();
            vi.advanceTimersByTime(3000); // countdown

            // Set one snake's score higher
            scoreGame.snakes[players[0].id].score = 5;
            scoreGame.snakes[players[1].id].score = 2;

            // Advance past timer
            vi.advanceTimersByTime(11000);

            expect(scoreGame.gameStatus).toBe('finished');
            const gameOver = players[0].getMessages().find(m => m.type === 'game_over');
            expect(gameOver).toBeDefined();
            expect(gameOver.winner).toBe(players[0].id);

            if (scoreGame.tickInterval) clearInterval(scoreGame.tickInterval);
        });
    });

    describe('multiplayer support', () => {
        it('should support 4 players', () => {
            const fourPlayers = createMockWsGroup(4);
            const multiGame = new SnakeGame('game-3', fourPlayers[0], {
                username: 'P1', avatarId: 1, maxPlayers: 4,
            });
            multiGame.addPlayer(fourPlayers[1], { username: 'P2', avatarId: 2 });
            multiGame.addPlayer(fourPlayers[2], { username: 'P3', avatarId: 3 });
            multiGame.addPlayer(fourPlayers[3], { username: 'P4', avatarId: 4 });

            expect(multiGame.players).toHaveLength(4);
            multiGame.initializeSnakes();
            expect(Object.keys(multiGame.snakes)).toHaveLength(4);

            if (multiGame.tickInterval) clearInterval(multiGame.tickInterval);
        });
    });

    describe('handlePlayAgain', () => {
        it('should restart when all players agree', () => {
            game.startGame();
            vi.advanceTimersByTime(3000);

            // End game first
            game.gameStatus = 'finished';
            if (game.tickInterval) {
                clearInterval(game.tickInterval);
                game.tickInterval = null;
            }

            players[0].clearMessages();
            players[1].clearMessages();

            game.handlePlayAgain(players[0]);
            const rematchMsg = players[1].getMessages().find(m => m.type === 'player_wants_rematch');
            expect(rematchMsg).toBeDefined();

            game.handlePlayAgain(players[1]);
            const restartMsg = players[0].getMessages().find(m => m.type === 'game_restarted');
            expect(restartMsg).toBeDefined();
        });

        it('should not restart when game is not finished', () => {
            game.gameStatus = 'playing';
            game.handlePlayAgain(players[0]);
            expect(game.wantsRestart.size).toBe(0);
        });
    });

    describe('onPlayerDisconnect', () => {
        it('should kill disconnected snake and remove player', () => {
            game.startGame();
            vi.advanceTimersByTime(3000);

            game.onPlayerDisconnect(players[1]);

            const deathMsg = players[0].getMessages().find(m => m.type === 'snake_death');
            expect(deathMsg).toBeDefined();
            expect(deathMsg.reason).toBe('disconnect');
        });

        it('should end game if fewer than 2 players', () => {
            game.startGame();
            vi.advanceTimersByTime(3000);

            game.onPlayerDisconnect(players[1]);

            expect(game.gameStatus).toBe('finished');
        });
    });
});
