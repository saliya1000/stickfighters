# Deployment Guide for Private VPS

This guide addresses how to deploy the **Stick Rumble** web game to a private Linux VPS using **PM2** for process management.

## Prerequisites

Ensure your VPS has the following installed:
-   **Node.js** (v18 or higher is **REQUIRED**).
    -   *Error `SyntaxError: Unexpected token '.'` means your Node version is too old.*
    -   Check version: `node -v`
    -   **How to Upgrade:**
        ```bash
        # Install NVM (Node Version Manager)
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        source ~/.bashrc
        
        # Install Node 18
        nvm install 18
        nvm use 18
        nvm alias default 18
        ```
-   **npm** (usually comes with Node.js)
-   **Git**

## 1. Clone the Repository

Connect to your VPS via SSH and clone your project:

```bash
git clone <your-repo-url>
cd <project-folder>
```

## 2. Install Dependencies

Install the project dependencies:

```bash
npm install
```

## 3. Environment Configuration

Create a `.env` file based on the example:

```bash
cp .env.example .env
```

Edit the `.env` file to add your production keys (e.g., PostHog API Key):

```bash
nano .env
```

> **Note:** The server defaults to port `3000`. If you need a different port, add `PORT=8080` (or your desired port) to the `.env` file.

## 4. Build the Client

The game uses Vite for the frontend. You must build the client files before starting the server in production mode.

```bash
npm run build
```

This creates a `dist/` folder that the server will serve automatically.

## 5. Deployment with PM2

**PM2** is a production process manager for Node.js. It keeps your app alive forever and reloads it without downtime.

### Install PM2

If you haven't installed PM2 globally yet:

```bash
npm install -g pm2
```

### Start the Application

Start the application using the `npm start` script defined in `package.json`. This script sets `NODE_ENV=production` automatically.

```bash
pm2 start npm --name "stick-rumble" -- run start
```

### Verify Running Status

Check if the app is running:

```bash
pm2 status
```

You should see "stick-rumble" with an "online" status.

### View Logs

To see the server logs (useful for debugging):

```bash
pm2 logs stick-rumble
```

### Configure Startup on Boot

To ensure the game starts automatically if the VPS reboots:

1.  Generate the startup script:

    ```bash
    pm2 startup
    ```

2.  **Copy and paste** the command that PM2 outputs (it will look something like `sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ...`).

3.  Save the current list of processes:

    ```bash
    pm2 save
    ```

## 6. Accessing the Game

By default, the game runs on port `3000`.

-   **Direct Access:** `http://<YOUR_VPS_IP>:3000`
-   Ensure your VPS firewall allows traffic on port 3000 (e.g., `sudo ufw allow 3000`).

## Common PM2 Commands

-   **Restart:** `pm2 restart stick-rumble`
-   **Stop:** `pm2 stop stick-rumble`
-   **Delete:** `pm2 delete stick-rumble`
-   **Monitor:** `pm2 monit`
