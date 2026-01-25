# Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the client (creates dist/ folder)
RUN npm run build

# Production Stage
FROM node:18-alpine

WORKDIR /app

# Copy package.json and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy server code and shared code
COPY server ./server
COPY shared ./shared

# Expose the port (matches server/index.js default)
EXPOSE 3002

# Environment variables
ENV NODE_ENV=production
ENV PORT=3002

# Start the server
CMD ["npm", "start"]
