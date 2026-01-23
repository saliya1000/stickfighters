import { CONSTANTS } from '../shared/constants.js';

export class Bot {
    constructor(id, name, difficulty, room) {
        this.id = id;
        this.name = name; // e.g. "Bot (Easy)"
        this.difficulty = difficulty; // 'easy', 'normal', 'hard'
        this.room = room; // Reference to GameRoom to sense environment

        this.targetId = null;
        this.decisionTimer = 0;

        // Difficulty tunings
        this.reactionTime = this.getReactionTime();
        this.accuracy = this.getAccuracy();
        this.aggressiveness = this.getAggressiveness();

        // Input state to return
        this.inputs = {
            left: false,
            right: false,
            jump: false,
            crouch: false,
            attack1: false,
            attack2: false
        };

        this.jumpCooldown = 0;
    }

    getReactionTime() {
        switch (this.difficulty) {
            case 'hard': return 0.1; // Fast
            case 'normal': return 0.3;
            case 'easy': default: return 0.8; // Slow
        }
    }

    getAccuracy() {
        switch (this.difficulty) {
            case 'hard': return 0.9;
            case 'normal': return 0.7;
            case 'easy': default: return 0.4;
        }
    }

    getAggressiveness() {
        switch (this.difficulty) {
            case 'hard': return 0.9; // Almost always attacks when close
            case 'normal': return 0.6;
            case 'easy': default: return 0.2; // Rarely attacks
        }
    }

    update(dt) {
        // Decrease timers
        if (this.decisionTimer > 0) {
            this.decisionTimer -= dt;
        }
        if (this.jumpCooldown > 0) {
            this.jumpCooldown -= dt;
        }

        // Only make new decisions periodically (reaction time)
        if (this.decisionTimer <= 0) {
            this.makeDecision();
            this.decisionTimer = this.reactionTime + Math.random() * 0.1;
        }

        return this.inputs;
    }

    makeDecision() {
        // Reset inputs
        this.inputs = { left: false, right: false, jump: false, crouch: false, attack1: false, attack2: false };

        // 1. Find Target
        const me = this.room.players.get(this.id);
        if (!me || me.hp <= 0) return;

        let target = null;
        let minDist = Infinity;

        for (const player of this.room.players.values()) {
            if (player.id === this.id || player.hp <= 0 || player.isWaiting) continue;

            const dx = player.x - me.x;
            const dy = player.y - me.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                minDist = dist;
                target = player;
            }
        }

        if (!target) return; // No one to fight

        const dx = target.x - me.x;
        const dy = target.y - me.y; // Positive if target is below, negative if above

        // 2. Horizontal Movement
        // Randomly stop or move away in easy mode?
        if (this.difficulty === 'easy' && Math.random() < 0.2) {
            // Idle or wrong way
            if (Math.random() < 0.5) this.inputs.left = true;
            else this.inputs.right = true;
        } else {
            // Move towards target
            // Keep some distance?
            const idealDist = this.difficulty === 'hard' ? 40 : 60;

            if (Math.abs(dx) > idealDist) {
                if (dx > 0) this.inputs.right = true;
                else this.inputs.left = true;
            }
        }

        // 3. Jumping / Platforms
        // If target is significantly above, try to jump
        if (dy < -50 && me.isGrounded && this.jumpCooldown <= 0) {
            // Only jump if we are hard/normal or randomly in easy
            if (this.difficulty !== 'easy' || Math.random() < 0.3) {
                this.inputs.jump = true;
                this.jumpCooldown = 1.0; // Don't spam jump
            }
        }

        // Jump if stuck (not moving but trying to)
        if (this.difficulty !== 'easy' && (this.inputs.left || this.inputs.right) && Math.abs(me.vx) < 0.1 && me.isGrounded && this.jumpCooldown <= 0) {
            this.inputs.jump = true;
            this.jumpCooldown = 1.0;
        }

        // 4. Attacking
        // Check range
        const range = 100; // Roughly punch/kick range
        if (minDist < range) {
            // Vertical alignment matter? slightly
            if (Math.abs(dy) < 50) {
                // Face him
                const correctFacing = (dx > 0 && me.facing === 'right') || (dx < 0 && me.facing === 'left');

                if (correctFacing || Math.abs(dx) < 20) {
                    if (Math.random() < this.aggressiveness) {
                        if (Math.random() < 0.5) this.inputs.attack1 = true;
                        else this.inputs.attack2 = true;
                    }
                }
            }
        }

        // 5. Hard Mode Specifics
        if (this.difficulty === 'hard') {
            // Dodge: Crouch if target is attacking and facing us
            // This is "Cheat-y" or "High Skill" - reading target action state
            if (target.action === 'punch') {
                // If they are facing us and close
                const targetFacingUs = (target.facing === 'right' && target.x < me.x) || (target.facing === 'left' && target.x > me.x);
                if (targetFacingUs && minDist < 100) {
                    this.inputs.crouch = true;
                }
            }
        }
    }
}
