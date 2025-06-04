# Multi-stage build for optimized production image

# Stage 1: Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files from project root
COPY package.json ./
COPY package-lock.json ./
# Debug: List files to ensure package-lock.json is present
RUN ls -la ./

# Install all dependencies (including dev for build process)
RUN npm ci

# Copy all source files
COPY . .

RUN npm run build

# Stage 2: Production stage
FROM nginx:alpine AS production

# Install runtime dependencies for environment variable substitution
RUN apk add --no-cache bash

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