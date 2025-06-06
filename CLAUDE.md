# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SIFT-Toolbox is a fact-checking application that implements the SIFT (Stop, Investigate the source, Find better coverage, Trace claims) methodology with AI assistance. It's a full-stack application with a Ruby Sinatra backend and React TypeScript frontend.

## Architecture

### Backend (Ruby/Sinatra)
- **Framework**: Sinatra 3.0 with Puma web server
- **Database**: PostgreSQL with Sequel ORM
- **AI Integration**: Multiple providers via `ruby_llm` gem (OpenAI, Google Gemini, OpenRouter)
- **Real-time Communication**: Server-Sent Events (SSE) for streaming AI responses
- **Configuration**: Environment variables via dotenv, centralized config pattern
- **Image Processing**: Custom ImageHandler for uploaded images

### Frontend (React/TypeScript)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6.2
- **API Communication**: Native fetch with SSE for real-time responses
- **Styling**: CSS-in-JS (no external framework detected)
- **State Management**: React hooks (no external state library)

### Key Services
- **AIService**: Handles streaming chat responses and initial SIFT analysis
- **SiftService**: Implements SIFT methodology processing
- **ImageHandler**: Processes uploaded images for analysis
- **AgentManager**: Manages AI agent configurations and behaviors

## Development Commands

### Frontend (Client)
```bash
cd client

# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# TypeScript checking (via tsconfig strict mode)
npx tsc --noEmit
```

### Backend (Server)
```bash
cd server

# Install dependencies
bundle install

# Database operations
bundle exec rake db:migrate
bundle exec rake db:rollback
bundle exec rake db:status

# Run server (development)
bundle exec ruby app.rb

# Linting
bundle exec rubocop
bundle exec rubocop -a  # Auto-fix issues

# Testing
bundle exec ruby test/services/agent_manager_test.rb  # Run specific test
```

### Docker Operations
```bash
# Development mode (with hot reload)
make dev

# Production build and run
make build
make run

# View logs and access container
make logs
make shell

# Stop and cleanup
make stop
make clean
```

## Key Configuration Files

### Environment Variables Required
- `GEMINI_API_KEY`: Google Gemini API access
- `OPENAI_API_KEY`: OpenAI API access  
- `OPENROUTER_API_KEY`: OpenRouter API access
- `FRONTEND_URL`: CORS configuration (default: http://localhost:5173)
- `DATABASE_URL`: PostgreSQL connection string

### Database Configuration
- Connection managed in `server/config/database.rb`
- Migrations in `server/db/migrate/`
- Uses Sequel ORM with PostgreSQL

### API Routes Structure
- `/api/health` - Health check endpoint
- `/api/sift/initiate` - Start SIFT analysis (supports text and image)
- `/api/sift/chat` - Continue SIFT conversation
- All responses use SSE for real-time streaming

## Testing Infrastructure

### Current State
- **Ruby**: Minitest framework with one test file (`test/services/agent_manager_test.rb`)
- **Frontend**: No testing framework configured
- **RSpec**: Directory structure exists but empty

### Running Tests
```bash
# Ruby backend test
cd server
bundle exec ruby test/services/agent_manager_test.rb
```

## Development Workflow

### Making API Changes
1. Backend changes in `server/app.rb` for routes
2. Service logic in `server/app/services/`
3. Frontend API calls in `client/src/services/apiClient.ts`

### Adding New AI Providers
1. Update `server/app/services/ai_service.rb`
2. Add API keys to environment configuration
3. Update model configuration in frontend

### Database Changes
1. Create migration: `cd server && bundle exec rake db:create_migration NAME=description`
2. Edit migration file in `db/migrate/`
3. Run migration: `bundle exec rake db:migrate`

## Error Handling Patterns

### Backend
- Centralized error handling in `server/app.rb`
- Custom error classes (e.g., `MyCustomError`)
- Structured JSON error responses
- Comprehensive logging with different levels

### Frontend
- Error boundaries for React components
- API error handling in service layer
- User-friendly error messages in UI

## CORS and Security

### CORS Configuration
- Configured in `server/app.rb` using `sinatra-cross_origin`
- Environment-based origin control
- Supports preflight requests

### Security Considerations
- API keys managed via environment variables
- Never hardcode sensitive information
- Use HTTPS in production
- Validate all user inputs

## Deployment

### Docker Deployment
- Multi-stage build in `docker/Dockerfile`
- Production optimized with Nginx
- Environment variable injection
- PostgreSQL service via docker-compose

### Development vs Production
- Development: Hot reload, verbose logging, CORS from localhost
- Production: Optimized builds, log rotation, restricted CORS origins