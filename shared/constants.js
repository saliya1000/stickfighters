export const CONSTANTS = {
    // Arena Dimensions
    ARENA_WIDTH: 1200,
    ARENA_HEIGHT: 600,

    // Physics
    GRAVITY: 0.8,
    FRICTION: 0.82,
    MOVE_ACCEL: 0.8,
    MAX_SPEED: 6,
    JUMP_FORCE: -18,

    // Player
    PLAYER_WIDTH: 40,
    PLAYER_HEIGHT: 80,
    PLAYER_HP: 100,
    SPAWN_DELAY: 2000,

    // Game Duration (seconds)
    GAME_DURATIONS: {
        MIN_3: 180,
        MIN_5: 300,
        MIN_10: 600
    },

    // Combat
    PUNCH_DAMAGE: 10,
    PUNCH_COOLDOWN: 250,
    PUNCH_RANGE: 60,

    KICK_DAMAGE: 15,
    KICK_COOLDOWN: 500,
    KICK_RANGE: 90,

    TICK_RATE: 60, // Server tick rate (60 Hz to match client render rate)

    // Power-Ups
    POWERUP_TYPES: {
        SPEED_BOOST: 'speed_boost',
        DAMAGE_BOOST: 'damage_boost'
    },
    POWERUP_DURATION: 10000, // 10s

    // Platforms (x, y, width, height)
    // y is from top (0)
    PLATFORMS: [
        { x: 300, y: 400, width: 200, height: 20 },
        { x: 700, y: 400, width: 200, height: 20 },
        { x: 500, y: 250, width: 200, height: 20 }
    ],

    POWERUP_SPAWN_INTERVAL_MIN: 15000,
    POWERUP_SPAWN_INTERVAL_MAX: 30000,
    POWERUP_SIZE: 30,

    // Hats
    HATS: {
        NONE: 0,
        COWBOY: 1,
        TOP_HAT: 2,
        VIKING: 3
    }
};
