import { CONSTANTS } from '../../shared/constants.js';

export class Renderer {
    constructor(arenaElement) {
        this.arena = arenaElement;
        this.playerElements = new Map();
        this.powerupElements = new Map();
        this.platformsRendered = false;
        // Simple mobile detection for performance optimization
        this.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    }

    init(platforms) {
        // Initial setup - styles will be handled by resize()
        this.arena.style.position = 'absolute';
        this.arena.style.transformOrigin = 'center center';
        this.arena.style.overflow = 'hidden';
        this.arena.style.border = '2px solid #666';

        // Setup resizing
        window.addEventListener('resize', () => this.resize());
        this.resize(); // Initial sizing

        this.renderPlatforms(platforms);
    }

    resize() {
        // Target Aspect Ratio
        const targetRatio = CONSTANTS.ARENA_WIDTH / CONSTANTS.ARENA_HEIGHT;
        const windowRatio = window.innerWidth / window.innerHeight;

        let scale;
        if (windowRatio > targetRatio) {
            // Window is wider - fit to height
            scale = window.innerHeight / CONSTANTS.ARENA_HEIGHT;
        } else {
            // Window is taller - fit to width
            scale = window.innerWidth / CONSTANTS.ARENA_WIDTH;
        }

        // Limit max scale to avoiding pixelation on huge screens?
        // Let's allow full scale for now so it feels immersive
        scale = Math.min(scale, 1);

        // Apply
        this.arena.style.width = `${CONSTANTS.ARENA_WIDTH}px`;
        this.arena.style.height = `${CONSTANTS.ARENA_HEIGHT}px`;
        this.arena.style.left = '50%';
        this.arena.style.top = '50%';
        this.arena.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }

    renderPlatforms(platforms) {
        // Clear existing platforms
        const existing = this.arena.querySelectorAll('.platform');
        existing.forEach(el => el.remove());
        this.platformsRendered = false;

        platforms = platforms || CONSTANTS.MAPS.CLASSIC || [];

        platforms.forEach(p => {
            const el = document.createElement('div');
            el.className = 'platform';
            el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
            el.style.left = '0';
            el.style.top = '0';
            el.style.width = `${p.width}px`;
            el.style.height = `${p.height}px`;
            this.arena.appendChild(el);
        });

        this.platformsRendered = true;
    }

    renderPowerups(powerups) {
        if (!powerups) return;
        const activeIds = new Set(powerups.map(p => p.id));

        // Remove despawned
        for (const [id, element] of this.powerupElements) {
            if (!activeIds.has(id)) {
                element.remove();
                this.powerupElements.delete(id);
            }
        }

        // Add/Update
        powerups.forEach(pu => {
            let el = this.powerupElements.get(pu.id);
            if (!el) {
                el = this.createPowerupElement(pu);
                this.powerupElements.set(pu.id, el);
                this.arena.appendChild(el);
            }
        });
    }

    createPowerupElement(pu) {
        const el = document.createElement('div');
        el.className = 'powerup';
        el.style.width = `${CONSTANTS.POWERUP_SIZE}px`;
        el.style.height = `${CONSTANTS.POWERUP_SIZE}px`;
        el.style.position = 'absolute';
        el.style.transform = `translate3d(${pu.x}px, ${pu.y}px, 0)`;
        el.style.left = '0';
        el.style.top = '0';
        el.style.borderRadius = '50%';
        el.style.boxShadow = '0 0 10px white';
        el.style.contain = 'layout style paint'; // Optimization: hints to browser

        // Color based on type
        if (pu.type === CONSTANTS.POWERUP_TYPES.SPEED_BOOST) {
            el.style.backgroundColor = 'yellow';
            el.innerHTML = '<div style="text-align:center; line-height:30px; font-weight:bold; color:black">S</div>';
        } else {
            el.style.backgroundColor = 'red';
            el.innerHTML = '<div style="text-align:center; line-height:30px; font-weight:bold; color:white">D</div>';
        }

        return el;
    }

    renderPlayers(players) {
        const activeIds = new Set(players.map(p => p.id));
        for (const [id, element] of this.playerElements) {
            if (!activeIds.has(id)) {
                element.remove();
                this.playerElements.delete(id);
            }
        }

        players.forEach(player => {
            let el = this.playerElements.get(player.id);

            if (!el) {
                el = this.createPlayerElement(player);
                this.playerElements.set(player.id, el);
                this.arena.appendChild(el);
            }

            this.updatePlayerTransform(el, player);
        });
    }

    createPlayerElement(player) {
        const el = document.createElement('div');
        el.classList.add('player');
        el.dataset.id = player.id;
        el.style.width = `${CONSTANTS.PLAYER_WIDTH}px`;
        el.style.height = `${CONSTANTS.PLAYER_HEIGHT}px`;
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
        el.style.willChange = 'transform';
        // Optimization: contain layout/paint to reduce reflow impact
        // Removed 'paint' to allow name tag and HP bar to be visible outside element bounds
        el.style.contain = 'layout style';

        // Face (Direction indicator)
        const face = document.createElement('div');
        face.className = 'face';
        el.appendChild(face);

        // Stickman Container
        const stickman = document.createElement('div');
        stickman.className = 'stickman';

        // Head
        const head = document.createElement('div');
        head.className = 'head';
        head.style.borderColor = player.color;

        // Body
        const body = document.createElement('div');
        body.className = 'body';
        body.style.backgroundColor = player.color;

        // Arms
        const armL = document.createElement('div');
        armL.className = 'limb arm arm-left';
        armL.style.backgroundColor = player.color;

        const armR = document.createElement('div');
        armR.className = 'limb arm arm-right';
        armR.style.backgroundColor = player.color;

        // Legs
        const legL = document.createElement('div');
        legL.className = 'limb leg leg-left';
        legL.style.backgroundColor = player.color;

        const legR = document.createElement('div');
        legR.className = 'limb leg leg-right';
        legR.style.backgroundColor = player.color;

        stickman.append(head, body, armL, armR, legL, legR);
        el.appendChild(stickman);

        // Name tag
        const nameTag = document.createElement('div');
        nameTag.textContent = player.name;
        nameTag.className = 'name-tag';
        el.appendChild(nameTag);

        // Health Bar
        const hpBar = document.createElement('div');
        hpBar.className = 'hp-bar';
        hpBar.style.position = 'absolute';
        hpBar.style.top = '-10px';
        hpBar.style.left = '0';
        hpBar.style.width = '100%';
        hpBar.style.height = '4px';
        hpBar.style.backgroundColor = 'red';

        const hpFill = document.createElement('div');
        hpFill.className = 'hp-fill';
        hpFill.style.width = '100%';
        hpFill.style.height = '100%';
        hpFill.style.backgroundColor = '#0f0';
        hpFill.style.transformOrigin = 'left';
        hpFill.style.willChange = 'transform';
        hpBar.appendChild(hpFill);
        el.appendChild(hpBar);

        // Cache references and last state
        el._refs = {
            stickman,
            nameTag,
            hpFill,
        };
        el._state = {
            x: null,
            y: null,
            hp: null,
            facing: null,
            action: null,
            buffs: null
        };

        return el;
    }

    updatePlayerTransform(el, player) {
        const { stickman, nameTag, hpFill } = el._refs;
        const lastState = el._state;

        // Visibility check
        if (player.hp <= 0) {
            if (el.style.display !== 'none') {
                el.style.display = 'none';
            }
            return;
        } else {
            if (el.style.display === 'none') {
                el.style.display = 'block';
            }
        }

        // Position
        const x = player.x || 0;
        const y = player.y || 0;
        if (x !== lastState.x || y !== lastState.y) {
            el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            lastState.x = x;
            lastState.y = y;
        }

        // HP Update
        const hpPercent = Math.max(0, Math.round((player.hp / CONSTANTS.PLAYER_HP) * 100));
        // Update HP bar only if changed
        if (player.hp !== lastState.hp) {
            hpFill.style.transform = `scaleX(${hpPercent / 100})`;

            // Update Name Tag + HP text
            const newText = `${player.name} (${hpPercent}%)`;
            if (nameTag.textContent !== newText) {
                nameTag.textContent = newText;
            }
            lastState.hp = player.hp;
        }



        // Action classes
        if (player.action !== lastState.action) {
            stickman.classList.remove('punching', 'kicking');
            if (player.action === 'punch') {
                stickman.classList.add('punching');
            } else if (player.action === 'kick') {
                stickman.classList.add('kicking');
            }
            lastState.action = player.action;
        }

        // Crouching (Squash animation)
        const isCrouching = player.isCrouching || false;
        if (isCrouching !== lastState.isCrouching || player.facing !== lastState.facing) {
            const scaleX = player.facing === 'left' ? -1 : 1;
            const scaleY = isCrouching ? 0.6 : 1.0;

            stickman.style.transformOrigin = 'bottom center';
            stickman.style.transform = `scale(${scaleX}, ${scaleY})`;

            lastState.isCrouching = isCrouching;
            lastState.facing = player.facing;
        }

        // Visual Buffs - Filter is expensive, only update if buffs changed
        const speedBuff = player.buffs?.speed || 0;
        const damageBuff = player.buffs?.damage || 0;
        const buffsChanged = !lastState.buffs ||
            lastState.buffs.speed !== speedBuff ||
            lastState.buffs.damage !== damageBuff;

        if (buffsChanged) {
            if (this.isMobile) {
                // Optimization: Mobile devices skip expensive drop-shadow filters
                // Could use a simple border or color change instead if critical, 
                // but for now just skipping the glow effect is a huge perf win.
                stickman.style.filter = 'none';
            } else {
                if (speedBuff > 0) {
                    stickman.style.filter = 'drop-shadow(0 0 10px yellow)';
                } else if (damageBuff > 0) {
                    stickman.style.filter = 'drop-shadow(0 0 10px red)';
                } else {
                    stickman.style.filter = 'none';
                }
            }
            lastState.buffs = { speed: speedBuff, damage: damageBuff };
        }
    }
}
