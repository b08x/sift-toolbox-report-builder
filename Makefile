# Makefile for Docker operations

.PHONY: help build run stop clean logs dev shell

# Default target
help:
	@echo "Available commands:"
	@echo "  make build    - Build the Docker image"
	@echo "  make run      - Run the container in production mode"
	@echo "  make dev      - Run the container in development mode"
	@echo "  make stop     - Stop all containers"
	@echo "  make clean    - Stop containers and remove images"
	@echo "  make logs     - View container logs"
	@echo "  make shell    - Open a shell in the running container"

# Build the Docker image
build:
	docker-compose -f docker/docker-compose.yml build

# Run in production mode
run:
	docker-compose -f docker/docker-compose.yml up -d

# Run in development mode
dev:
	docker-compose -f docker/docker-compose.yml --profile dev up sift-toolbox-dev

# Stop all containers
stop:
	docker-compose -f docker/docker-compose.yml down

# Clean up containers and images
clean:
	docker-compose -f docker/docker-compose.yml down --rmi all --volumes

# View logs
logs:
	docker-compose -f docker/docker-compose.yml logs -f

# Open shell in running container
shell:
	docker-compose -f docker/docker-compose.yml exec sift-toolbox sh

# Build with specific API key (for CI/CD)
build-with-key:
	@if [ -z "$(GEMINI_API_KEY)" ]; then \
		echo "Error: GEMINI_API_KEY is not set"; \
		exit 1; \
	fi
	docker-compose -f docker/docker-compose.yml build --build-arg GEMINI_API_KEY=$(GEMINI_API_KEY)

# Run production build locally
run-prod-local:
	docker build -f docker/Dockerfile -t sift-toolbox:latest .
	docker run -d -p 3000:80 --name sift-toolbox \
		-e GEMINI_API_KEY=${GEMINI_API_KEY} \
		sift-toolbox:latest

# Health check
health:
	@curl -f http://localhost:3000 || echo "Application is not responding"