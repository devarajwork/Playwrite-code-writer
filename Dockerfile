# Use Playwright base image with all browsers installed
FROM mcr.microsoft.com/playwright:v1.49.0-noble

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Compile server TypeScript
RUN npm run compile

# Expose the port Render will use (default 10000)
EXPOSE 10000

# Start the server
CMD ["npm", "run", "start"]
