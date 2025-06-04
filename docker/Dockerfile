# Multi-stage build for optimized production image

# Stage 1: Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files from project root
COPY package.json ./
COPY package-lock.json ./

# Install all dependencies (including dev for build process)
RUN npm ci

# Copy all source files
COPY . .

# Ensure the .env.production file is copied and contains the placeholder
COPY docker/.env.production ./

# Build the application
# The VITE_GEMINI_API_KEY_PLACEHOLDER in .env.production will be included in the build
RUN npm run build

# Verify the placeholder exists in built files (for debugging)
RUN echo "Checking if placeholder exists in built files..." && \
    find dist -name "*.js" -exec grep -l "VITE_GEMINI_API_KEY_PLACEHOLDER" {} \; || \
    echo "Warning: Placeholder not found in built files"

# Stage 2: Production stage
FROM nginx:alpine AS production

# Install runtime dependencies for environment variable substitution
RUN apk add --no-cache bash findutils

# Copy custom nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy entrypoint script
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Use entrypoint for runtime configuration
ENTRYPOINT ["/docker-entrypoint.sh"]