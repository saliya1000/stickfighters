import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { Physics } from '../../shared/physics.js';
import { CONSTANTS } from '../../shared/constants.js';
import { Network } from './network.js';
import { AudioManager } from './audio.js';

export class Game {
    constructor() {
        this.arena = document.getElementById('game-arena');
        this.renderer = new Renderer(this.arena);
        this.input = new InputHandler();
        this.network = new Network(this);
        this.audio = new AudioManager();
        this.isRunning = false;

        this.players = [];
        this.localId = null;

        // FPS tracking with self-correcting fixed timestep
        this.frameCount = 0;
        this.updateCount = 0;
        this.renderFPSLastTime = performance.now();
        this.updateFPSLastTime = performance.now();
        this.fps = 60; // Render FPS
        this.updateFPS = 60; // Update FPS
        this.minFPS = 60;
        this.targetFrameTime = 1000 / 60; // 16.67ms for 60 FPS
        this.fixedDeltaTime = 16.67; // Fixed 60 FPS timestep in ms
        this.accumulator = 0; // Fixed timestep accumulator
        this.lastUpdateTime = 0; // Last update timestamp
        this.lastFrameTime = 0; // For smooth FPS calculation
        this.lastFPSUpdateTime = 0; // Track when to update FPS display

        // Optimization: Track last states to avoid DOM thrashing
        this.lastScoreStr = '';
        this.lastTimerStr = '';
        this.lastFpsText = '';
        this.lastFpsClasses = { critical: false, low: false };
        this.lastTimerValue = -1; // Cache timer value to avoid recalculating
        this.localPlayer = null; // Cache local player reference
        this.waitingScreenVisible = false; // Cache waiting screen visibility

        // UI Elements Cache - cache all DOM references to avoid per-frame queries
        this.waitingScreen = document.getElementById('waiting-screen');
        this.waitingTimer = document.getElementById('waiting-timer');
        this.timerEl = document.getElementById('timer');
        this.scoreboardEl = document.getElementById('scoreboard');
        this.fpsCounterEl = document.getElementById('fps-counter');
        this.msgArea = document.getElementById('message-area');
        this.pauseMenu = document.getElementById('pause-menu');
        this.pauseStatus = document.getElementById('pause-status');
    }

    // Event Handlers for UI
    setupUI() {
        // Handle tab visibility changes - reset timing when tab regains focus
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isRunning) {
                // Tab regained focus - reset timing to prevent huge delta time
                const now = performance.now();
                this.lastUpdateTime = now;
                this.lastFrameTime = now;
                this.accumulator = 0;
            }
        });

        // Pause/Resume
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isRunning) {
                this.network.togglePause();
            }
        });

        document.getElementById('resume-btn').addEventListener('click', () => {
            this.network.togglePause();
        });

        document.getElementById('game-pause-btn').addEventListener('click', () => {
            this.network.togglePause();
            // Blur the button so Space key (Jump) doesn't re-trigger it
            document.getElementById('game-pause-btn').blur();
        });

        document.getElementById('quit-btn').addEventListener('click', () => {
            window.location.reload();
        });

        const fsBtn = document.getElementById('fullscreen-btn');
        if (fsBtn) {
            fsBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                    });
                } else {
                    document.exitFullscreen();
                }
            });
        }
    }

    start() {
        this.renderer.init();
        this.setupUI();
        this.isRunning = true;
        const now = performance.now();
        this.renderFPSLastTime = now;
        this.updateFPSLastTime = now;
        this.lastUpdateTime = now;
        this.lastFrameTime = 0;
        this.lastFPSUpdateTime = 0;
        this.frameCount = 0;
        this.updateCount = 0;
        this.accumulator = 0;
        this.lastTimerValue = -1;

        // Fixed timestep loop using requestAnimationFrame with accumulator pattern
        // Processes 2 updates per frame when rendering is slow to maintain 60+ FPS updates
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    join(username) {
        this.network.joinGame(username);
        // Do not start until confirmation
    }

    onJoinSuccess() {
        this.isRunning = true;
        this.start();
    }

    onJoinError(msg) {
        alert(msg); // Simple alert for now, or use a callback to UI
    }

    onStateUpdate(state) {
        this.players = state.players;
        this.powerups = state.powerups;

        if (!this.localId && this.network.socket.id) {
            this.localId = this.network.socket.id;
        }

        // Cache local player reference - only find when ID changes or player not found
        // Since server sends new objects each update, we need to find by ID each time
        // But we can optimize by checking if we still have the same ID first
        if (this.localId) {
            // Use for loop instead of find() for better performance
            this.localPlayer = null;
            for (let i = 0; i < this.players.length; i++) {
                if (this.players[i].id === this.localId) {
                    this.localPlayer = this.players[i];
                    break;
                }
            }
        } else {
            this.localPlayer = null;
        }

        if (this.waitingScreen && this.waitingTimer && state.timer !== undefined) {
            const shouldShowWaiting = this.localPlayer && this.localPlayer.isWaiting;
            
            // Only update visibility when it changes
            if (shouldShowWaiting !== this.waitingScreenVisible) {
                if (shouldShowWaiting) {
                    this.waitingScreen.classList.remove('hidden');
                } else {
                    this.waitingScreen.classList.add('hidden');
                }
                this.waitingScreenVisible = shouldShowWaiting;
            }
            
            // Only update timer text if waiting screen is visible
            if (shouldShowWaiting) {
                const minutes = Math.floor(state.timer / 60).toString().padStart(2, '0');
                const seconds = Math.floor(state.timer % 60).toString().padStart(2, '0');
                const timeStr = `${minutes}:${seconds}`;
                if (this.waitingTimer.textContent !== timeStr) {
                    this.waitingTimer.textContent = timeStr;
                }
            }
        }

        if (state.timer !== undefined && this.timerEl) {
            // Only recalculate timer string if timer value actually changed
            const timerValue = Math.floor(state.timer);
            if (timerValue !== this.lastTimerValue) {
                this.lastTimerValue = timerValue;
                const minutes = Math.floor(state.timer / 60).toString().padStart(2, '0');
                const seconds = Math.floor(state.timer % 60).toString().padStart(2, '0');
                const newTimerStr = `${minutes}:${seconds}`;
                // Only update if timer string changed and doesn't contain "(PAUSED)"
                if (this.lastTimerStr !== newTimerStr && !this.timerEl.textContent.includes('(PAUSED)')) {
                    this.timerEl.textContent = newTimerStr;
                    this.lastTimerStr = newTimerStr;
                }
            }
        }

        // Update Scoreboard - Only if scores/names change
        if (this.scoreboardEl && this.players) {
            // Filter out waiting players from scoreboard
            const activePlayers = this.players.filter(p => !p.isWaiting);

            // Create a simple signature of the scoreboard state
            // map players to string "id-score" and sort by score
            // Actually we render sorted by score, so we should check the sorted order signature
            const sortedPlayers = [...activePlayers].sort((a, b) => b.score - a.score);
            const scoreSignature = sortedPlayers.map(p => `${p.id}:${p.score}:${p.name}`).join('|');

            if (this.lastScoreStr !== scoreSignature) {
                // Use DocumentFragment to batch DOM updates and reduce reflows
                const fragment = document.createDocumentFragment();
                sortedPlayers.forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'score-item';
                    item.style.color = p.color;
                    item.textContent = `${p.name}: ${p.score}`;
                    fragment.appendChild(item);
                });
                this.scoreboardEl.innerHTML = '';
                this.scoreboardEl.appendChild(fragment);
                this.lastScoreStr = scoreSignature;
            }
        }
    }



    onGameStart() {
        // Optional: show "GO!" message
        this.audio.playTone(600, 'sine', 0.5);
        // Clear system messages
        if (this.msgArea) this.msgArea.innerText = '';
    }

    onServerMessage(msg) {
        if (this.msgArea) {
            this.msgArea.textContent = msg;
            // Clear after a few seconds
            setTimeout(() => {
                if (this.msgArea && this.msgArea.textContent === msg) {
                    this.msgArea.textContent = '';
                }
            }, 5000);
        }
    }

    onGameEnd(data) {
        console.log('Game End Data Received:', data);
        this.isRunning = false;

        const endScreen = document.getElementById('end-screen');
        const gameScreen = document.getElementById('game-screen');
        const winnerText = document.getElementById('winner-text');

        gameScreen.classList.add('hidden');
        endScreen.classList.remove('hidden');
        winnerText.textContent = `${data.winner} (${data.reason})`;

        const endScores = document.getElementById('end-scores');
        if (endScores && data.scores) {
            endScores.innerHTML = `
                <div class="score-header">
                    <span>Rank</span>
                    <span>Player</span>
                    <span>Score</span>
                </div>
            `;

            data.scores.forEach((p, index) => {
                const item = document.createElement('div');
                item.className = `score-item rank-${index + 1}`;

                const rank = document.createElement('span');
                rank.className = 'rank';
                rank.innerText = `#${index + 1}`;

                const name = document.createElement('span');
                name.className = 'player-name';
                name.innerText = p.name;
                name.style.color = p.color;

                const score = document.createElement('span');
                score.className = 'player-score';
                score.innerText = p.score;

                item.append(rank, name, score);
                endScores.appendChild(item);
            });
        }
    }

    onGamePaused(data) {
        // Handle both boolean (old) and object (new) payload for backward compatibility/robustness
        const isPaused = typeof data === 'object' ? data.isPaused : data;
        const pauser = typeof data === 'object' ? data.pauser : null;

        if (isPaused) {
            if (this.pauseMenu && !this.pauseMenu.classList.contains('hidden')) {
                // Only update if not already visible to avoid unnecessary DOM manipulation
            } else if (this.pauseMenu) {
                this.pauseMenu.classList.remove('hidden');
            }
            
            // Only update timer text if it doesn't already contain "(PAUSED)"
            if (this.timerEl && !this.timerEl.innerText.includes('(PAUSED)')) {
                this.timerEl.innerText += " (PAUSED)";
            }
            
            if (this.pauseStatus) {
                if (pauser) {
                    const newText = `Paused by ${pauser}`;
                    if (this.pauseStatus.innerText !== newText) {
                        this.pauseStatus.innerText = newText;
                    }
                } else {
                    if (this.pauseStatus.innerText !== '') {
                        this.pauseStatus.innerText = '';
                    }
                }
            }
        } else {
            if (this.pauseMenu && !this.pauseMenu.classList.contains('hidden')) {
                this.pauseMenu.classList.add('hidden');
            }
            
            // Remove "(PAUSED)" from timer if present
            if (this.timerEl && this.timerEl.innerText.includes('(PAUSED)')) {
                this.timerEl.innerText = this.timerEl.innerText.replace(' (PAUSED)', '');
            }
        }
    }

    onPlayerHit({ type }) {
        if (type === 'punch') {
            this.audio.playPunch();
        } else {
            this.audio.playKick();
        }
    }

    onPlayerKO() {
        this.audio.playKO();
    }

    gameLoop(timestamp) {
        if (!this.isRunning) {
            requestAnimationFrame(this.gameLoop.bind(this));
            return;
        }

        // Initialize timing
        if (!this.lastUpdateTime) {
            this.lastUpdateTime = timestamp;
        }

        // Calculate delta time, cap to prevent huge jumps (e.g., when tab regains focus)
        let dt = timestamp - this.lastUpdateTime;
        const maxDelta = this.targetFrameTime * 3; // Max 3 frames worth (50ms)
        if (dt > maxDelta) {
            // Large gap detected (tab was hidden, browser throttled, etc.)
            // Reset timing to prevent game state issues
            dt = this.targetFrameTime;
            this.accumulator = 0;
            this.lastUpdateTime = timestamp - this.targetFrameTime; // Set to 1 frame ago
        }

        // Fixed timestep accumulator - processes multiple updates per frame to maintain 60 FPS
        // This is the standard approach: when rendering is slow (37 FPS), we process 2 updates
        // per frame to achieve ~74 FPS updates, maintaining smooth gameplay
        this.accumulator += dt;

        // Process multiple updates per frame (up to 2-3) to catch up to 60 FPS
        // When rendering at 37 FPS: 2 updates/frame = ~74 FPS updates (exceeds 60 FPS target)
        // Capped at 2 updates per frame for slower PC compatibility (prevents overload)
        const maxUpdatesPerFrame = 2;
        let updatesThisFrame = 0;

        while (this.accumulator >= this.fixedDeltaTime && updatesThisFrame < maxUpdatesPerFrame) {
            this.update(this.fixedDeltaTime);
            this.accumulator -= this.fixedDeltaTime;
            this.lastUpdateTime += this.fixedDeltaTime;
            this.updateCount++;
            updatesThisFrame++;
        }

        // Clamp accumulator to prevent infinite catch-up (max 3 frames worth)
        // This prevents lag spikes from accumulating forever while allowing catch-up
        if (this.accumulator > this.fixedDeltaTime * 3) {
            this.accumulator = this.fixedDeltaTime * 3;
        }

        // Render every frame (smooth visuals)
        this.render();
        this.frameCount++;

        // Calculate instant FPS for smoother display (every frame)
        if (this.lastFrameTime > 0) {
            const frameDelta = timestamp - this.lastFrameTime;
            const instantFPS = Math.round(1000 / frameDelta);
            // Smooth the FPS value
            this.fps = Math.round(this.fps * 0.9 + instantFPS * 0.1);
        }
        this.lastFrameTime = timestamp;

        // Track FPS every second for logging
        const fpsElapsed = timestamp - this.renderFPSLastTime;
        if (fpsElapsed >= 1000) {
            const actualFPS = this.frameCount;
            this.frameCount = 0;
            this.renderFPSLastTime = timestamp;

            if (actualFPS < this.minFPS) {
                console.warn(`Render FPS dropped below minimum: ${actualFPS} < ${this.minFPS}`);
            }
        }

        // Track update FPS
        const updateElapsed = timestamp - this.updateFPSLastTime;
        if (updateElapsed >= 1000) {
            this.updateFPS = this.updateCount;
            this.updateCount = 0;
            this.updateFPSLastTime = timestamp;

            if (this.updateFPS < this.minFPS) {
                console.warn(`Update FPS dropped below minimum: ${this.updateFPS} < ${this.minFPS}`);
            }
        }

        // Update FPS counter display every 1 second
        if (this.lastFPSUpdateTime === 0 || (timestamp - this.lastFPSUpdateTime) >= 1000) {
            this.updateFPSCounter();
            this.lastFPSUpdateTime = timestamp;
        }

        // Continue loop
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    update(dt) {
        const inputState = this.input.getState();
        const player = this.localPlayer || this.players.find(p => p.id === this.localId);

        // Client side sound trigger for jump
        if (player && inputState.jump && player.isGrounded) {
            this.audio.playJump();
        }

        // Send input every update (60Hz)
        this.network.sendInput(inputState);
    }

    render() {
        this.renderer.renderPlayers(this.players);
        this.renderer.renderPowerups(this.powerups);
    }

    updateFPSCounter() {
        if (!this.fpsCounterEl) return;

        // Calculate current FPS from frame count (smoother display)
        const currentRenderFPS = Math.round(this.fps || 60);
        const currentUpdateFPS = Math.round(this.updateFPS || 60);

        // Update text only if changed
        const newText = `FPS: ${currentRenderFPS} / ${currentUpdateFPS}`;
        if (this.fpsCounterEl.textContent !== newText) {
            this.fpsCounterEl.textContent = newText;
        }

        // Update color based on FPS - only when state changes
        let shouldAddCritical = currentRenderFPS < 30;
        let shouldAddLow = currentRenderFPS >= 30 && currentRenderFPS < 60;
        let hasCritical = this.fpsCounterEl.classList.contains('critical-fps');
        let hasLow = this.fpsCounterEl.classList.contains('low-fps');

        if (shouldAddCritical && !hasCritical) {
            this.fpsCounterEl.classList.remove('low-fps');
            this.fpsCounterEl.classList.add('critical-fps');
        } else if (shouldAddLow && !hasLow) {
            this.fpsCounterEl.classList.remove('critical-fps');
            this.fpsCounterEl.classList.add('low-fps');
        } else if (!shouldAddCritical && !shouldAddLow && (hasCritical || hasLow)) {
            this.fpsCounterEl.classList.remove('low-fps', 'critical-fps');
        }
    }
}
