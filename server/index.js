import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { GameRoom } from './GameRoom.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
    }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces for public access

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));

    app.get(/(.*)/, (req, res) => {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
}

// Simple room management (single room for now)
const defaultRoomId = 'default-room';
const gameRoom = new GameRoom(defaultRoomId, io);

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('joinGame', (username) => {
        console.log(`Player ${socket.id} joining as ${username}`);
        gameRoom.addPlayer(socket, username);
    });

    socket.on('input', (inputs) => {
        gameRoom.handleInput(socket.id, inputs);
    });

    socket.on('togglePause', () => {
        gameRoom.togglePause(socket.id);
    });

    socket.on('requestStartGame', (duration) => {
        gameRoom.requestStartGame(socket.id, duration);
    });


    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        gameRoom.removePlayer(socket.id);
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
