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
        this.updateIntervalId = null; // Fallback timer
        this.lastFrameTime = 0; // For smooth FPS calculation
        this.lastFPSUpdateTime = 0; // Track when to update FPS display
    }

    // Event Handlers for UI
    setupUI() {
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

        // Self-correcting fixed timestep loop using requestAnimationFrame
        // This ensures updates happen at 60 FPS even if rendering is slower
        requestAnimationFrame(this.gameLoop.bind(this));

        // Fallback: Use setInterval as backup (will be throttled but helps catch up)
        this.updateIntervalId = setInterval(() => {
            if (this.isRunning) {
                const now = performance.now();
                const timeSinceLastUpdate = now - this.lastUpdateTime;

                // If we're falling behind (more than 2 frames), force an update
                if (timeSinceLastUpdate >= this.targetFrameTime * 2) {
                    this.update(this.fixedDeltaTime);
                    this.lastUpdateTime = now;
                    this.updateCount++;
                }
            }
        }, this.targetFrameTime);
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

        const timerEl = document.getElementById('timer');
        if (state.timer !== undefined && timerEl) {
            const minutes = Math.floor(state.timer / 60).toString().padStart(2, '0');
            const seconds = Math.floor(state.timer % 60).toString().padStart(2, '0');
            timerEl.innerText = `${minutes}:${seconds}`;
        }

        // Update Scoreboard
        const scoreboardEl = document.getElementById('scoreboard');
        if (scoreboardEl && this.players) {
            scoreboardEl.innerHTML = '';
            const sortedPlayers = [...this.players].sort((a, b) => b.score - a.score);
            sortedPlayers.forEach(p => {
                const item = document.createElement('div');
                item.className = 'score-item';
                item.style.color = p.color;
                item.innerText = `${p.name}: ${p.score}`;
                scoreboardEl.appendChild(item);
            });
        }
    }



    onGameStart() {
        // Optional: show "GO!" message
        this.audio.playTone(600, 'sine', 0.5);
        // Clear system messages
        const msgArea = document.getElementById('message-area');
        if (msgArea) msgArea.innerText = '';
    }

    onServerMessage(msg) {
        const msgArea = document.getElementById('message-area');
        if (msgArea) {
            msgArea.innerText = msg;
            // Clear after a few seconds
            setTimeout(() => {
                if (msgArea.innerText === msg) {
                    msgArea.innerText = '';
                }
            }, 5000);
        }
    }

    onGameEnd(data) {
        console.log('Game End Data Received:', data);
        this.isRunning = false;

        // Clean up update interval
        if (this.updateIntervalId) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = null;
        }

        const endScreen = document.getElementById('end-screen');
        const gameScreen = document.getElementById('game-screen');
        const winnerText = document.getElementById('winner-text');

        gameScreen.classList.add('hidden');
        endScreen.classList.remove('hidden');
        winnerText.innerText = `${data.winner} (${data.reason})`;

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
        const pauseMenu = document.getElementById('pause-menu');
        const timerEl = document.getElementById('timer');
        const pauseStatus = document.getElementById('pause-status');

        // Handle both boolean (old) and object (new) payload for backward compatibility/robustness
        const isPaused = typeof data === 'object' ? data.isPaused : data;
        const pauser = typeof data === 'object' ? data.pauser : null;

        if (isPaused) {
            pauseMenu.classList.remove('hidden');
            if (timerEl) timerEl.innerText += " (PAUSED)";
            if (pauseStatus && pauser) {
                pauseStatus.innerText = `Paused by ${pauser}`;
            } else if (pauseStatus) {
                pauseStatus.innerText = '';
            }
        } else {
            pauseMenu.classList.add('hidden');
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

        // Calculate delta time, cap to prevent huge jumps
        let dt = timestamp - this.lastUpdateTime;
        const maxDelta = this.targetFrameTime * 3; // Max 3 frames worth
        if (dt > maxDelta) {
            dt = this.targetFrameTime;
            this.accumulator = 0; // Reset on large gap
        }

        // Fixed timestep accumulator - ensures 60 FPS updates
        this.accumulator += dt;

        // Update at fixed 60 FPS rate (16.67ms per update)
        // Process multiple updates if we're catching up, but limit to prevent blocking
        const maxUpdatesPerFrame = 3;
        let updatesThisFrame = 0;

        while (this.accumulator >= this.fixedDeltaTime && updatesThisFrame < maxUpdatesPerFrame) {
            this.update(this.fixedDeltaTime);
            this.accumulator -= this.fixedDeltaTime;
            this.lastUpdateTime += this.fixedDeltaTime;
            this.updateCount++;
            updatesThisFrame++;
        }

        // Clamp accumulator to prevent infinite catch-up
        if (this.accumulator > this.fixedDeltaTime * maxUpdatesPerFrame) {
            this.accumulator = this.fixedDeltaTime * maxUpdatesPerFrame;
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

        // Update FPS counter display more frequently (every 100ms for smooth updates)
        if (this.lastFPSUpdateTime === 0 || (timestamp - this.lastFPSUpdateTime) >= 100) {
            this.updateFPSCounter();
            this.lastFPSUpdateTime = timestamp;
        }

        // Continue loop
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    update(dt) {
        const inputState = this.input.getState();
        const player = this.players.find(p => p.id === this.localId);

        // Client side sound trigger for jump
        if (player && inputState.jump && player.isGrounded) {
            this.audio.playJump();
        }

        this.network.sendInput(inputState);
    }

    render() {
        this.renderer.renderPlayers(this.players);
        this.renderer.renderPowerups(this.powerups);
    }

    updateFPSCounter() {
        const fpsCounterEl = document.getElementById('fps-counter');
        if (!fpsCounterEl) return;

        // Calculate current FPS from frame count (smoother display)
        const currentRenderFPS = Math.round(this.fps || 60);
        const currentUpdateFPS = Math.round(this.updateFPS || 60);

        // Update text
        fpsCounterEl.textContent = `FPS: ${currentRenderFPS} / ${currentUpdateFPS}`;

        // Update color based on FPS
        fpsCounterEl.classList.remove('low-fps', 'critical-fps');
        if (currentRenderFPS < 30) {
            fpsCounterEl.classList.add('critical-fps');
        } else if (currentRenderFPS < 60) {
            fpsCounterEl.classList.add('low-fps');
        }
    }
}
