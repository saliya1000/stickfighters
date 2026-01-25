import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import 'dotenv/config'; // Load .env
import { GameRoom } from './GameRoom.js';
import { Analytics } from './analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
    }
});

const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces for public access

// Initialize Analytics
Analytics.init(process.env.POSTHOG_API_KEY);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));

    app.get(/(.*)/, (req, res) => {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
}

// Room management
const rooms = new Map(); // code -> GameRoom

// Helper to validate room code
const isValidCode = (code) => /^\d{4}$/.test(code);

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Track which room this socket is in for disconnect handling
    let currentRoomCode = null;

    socket.on('createRoom', ({ username, code }) => {
        // Validation
        if (!username || !username.trim()) {
            socket.emit('joinError', 'Invalid username');
            return;
        }
        if (!code || !isValidCode(code)) {
            socket.emit('joinError', 'Room code must be 4 digits');
            return;
        }
        if (rooms.has(code)) {
            socket.emit('joinError', 'Room code already exists');
            return;
        }
        if (rooms.size >= 4) {
            socket.emit('joinError', 'Server is full (max 4 rooms)');
            return;
        }

        console.log(`Creating room ${code} for ${username}`);

        // Create new room
        const newRoom = new GameRoom(code, io);
        rooms.set(code, newRoom);

        // Add player
        newRoom.addPlayer(socket, username);
        currentRoomCode = code;

        socket.emit('createSuccess', code); // Optional specific event
    });

    socket.on('joinRoom', ({ username, code }) => {
        // Validation
        if (!username || !username.trim()) {
            socket.emit('joinError', 'Invalid username');
            return;
        }
        if (!code) {
            socket.emit('joinError', 'Please enter a room code');
            return;
        }

        const room = rooms.get(code);
        if (!room) {
            socket.emit('joinError', 'Room not found');
            return;
        }

        console.log(`Player ${username} joining room ${code}`);
        room.addPlayer(socket, username);
        currentRoomCode = code;
    });

    socket.on('input', (inputs) => {
        const room = rooms.get(currentRoomCode);
        if (room) {
            room.handleInput(socket.id, inputs);
        }
    });

    socket.on('togglePause', () => {
        const room = rooms.get(currentRoomCode);
        if (room) {
            room.togglePause(socket.id);
        }
    });

    socket.on('requestStartGame', ({ duration, mapId }) => {
        const room = rooms.get(currentRoomCode);
        if (room) {
            room.requestStartGame(socket.id, duration, mapId);
        }
    });

    socket.on('addBot', (difficulty) => {
        const room = rooms.get(currentRoomCode);
        // Only host can add bots? Or anyone? Let's say host for now.
        if (room && room.hostId === socket.id) {
            room.addBot(difficulty);
        }
    });

    socket.on('removeBot', (botId) => {
        const room = rooms.get(currentRoomCode);
        if (room && room.hostId === socket.id) {
            room.removeBot(botId);
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        if (currentRoomCode) {
            const room = rooms.get(currentRoomCode);
            if (room) {
                room.removePlayer(socket.id);
                // Clean up empty rooms
                if (room.players.size === 0) {
                    console.log(`Room ${currentRoomCode} empty, destroying...`);
                    room.endGame('Room closed'); // Ensure loop stops
                    rooms.delete(currentRoomCode);
                }
            }
        }
    });
});

httpServer.listen(PORT, HOST, () => {
    // Get network interfaces to display accessible URLs
    const networkInterfaces = os.networkInterfaces();
    const addresses = [];

    // Collect all IPv4 addresses
    Object.keys(networkInterfaces).forEach((interfaceName) => {
        networkInterfaces[interfaceName].forEach((iface) => {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(`http://${iface.address}:${PORT}`);
            }
        });
    });

    console.log(`\n🚀 Server running!`);
    console.log(`   Local:    http://localhost:${PORT}`);
    if (addresses.length > 0) {
        console.log(`   Network:  ${addresses.join(', ')}`);
    } else {
        console.log(`   Network:  Accessible from any network interface`);
    }
    console.log(`\n   Share one of these URLs with players to join the game!`);
    console.log(`   For public access, use a tunneling service like ngrok:\n`);
    console.log(`   Example: ngrok http ${PORT}\n`);
});
