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
const joinBtn = document.getElementById('join-btn');
const usernameInput = document.getElementById('username');

joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        console.log('Joining as:', username);
        // UI swichting is now handled via callbacks
        game.join(username);
    }
});

// Bind Game callbacks to UI
const startGameBtn = document.getElementById('start-game-btn');
const lobbyStatus = document.getElementById('lobby-status');
const playerList = document.getElementById('player-list');

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
        item.innerText = `${p.name} ${data.hostId === p.id ? '(Host)' : ''}`;
        item.style.color = p.color;
        playerList.appendChild(item);
    });

    // Handle Start Button
    const amHost = game.network.socket.id === data.hostId;
    if (amHost) {
        startGameBtn.classList.remove('hidden');
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
        lobbyStatus.innerText = "Waiting for host to start...";
    }
};

game.onGameStart = () => {
    console.log('Game Starting!');
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    game.isRunning = true;
    game.start();
};

game.onJoinError = (msg) => {
    alert(`Error: ${msg}`);
};

startGameBtn.addEventListener('click', () => {
    game.network.requestStartGame();
});

document.getElementById('lobby-return-btn').addEventListener('click', () => {
    window.location.reload(); // Simple reload to go back to title for now
});
