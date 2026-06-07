FROM node:20-alpine
WORKDIR /app

# Install Chromium and necessary dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Environment variables to configure Playwright for system Chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

# Install dependencies
COPY package.json ./
RUN npm install

# Copy application script
COPY browser.js ./

# Create screenshots directory with correct ownership for non-root user
RUN mkdir -p /screenshots && chown -R node:node /screenshots /app

# Switch to non-root user
USER node

# Default command
CMD ["node", "browser.js"]
