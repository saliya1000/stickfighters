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

        // Optimizations: Track last states to avoid DOM thrashing
        this.lastUpdateTime = 0; // Last update timestamp
        this.accumulator = 0; // Fixed timestep accumulator
        this.targetFrameTime = 1000 / 60; // 16.67ms for 60 FPS
        this.fixedDeltaTime = 16.67; // Fixed 60 FPS timestep in ms

        // Optimization: Track last states to avoid DOM thrashing
        this.lastScoreStr = '';

        // UI Elements Cache
        this.waitingScreen = document.getElementById('waiting-screen');
        this.waitingTimer = document.getElementById('waiting-timer');
        this.timerEl = document.getElementById('timer');
        this.scoreboardEl = document.getElementById('scoreboard');
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
        this.lastUpdateTime = now;
        this.accumulator = 0;
        this.frameCount = 0;
        this.updateCount = 0;
        this.accumulator = 0;

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

        const localPlayer = this.players.find(p => p.id === this.localId);

        if (this.waitingScreen && this.waitingTimer && state.timer !== undefined) {
            const minutes = Math.floor(state.timer / 60).toString().padStart(2, '0');
            const seconds = Math.floor(state.timer % 60).toString().padStart(2, '0');
            const timeStr = `${minutes}:${seconds}`;

            if (localPlayer && localPlayer.isWaiting) {
                if (this.waitingScreen.classList.contains('hidden')) {
                    this.waitingScreen.classList.remove('hidden');
                }
                this.waitingTimer.textContent = timeStr;
            } else {
                if (!this.waitingScreen.classList.contains('hidden')) {
                    this.waitingScreen.classList.add('hidden');
                }
            }
        }

        if (state.timer !== undefined && this.timerEl) {
            const minutes = Math.floor(state.timer / 60).toString().padStart(2, '0');
            const seconds = Math.floor(state.timer % 60).toString().padStart(2, '0');
            const newTimerStr = `${minutes}:${seconds}`;
            if (this.lastTimerStr !== newTimerStr) {
                this.timerEl.textContent = newTimerStr;
                this.lastTimerStr = newTimerStr;
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
            let scoreSignature = '';
            // Manual loop is faster/allocates less than map().join()
            for (let i = 0; i < sortedPlayers.length; i++) {
                const p = sortedPlayers[i];
                scoreSignature += p.id + p.score + p.name;
            }

            if (this.lastScoreStr !== scoreSignature) {
                this.scoreboardEl.innerHTML = '';

                // Header
                const header = document.createElement('div');
                header.className = 'scoreboard-header';
                header.innerHTML = '<span>Player</span><span>Score</span>';
                this.scoreboardEl.appendChild(header);

                sortedPlayers.forEach((p, index) => {
                    const row = document.createElement('div');
                    row.className = `score-row rank-${index + 1}`;
                    if (p.id === this.localId) row.classList.add('local-player');

                    // Rank
                    const rank = document.createElement('div');
                    rank.className = 'score-rank';
                    rank.innerText = index + 1; // Or use icons 👑 for #1

                    // Avatar
                    const avatar = document.createElement('div');
                    avatar.className = 'score-avatar';
                    avatar.style.backgroundColor = p.color;

                    // Name
                    const name = document.createElement('div');
                    name.className = 'score-name';
                    name.innerText = p.name;

                    // Score
                    const score = document.createElement('div');
                    score.className = 'score-value';
                    score.innerText = p.score;

                    row.append(rank, avatar, name, score);
                    this.scoreboardEl.appendChild(row);
                });
                this.lastScoreStr = scoreSignature;
            }
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
            msgArea.textContent = msg;
            // Clear after a few seconds
            setTimeout(() => {
                if (msgArea.textContent === msg) {
                    msgArea.textContent = '';
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
            // console.log('Updating...'); // Very spammy
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

        // Network Output Optimization: Only send input if changed
        if (this.shouldSendInput(inputState)) {
            // Clone to avoid reference issues
            this.lastSentInput = { ...inputState };
            this.network.sendInput(inputState);
        }
    }

    shouldSendInput(current) {
        if (!this.lastSentInput) return true;
        return current.left !== this.lastSentInput.left ||
            current.right !== this.lastSentInput.right ||
            current.jump !== this.lastSentInput.jump ||
            current.crouch !== this.lastSentInput.crouch ||
            current.attack1 !== this.lastSentInput.attack1 ||
            current.attack2 !== this.lastSentInput.attack2;
    }

    render() {
        this.renderer.renderPlayers(this.players);
        this.renderer.renderPowerups(this.powerups);
    }


}
