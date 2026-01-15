import { CONSTANTS } from './constants.js';

export class Physics {
    static applyGravity(entity) {
        entity.vy += CONSTANTS.GRAVITY;
    }

    static applyFriction(entity) {
        entity.vx *= CONSTANTS.FRICTION;
    }

    static moveEntity(entity) {
        entity.x += entity.vx;
        entity.y += entity.vy;
    }

    static constrainToArena(entity) {
        // Floor
        if (entity.y + CONSTANTS.PLAYER_HEIGHT > CONSTANTS.ARENA_HEIGHT) {
            entity.y = CONSTANTS.ARENA_HEIGHT - CONSTANTS.PLAYER_HEIGHT;
            entity.vy = 0;
            entity.isGrounded = true;
        } else {
            entity.isGrounded = false;
        }

        // Walls
        if (entity.x < 0) {
            entity.x = 0;
            entity.vx = 0;
        } else if (entity.x + CONSTANTS.PLAYER_WIDTH > CONSTANTS.ARENA_WIDTH) {
            entity.x = CONSTANTS.ARENA_WIDTH - CONSTANTS.PLAYER_WIDTH;
            entity.vx = 0;
        }
    }

    static checkCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    static checkPlatformCollisions(entity) {
        // Only check if falling
        if (entity.vy < 0) return;

        const feetY = entity.y + CONSTANTS.PLAYER_HEIGHT;
        const prevFeetY = (entity.y - entity.vy) + CONSTANTS.PLAYER_HEIGHT; // Approximate previous position
        // Better: we assume moveEntity has already updated y. 
        // We need to know if we crossed the line this frame.

        for (const plat of CONSTANTS.PLATFORMS) {
            // Horizontal overlap
            if (entity.x + CONSTANTS.PLAYER_WIDTH > plat.x && entity.x < plat.x + plat.width) {
                // Vertical overlap logic for one-way platform
                // Check if feet are currently slightly inside/below the platform top
                // AND previously were above it.
                // Since we don't track prevY explicitly in entity for this, we use the fact that we just moved.
                // But simplified: if feet are within a small threshold of the top and we are falling.

                // If feet are within the platform height range (top to bottom)
                // And we are falling designated by vy >= 0
                // SNAP to top.

                // Effective top of platform
                const platTop = plat.y;

                // Check if feet are "inside" the platform (between top and bottom)
                // But only if we were likely above it before. 
                // Let's use a threshold: if feet are between platTop and platTop + 20 (velocity dependent usually)
                if (feetY >= platTop && feetY <= platTop + plat.height + (entity.vy || 0)) {
                    // Snap
                    entity.y = platTop - CONSTANTS.PLAYER_HEIGHT;
                    entity.vy = 0;
                    entity.isGrounded = true;
                    return; // Landed on one, stop checking
                }
            }
        }
    }
}
