const BaseGame = require('./BaseGame');

const GRID_SIZE = { width: 30, height: 30 };
const TICK_RATE = 150; // ms
const INITIAL_LENGTH = 3;
const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1'];
const START_POSITIONS = [
    { x: 5, y: 5, dir: 'right' },    // Joueur 1: haut-gauche, va à droite
    { x: 24, y: 24, dir: 'left' },   // Joueur 2: bas-droite, va à gauche
    { x: 24, y: 5, dir: 'down' },    // Joueur 3: haut-droite, va en bas
    { x: 5, y: 24, dir: 'up' }       // Joueur 4: bas-gauche, va en haut
];

const OPPOSITES = { up: 'down', down: 'up', left: 'right', right: 'left' };

class SnakeGame extends BaseGame {
    constructor(gameId, creator, options = {}) {
        super(gameId, creator, options);
        this.gameType = 'snake';
        this.maxPlayersCount = Math.min(4, Math.max(2, options.maxPlayers || 4));
        this.snakeGameMode = options.snakeGameMode || 'survivor';
        this.timerDuration = options.timerDuration || 120;
        this.gameStatus = 'waiting';
        this.creatorId = creator.id;
        this.snakes = {};
        this.fruits = [];
        this.tickInterval = null;
        this.timerStarted = null;
    }

    get maxPlayers() {
        return this.maxPlayersCount;
    }

    canJoin() {
        return this.gameStatus === 'waiting' && this.players.length < this.maxPlayers;
    }

    addPlayer(ws, options = {}) {
        super.addPlayer(ws, options);
        this.broadcastPlayerJoined(ws);
    }

    broadcastPlayerJoined(newPlayer) {
        this.players.forEach(player => {
            this.sendTo(player, {
                type: 'player_joined',
                gameId: this.id,
                playerId: player.id,
                newPlayerId: newPlayer.id,
                players: this.players.map(p => ({
                    id: p.id,
                    username: this.usernames[p.id],
                    avatar: this.avatars[p.id]
                })),
                maxPlayers: this.maxPlayers,
                creatorId: this.creatorId,
                snakeGameMode: this.snakeGameMode
            });
        });
    }

    // Snake doesn't use standard game start
    onGameStart() {}

    startGame() {
        if (this.gameStatus !== 'waiting' || this.players.length < 2) return;

        this.gameStatus = 'countdown';
        this.initializeSnakes();
        this.spawnFruit(5);

        this.broadcast({
            type: 'game_starting',
            countdown: 3,
            snakes: this.sanitizeSnakes(),
            fruits: this.fruits,
            gridSize: GRID_SIZE,
            gameMode: this.snakeGameMode,
            timerDuration: this.snakeGameMode === 'score' ? this.timerDuration : null
        });

        setTimeout(() => {
            this.gameStatus = 'playing';
            this.timerStarted = Date.now();
            this.broadcast({ type: 'game_started' });
            this.tickInterval = setInterval(() => this.tick(), TICK_RATE);
        }, 3000);
    }

    initializeSnakes() {
        this.snakes = {};
        this.players.forEach((player, index) => {
            const start = START_POSITIONS[index];
            const segments = [];
            for (let i = 0; i < INITIAL_LENGTH; i++) {
                let x = start.x, y = start.y;
                if (start.dir === 'right') x -= i;
                else if (start.dir === 'left') x += i;
                else if (start.dir === 'down') y -= i;
                else if (start.dir === 'up') y += i;
                segments.push({ x, y });
            }
            this.snakes[player.id] = {
                segments,
                direction: start.dir,
                nextDirection: start.dir,
                alive: true,
                color: COLORS[index],
                score: 0,
                growing: false
            };
        });
    }

    spawnFruit(count = 1) {
        for (let i = 0; i < count; i++) {
            let pos, attempts = 0;
            do {
                pos = {
                    x: Math.floor(Math.random() * GRID_SIZE.width),
                    y: Math.floor(Math.random() * GRID_SIZE.height),
                    value: 1
                };
                attempts++;
            } while (this.isPositionOccupied(pos) && attempts < 100);
            if (attempts < 100) this.fruits.push(pos);
        }
    }

    isPositionOccupied(pos) {
        for (const snake of Object.values(this.snakes)) {
            for (const seg of snake.segments) {
                if (seg.x === pos.x && seg.y === pos.y) return true;
            }
        }
        for (const fruit of this.fruits) {
            if (fruit.x === pos.x && fruit.y === pos.y) return true;
        }
        return false;
    }

    handleMove(ws, data) {
        // This is called for direction change
        if (data.type === 'change_direction') {
            this.changeDirection(ws.id, data.direction);
        }
    }

    changeDirection(playerId, newDir) {
        if (this.gameStatus !== 'playing') return;
        const snake = this.snakes[playerId];
        if (!snake || !snake.alive) return;
        if (OPPOSITES[snake.direction] !== newDir) {
            snake.nextDirection = newDir;
        }
    }

    tick() {
        if (this.gameStatus !== 'playing') {
            clearInterval(this.tickInterval);
            return;
        }

        // Apply direction changes
        Object.values(this.snakes).forEach(snake => {
            if (snake.alive) snake.direction = snake.nextDirection;
        });

        // Move snakes
        Object.values(this.snakes).forEach(snake => {
            if (snake.alive) this.moveSnake(snake);
        });

        // Check collisions
        this.checkCollisions();

        // Check fruit consumption
        this.checkFruits();

        // Check win condition
        if (this.checkWinCondition()) return;

        // Broadcast state
        this.broadcast({
            type: 'snake_update',
            snakes: this.sanitizeSnakes(),
            fruits: this.fruits,
            timeRemaining: this.getTimeRemaining()
        });
    }

    moveSnake(snake) {
        const head = snake.segments[0];
        let newHead;
        switch (snake.direction) {
            case 'up': newHead = { x: head.x, y: head.y - 1 }; break;
            case 'down': newHead = { x: head.x, y: head.y + 1 }; break;
            case 'left': newHead = { x: head.x - 1, y: head.y }; break;
            case 'right': newHead = { x: head.x + 1, y: head.y }; break;
        }
        snake.segments.unshift(newHead);
        if (!snake.growing) {
            snake.segments.pop();
        } else {
            snake.growing = false;
        }
    }

    checkCollisions() {
        Object.entries(this.snakes).forEach(([pid, snake]) => {
            if (!snake.alive) return;
            const head = snake.segments[0];

            // Wall collision
            if (head.x < 0 || head.x >= GRID_SIZE.width || head.y < 0 || head.y >= GRID_SIZE.height) {
                this.killSnake(pid, 'wall');
                return;
            }

            // Self collision
            for (let i = 1; i < snake.segments.length; i++) {
                if (head.x === snake.segments[i].x && head.y === snake.segments[i].y) {
                    this.killSnake(pid, 'self');
                    return;
                }
            }

            // Other snake collision
            Object.entries(this.snakes).forEach(([otherId, other]) => {
                if (otherId === pid) return;
                for (const seg of other.segments) {
                    if (head.x === seg.x && head.y === seg.y) {
                        this.killSnake(pid, 'collision');
                        return;
                    }
                }
            });
        });
    }

    killSnake(playerId, reason) {
        const snake = this.snakes[playerId];
        if (!snake || !snake.alive) return;
        snake.alive = false;
        this.broadcast({
            type: 'snake_death',
            playerId,
            reason,
            username: this.usernames[playerId]
        });
    }

    checkFruits() {
        Object.entries(this.snakes).forEach(([pid, snake]) => {
            if (!snake.alive) return;
            const head = snake.segments[0];
            for (let i = this.fruits.length - 1; i >= 0; i--) {
                const fruit = this.fruits[i];
                if (head.x === fruit.x && head.y === fruit.y) {
                    snake.score += fruit.value;
                    snake.growing = true;
                    this.fruits.splice(i, 1);
                    this.spawnFruit(1);
                    break;
                }
            }
        });
    }

    checkWinCondition() {
        const alive = Object.entries(this.snakes).filter(([_, s]) => s.alive);

        if (this.snakeGameMode === 'survivor' && alive.length <= 1) {
            const winnerId = alive.length === 1 ? alive[0][0] : null;
            this.endGame(winnerId);
            return true;
        }

        if (this.snakeGameMode === 'score' && this.getTimeRemaining() <= 0) {
            const sorted = Object.entries(this.snakes).sort((a, b) => b[1].score - a[1].score);
            this.endGame(sorted[0][0]);
            return true;
        }

        return false;
    }

    getTimeRemaining() {
        if (this.snakeGameMode !== 'score' || !this.timerStarted) return null;
        const elapsed = (Date.now() - this.timerStarted) / 1000;
        return Math.max(0, this.timerDuration - elapsed);
    }

    endGame(winnerId) {
        this.gameStatus = 'finished';
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }

        const rankings = Object.entries(this.snakes)
            .map(([pid, snake]) => ({
                playerId: pid,
                username: this.usernames[pid],
                score: snake.score,
                alive: snake.alive
            }))
            .sort((a, b) => b.score !== a.score ? b.score - a.score : b.alive - a.alive);

        this.broadcast({
            type: 'game_over',
            winner: winnerId,
            winnerUsername: winnerId ? this.usernames[winnerId] : null,
            scores: Object.fromEntries(Object.entries(this.snakes).map(([pid, s]) => [pid, s.score])),
            rankings,
            gameMode: this.snakeGameMode
        });
    }

    sanitizeSnakes() {
        const result = {};
        Object.entries(this.snakes).forEach(([pid, snake]) => {
            result[pid] = {
                segments: snake.segments,
                direction: snake.direction,
                alive: snake.alive,
                color: snake.color,
                score: snake.score
            };
        });
        return result;
    }

    onPlayerDisconnect(ws) {
        this.removePlayer(ws);
        if (this.snakes[ws.id]) {
            this.killSnake(ws.id, 'disconnect');
        }

        this.broadcast({
            type: 'player_left',
            playerId: ws.id,
            username: this.usernames[ws.id],
            players: this.players.map(p => ({
                id: p.id,
                username: this.usernames[p.id],
                avatar: this.avatars[p.id]
            }))
        });

        if (this.players.length < 2 && this.gameStatus === 'playing') {
            const lastPlayer = this.players[0];
            this.endGame(lastPlayer?.id || null);
        }

        return this.players.length === 0;
    }

    resetRound() {
        // Snake doesn't have rounds in the traditional sense
    }

    handlePlayAgain(ws) {
        if (this.gameStatus !== 'finished') return;

        this.wantsRestart.add(ws.id);

        // Notify other players
        this.players.forEach(player => {
            if (player.id !== ws.id) {
                this.sendTo(player, {
                    type: 'player_wants_rematch',
                    playerId: ws.id,
                    username: this.usernames[ws.id],
                    readyCount: this.wantsRestart.size,
                    totalPlayers: this.players.length
                });
            }
        });

        // Check if all players want to restart
        if (this.wantsRestart.size === this.players.length) {
            this.restartGame();
        }
    }

    restartGame() {
        this.wantsRestart.clear();
        this.gameStatus = 'waiting';
        this.snakes = {};
        this.fruits = [];

        this.broadcast({
            type: 'game_restarted',
            players: this.players.map(p => ({
                id: p.id,
                username: this.usernames[p.id],
                avatar: this.avatars[p.id]
            })),
            maxPlayers: this.maxPlayers,
            creatorId: this.creatorId,
            snakeGameMode: this.snakeGameMode
        });

        // Auto-start since all players are already here
        setTimeout(() => this.startGame(), 500);
    }
}

module.exports = SnakeGame;
