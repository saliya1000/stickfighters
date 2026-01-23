import { io } from "socket.io-client";
import { Game } from './game.js';
import pkg from '../../package.json';

console.log('Client initializing...');

// Basic socket connection test
const socket = io();
const game = new Game();

// Set Version
document.getElementById('game-version').innerText = pkg.version;

socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
});

// Preliminary UI logic
const joinScreen = document.getElementById('join-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const createBtn = document.getElementById('create-room-btn');
const joinBtn = document.getElementById('join-room-btn');
const usernameInput = document.getElementById('username');
const roomCodeInput = document.getElementById('room-code');

const handleJoin = (action) => {
    const username = usernameInput.value.trim();
    const code = roomCodeInput.value.trim();

    if (!username) {
        alert("Please enter a username");
        return;
    }

    if (!code || code.length !== 4 || isNaN(code)) {
        alert("Please enter a valid 4-digit room code");
        return;
    }

    console.log(`${action}ing room ${code} as ${username}`);
    game.join(username, code, action);
};

createBtn.addEventListener('click', () => handleJoin('create'));
joinBtn.addEventListener('click', () => handleJoin('join'));

// Bind Game callbacks to UI
const startGameBtn = document.getElementById('start-game-btn');
const lobbyStatus = document.getElementById('lobby-status');
const playerList = document.getElementById('player-list');
import { CONSTANTS } from '../../shared/constants.js';

// Bind Game callbacks to UI
game.onJoinSuccess = () => {
    joinScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    // We do NOT start the game loop yet
};

game.onLobbyUpdate = (data) => {
    // Render player list
    playerList.innerHTML = '';
    data.players.forEach(p => {
        const item = document.createElement('div');
        item.className = 'player-card';

        const avatar = document.createElement('div');
        avatar.className = 'player-avatar';
        avatar.style.backgroundColor = p.color;
        item.appendChild(avatar);

        const name = document.createElement('div');
        name.className = 'player-name';
        name.innerText = p.name;
        item.appendChild(name);

        if (data.hostId === p.id) {
            const badge = document.createElement('div');
            badge.className = 'host-badge';
            badge.innerText = 'HOST';
            item.appendChild(badge);
        }

        playerList.appendChild(item);
    });

    const amHost = game.network.socket.id === data.hostId;
    const durationSelect = document.getElementById('game-duration');
    const mapSelect = document.getElementById('map-select');
    const controlsLabel = document.querySelector('.lobby-label');
    const botControls = document.getElementById('bot-controls');

    // Add Remove Button for Bots (Only if Host)
    if (amHost) {
        playerList.querySelectorAll('.player-card').forEach((card, index) => {
            const p = data.players[index];
            if (p && p.isBot) {
                const removeBtn = document.createElement('button');
                removeBtn.innerText = '✕';
                removeBtn.style.marginLeft = '10px';
                removeBtn.style.padding = '5px 10px';
                removeBtn.style.backgroundColor = 'red';
                removeBtn.style.color = 'white';
                removeBtn.style.border = 'none';
                removeBtn.style.cursor = 'pointer';
                removeBtn.onclick = () => {
                    game.network.removeBot(p.id);
                };
                card.appendChild(removeBtn);
            }
        });
    }


    if (amHost) {
        startGameBtn.classList.remove('hidden');
        if (durationSelect) durationSelect.style.display = 'inline-block';
        if (mapSelect) mapSelect.style.display = 'inline-block';
        if (controlsLabel) controlsLabel.style.display = 'inline-block';
        if (botControls) botControls.style.display = 'inline-block';

        if (data.canStart) {
            startGameBtn.disabled = false;
            startGameBtn.style.opacity = 1;
            lobbyStatus.innerText = "Ready to start!";
        } else {
            startGameBtn.disabled = true;
            startGameBtn.style.opacity = 0.5;
            lobbyStatus.innerText = "Waiting for more players (2-4 needed)...";
        }
    } else {
        startGameBtn.classList.add('hidden');
        if (durationSelect) durationSelect.style.display = 'none';
        if (mapSelect) mapSelect.style.display = 'none';
        if (controlsLabel) controlsLabel.style.display = 'none';
        if (botControls) botControls.style.display = 'none';
        lobbyStatus.innerText = "Waiting for host to start...";
    }
};

document.getElementById('add-bot-btn').addEventListener('click', () => {
    const difficulty = document.getElementById('bot-difficulty').value;
    game.network.addBot(difficulty);
});

game.onGameStart = (data) => {
    console.log('Game Starting!', data);
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    game.isRunning = true;
    game.start(data?.mapId);
};

game.onJoinError = (msg) => {
    alert(`Error: ${msg}`);
};

startGameBtn.addEventListener('click', () => {
    const duration = parseInt(document.getElementById('game-duration').value);
    const mapId = document.getElementById('map-select').value;
    game.network.requestStartGame(duration, mapId);
});

document.getElementById('lobby-return-btn').addEventListener('click', () => {
    window.location.reload(); // Simple reload to go back to title for now
});

document.getElementById('waiting-leave-btn').addEventListener('click', () => {
    window.location.reload();
});
