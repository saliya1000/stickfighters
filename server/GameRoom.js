import { Physics } from '../shared/physics.js';
import { CONSTANTS } from '../shared/constants.js';

export class GameRoom {
    constructor(roomId, io) {
        this.roomId = roomId;
        this.io = io;
        this.players = new Map(); // id -> player object
        this.hostId = null; // Track the lead player
        this.isRunning = false;
        this.isPaused = false;
        this.pauser = null; // Track who paused
        this.lastTime = Date.now();
        this.timer = 180; // 3 minutes in seconds
        this.powerups = new Map(); // id -> powerup object
        this.nextPowerupId = 1;
        this.nextPowerupSpawn = Date.now() + Math.random() * (CONSTANTS.POWERUP_SPAWN_INTERVAL_MAX - CONSTANTS.POWERUP_SPAWN_INTERVAL_MIN) + CONSTANTS.POWERUP_SPAWN_INTERVAL_MIN;

        // Define vibrant colors
        this.availableColors = [
            '#FF0000', // Red
            '#00FF00', // Green
            '#0000FF', // Blue
            '#FFFF00', // Yellow
            '#00FFFF', // Cyan
            '#FF00FF', // Magenta
            '#FFA500', // Orange
            '#800080', // Purple
            '#FFC0CB', // Pink
            '#FFFFFF'  // White
        ];
        this.usedColors = new Set();
    }

    addPlayer(socket, name) {
        // Check if lobby is full (max 4 players)
        if (this.players.size >= 4) {
            socket.emit('joinError', 'Lobby is full (maximum 4 players)');
            return;
        }

        // Validate name (simple check)
        const playerName = name ? name.trim().substr(0, 10) : `Player ${socket.id.substr(0, 4)}`;

        // Check for duplicates
        const existingNames = new Set(Array.from(this.players.values()).map(p => p.name.toLowerCase()));
        if (existingNames.has(playerName.toLowerCase())) {
            socket.emit('joinError', 'Username already taken');
            return;
        }

        // Assign Unique Color
        let playerColor = '#FFFFFF';
        for (const color of this.availableColors) {
            if (!this.usedColors.has(color)) {
                playerColor = color;
                this.usedColors.add(color);
                break;
            }
        }
        // Fallback if all colors taken (random hsl)
        if (playerColor === '#FFFFFF' && this.usedColors.has('#FFFFFF')) {
            playerColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
        }

        const player = {
            id: socket.id,
            name: playerName,
            x: Math.random() * (CONSTANTS.ARENA_WIDTH - 100) + 50,
            y: 100,
            vx: 0,
            vy: 0,
            color: playerColor,
            facing: 'right',
            hp: CONSTANTS.PLAYER_HP,
            score: 0,
            isGrounded: false,
            punchCooldown: 0,
            kickCooldown: 0,
            lastUpdate: Date.now(),
            action: null,
            actionTimer: 0,
            isCrouching: false,
            inputs: { left: false, right: false, jump: false, crouch: false, attack1: false, attack2: false },
            hatId: CONSTANTS.HATS.NONE, // Default hat
            buffs: {
                speed: 0,
                damage: 0
            }
        };

        // Check if game is already running
        if (this.isRunning) {
            player.isWaiting = true;
            player.hp = 0; // Mark as dead effectively
            // Force this player to game screen
            socket.emit('gameStart');
        }

        this.players.set(socket.id, player);
        socket.join(this.roomId);

        socket.on('input', (state) => {
            this.handleInput(socket.id, state);
        });

        socket.on('requestStartGame', () => {
            this.requestStartGame(socket.id);
        });

        // Assign host if none exists
        if (!this.hostId) {
            this.hostId = socket.id;
        }

        // Notify success to the joiner
        socket.emit('joinSuccess');

        // If game is paused, notify the new player immediately
        if (this.isRunning && this.isPaused) {
            socket.emit('gamePaused', { isPaused: true, pauser: this.pauser });
        }

        this.io.to(this.roomId).emit('playerJoined', player);

        // Broadcast new lobby state
        this.broadcastLobbyState();
    }

    removePlayer(socketId) {
        const player = this.players.get(socketId);
        if (player) {
            // Only announce if the player was active (not waiting)
            if (!player.isWaiting) {
                this.io.to(this.roomId).emit('serverMessage', `${player.name} left the game.`);
            }

            // Release color
            if (this.usedColors.has(player.color)) {
                this.usedColors.delete(player.color);
            }
        }

        this.players.delete(socketId);

        // Reassign host if the host left
        if (this.hostId === socketId) {
            this.hostId = this.players.keys().next().value || null;
        }

        this.io.to(this.roomId).emit('playerLeft', socketId);
        this.broadcastLobbyState();

        if (this.players.size < 2 && this.isRunning) {
            this.endGame('Not enough players');
        }
    }

    broadcastLobbyState() {
        // Emit lobby update with player list and host ID
        this.io.to(this.roomId).emit('lobbyUpdate', {
            players: Array.from(this.players.values()),
            hostId: this.hostId,
            canStart: this.players.size >= 2 && this.players.size <= 4
        });
    }

    requestStartGame(socketId, duration) {
        if (this.isRunning) return;

        // Only host can start
        if (socketId !== this.hostId) return;

        // Player count check
        if (this.players.size >= 2 && this.players.size <= 4) {
            this.startGame(duration);
        }
    }

    handleInput(socketId, inputs) {
        const player = this.players.get(socketId);
        if (player) {
            player.inputs = inputs;
        }
    }

    togglePause(socketId) {
        if (!this.isRunning) return;

        const player = this.players.get(socketId);
        if (!player) return;

        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            this.pauser = player.name;
        } else {
            this.pauser = null;
        }

        const msg = this.isPaused ? `${player.name} paused the game` : `${player.name} resumed the game`;

        this.io.to(this.roomId).emit('gamePaused', { isPaused: this.isPaused, pauser: player.name });
        this.io.to(this.roomId).emit('serverMessage', msg);
    }

    startGame(duration = CONSTANTS.GAME_DURATIONS.MIN_3) {
        // Validate duration
        const validDurations = Object.values(CONSTANTS.GAME_DURATIONS);
        if (!validDurations.includes(duration)) {
            console.warn('Invalid duration requested, defaulting to 3 mins');
            duration = CONSTANTS.GAME_DURATIONS.MIN_3;
        }

        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = Date.now();
        this.lastTimerUpdate = Date.now();
        this.timer = duration; // Set timer to selected duration

        this.powerups.clear();
        this.nextPowerupSpawn = Date.now() + 5000; // First spawn in 5s

        // Reset all players
        for (const player of this.players.values()) {
            this.respawnPlayer(player);
            player.score = 0; // Optional: Reset score or keep it? Usually reset for new match
        }

        this.io.to(this.roomId).emit('gameStart');

        this.intervalId = setInterval(() => {
            this.update();
        }, 1000 / CONSTANTS.TICK_RATE);
    }

    endGame(reason) {
        this.isRunning = false;
        clearInterval(this.intervalId);

        // Determine winner
        let winnerName = null;
        let maxScore = -1;
        let isDraw = false;

        const players = Array.from(this.players.values());
        if (players.length > 0) {
            // Sort by score descending
            players.sort((a, b) => b.score - a.score);

            const topPlayer = players[0];
            maxScore = topPlayer.score;
            winnerName = topPlayer.name;

            // Check for draw
            if (players.length > 1 && players[1].score === maxScore) {
                isDraw = true;
            }
        }

        const winnerMessage = isDraw ? "It's a Draw!" : (winnerName ? `${winnerName} Wins!` : "No Winner");

        const scores = players.map(p => ({
            name: p.name,
            score: p.score,
            color: p.color
        }));

        console.log('Ending game. Leaderboard:', scores);

        this.io.to(this.roomId).emit('gameEnd', { reason, winner: winnerMessage, scores });
    }

    update() {
        if (this.isPaused) {
            this.lastTime = Date.now();
            this.lastTimerUpdate = Date.now();
            return;
        }

        const now = Date.now();
        this.lastTime = now;

        // Timer
        if (this.isRunning && this.timer > 0) {
            const delta = (now - (this.lastTimerUpdate || now)) / 1000;
            this.timer -= delta;
            this.lastTimerUpdate = now;

            if (this.timer <= 0) {
                this.timer = 0;
                this.endGame('Time Limit Reached');
            }
        } else {
            this.lastTimerUpdate = now;
        }

        // Power-Up Spawning
        if (this.isRunning && now >= this.nextPowerupSpawn && this.powerups.size === 0) {
            this.spawnPowerup();
            this.nextPowerupSpawn = now + Math.random() * (CONSTANTS.POWERUP_SPAWN_INTERVAL_MAX - CONSTANTS.POWERUP_SPAWN_INTERVAL_MIN) + CONSTANTS.POWERUP_SPAWN_INTERVAL_MIN;
        }

        // Power-Up Despawn
        for (const [id, pu] of this.powerups) {
            if (now > pu.despawnTime) {
                this.powerups.delete(id);
            }
        }

        for (const player of this.players.values()) {
            if (player.hp <= 0 || player.isWaiting) continue;

            // Buff Expiration
            if (player.buffs.speed > 0 && now > player.buffs.speed) player.buffs.speed = 0;
            if (player.buffs.damage > 0 && now > player.buffs.damage) player.buffs.damage = 0;

            // Cooldowns
            if (player.punchCooldown > 0) player.punchCooldown -= (1000 / CONSTANTS.TICK_RATE);
            if (player.kickCooldown > 0) player.kickCooldown -= (1000 / CONSTANTS.TICK_RATE);

            // Apply Inputs (Buffed Speed)
            const speedMult = player.buffs.speed > 0 ? 1.5 : 1.0;

            // Crouch Logic
            player.isCrouching = player.inputs.crouch && player.isGrounded;



            // Movement (Crouch slows you down significantly)
            const moveSpeed = player.isCrouching ? CONSTANTS.MOVE_ACCEL * 0.3 : CONSTANTS.MOVE_ACCEL;

            if (player.inputs.left) {
                player.vx -= moveSpeed * speedMult;
                player.facing = 'left';
            }
            if (player.inputs.right) {
                player.vx += moveSpeed * speedMult;
                player.facing = 'right';
            }
            // Cannot jump while crouching
            if (player.inputs.jump && player.isGrounded && !player.isCrouching) {
                player.vy = CONSTANTS.JUMP_FORCE;
                player.isGrounded = false;
            }

            // Attacks
            if (player.inputs.attack1 && player.punchCooldown <= 0) {
                this.performAttack(player, 'punch');
            } else if (player.inputs.attack2 && player.kickCooldown <= 0) {
                this.performAttack(player, 'kick');
            }

            // Power-Up Collection
            for (const [id, pu] of this.powerups) {
                const playerRect = { x: player.x, y: player.y, width: CONSTANTS.PLAYER_WIDTH, height: CONSTANTS.PLAYER_HEIGHT };
                const puRect = { x: pu.x, y: pu.y, width: CONSTANTS.POWERUP_SIZE, height: CONSTANTS.POWERUP_SIZE };

                if (Physics.checkCollision(playerRect, puRect)) {
                    this.applyPowerup(player, pu);
                    this.powerups.delete(id);
                    this.io.to(this.roomId).emit('serverMessage', `${player.name} collected ${pu.type === CONSTANTS.POWERUP_TYPES.SPEED_BOOST ? 'Speed Boost' : 'Damage Boost'}!`);
                }
            }

            // Physics
            Physics.applyGravity(player);
            Physics.applyFriction(player);

            const maxSpeed = CONSTANTS.MAX_SPEED * speedMult;
            if (Math.abs(player.vx) > maxSpeed) {
                player.vx = Math.sign(player.vx) * maxSpeed;
            }

            Physics.moveEntity(player);
            Physics.constrainToArena(player);
            Physics.checkPlatformCollisions(player);

            // Action Timer
            if (player.actionTimer > 0) {
                player.actionTimer -= (1000 / CONSTANTS.TICK_RATE) / 1000;
                if (player.actionTimer <= 0) {
                    player.actionTimer = 0;
                    player.action = null;
                }
            }
        }

        this.io.to(this.roomId).emit('stateUpdate', {
            players: Array.from(this.players.values()),
            powerups: Array.from(this.powerups.values()),
            time: now,
            timer: this.timer
        });
    }

    spawnPowerup() {
        const type = Math.random() > 0.5 ? CONSTANTS.POWERUP_TYPES.SPEED_BOOST : CONSTANTS.POWERUP_TYPES.DAMAGE_BOOST;
        const powerup = {
            id: this.nextPowerupId++,
            type: type,
            x: Math.random() * (CONSTANTS.ARENA_WIDTH - 100) + 50,
            y: CONSTANTS.ARENA_HEIGHT - 100 - CONSTANTS.POWERUP_SIZE, // On ground roughly
            despawnTime: Date.now() + 15000 // Lasts 15s on map
        };
        this.powerups.set(powerup.id, powerup);
        // this.io.to(this.roomId).emit('powerupSpawned', powerup); 
    }

    applyPowerup(player, pu) {
        const until = Date.now() + CONSTANTS.POWERUP_DURATION;
        if (pu.type === CONSTANTS.POWERUP_TYPES.SPEED_BOOST) {
            player.buffs.speed = until;
        } else if (pu.type === CONSTANTS.POWERUP_TYPES.DAMAGE_BOOST) {
            player.buffs.damage = until;
        }
    }

    performAttack(attacker, type) {
        const isPunch = type === 'punch';
        const range = isPunch ? CONSTANTS.PUNCH_RANGE : CONSTANTS.KICK_RANGE;
        let damage = isPunch ? CONSTANTS.PUNCH_DAMAGE : CONSTANTS.KICK_DAMAGE;

        // Apply Damage Buff
        if (attacker.buffs.damage > 0) {
            damage = Math.floor(damage * 1.5);
        }

        const cooldown = isPunch ? CONSTANTS.PUNCH_COOLDOWN : CONSTANTS.KICK_COOLDOWN;

        attacker[isPunch ? 'punchCooldown' : 'kickCooldown'] = cooldown;
        attacker.action = type;
        attacker.actionTimer = 0.2; // 200ms animation duration

        const attackX = attacker.facing === 'right' ? attacker.x + CONSTANTS.PLAYER_WIDTH : attacker.x - range;
        const attackRect = {
            x: attackX,
            y: attacker.y,
            width: range,
            height: CONSTANTS.PLAYER_HEIGHT
        };

        for (const target of this.players.values()) {
            if (target.id === attacker.id || target.hp <= 0 || target.isWaiting) continue;

            const targetRect = {
                x: target.x,
                y: target.y,
                width: CONSTANTS.PLAYER_WIDTH,
                height: CONSTANTS.PLAYER_HEIGHT
            };

            if (Physics.checkCollision(attackRect, targetRect)) {
                // Ducking mechanic: Crouching players dodge HIGH attacks (Punches)
                if (isPunch && target.isCrouching) {
                    // Miss
                    continue;
                }
                this.applyDamage(target, attacker, damage, isPunch ? 'punch' : 'kick');
            }
        }
    }

    applyDamage(victim, attacker, amount, type) {
        victim.hp -= amount;
        this.io.to(this.roomId).emit('playerHit', { victimId: victim.id, type });

        if (victim.hp <= 0) {
            victim.hp = 0;
            attacker.score += 1;
            setTimeout(() => this.respawnPlayer(victim), CONSTANTS.SPAWN_DELAY);
            this.io.to(this.roomId).emit('playerKO', { victimId: victim.id, attackerId: attacker.id });
        }
    }

    respawnPlayer(player) {
        player.hp = CONSTANTS.PLAYER_HP;
        player.x = Math.random() * (CONSTANTS.ARENA_WIDTH - 100) + 50;
        player.y = 100;
        player.vx = 0;
        player.vy = 0;
        player.action = null;
        player.actionTimer = 0;
        player.isWaiting = false; // Reset waiting status on respawn
        // Reset buffs on death? Let's say yes.
        player.buffs.speed = 0;
        player.buffs.damage = 0;
    }
}
