# Multi-stage Dockerfile for Express backend

# Stage 1: Build TypeScript application
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency and TypeScript config files
COPY package.json package-lock.json tsconfig.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Transpile TypeScript to JavaScript
RUN npm run build

# Stage 2: Install production dependencies only
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 3: Minimal runner image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user and group
RUN addgroup -S node-group && adduser -S node-user -G node-group

# Copy compiled files and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# Change ownership of the app directory to the non-root user
RUN chown -R node-user:node-group /app

# Switch to the non-root user
USER node-user

EXPOSE 5001
ENV PORT=5001

# Run the compiled server
CMD ["node", "dist/server.js"]
