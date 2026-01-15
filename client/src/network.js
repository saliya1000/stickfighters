import { io } from "socket.io-client";

export class Network {
    constructor(game) {
        this.game = game;

        // Get server URL from URL parameter, environment variable, or default to current host
        const urlParams = new URLSearchParams(window.location.search);
        const serverUrl = urlParams.get('server') ||
            import.meta.env.VITE_SERVER_URL ||
            window.location.origin;

        // If server URL is provided, use it; otherwise connect to current host
        const socketUrl = serverUrl !== window.location.origin ? serverUrl : '';

        console.log('Connecting to server:', socketUrl || 'current host');
        this.socket = io(socketUrl);
        this.bindEvents();
    }

    bindEvents() {
        this.socket.on('connect', () => {
            console.log('Connected to server with ID:', this.socket.id);
        });

        this.socket.on('joinError', (msg) => {
            if (this.game.onJoinError) this.game.onJoinError(msg);
        });

        this.socket.on('joinSuccess', () => {
            if (this.game.onJoinSuccess) this.game.onJoinSuccess();
        });


        this.socket.on('playerJoined', (player) => {
            console.log('Player joined:', player);
        });

        this.socket.on('lobbyUpdate', (lobbyState) => {
            if (this.game.onLobbyUpdate) this.game.onLobbyUpdate(lobbyState);
        });

        this.socket.on('currentPlayers', (players) => {
            console.log('Received current players:', players);
        });

        this.socket.on('stateUpdate', (state) => {
            this.game.onStateUpdate(state);
        });

        this.socket.on('gameStart', () => {
            console.log('Game Started!');
            if (this.game.onGameStart) this.game.onGameStart();
        });

        this.socket.on('gameEnd', (data) => {
            console.log('Game Ended:', data);
            if (this.game.onGameEnd) this.game.onGameEnd(data);
        });

        this.socket.on('gamePaused', (isPaused) => {
            if (this.game.onGamePaused) this.game.onGamePaused(isPaused);
        });

        this.socket.on('playerHit', (data) => {
            if (this.game.onPlayerHit) this.game.onPlayerHit(data);
        });

        this.socket.on('playerKO', (data) => {
            if (this.game.onPlayerKO) this.game.onPlayerKO(data);
        });

        this.socket.on('serverMessage', (msg) => {
            if (this.game.onServerMessage) this.game.onServerMessage(msg);
        });
    }

    joinGame(username) {
        this.socket.emit('joinGame', username);
    }

    sendInput(inputState) {
        this.socket.emit('input', inputState);
    }

    togglePause() {
        this.socket.emit('togglePause');
    }

    requestStartGame(duration) {
        this.socket.emit('requestStartGame', duration);
    }
}
