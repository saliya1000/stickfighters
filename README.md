# Stickfighters

A real-time multiplayer 2D fighting game built with modern Web Technologies. Fight your friends in a cyberpunk arena with stick figures!

![Stickfighters Banner](client/public/banner.png)

## Features

- **Real-time Multiplayer**: Built with Socket.IO for low-latency state synchronization.
- **Physics Engine**: Custom AABB physics for movement, gravity, and collisions.
- **Combat System**: 
  - Punch and Kick attacks with cooldowns.
  - Action-based animations (limbs move dynamically).
  - Health and knockback mechanics.
- **Stick Figure Visuals**: Dynamic DOM-based rendering with CSS animations.
- **Audio**: Procedurally synthesized sound effects using the Web Audio API (no assets required).
- **Game Loop**: Server-authoritative logic with client-side interpolation.

## Technology Stack

- **Runtime**: Node.js
- **Backend Framework**: Express
- **Real-time Communication**: Socket.IO
- **Frontend Build Tool**: Vite
- **Frontend Framework**: Vanilla JavaScript (no framework, just DOM manipulation)

## Project Structure

```
├── client/         # Frontend React/Vite application
│   ├── src/        # Game logic, rendering, and network code
│   └── index.html  # Entry point
├── server/         # Backend Node/Express application
│   └── index.js    # Server entry point and Socket.IO handler
├── shared/         # Shared code between client and server (constants, types)
├── scripts/        # Helper scripts for deployment/setup
└── package.json    # Project dependencies and scripts
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://gitea.kood.tech/saliyawijebandara/multi-player.git
   cd multi-player
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Game

You can run the game in different modes depending on your needs.

#### 1. Development Mode (Recommended for Editing)

**Option A: Run Everything (Easiest)**
Start both client and server with a single command:
```bash
npm run dev
```
This will launch the server on port 3000 and the client on port 5173.

**Option B: Manual Setup (For Debugging)**
Run the client and server separately to see distinct logs.

**Terminal 1 (Server):**
```bash
npm run server
```

**Terminal 2 (Client):**
```bash
npm run client
```
Open the URL shown in the terminal (usually `http://localhost:5173`).

#### 2. Production Mode

Build the client and serve it via the Node.js backend.

```bash
# Build the client to the dist/ folder
npm run build

# Start the server (serves the static files from dist/)
npm start
```
Open `http://localhost:3000`.

## Public Access & Multiplayer

To play with friends over the internet, you need to expose your local server.

### Option 1: Using ngrok (Recommended)

1. Install [ngrok](https://ngrok.com/).
2. Start your server (Development or Production mode).
3. Run ngrok to tunnel port 3000:
   ```bash
   ngrok http 3000
   ```
4. Share the `https://...ngrok.io` URL with your friends.

**Note for Development Mode:**
If you are running `npm run dev` (Vertex/Client on 5173) but your backend is on 3000, you generally want to expose the **backend** (port 3000) and have players connect to that. If you are serving the built client (Production Mode), exposing port 3000 is enough.

If you are developing and want to use a remote backend with a local client:
```bash
VITE_SERVER_URL=https://your-ngrok-url.ngrok.io npm run dev
```

### Option 2: Setup Script

We provide a helper script to guide you through public access setup:
```bash
./scripts/setup-public-access.sh
```

### Option 3: Local Network (LAN)

If you are on the same Wi-Fi, you can connect using your machine's local IP address (e.g., `192.168.1.x`).
The server console output will list available network addresses when you run `npm start` or `npm run server`.

## Controls

| Action | Key(s) |
|--------|--------|
| **Move Left** | `A` or `Left Arrow` |
| **Move Right** | `D` or `Right Arrow` |
| **Jump** | `W`, `Space`, or `Up Arrow` |
| **Crouch** | `S` or `Down Arrow` |
| **Punch** | `J` |
| **Kick** | `K` |
| **Pause/Menu** | `ESC` |

## License

MIT
