# Use Playwright base image with all browsers installed
FROM mcr.microsoft.com/playwright:v1.49.0-noble

# Tell the Playwright npm package to use the browsers pre-installed in this Docker image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Set working directory
WORKDIR /app

# Install all dependencies (dev needed for tsc + vite build)
COPY package.json package-lock.json ./
RUN npm ci

# Explicitly install Playwright browsers to ensure version match
RUN npx playwright install chromium --with-deps

# Install TypeScript and Vite globally so they are on PATH
RUN npm install -g typescript vite

# Copy the rest of the source code
COPY . .

# Build Vite client → dist/client/
RUN npx vite build

# Compile server TypeScript → dist/server/
RUN npx tsc

# Expose port (Render sets $PORT automatically)
EXPOSE 10000

# Start the server
CMD ["npm", "run", "start"]
