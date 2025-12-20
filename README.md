# Stickfighters

A real-time multiplayer 2D fighting game built with modern Web Technologies. Fight your friends in a cyberpunk arena with stick figures!

![Stickfighters Banner](https://via.placeholder.com/800x400?text=Stickfighters+Game)

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

## Controls

| Action | Key(s) |
|--------|--------|
| **Move Left** | `A` or `Left Arrow` |
| **Move Right** | `D` or `Right Arrow` |
| **Jump** | `W`, `Space`, or `Up Arrow` |
| **Punch** | `J` |
| **Kick** | `K` |
| **Pause/Menu** | `ESC` |

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

1. **Development Mode** (Client + Server):
   ```bash
   npm run start
   ```
   This builds the client and starts the server on port 3000.

2. Open your browser to `http://localhost:3000`.
3. Open a second tab to join as another player and fight!

## Architecture

- **Server**: Node.js + Express. Handles game state, physics, and broadcasts updates via Socket.IO.
- **Client**: Vanilla JavaScript + Vite. Renders the game state using DOM manipulation for performance and style.
- **Shared**: `physics` and `constants` modules are shared between client and server to ensure logic consistency.

## License

MIT
